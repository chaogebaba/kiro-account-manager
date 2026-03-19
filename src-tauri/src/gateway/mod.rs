use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Json, Response},
    routing::{get, post},
    Router,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    net::SocketAddr,
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};
use tauri::{AppHandle, Manager};
use tokio::{
    net::TcpListener,
    sync::{oneshot, Mutex as AsyncMutex},
    task::JoinHandle,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_host")]
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default)]
    pub access_token: Option<String>,
    #[serde(default = "default_region")]
    pub region: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayStatus {
    pub running: bool,
    pub host: String,
    pub port: u16,
    pub request_count: u64,
    pub last_error: Option<String>,
}

#[derive(Debug)]
pub struct GatewayRuntime {
    pub config: GatewayConfig,
    pub request_count: Arc<AtomicU64>,
    pub last_error: Arc<AsyncMutex<Option<String>>>,
    shutdown_tx: Option<oneshot::Sender<()>>,
    server_task: Option<JoinHandle<()>>,
}

#[derive(Clone)]
struct RouterState {
    config: GatewayConfig,
    request_count: Arc<AtomicU64>,
    last_error: Arc<AsyncMutex<Option<String>>>,
    http: Client,
}

#[derive(Debug, Clone, Copy)]
enum ResponseFormat {
    Anthropic,
    OpenAi,
}

const CONFIG_DIR: &str = ".kiro-account-manager";
const CONFIG_FILE: &str = "gateway-config.json";

fn default_host() -> String {
    "127.0.0.1".to_string()
}

fn default_port() -> u16 {
    8765
}

fn default_region() -> String {
    "us-east-1".to_string()
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            host: default_host(),
            port: default_port(),
            access_token: None,
            region: default_region(),
        }
    }
}

impl GatewayStatus {
    pub fn stopped(config: &GatewayConfig) -> Self {
        Self {
            running: false,
            host: config.host.clone(),
            port: config.port,
            request_count: 0,
            last_error: None,
        }
    }
}

fn ensure_config_valid(config: &GatewayConfig) -> Result<(), String> {
    if config.host.trim().is_empty() {
        return Err("监听地址不能为空".to_string());
    }
    if config.port == 0 {
        return Err("端口必须大于 0".to_string());
    }
    if config.region.trim().is_empty() {
        return Err("region 不能为空".to_string());
    }
    Ok(())
}

fn config_path() -> Result<PathBuf, String> {
    let data_dir = dirs::data_local_dir().ok_or_else(|| "无法定位 app data 目录".to_string())?;

    let dir = data_dir.join(CONFIG_DIR);
    fs::create_dir_all(&dir).map_err(|e| format!("创建配置目录失败: {e}"))?;
    Ok(dir.join(CONFIG_FILE))
}

pub fn load_gateway_config() -> Result<GatewayConfig, String> {
    let path = config_path()?;
    if !path.exists() {
        return Ok(GatewayConfig::default());
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("读取配置失败: {e}"))?;
    let cfg = serde_json::from_str::<GatewayConfig>(&content)
        .map_err(|e| format!("解析配置失败: {e}"))?;
    Ok(cfg)
}

pub fn get_gateway_config() -> Result<GatewayConfig, String> {
    load_gateway_config()
}

pub fn save_gateway_config(config: &GatewayConfig) -> Result<(), String> {
    ensure_config_valid(config)?;
    let path = config_path()?;
    let content = serde_json::to_string_pretty(config).map_err(|e| format!("序列化配置失败: {e}"))?;
    fs::write(path, content).map_err(|e| format!("写入配置失败: {e}"))
}

pub async fn start_gateway(
    state: &tauri::State<'_, crate::state::AppState>,
    config: GatewayConfig,
) -> Result<GatewayStatus, String> {
    ensure_config_valid(&config)?;

    let existing = {
        let mut guard = state
            .gateway
            .lock()
            .map_err(|_| "获取 gateway 状态失败".to_string())?;
        guard.take()
    };

    if let Some(mut rt) = existing {
        stop_runtime(&mut rt).await;
    }

    let runtime = spawn_runtime(config.clone()).await?;
    let status = GatewayStatus {
        running: true,
        host: config.host.clone(),
        port: config.port,
        request_count: 0,
        last_error: None,
    };

    let mut guard = state
        .gateway
        .lock()
        .map_err(|_| "获取 gateway 状态失败".to_string())?;
    *guard = Some(runtime);

    Ok(status)
}

pub async fn stop_gateway(state: &tauri::State<'_, crate::state::AppState>) -> Result<(), String> {
    let existing = {
        let mut guard = state
            .gateway
            .lock()
            .map_err(|_| "获取 gateway 状态失败".to_string())?;
        guard.take()
    };

    if let Some(mut rt) = existing {
        stop_runtime(&mut rt).await;
    }

    Ok(())
}

pub async fn get_gateway_status(
    state: &tauri::State<'_, crate::state::AppState>,
) -> Result<GatewayStatus, String> {
    let snapshot = {
        let guard = state
            .gateway
            .lock()
            .map_err(|_| "获取 gateway 状态失败".to_string())?;

        guard.as_ref().map(|rt| {
            (
                rt.config.clone(),
                rt.request_count.load(Ordering::Relaxed),
                rt.last_error.clone(),
                rt.server_task.is_some(),
            )
        })
    };

    if let Some((config, request_count, last_error, running)) = snapshot {
        let last_error_text = last_error.lock().await.clone();
        Ok(GatewayStatus {
            running,
            host: config.host,
            port: config.port,
            request_count,
            last_error: last_error_text,
        })
    } else {
        let cfg = load_gateway_config().unwrap_or_default();
        Ok(GatewayStatus::stopped(&cfg))
    }
}

fn router(state: RouterState) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/v1/models", get(models_handler))
        .route("/v1/messages", post(messages_handler))
        .route("/v1/messages/count_tokens", post(count_tokens_handler))
        .route("/v1/chat/completions", post(chat_completions_handler))
        .with_state(state)
}

async fn spawn_runtime(config: GatewayConfig) -> Result<GatewayRuntime, String> {
    ensure_config_valid(&config)?;

    let request_count = Arc::new(AtomicU64::new(0));
    let last_error = Arc::new(AsyncMutex::new(None));

    let http = Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("初始化 HTTP 客户端失败: {e}"))?;

    let state = RouterState {
        config: config.clone(),
        request_count: request_count.clone(),
        last_error: last_error.clone(),
        http,
    };

    let app = router(state);
    let addr: SocketAddr = format!("{}:{}", config.host, config.port)
        .parse()
        .map_err(|e| format!("监听地址无效: {e}"))?;

    let listener = TcpListener::bind(addr)
        .await
        .map_err(|e| format!("绑定端口失败: {e}"))?;

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    let server = axum::serve(listener, app.into_make_service()).with_graceful_shutdown(async {
        let _ = shutdown_rx.await;
    });

    let server_task = tokio::spawn(async move {
        if let Err(e) = server.await {
            eprintln!("gateway server error: {e}");
        }
    });

    Ok(GatewayRuntime {
        config,
        request_count,
        last_error,
        shutdown_tx: Some(shutdown_tx),
        server_task: Some(server_task),
    })
}

async fn stop_runtime(runtime: &mut GatewayRuntime) {
    if let Some(tx) = runtime.shutdown_tx.take() {
        let _ = tx.send(());
    }
    if let Some(task) = runtime.server_task.take() {
        let _ = task.await;
    }
}

pub async fn auto_start_if_enabled(app: &AppHandle) -> Result<(), String> {
    let cfg = load_gateway_config()?;
    if !cfg.enabled {
        return Ok(());
    }

    let state = app.state::<crate::state::AppState>();
    let _ = start_gateway(&state, cfg).await?;
    Ok(())
}

async fn health_handler() -> impl IntoResponse {
    Json(json!({ "ok": true }))
}

async fn models_handler() -> impl IntoResponse {
    Json(json!({
        "object": "list",
        "data": [
            {
                "id": "claude-3-5-sonnet",
                "object": "model",
                "owned_by": "kiro"
            },
            {
                "id": "claude-3-7-sonnet",
                "object": "model",
                "owned_by": "kiro"
            }
        ]
    }))
}

async fn count_tokens_handler(Json(payload): Json<Value>) -> impl IntoResponse {
    let messages = payload
        .get("messages")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let mut chars = 0usize;
    for msg in messages {
        let c = msg
            .get("content")
            .and_then(Value::as_str)
            .unwrap_or_default();
        chars += c.chars().count();
    }

    Json(json!({ "input_tokens": (chars / 4).max(1) }))
}

async fn messages_handler(
    State(state): State<RouterState>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    proxy_handler(state, headers, payload, ResponseFormat::Anthropic).await
}

async fn chat_completions_handler(
    State(state): State<RouterState>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    proxy_handler(state, headers, payload, ResponseFormat::OpenAi).await
}

fn extract_text_content(content: Option<&Value>) -> String {
    match content {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Array(arr)) => arr
            .iter()
            .filter_map(|v| {
                if v.get("type").and_then(Value::as_str) == Some("text") {
                    v.get("text").and_then(Value::as_str).map(str::to_string)
                } else {
                    None
                }
            })
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    }
}

async fn proxy_handler(
    state: RouterState,
    headers: HeaderMap,
    payload: Value,
    format: ResponseFormat,
) -> Response {
    state.request_count.fetch_add(1, Ordering::Relaxed);

    if let Some(token) = state.config.access_token.as_ref().filter(|t| !t.trim().is_empty()) {
        match headers.get("authorization").and_then(|h| h.to_str().ok()) {
            Some(v) if v == format!("Bearer {token}") => {}
            _ => {
                return (StatusCode::UNAUTHORIZED, Json(json!({ "error": "unauthorized" })))
                    .into_response();
            }
        }
    }

    let local_token = match crate::kiro::get_kiro_local_token().await {
        Some(v) => v,
        None => {
            let msg = "未找到 Kiro 本地 token，请先在 Kiro IDE 登录".to_string();
            *state.last_error.lock().await = Some(msg.clone());
            return (StatusCode::UNAUTHORIZED, Json(json!({ "error": msg }))).into_response();
        }
    };

    let access_token = match local_token.access_token {
        Some(v) if !v.trim().is_empty() => v,
        _ => {
            let msg = "Kiro 本地 token 缺少 accessToken".to_string();
            *state.last_error.lock().await = Some(msg.clone());
            return (StatusCode::UNAUTHORIZED, Json(json!({ "error": msg }))).into_response();
        }
    };

    let upstream_url = format!(
        "https://q.{}.amazonaws.com/generateAssistantResponse",
        state.config.region
    );

    let upstream_payload = build_codewhisperer_payload(&payload, &local_token.profile_arn);

    let req = state
        .http
        .post(upstream_url)
        .header("Authorization", format!("Bearer {access_token}"))
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&upstream_payload);

    let upstream_resp = match req.send().await {
        Ok(v) => v,
        Err(e) => {
            let msg = format!("上游请求失败: {e}");
            *state.last_error.lock().await = Some(msg.clone());
            return (StatusCode::BAD_GATEWAY, Json(json!({ "error": msg }))).into_response();
        }
    };

    let status = upstream_resp.status();
    let body_text = match upstream_resp.text().await {
        Ok(v) => v,
        Err(e) => {
            let msg = format!("读取上游响应失败: {e}");
            *state.last_error.lock().await = Some(msg.clone());
            return (StatusCode::BAD_GATEWAY, Json(json!({ "error": msg }))).into_response();
        }
    };

    if !status.is_success() {
        *state.last_error.lock().await = Some(format!("上游错误 {}: {}", status, body_text));
        return (StatusCode::BAD_GATEWAY, Json(json!({ "error": body_text }))).into_response();
    }

    let text = extract_response_text(&body_text);

    match format {
        ResponseFormat::Anthropic => {
            let response = json!({
                "id": format!("msg_{}", short_uuid()),
                "type": "message",
                "role": "assistant",
                "model": "claude-3-5-sonnet",
                "content": [
                    {
                        "type": "text",
                        "text": text
                    }
                ],
                "stop_reason": "end_turn",
                "stop_sequence": Value::Null,
                "usage": {
                    "input_tokens": 0,
                    "output_tokens": estimate_tokens(&text)
                }
            });
            Json(response).into_response()
        }
        ResponseFormat::OpenAi => {
            let response = json!({
                "id": format!("chatcmpl-{}", short_uuid()),
                "object": "chat.completion",
                "created": chrono::Utc::now().timestamp(),
                "model": "claude-3-5-sonnet",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": text
                        },
                        "finish_reason": "stop"
                    }
                ],
                "usage": {
                    "prompt_tokens": 0,
                    "completion_tokens": estimate_tokens(&text),
                    "total_tokens": estimate_tokens(&text)
                }
            });
            Json(response).into_response()
        }
    }
}

fn build_codewhisperer_payload(payload: &Value, profile_arn: &Option<String>) -> Value {
    let model = payload
        .get("model")
        .and_then(Value::as_str)
        .unwrap_or("claude-3-5-sonnet");

    if payload.get("messages").is_some() {
        let messages = payload
            .get("messages")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        let mut history = Vec::<Value>::new();
        let mut current = String::new();

        for (idx, msg) in messages.iter().enumerate() {
            let role = msg.get("role").and_then(Value::as_str).unwrap_or("user");
            let content = extract_text_content(msg.get("content"));

            if idx + 1 == messages.len() && role == "user" {
                current = content;
            } else {
                history.push(json!({
                    "role": role,
                    "content": content
                }));
            }
        }

        json!({
            "model": model,
            "profileArn": profile_arn,
            "conversationState": {
                "chatTriggerType": "MANUAL",
                "history": history,
                "currentMessage": {
                    "userInputMessage": {
                        "content": current
                    }
                }
            }
        })
    } else {
        let messages = payload
            .get("messages")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        let mut history = Vec::<Value>::new();
        let mut current = String::new();

        for (idx, msg) in messages.iter().enumerate() {
            let role = msg.get("role").and_then(Value::as_str).unwrap_or("user");
            let content = msg
                .get("content")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();

            if idx + 1 == messages.len() && role == "user" {
                current = content;
            } else {
                history.push(json!({
                    "role": role,
                    "content": content
                }));
            }
        }

        json!({
            "model": model,
            "profileArn": profile_arn,
            "conversationState": {
                "chatTriggerType": "MANUAL",
                "history": history,
                "currentMessage": {
                    "userInputMessage": {
                        "content": current
                    }
                }
            }
        })
    }
}

fn extract_response_text(raw: &str) -> String {
    if raw.trim().is_empty() {
        return String::new();
    }

    if let Ok(v) = serde_json::from_str::<Value>(raw) {
        if let Some(s) = v
            .get("assistantResponse")
            .and_then(|x| x.get("content"))
            .and_then(Value::as_str)
        {
            return s.to_string();
        }

        if let Some(s) = v
            .get("content")
            .and_then(Value::as_str)
        {
            return s.to_string();
        }

        if let Some(arr) = v.get("content").and_then(Value::as_array) {
            let text = arr
                .iter()
                .filter_map(|b| {
                    if b.get("type").and_then(Value::as_str) == Some("text") {
                        b.get("text").and_then(Value::as_str).map(str::to_string)
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
                .join("\n");
            if !text.is_empty() {
                return text;
            }
        }
    }

    raw.to_string()
}

fn estimate_tokens(text: &str) -> usize {
    (text.chars().count() / 4).max(1)
}

fn short_uuid() -> String {
    uuid::Uuid::new_v4().to_string().replace('-', "")
}

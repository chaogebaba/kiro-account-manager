use axum::{
    body::{Body, Bytes},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Json, Response},
};
use futures_util::StreamExt;
use rand::{seq::SliceRandom, thread_rng};
use regex::Regex;
use reqwest::Client;
use serde_json::{json, Value};
use std::{collections::HashMap, convert::Infallible, net::{IpAddr, SocketAddr}};
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use url::Url;

use crate::{
    account::{Account, AccountStore},
    commands::common::{calc_expires_at, calc_status, get_usage_by_provider, refresh_token_by_provider, RefreshResult},
    kiro::KiroLocalToken,
};

use super::{
    converter::{build_kiro_payload, get_available_models, normalize_anthropic_request, normalize_responses_request},
    models::{AnthropicContentBlock, AnthropicMessagesRequest, AnthropicMessagesResponse, AnthropicUsage, NormalizedMessage, ToolCall, ToolCallFunction, WebSearchToolOptions, NormalizedRequest},
    stream::{self, aggregate_kiro_response, extract_json, parse_kiro_event_full, KiroEvent},
    thinking_parser::{SegmentType, ThinkingParser},
    GatewayConfig, ResponseFormat, RouterState, DEFAULT_AGENT_MODE,
};

#[derive(Debug, Clone)]
struct UpstreamCredentials {
    access_token: String,
    profile_arn: Option<String>,
    region: String,
}

#[derive(Debug, Clone, PartialEq)]
struct ServerToolCall {
    id: String,
    name: String,
    input: Value,
    result_content: Value,
    tool_result_text: String,
}

#[derive(Debug, Clone)]
struct ProxyExecutionOutcome {
    aggregated: stream::AggregatedKiroResponse,
    server_tool_calls: Vec<ServerToolCall>,
}

pub async fn models_handler() -> impl IntoResponse {
    Json(json!({
        "object": "list",
        "data": get_available_models(),
    }))
}

pub async fn count_tokens_handler(payload: Value) -> impl IntoResponse {
    let mut chars = 0usize;
    if let Some(messages) = payload.get("messages").and_then(Value::as_array) {
        for message in messages {
            chars += extract_plain_text(message.get("content")).chars().count();
        }
    }
    if let Some(input) = payload.get("input") {
        chars += extract_plain_text(Some(input)).chars().count();
    }
    Json(json!({ "input_tokens": (chars / 4).max(1) }))
}

pub async fn proxy_handler(
    state: RouterState,
    client_addr: SocketAddr,
    headers: HeaderMap,
    payload: Value,
    format: ResponseFormat,
) -> Response {
    let request_index = state.request_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

    if state.config.local_only && !client_addr.ip().is_loopback() {
        let message = format!("已拒绝来自非本机地址的访问: {}", client_addr.ip());
        *state.last_error.lock().await = Some(message.clone());
        return gateway_error_response(format, StatusCode::FORBIDDEN, "permission_error", &message);
    }
    if !state.config.local_only
        && !state.config.allowed_ips.is_empty()
        && !ip_matches_allowlist(client_addr.ip(), &state.config.allowed_ips)
    {
        let message = format!("访问地址 {} 不在网关白名单中", client_addr.ip());
        *state.last_error.lock().await = Some(message.clone());
        return gateway_error_response(format, StatusCode::FORBIDDEN, "permission_error", &message);
    }

    if let Err(message) = verify_client_auth(&headers, &state.config) {
        let sanitized = sanitize_error(&message);
        *state.last_error.lock().await = Some(sanitized.clone());
        return gateway_error_response(format, StatusCode::UNAUTHORIZED, "authentication_error", &sanitized);
    }

    let request = match normalize_request(format, &payload) {
        Ok(request) => request,
        Err(message) => {
            let sanitized = sanitize_error(&message);
            *state.last_error.lock().await = Some(sanitized.clone());
            return gateway_error_response(format, StatusCode::BAD_REQUEST, "invalid_request_error", &sanitized);
        }
    };

    let upstream = match resolve_upstream_credentials(&state.config, request_index).await {
        Ok(creds) => creds,
        Err(message) => {
            let sanitized = sanitize_error(&message);
            *state.last_error.lock().await = Some(sanitized.clone());
            return gateway_error_response(format, StatusCode::UNAUTHORIZED, "authentication_error", &sanitized);
        }
    };

    if has_server_web_search_tool(&request) {
        let outcome = match execute_request_with_server_tools(&state, &upstream, &request).await {
            Ok(outcome) => outcome,
            Err((status, error_type, message)) => {
                *state.last_error.lock().await = Some(message.clone());
                return gateway_error_response(format, status, error_type, &message);
            }
        };

        if request.stream {
            return stream_completed_response(format, request.model, outcome);
        }

        let response = match format {
            ResponseFormat::Anthropic => build_anthropic_response(
                &request.model,
                &outcome.aggregated,
                &outcome.server_tool_calls,
            ),
            ResponseFormat::OpenAi => build_openai_response(&request.model, &outcome.aggregated),
            ResponseFormat::Responses => build_responses_response(&request.model, &outcome.aggregated),
        };
        return Json(response).into_response();
    }

    let upstream_payload = match build_kiro_payload(&request, upstream.profile_arn.clone()) {
        Ok(payload) => payload,
        Err(message) => {
            let sanitized = sanitize_error(&message);
            *state.last_error.lock().await = Some(sanitized.clone());
            return gateway_error_response(format, StatusCode::BAD_REQUEST, "invalid_request_error", &sanitized);
        }
    };

    let upstream_resp = match send_generate_request(&state.http, &upstream, &upstream_payload).await {
        Ok(resp) => resp,
        Err((status, error_type, message)) => {
            *state.last_error.lock().await = Some(message.clone());
            return gateway_error_response(format, status, error_type, &message);
        }
    };

    if request.stream {
        return stream_proxy_response(upstream_resp, format, request.model);
    }

    let body = match upstream_resp.text().await {
        Ok(body) => body,
        Err(error) => {
            let message = sanitize_error(&format!("读取上游响应失败: {error}"));
            *state.last_error.lock().await = Some(message.clone());
            return gateway_error_response(format, StatusCode::BAD_GATEWAY, "api_error", &message);
        }
    };
    let aggregated = aggregate_kiro_response(&body);
    let response = match format {
        ResponseFormat::Anthropic => build_anthropic_response(&request.model, &aggregated, &[]),
        ResponseFormat::OpenAi => build_openai_response(&request.model, &aggregated),
        ResponseFormat::Responses => build_responses_response(&request.model, &aggregated),
    };
    Json(response).into_response()
}

pub async fn mcp_proxy_handler(
    state: RouterState,
    client_addr: SocketAddr,
    headers: HeaderMap,
    payload: Value,
) -> Response {
    state.request_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

    if state.config.local_only && !client_addr.ip().is_loopback() {
        let message = format!("已拒绝来自非本机地址的 MCP 访问: {}", client_addr.ip());
        *state.last_error.lock().await = Some(message.clone());
        return gateway_error_response(
            ResponseFormat::Responses,
            StatusCode::FORBIDDEN,
            "permission_error",
            &message,
        );
    }
    if !state.config.local_only
        && !state.config.allowed_ips.is_empty()
        && !ip_matches_allowlist(client_addr.ip(), &state.config.allowed_ips)
    {
        let message = format!("MCP 访问地址 {} 不在网关白名单中", client_addr.ip());
        *state.last_error.lock().await = Some(message.clone());
        return gateway_error_response(
            ResponseFormat::Responses,
            StatusCode::FORBIDDEN,
            "permission_error",
            &message,
        );
    }
    if let Err(message) = verify_client_auth(&headers, &state.config) {
        let sanitized = sanitize_error(&message);
        *state.last_error.lock().await = Some(sanitized.clone());
        return gateway_error_response(
            ResponseFormat::Responses,
            StatusCode::UNAUTHORIZED,
            "authentication_error",
            &sanitized,
        );
    }

    let upstream = match resolve_upstream_credentials(&state.config, 0).await {
        Ok(creds) => creds,
        Err(message) => {
            let sanitized = sanitize_error(&message);
            *state.last_error.lock().await = Some(sanitized.clone());
            return gateway_error_response(
                ResponseFormat::Responses,
                StatusCode::UNAUTHORIZED,
                "authentication_error",
                &sanitized,
            );
        }
    };

    let upstream_url = format!("https://q.{}.amazonaws.com/mcp", upstream.region);
    let upstream_resp = match state
        .http
        .post(upstream_url)
        .header("Authorization", format!("Bearer {}", upstream.access_token))
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&payload)
        .send()
        .await
    {
        Ok(resp) => resp,
        Err(error) => {
            let message = sanitize_error(&format!("MCP 上游请求失败: {error}"));
            *state.last_error.lock().await = Some(message.clone());
            return gateway_error_response(
                ResponseFormat::Responses,
                StatusCode::BAD_GATEWAY,
                "api_error",
                &message,
            );
        }
    };

    let status = upstream_resp.status();
    let content_type = upstream_resp.headers().get(header::CONTENT_TYPE).cloned();
    let body = match upstream_resp.bytes().await {
        Ok(body) => body,
        Err(error) => {
            let message = sanitize_error(&format!("读取 MCP 上游响应失败: {error}"));
            *state.last_error.lock().await = Some(message.clone());
            return gateway_error_response(
                ResponseFormat::Responses,
                StatusCode::BAD_GATEWAY,
                "api_error",
                &message,
            );
        }
    };

    if !status.is_success() {
        let body_text = String::from_utf8_lossy(&body).to_string();
        let (mapped_status, error_type, message) = map_upstream_error(status, &body_text);
        *state.last_error.lock().await = Some(message.clone());
        return gateway_error_response(ResponseFormat::Responses, mapped_status, error_type, &message);
    }

    let mut builder = Response::builder().status(status);
    if let Some(value) = content_type {
        builder = builder.header(header::CONTENT_TYPE, value);
    } else {
        builder = builder.header(header::CONTENT_TYPE, HeaderValue::from_static("application/json"));
    }

    builder
        .body(Body::from(body))
        .unwrap_or_else(|error| {
            gateway_error_response(
                ResponseFormat::Responses,
                StatusCode::INTERNAL_SERVER_ERROR,
                "api_error",
                &format!("构建 MCP 响应失败: {error}"),
            )
        })
}

async fn execute_request_with_server_tools(
    state: &RouterState,
    upstream: &UpstreamCredentials,
    request: &NormalizedRequest,
) -> Result<ProxyExecutionOutcome, (StatusCode, &'static str, String)> {
    let mut working_request = request.clone();
    let web_search_options = request
        .tools
        .as_ref()
        .and_then(|tools| tools.iter().find(|tool| tool.tool_type.starts_with("web_search_")))
        .and_then(|tool| tool.web_search.clone());
    let max_uses = web_search_options
        .as_ref()
        .and_then(|options| options.max_uses)
        .map(|value| value.max(0) as usize)
        .unwrap_or(usize::MAX);
    let mut server_tool_calls = Vec::new();

    for _ in 0..8 {
        let upstream_payload = build_kiro_payload(&working_request, upstream.profile_arn.clone())
            .map_err(|message| {
                (
                    StatusCode::BAD_REQUEST,
                    "invalid_request_error",
                    sanitize_error(&message),
                )
            })?;
        let upstream_resp = send_generate_request(&state.http, upstream, &upstream_payload).await?;
        let body = upstream_resp.text().await.map_err(|error| {
            (
                StatusCode::BAD_GATEWAY,
                "api_error",
                sanitize_error(&format!("读取上游响应失败: {error}")),
            )
        })?;
        let aggregated = aggregate_kiro_response(&body);
        let web_search_calls: Vec<(String, String, String)> = aggregated
            .tool_calls
            .iter()
            .filter(|(_, name, _)| name == "web_search")
            .cloned()
            .collect();

        if web_search_calls.is_empty() {
            return Ok(ProxyExecutionOutcome {
                aggregated,
                server_tool_calls,
            });
        }
        if web_search_calls.len() != aggregated.tool_calls.len() {
            return Err((
                StatusCode::BAD_REQUEST,
                "invalid_request_error",
                "暂不支持 web_search 与普通客户端工具在同一轮混用".to_string(),
            ));
        }
        if server_tool_calls.len() + web_search_calls.len() > max_uses {
            return Err((
                StatusCode::BAD_REQUEST,
                "invalid_request_error",
                format!("web_search 调用次数超过 max_uses={max_uses}"),
            ));
        }

        working_request
            .messages
            .push(normalized_assistant_message_from_aggregated(&aggregated));

        let mut tool_result_blocks = Vec::new();
        for (id, name, arguments) in web_search_calls {
            let input = serde_json::from_str(&arguments).unwrap_or_else(|_| json!({ "query": arguments }));
            let mcp_arguments = build_web_search_mcp_arguments(&input);
            let mcp_result = call_mcp_tool(&state.http, upstream, &name, mcp_arguments).await?;
            let (result_content, tool_result_text) =
                parse_web_search_mcp_result(&mcp_result, web_search_options.as_ref());

            server_tool_calls.push(ServerToolCall {
                id: id.clone(),
                name,
                input: input.clone(),
                result_content: result_content.clone(),
                tool_result_text,
            });
            tool_result_blocks.push(json!({
                "type": "web_search_tool_result",
                "tool_use_id": id,
                "content": result_content
            }));
        }

        working_request.messages.push(NormalizedMessage {
            role: "user".to_string(),
            content: Some(Value::Array(tool_result_blocks)),
            tool_calls: None,
            tool_call_id: None,
        });
    }

    Err((
        StatusCode::BAD_GATEWAY,
        "api_error",
        "web_search 代理循环超过最大轮数".to_string(),
    ))
}

async fn send_generate_request<T: serde::Serialize + ?Sized>(
    http: &Client,
    upstream: &UpstreamCredentials,
    upstream_payload: &T,
) -> Result<reqwest::Response, (StatusCode, &'static str, String)> {
    let upstream_url = format!(
        "https://q.{}.amazonaws.com/generateAssistantResponse",
        upstream.region
    );

    let upstream_resp = http
        .post(upstream_url)
        .header("Authorization", format!("Bearer {}", upstream.access_token))
        .header("Content-Type", "application/json")
        .header("Accept", "application/vnd.amazon.eventstream")
        .header("x-amzn-kiro-agent-mode", DEFAULT_AGENT_MODE)
        .json(upstream_payload)
        .send()
        .await
        .map_err(|error| {
            (
                StatusCode::BAD_GATEWAY,
                "api_error",
                sanitize_error(&format!("上游请求失败: {error}")),
            )
        })?;

    if !upstream_resp.status().is_success() {
        let status = upstream_resp.status();
        let body = upstream_resp.text().await.unwrap_or_default();
        let (mapped_status, error_type, message) = map_upstream_error(status, &body);
        return Err((mapped_status, error_type, message));
    }

    Ok(upstream_resp)
}

async fn call_mcp_tool(
    http: &Client,
    upstream: &UpstreamCredentials,
    tool_name: &str,
    arguments: Value,
) -> Result<Value, (StatusCode, &'static str, String)> {
    let upstream_url = format!("https://q.{}.amazonaws.com/mcp", upstream.region);
    let payload = json!({
        "jsonrpc": "2.0",
        "id": short_uuid(),
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments
        }
    });

    let response = http
        .post(upstream_url)
        .header("Authorization", format!("Bearer {}", upstream.access_token))
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|error| {
            (
                StatusCode::BAD_GATEWAY,
                "api_error",
                sanitize_error(&format!("MCP 上游请求失败: {error}")),
            )
        })?;

    let status = response.status();
    let body = response.text().await.map_err(|error| {
        (
            StatusCode::BAD_GATEWAY,
            "api_error",
            sanitize_error(&format!("读取 MCP 上游响应失败: {error}")),
        )
    })?;
    if !status.is_success() {
        let (mapped_status, error_type, message) = map_upstream_error(status, &body);
        return Err((mapped_status, error_type, message));
    }

    let value: Value = serde_json::from_str(&body).unwrap_or_else(|_| json!({ "result": { "content": [{ "type": "text", "text": body }] } }));
    if let Some(error) = value.get("error") {
        let message = error
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("MCP 工具调用失败")
            .to_string();
        return Err((StatusCode::BAD_GATEWAY, "api_error", sanitize_error(&message)));
    }

    Ok(value.get("result").cloned().unwrap_or(value))
}

fn has_server_web_search_tool(request: &NormalizedRequest) -> bool {
    request
        .tools
        .as_ref()
        .map(|tools| tools.iter().any(|tool| tool.tool_type.starts_with("web_search_")))
        .unwrap_or(false)
}

fn normalized_assistant_message_from_aggregated(
    aggregated: &stream::AggregatedKiroResponse,
) -> NormalizedMessage {
    NormalizedMessage {
        role: "assistant".to_string(),
        content: if aggregated.text.is_empty() {
            None
        } else {
            Some(Value::String(aggregated.text.clone()))
        },
        tool_calls: if aggregated.tool_calls.is_empty() {
            None
        } else {
            Some(
                aggregated
                    .tool_calls
                    .iter()
                    .map(|(id, name, arguments)| ToolCall {
                        id: id.clone(),
                        call_type: "function".to_string(),
                        function: ToolCallFunction {
                            name: name.clone(),
                            arguments: arguments.clone(),
                        },
                    })
                    .collect(),
            )
        },
        tool_call_id: None,
    }
}

fn build_web_search_mcp_arguments(input: &Value) -> Value {
    let query = input
        .get("query")
        .and_then(Value::as_str)
        .or_else(|| input.get("search_query").and_then(Value::as_str))
        .unwrap_or_default()
        .to_string();
    json!({ "query": query })
}

fn parse_web_search_mcp_result(
    result: &Value,
    options: Option<&WebSearchToolOptions>,
) -> (Value, String) {
    let text = result
        .get("content")
        .and_then(Value::as_array)
        .and_then(|items| {
            items.iter().find_map(|item| {
                if item.get("type").and_then(Value::as_str) == Some("text") {
                    item.get("text").and_then(Value::as_str).map(str::to_string)
                } else {
                    None
                }
            })
        })
        .unwrap_or_else(|| result.to_string());

    let filtered_results = serde_json::from_str::<Value>(&text)
        .ok()
        .and_then(|value| value.get("results").and_then(Value::as_array).cloned())
        .unwrap_or_default()
        .into_iter()
        .filter(|item| domain_matches_filters(item, options))
        .map(normalize_anthropic_web_search_result)
        .collect::<Vec<_>>();

    let tool_result_text = if filtered_results.is_empty() {
        text
    } else {
        json!({ "results": filtered_results.clone() }).to_string()
    };

    (Value::Array(filtered_results), tool_result_text)
}

fn domain_matches_filters(item: &Value, options: Option<&WebSearchToolOptions>) -> bool {
    let Some(options) = options else {
        return true;
    };
    let domain = item
        .get("url")
        .and_then(Value::as_str)
        .and_then(extract_domain_from_url);
    let Some(domain) = domain else {
        return true;
    };

    if let Some(allowed) = options.allowed_domains.as_ref().filter(|items| !items.is_empty()) {
        if !allowed.iter().any(|entry| domain_matches_rule(&domain, entry)) {
            return false;
        }
    }
    if let Some(blocked) = options.blocked_domains.as_ref() {
        if blocked.iter().any(|entry| domain_matches_rule(&domain, entry)) {
            return false;
        }
    }
    true
}

fn extract_domain_from_url(url: &str) -> Option<String> {
    Url::parse(url)
        .ok()?
        .host_str()
        .map(|host| host.trim_start_matches("www.").to_ascii_lowercase())
}

fn domain_matches_rule(domain: &str, rule: &str) -> bool {
    let normalized = rule.trim().trim_start_matches("www.").to_ascii_lowercase();
    domain == normalized || domain.ends_with(&format!(".{normalized}"))
}

fn normalize_anthropic_web_search_result(item: Value) -> Value {
    match item {
        Value::Object(mut map) => {
            map.insert("type".to_string(), Value::String("web_search_result".to_string()));
            Value::Object(map)
        }
        other => other,
    }
}

fn ip_matches_allowlist(ip: IpAddr, allowlist: &[String]) -> bool {
    allowlist.iter().any(|entry| {
        let entry = entry.trim();
        entry.parse::<IpAddr>().map(|allowed| allowed == ip).unwrap_or(false)
            || entry
                .parse::<ipnet::IpNet>()
                .map(|network| network.contains(&ip))
                .unwrap_or(false)
    })
}

fn normalize_request(format: ResponseFormat, payload: &Value) -> Result<NormalizedRequest, String> {
    match format {
        ResponseFormat::Anthropic => {
            let request: AnthropicMessagesRequest = serde_json::from_value(payload.clone())
                .map_err(|error| format!("Anthropic 请求解析失败: {error}"))?;
            Ok(normalize_anthropic_request(&request))
        }
        ResponseFormat::OpenAi => serde_json::from_value(payload.clone())
            .map_err(|error| format!("OpenAI 请求解析失败: {error}")),
        ResponseFormat::Responses => normalize_responses_request(payload),
    }
}

fn verify_client_auth(headers: &HeaderMap, config: &GatewayConfig) -> Result<(), String> {
    let Some(expected) = config.access_token.as_ref().filter(|token| !token.trim().is_empty()) else {
        return Ok(());
    };

    let authorization = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .and_then(|value| value.strip_prefix("Bearer ").or(Some(value)));
    let api_key = headers.get("x-api-key").and_then(|value| value.to_str().ok());

    if authorization == Some(expected.as_str()) || api_key == Some(expected.as_str()) {
        Ok(())
    } else {
        Err("客户端 API Key 无效".to_string())
    }
}

async fn resolve_upstream_credentials(
    config: &GatewayConfig,
    request_index: u64,
) -> Result<UpstreamCredentials, String> {
    match config.account_mode.as_str() {
        "single" | "group" | "tag" => resolve_managed_account_credentials(config, request_index).await,
        _ => resolve_local_credentials(config).await,
    }
}

async fn resolve_local_credentials(config: &GatewayConfig) -> Result<UpstreamCredentials, String> {
    let local_token = crate::kiro::get_kiro_local_token()
        .await
        .ok_or_else(|| "未找到 Kiro 本地 token，请先在 Kiro IDE 登录".to_string())?;

    build_credentials_from_local_token(config, local_token)
}

fn build_credentials_from_local_token(
    config: &GatewayConfig,
    local_token: KiroLocalToken,
) -> Result<UpstreamCredentials, String> {
    let access_token = local_token
        .access_token
        .filter(|token| !token.trim().is_empty())
        .ok_or_else(|| "Kiro 本地 token 缺少 accessToken".to_string())?;

    Ok(UpstreamCredentials {
        access_token,
        profile_arn: local_token.profile_arn,
        region: local_token
            .region
            .filter(|region| !region.trim().is_empty())
            .unwrap_or_else(|| config.region.clone()),
    })
}

async fn resolve_managed_account_credentials(
    config: &GatewayConfig,
    request_index: u64,
) -> Result<UpstreamCredentials, String> {
    let mut store = AccountStore::new();
    store.reload();
    let mut accounts = match config.account_mode.as_str() {
        "single" => store
            .accounts
            .iter()
            .filter(|account| config.account_id.as_deref() == Some(account.id.as_str()))
            .cloned()
            .collect::<Vec<_>>(),
        "group" => store
            .accounts
            .iter()
            .filter(|account| {
                config.group_id.as_deref() == account.group_id.as_deref() && account.is_available()
            })
            .cloned()
            .collect::<Vec<_>>(),
        "tag" => store
            .accounts
            .iter()
            .filter(|account| {
                account.is_available()
                    && account
                        .tag_links
                        .iter()
                        .any(|link| config.tag_id.as_deref() == Some(link.tag_id.as_str()))
            })
            .cloned()
            .collect::<Vec<_>>(),
        _ => Vec::new(),
    };

    if accounts.is_empty() {
        return Err("未找到符合网关配置的可用账号".to_string());
    }

    order_accounts(&mut accounts, &config.strategy, request_index);
    let mut last_error = "没有可用的账号可供网关使用".to_string();

    for (index, account) in accounts.iter().enumerate() {
        match refresh_token_by_provider(account).await {
            Ok(refresh) => {
                let provider = account.provider.as_deref().unwrap_or("Google").to_string();
                let usage_result = get_usage_by_provider(&provider, &refresh.access_token).await;
                let mut usage_data = None;
                let mut is_banned = false;
                let mut is_auth_error = false;

                if let Ok(usage) = usage_result {
                    usage_data = Some(usage.usage_data);
                    is_banned = usage.is_banned;
                    is_auth_error = usage.is_auth_error;
                }

                persist_account_refresh(account, &refresh, usage_data.clone(), is_banned, is_auth_error);

                if (is_banned || is_auth_error) && index + 1 < accounts.len() {
                    last_error = format!("账号 {} 已不可用，尝试下一个账号", account.label);
                    continue;
                }

                if let Some(usage_data) = usage_data {
                    if usage_exceeds_threshold(&usage_data, config.threshold) && index + 1 < accounts.len() {
                        last_error = format!("账号 {} 已达到阈值 {}%，尝试下一个账号", account.label, config.threshold);
                        continue;
                    }
                }

                return Ok(UpstreamCredentials {
                    access_token: refresh.access_token,
                    profile_arn: refresh.profile_arn.or_else(|| account.profile_arn.clone()),
                    region: account
                        .region
                        .clone()
                        .filter(|region| !region.trim().is_empty())
                        .unwrap_or_else(|| config.region.clone()),
                });
            }
            Err(error) => {
                last_error = format!("刷新账号 {} 失败: {}", account.label, sanitize_error(&error));
            }
        }
    }

    Err(last_error)
}

fn order_accounts(accounts: &mut [Account], strategy: &str, request_index: u64) {
    match strategy {
        "most_quota" => accounts.sort_by(|left, right| {
            remaining_quota(right)
                .partial_cmp(&remaining_quota(left))
                .unwrap_or(std::cmp::Ordering::Equal)
        }),
        "random" => accounts.shuffle(&mut thread_rng()),
        _ => {
            if !accounts.is_empty() {
                accounts.rotate_left((request_index as usize) % accounts.len());
            }
        }
    }
}

fn persist_account_refresh(
    account: &Account,
    refresh: &RefreshResult,
    usage_data: Option<Value>,
    is_banned: bool,
    is_auth_error: bool,
) {
    let mut store = AccountStore::new();
    if let Some(target) = store.accounts.iter_mut().find(|candidate| candidate.id == account.id) {
        target.access_token = Some(refresh.access_token.clone());
        target.refresh_token = refresh.refresh_token.clone();
        target.expires_at = Some(calc_expires_at(refresh.expires_in));
        if let Some(profile_arn) = refresh.profile_arn.clone() {
            target.profile_arn = Some(profile_arn);
        }
        target.id_token = refresh.id_token.clone();
        target.sso_session_id = refresh.sso_session_id.clone();
        if let Some(data) = usage_data {
            target.usage_data = Some(data);
        }
        target.status = calc_status(is_banned, is_auth_error);
        let _ = store.save_to_file();
    }
}

fn remaining_quota(account: &Account) -> f64 {
    let Some(usage_data) = account.usage_data.as_ref() else {
        return 0.0;
    };
    let Some((current, limit)) = extract_usage_totals(usage_data) else {
        return 0.0;
    };
    if limit <= 0 {
        return 0.0;
    }
    (limit - current).max(0) as f64
}

fn usage_exceeds_threshold(usage_data: &Value, threshold: i32) -> bool {
    let Some((current, limit)) = extract_usage_totals(usage_data) else {
        return false;
    };
    if limit <= 0 {
        return false;
    }
    (current as f64 / limit as f64) * 100.0 >= f64::from(threshold)
}

fn extract_usage_totals(usage_data: &Value) -> Option<(i64, i64)> {
    let breakdown = usage_data
        .get("usageBreakdownList")
        .and_then(Value::as_array)?
        .first()?;
    let current = breakdown.get("currentUsage").and_then(Value::as_i64).unwrap_or(0);
    let limit = breakdown.get("usageLimit").and_then(Value::as_i64).unwrap_or(0);
    Some((current, limit))
}

fn extract_plain_text(value: Option<&Value>) -> String {
    match value {
        Some(Value::String(text)) => text.clone(),
        Some(Value::Array(items)) => items
            .iter()
            .filter_map(|item| {
                item.get("text")
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .or_else(|| item.get("content").and_then(Value::as_str).map(str::to_string))
            })
            .collect::<Vec<_>>()
            .join("\n"),
        Some(Value::Object(map)) => map
            .get("text")
            .and_then(Value::as_str)
            .or_else(|| map.get("content").and_then(Value::as_str))
            .unwrap_or_default()
            .to_string(),
        _ => String::new(),
    }
}

fn build_anthropic_content_blocks(
    aggregated: &stream::AggregatedKiroResponse,
    server_tool_calls: &[ServerToolCall],
) -> Vec<AnthropicContentBlock> {
    let mut content = Vec::new();
    if !aggregated.thinking.is_empty() {
        content.push(AnthropicContentBlock {
            block_type: "thinking".to_string(),
            text: None,
            thinking: Some(aggregated.thinking.clone()),
            id: None,
            name: None,
            input: None,
            tool_use_id: None,
            content: None,
            citations: None,
        });
    }
    for call in server_tool_calls {
        content.push(AnthropicContentBlock {
            block_type: "server_tool_use".to_string(),
            text: None,
            thinking: None,
            id: Some(call.id.clone()),
            name: Some(call.name.clone()),
            input: Some(call.input.clone()),
            tool_use_id: None,
            content: None,
            citations: None,
        });
        content.push(AnthropicContentBlock {
            block_type: "web_search_tool_result".to_string(),
            text: None,
            thinking: None,
            id: None,
            name: None,
            input: None,
            tool_use_id: Some(call.id.clone()),
            content: Some(call.result_content.clone()),
            citations: None,
        });
    }
    if !aggregated.text.is_empty() {
        content.push(AnthropicContentBlock {
            block_type: "text".to_string(),
            text: Some(aggregated.text.clone()),
            thinking: None,
            id: None,
            name: None,
            input: None,
            tool_use_id: None,
            content: None,
            citations: None,
        });
    }
    for (id, name, arguments) in &aggregated.tool_calls {
        content.push(AnthropicContentBlock {
            block_type: "tool_use".to_string(),
            text: None,
            thinking: None,
            id: Some(id.clone()),
            name: Some(name.clone()),
            input: Some(serde_json::from_str(arguments).unwrap_or_else(|_| json!({}))),
            tool_use_id: None,
            content: None,
            citations: None,
        });
    }
    content
}

fn build_anthropic_response(
    model: &str,
    aggregated: &stream::AggregatedKiroResponse,
    server_tool_calls: &[ServerToolCall],
) -> Value {
    let content = build_anthropic_content_blocks(aggregated, server_tool_calls);
    serde_json::to_value(AnthropicMessagesResponse {
        id: format!("msg_{}", short_uuid()),
        response_type: "message".to_string(),
        role: "assistant".to_string(),
        content,
        model: model.to_string(),
        stop_reason: Some(if aggregated.tool_calls.is_empty() {
            "end_turn".to_string()
        } else {
            "tool_use".to_string()
        }),
        stop_sequence: None,
        usage: AnthropicUsage {
            input_tokens: aggregated.input_tokens,
            output_tokens: aggregated.output_tokens,
        },
    })
    .unwrap_or_else(|_| json!({}))
}

fn build_openai_response(model: &str, aggregated: &stream::AggregatedKiroResponse) -> Value {
    let tool_calls: Vec<Value> = aggregated
        .tool_calls
        .iter()
        .map(|(id, name, arguments)| {
            json!({
                "id": id,
                "type": "function",
                "function": {
                    "name": name,
                    "arguments": arguments
                }
            })
        })
        .collect();

    json!({
        "id": format!("chatcmpl-{}", short_uuid()),
        "object": "chat.completion",
        "created": chrono::Utc::now().timestamp(),
        "model": model,
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": if aggregated.text.is_empty() { Value::Null } else { Value::String(aggregated.text.clone()) },
                "tool_calls": if tool_calls.is_empty() { Value::Null } else { Value::Array(tool_calls) }
            },
            "finish_reason": if aggregated.tool_calls.is_empty() { "stop" } else { "tool_calls" }
        }],
        "usage": {
            "prompt_tokens": aggregated.input_tokens,
            "completion_tokens": aggregated.output_tokens,
            "total_tokens": aggregated.input_tokens + aggregated.output_tokens
        }
    })
}

fn build_responses_response(model: &str, aggregated: &stream::AggregatedKiroResponse) -> Value {
    let message_id = format!("msg_{}", short_uuid());
    let mut content = Vec::new();
    if !aggregated.text.is_empty() {
        content.push(json!({
            "type": "output_text",
            "text": aggregated.text,
            "annotations": []
        }));
    }
    if !aggregated.thinking.is_empty() {
        content.push(json!({
            "type": "reasoning",
            "summary": aggregated.thinking
        }));
    }
    for (id, name, arguments) in &aggregated.tool_calls {
        content.push(json!({
            "type": "function_call",
            "call_id": id,
            "name": name,
            "arguments": arguments
        }));
    }

    json!({
        "id": format!("resp_{}", short_uuid()),
        "object": "response",
        "created_at": chrono::Utc::now().timestamp(),
        "status": "completed",
        "model": model,
        "output": [{
            "id": message_id,
            "type": "message",
            "role": "assistant",
            "content": content
        }],
        "output_text": aggregated.text,
        "usage": {
            "input_tokens": aggregated.input_tokens,
            "output_tokens": aggregated.output_tokens,
            "total_tokens": aggregated.input_tokens + aggregated.output_tokens
        }
    })
}

fn stream_completed_response(
    format: ResponseFormat,
    model: String,
    outcome: ProxyExecutionOutcome,
) -> Response {
    let (tx, rx) = mpsc::channel::<Result<Bytes, Infallible>>(32);
    tokio::spawn(async move {
        let created_at = chrono::Utc::now().timestamp();
        match format {
            ResponseFormat::Anthropic => {
                let message_id = format!("msg_{}", short_uuid());
                let blocks = build_anthropic_content_blocks(&outcome.aggregated, &outcome.server_tool_calls);
                let start = json!({
                    "type": "message_start",
                    "message": {
                        "id": message_id,
                        "type": "message",
                        "role": "assistant",
                        "content": [],
                        "model": model,
                        "stop_reason": Value::Null,
                        "stop_sequence": Value::Null,
                        "usage": {
                            "input_tokens": outcome.aggregated.input_tokens,
                            "output_tokens": outcome.aggregated.output_tokens
                        }
                    }
                });
                send_event(&tx, Some("message_start"), &start.to_string()).await;
                for (index, block) in blocks.iter().enumerate() {
                    let start_block = match block.block_type.as_str() {
                        "text" => json!({
                            "type": "content_block_start",
                            "index": index,
                            "content_block": { "type": "text", "text": "" }
                        }),
                        "thinking" => json!({
                            "type": "content_block_start",
                            "index": index,
                            "content_block": { "type": "thinking", "thinking": "" }
                        }),
                        _ => json!({
                            "type": "content_block_start",
                            "index": index,
                            "content_block": block
                        }),
                    };
                    send_event(&tx, Some("content_block_start"), &start_block.to_string()).await;
                    if let Some(text) = &block.text {
                        let delta = json!({
                            "type": "content_block_delta",
                            "index": index,
                            "delta": { "type": "text_delta", "text": text }
                        });
                        send_event(&tx, Some("content_block_delta"), &delta.to_string()).await;
                    } else if let Some(thinking) = &block.thinking {
                        let delta = json!({
                            "type": "content_block_delta",
                            "index": index,
                            "delta": { "type": "thinking_delta", "thinking": thinking }
                        });
                        send_event(&tx, Some("content_block_delta"), &delta.to_string()).await;
                    }
                    let stop = json!({ "type": "content_block_stop", "index": index });
                    send_event(&tx, Some("content_block_stop"), &stop.to_string()).await;
                }
                let finish = json!({
                    "type": "message_delta",
                    "delta": {
                        "stop_reason": if outcome.aggregated.tool_calls.is_empty() { "end_turn" } else { "tool_use" },
                        "stop_sequence": Value::Null
                    },
                    "usage": { "output_tokens": outcome.aggregated.output_tokens }
                });
                send_event(&tx, Some("message_delta"), &finish.to_string()).await;
                send_event(&tx, Some("message_stop"), "{\"type\":\"message_stop\"}").await;
            }
            ResponseFormat::OpenAi => {
                let openai_id = format!("chatcmpl-{}", short_uuid());
                let role = json!({
                    "id": openai_id,
                    "object": "chat.completion.chunk",
                    "created": created_at,
                    "model": model,
                    "choices": [{ "index": 0, "delta": { "role": "assistant" }, "finish_reason": Value::Null }]
                });
                send_data(&tx, &role.to_string()).await;
                if !outcome.aggregated.text.is_empty() {
                    let chunk = json!({
                        "id": openai_id,
                        "object": "chat.completion.chunk",
                        "created": created_at,
                        "model": model,
                        "choices": [{ "index": 0, "delta": { "content": outcome.aggregated.text }, "finish_reason": Value::Null }]
                    });
                    send_data(&tx, &chunk.to_string()).await;
                }
                let done = json!({
                    "id": openai_id,
                    "object": "chat.completion.chunk",
                    "created": created_at,
                    "model": model,
                    "choices": [{ "index": 0, "delta": {}, "finish_reason": "stop" }]
                });
                send_data(&tx, &done.to_string()).await;
                send_data(&tx, "[DONE]").await;
            }
            ResponseFormat::Responses => {
                let response_id = format!("resp_{}", short_uuid());
                if !outcome.aggregated.text.is_empty() {
                    let delta = json!({
                        "type": "response.output_text.delta",
                        "response_id": response_id,
                        "delta": outcome.aggregated.text
                    });
                    send_data(&tx, &delta.to_string()).await;
                }
                let completed = json!({
                    "type": "response.completed",
                    "response": {
                        "id": response_id,
                        "object": "response",
                        "created_at": created_at,
                        "status": "completed",
                        "model": model,
                        "usage": {
                            "input_tokens": outcome.aggregated.input_tokens,
                            "output_tokens": outcome.aggregated.output_tokens,
                            "total_tokens": outcome.aggregated.input_tokens + outcome.aggregated.output_tokens
                        }
                    }
                });
                send_data(&tx, &completed.to_string()).await;
                send_data(&tx, "[DONE]").await;
            }
        }
    });

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, HeaderValue::from_static("text/event-stream"))
        .header(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"))
        .header(header::CONNECTION, HeaderValue::from_static("keep-alive"))
        .body(Body::from_stream(ReceiverStream::new(rx)))
        .unwrap_or_else(|_| Response::new(Body::empty()))
}

fn gateway_error_response(
    format: ResponseFormat,
    status: StatusCode,
    error_type: &str,
    message: &str,
) -> Response {
    let body = match format {
        ResponseFormat::Anthropic => json!({
            "type": "error",
            "error": {
                "type": error_type,
                "message": message
            }
        }),
        _ => json!({
            "error": {
                "message": message,
                "type": error_type,
                "code": status.as_u16()
            }
        }),
    };
    (status, Json(body)).into_response()
}

fn map_upstream_error(status: StatusCode, body: &str) -> (StatusCode, &'static str, String) {
    let sanitized = sanitize_error(&extract_error_message(body));
    let text = body.to_lowercase();
    let mapped_status = if status == StatusCode::BAD_GATEWAY || status == StatusCode::OK {
        if text.contains("throttlingexception") || text.contains("servicequotaexceededexception") {
            StatusCode::TOO_MANY_REQUESTS
        } else if text.contains("accessdeniedexception") {
            StatusCode::FORBIDDEN
        } else if text.contains("validationexception") {
            StatusCode::BAD_REQUEST
        } else if text.contains("serviceunavailableexception") {
            StatusCode::SERVICE_UNAVAILABLE
        } else {
            StatusCode::BAD_GATEWAY
        }
    } else {
        status
    };

    let error_type = match mapped_status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => "authentication_error",
        StatusCode::TOO_MANY_REQUESTS => "rate_limit_error",
        StatusCode::BAD_REQUEST | StatusCode::NOT_FOUND | StatusCode::CONFLICT => "invalid_request_error",
        _ => "api_error",
    };

    (mapped_status, error_type, sanitized)
}

fn extract_error_message(body: &str) -> String {
    if body.trim().is_empty() {
        return "上游返回空错误响应".to_string();
    }
    if let Ok(value) = serde_json::from_str::<Value>(body) {
        for pointer in [
            "/message",
            "/Message",
            "/error/message",
            "/reason",
            "/__type",
            "/errorCode",
        ] {
            if let Some(text) = value.pointer(pointer).and_then(Value::as_str) {
                return text.to_string();
            }
        }
    }
    body.to_string()
}

fn sanitize_error(message: &str) -> String {
    let mut sanitized = message.to_string();
    for pattern in [
        r"Bearer\s+[A-Za-z0-9._\-]+",
        r#""accessToken"\s*:\s*"[^"]+""#,
        r#""refreshToken"\s*:\s*"[^"]+""#,
        r#""clientSecret"\s*:\s*"[^"]+""#,
        r#"sk-[A-Za-z0-9]+"#,
    ] {
        if let Ok(regex) = Regex::new(pattern) {
            sanitized = regex.replace_all(&sanitized, "[REDACTED]").to_string();
        }
    }
    sanitized
}

fn short_uuid() -> String {
    uuid::Uuid::new_v4().to_string().replace('-', "")
}

fn stream_proxy_response(
    upstream_resp: reqwest::Response,
    format: ResponseFormat,
    model: String,
) -> Response {
    let (tx, rx) = mpsc::channel::<Result<Bytes, Infallible>>(64);
    tokio::spawn(async move {
        let mut upstream_stream = upstream_resp.bytes_stream();
        let mut buffer = String::new();
        let mut parser = ThinkingParser::new();
        let mut message_started = false;
        let mut next_block_index = 0usize;
        let mut text_block_index: Option<usize> = None;
        let mut thinking_block_index: Option<usize> = None;
        let mut tool_block_indexes: HashMap<String, usize> = HashMap::new();
        let mut saw_tool_calls = false;
        let mut input_tokens = 0i32;
        let mut output_tokens = 0i32;
        let openai_id = format!("chatcmpl-{}", short_uuid());
        let anthropic_id = format!("msg_{}", short_uuid());
        let response_id = format!("resp_{}", short_uuid());
        let created_at = chrono::Utc::now().timestamp();
        let mut openai_role_sent = false;
        let mut openai_tool_indexes: HashMap<String, usize> = HashMap::new();
        let mut openai_next_tool_index = 0usize;

        while let Some(chunk_result) = upstream_stream.next().await {
            match chunk_result {
                Ok(bytes) => {
                    buffer.push_str(&String::from_utf8_lossy(&bytes));
                    while let Some(start) = buffer.find('{') {
                        let remaining = &buffer[start..];
                        let Some(json_str) = extract_json(remaining) else {
                            break;
                        };
                        let json_len = json_str.len();
                        if let Some(event) = parse_kiro_event_full(&json_str) {
                            match event {
                                KiroEvent::Usage {
                                    input_tokens: input,
                                    output_tokens: output,
                                } => {
                                    input_tokens = input;
                                    output_tokens = output;
                                }
                                KiroEvent::ContextUsage { percentage } => {
                                    if matches!(format, ResponseFormat::Anthropic) {
                                        let data = json!({"type":"context_usage","percentage":percentage});
                                        send_event(&tx, Some("context_usage"), &data.to_string()).await;
                                    }
                                }
                                KiroEvent::Thinking(text) => {
                                    handle_stream_text(
                                        &tx,
                                        format,
                                        &model,
                                        &anthropic_id,
                                        &openai_id,
                                        &response_id,
                                        created_at,
                                        &text,
                                        true,
                                        &mut message_started,
                                        &mut next_block_index,
                                        &mut text_block_index,
                                        &mut thinking_block_index,
                                        &mut openai_role_sent,
                                        &mut openai_tool_indexes,
                                        &mut openai_next_tool_index,
                                        input_tokens,
                                        output_tokens,
                                    )
                                    .await;
                                }
                                KiroEvent::Text(text) => {
                                    for segment in parser.push_and_parse(&text) {
                                        handle_stream_text(
                                            &tx,
                                            format,
                                            &model,
                                            &anthropic_id,
                                            &openai_id,
                                            &response_id,
                                            created_at,
                                            &segment.content,
                                            segment.segment_type == SegmentType::Thinking,
                                            &mut message_started,
                                            &mut next_block_index,
                                            &mut text_block_index,
                                            &mut thinking_block_index,
                                            &mut openai_role_sent,
                                            &mut openai_tool_indexes,
                                            &mut openai_next_tool_index,
                                            input_tokens,
                                            output_tokens,
                                        )
                                        .await;
                                    }
                                }
                                KiroEvent::ToolUseStart { id, name } => {
                                    saw_tool_calls = true;
                                    match format {
                                        ResponseFormat::Anthropic => {
                                            ensure_anthropic_message_start(
                                                &tx,
                                                &mut message_started,
                                                &anthropic_id,
                                                &model,
                                                input_tokens,
                                                output_tokens,
                                            )
                                            .await;
                                            close_content_block(&tx, &mut text_block_index).await;
                                            close_content_block(&tx, &mut thinking_block_index).await;
                                            let index = next_block_index;
                                            next_block_index += 1;
                                            tool_block_indexes.insert(id.clone(), index);
                                            let data = json!({
                                                "type": "content_block_start",
                                                "index": index,
                                                "content_block": {
                                                    "type": "tool_use",
                                                    "id": id,
                                                    "name": name,
                                                    "input": {}
                                                }
                                            });
                                            send_event(&tx, Some("content_block_start"), &data.to_string()).await;
                                        }
                                        ResponseFormat::OpenAi => {
                                            ensure_openai_role_chunk(&tx, &mut openai_role_sent, &openai_id, &model, created_at).await;
                                            let index = openai_next_tool_index;
                                            openai_next_tool_index += 1;
                                            openai_tool_indexes.insert(id.clone(), index);
                                            let data = json!({
                                                "id": openai_id,
                                                "object": "chat.completion.chunk",
                                                "created": created_at,
                                                "model": model,
                                                "choices": [{
                                                    "index": 0,
                                                    "delta": {
                                                        "tool_calls": [{
                                                            "index": index,
                                                            "id": id,
                                                            "type": "function",
                                                            "function": {
                                                                "name": name,
                                                                "arguments": ""
                                                            }
                                                        }]
                                                    },
                                                    "finish_reason": Value::Null
                                                }]
                                            });
                                            send_data(&tx, &data.to_string()).await;
                                        }
                                        ResponseFormat::Responses => {
                                            let data = json!({
                                                "type": "response.output_item.added",
                                                "response_id": response_id,
                                                "item": {
                                                    "type": "function_call",
                                                    "call_id": id,
                                                    "name": name,
                                                    "arguments": ""
                                                }
                                            });
                                            send_data(&tx, &data.to_string()).await;
                                        }
                                    }
                                }
                                KiroEvent::ToolUseInputDelta { id, input_delta } => match format {
                                    ResponseFormat::Anthropic => {
                                        if let Some(index) = tool_block_indexes.get(&id).copied() {
                                            let data = json!({
                                                "type": "content_block_delta",
                                                "index": index,
                                                "delta": {
                                                    "type": "input_json_delta",
                                                    "partial_json": input_delta
                                                }
                                            });
                                            send_event(&tx, Some("content_block_delta"), &data.to_string()).await;
                                        }
                                    }
                                    ResponseFormat::OpenAi => {
                                        ensure_openai_role_chunk(&tx, &mut openai_role_sent, &openai_id, &model, created_at).await;
                                        let index = *openai_tool_indexes.entry(id.clone()).or_insert_with(|| {
                                            let current = openai_next_tool_index;
                                            openai_next_tool_index += 1;
                                            current
                                        });
                                        let data = json!({
                                            "id": openai_id,
                                            "object": "chat.completion.chunk",
                                            "created": created_at,
                                            "model": model,
                                            "choices": [{
                                                "index": 0,
                                                "delta": {
                                                    "tool_calls": [{
                                                        "index": index,
                                                        "function": {
                                                            "arguments": input_delta
                                                        }
                                                    }]
                                                },
                                                "finish_reason": Value::Null
                                            }]
                                        });
                                        send_data(&tx, &data.to_string()).await;
                                    }
                                    ResponseFormat::Responses => {
                                        let data = json!({
                                            "type": "response.function_call_arguments.delta",
                                            "response_id": response_id,
                                            "call_id": id,
                                            "delta": input_delta
                                        });
                                        send_data(&tx, &data.to_string()).await;
                                    }
                                },
                                KiroEvent::ToolUseStop { id } => match format {
                                    ResponseFormat::Anthropic => {
                                        if let Some(index) = tool_block_indexes.remove(&id) {
                                            let data = json!({
                                                "type": "content_block_stop",
                                                "index": index
                                            });
                                            send_event(&tx, Some("content_block_stop"), &data.to_string()).await;
                                        }
                                    }
                                    ResponseFormat::Responses => {
                                        let data = json!({
                                            "type": "response.output_item.done",
                                            "response_id": response_id,
                                            "call_id": id
                                        });
                                        send_data(&tx, &data.to_string()).await;
                                    }
                                    ResponseFormat::OpenAi => {}
                                },
                            }
                        }
                        buffer = buffer[start + json_len..].to_string();
                    }
                }
                Err(error) => {
                    let data = json!({"type":"error","message":sanitize_error(&format!("流式读取失败: {error}"))});
                    send_data(&tx, &data.to_string()).await;
                    break;
                }
            }
        }

        for segment in parser.flush() {
            handle_stream_text(
                &tx,
                format,
                &model,
                &anthropic_id,
                &openai_id,
                &response_id,
                created_at,
                &segment.content,
                segment.segment_type == SegmentType::Thinking,
                &mut message_started,
                &mut next_block_index,
                &mut text_block_index,
                &mut thinking_block_index,
                &mut openai_role_sent,
                &mut openai_tool_indexes,
                &mut openai_next_tool_index,
                input_tokens,
                output_tokens,
            )
            .await;
        }

        match format {
            ResponseFormat::Anthropic => {
                close_content_block(&tx, &mut text_block_index).await;
                close_content_block(&tx, &mut thinking_block_index).await;
                let finish = json!({
                    "type": "message_delta",
                    "delta": {
                        "stop_reason": if saw_tool_calls { "tool_use" } else { "end_turn" },
                        "stop_sequence": Value::Null
                    },
                    "usage": {
                        "output_tokens": output_tokens
                    }
                });
                send_event(&tx, Some("message_delta"), &finish.to_string()).await;
                send_event(&tx, Some("message_stop"), "{\"type\":\"message_stop\"}").await;
            }
            ResponseFormat::OpenAi => {
                ensure_openai_role_chunk(&tx, &mut openai_role_sent, &openai_id, &model, created_at).await;
                let done = json!({
                    "id": openai_id,
                    "object": "chat.completion.chunk",
                    "created": created_at,
                    "model": model,
                    "choices": [{
                        "index": 0,
                        "delta": {},
                        "finish_reason": if saw_tool_calls { "tool_calls" } else { "stop" }
                    }]
                });
                send_data(&tx, &done.to_string()).await;
                send_data(&tx, "[DONE]").await;
            }
            ResponseFormat::Responses => {
                let completed = json!({
                    "type": "response.completed",
                    "response": {
                        "id": response_id,
                        "object": "response",
                        "created_at": created_at,
                        "status": "completed",
                        "model": model,
                        "usage": {
                            "input_tokens": input_tokens,
                            "output_tokens": output_tokens,
                            "total_tokens": input_tokens + output_tokens
                        }
                    }
                });
                send_data(&tx, &completed.to_string()).await;
                send_data(&tx, "[DONE]").await;
            }
        }
    });

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, HeaderValue::from_static("text/event-stream"))
        .header(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"))
        .header(header::CONNECTION, HeaderValue::from_static("keep-alive"))
        .body(Body::from_stream(ReceiverStream::new(rx)))
        .unwrap_or_else(|_| Response::new(Body::empty()))
}

#[allow(clippy::too_many_arguments)]
async fn handle_stream_text(
    tx: &mpsc::Sender<Result<Bytes, Infallible>>,
    format: ResponseFormat,
    model: &str,
    anthropic_id: &str,
    openai_id: &str,
    response_id: &str,
    created_at: i64,
    text: &str,
    is_thinking: bool,
    message_started: &mut bool,
    next_block_index: &mut usize,
    text_block_index: &mut Option<usize>,
    thinking_block_index: &mut Option<usize>,
    openai_role_sent: &mut bool,
    _openai_tool_indexes: &mut HashMap<String, usize>,
    _openai_next_tool_index: &mut usize,
    input_tokens: i32,
    output_tokens: i32,
) {
    if text.is_empty() {
        return;
    }

    match format {
        ResponseFormat::Anthropic => {
            ensure_anthropic_message_start(
                tx,
                message_started,
                anthropic_id,
                model,
                input_tokens,
                output_tokens,
            )
            .await;

            if is_thinking {
                close_content_block(tx, text_block_index).await;
                if thinking_block_index.is_none() {
                    let index = *next_block_index;
                    *next_block_index += 1;
                    *thinking_block_index = Some(index);
                    let data = json!({
                        "type": "content_block_start",
                        "index": index,
                        "content_block": {
                            "type": "thinking",
                            "thinking": ""
                        }
                    });
                    send_event(tx, Some("content_block_start"), &data.to_string()).await;
                }
                let data = json!({
                    "type": "content_block_delta",
                    "index": thinking_block_index.unwrap_or_default(),
                    "delta": {
                        "type": "thinking_delta",
                        "thinking": text
                    }
                });
                send_event(tx, Some("content_block_delta"), &data.to_string()).await;
            } else {
                close_content_block(tx, thinking_block_index).await;
                if text_block_index.is_none() {
                    let index = *next_block_index;
                    *next_block_index += 1;
                    *text_block_index = Some(index);
                    let data = json!({
                        "type": "content_block_start",
                        "index": index,
                        "content_block": {
                            "type": "text",
                            "text": ""
                        }
                    });
                    send_event(tx, Some("content_block_start"), &data.to_string()).await;
                }
                let data = json!({
                    "type": "content_block_delta",
                    "index": text_block_index.unwrap_or_default(),
                    "delta": {
                        "type": "text_delta",
                        "text": text
                    }
                });
                send_event(tx, Some("content_block_delta"), &data.to_string()).await;
            }
        }
        ResponseFormat::OpenAi => {
            if is_thinking {
                return;
            }
            ensure_openai_role_chunk(tx, openai_role_sent, openai_id, model, created_at).await;
            let data = json!({
                "id": openai_id,
                "object": "chat.completion.chunk",
                "created": created_at,
                "model": model,
                "choices": [{
                    "index": 0,
                    "delta": {
                        "content": text
                    },
                    "finish_reason": Value::Null
                }]
            });
            send_data(tx, &data.to_string()).await;
        }
        ResponseFormat::Responses => {
            let data = json!({
                "type": if is_thinking { "response.reasoning.delta" } else { "response.output_text.delta" },
                "response_id": response_id,
                "delta": text
            });
            send_data(tx, &data.to_string()).await;
        }
    }
}

async fn ensure_anthropic_message_start(
    tx: &mpsc::Sender<Result<Bytes, Infallible>>,
    message_started: &mut bool,
    anthropic_id: &str,
    model: &str,
    input_tokens: i32,
    output_tokens: i32,
) {
    if *message_started {
        return;
    }
    let data = json!({
        "type": "message_start",
        "message": {
            "id": anthropic_id,
            "type": "message",
            "role": "assistant",
            "content": [],
            "model": model,
            "stop_reason": Value::Null,
            "stop_sequence": Value::Null,
            "usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens
            }
        }
    });
    send_event(tx, Some("message_start"), &data.to_string()).await;
    *message_started = true;
}

async fn ensure_openai_role_chunk(
    tx: &mpsc::Sender<Result<Bytes, Infallible>>,
    role_sent: &mut bool,
    openai_id: &str,
    model: &str,
    created_at: i64,
) {
    if *role_sent {
        return;
    }
    let data = json!({
        "id": openai_id,
        "object": "chat.completion.chunk",
        "created": created_at,
        "model": model,
        "choices": [{
            "index": 0,
            "delta": {
                "role": "assistant"
            },
            "finish_reason": Value::Null
        }]
    });
    send_data(tx, &data.to_string()).await;
    *role_sent = true;
}

async fn close_content_block(
    tx: &mpsc::Sender<Result<Bytes, Infallible>>,
    index: &mut Option<usize>,
) {
    if let Some(current) = index.take() {
        let data = json!({
            "type": "content_block_stop",
            "index": current
        });
        send_event(tx, Some("content_block_stop"), &data.to_string()).await;
    }
}

async fn send_event(
    tx: &mpsc::Sender<Result<Bytes, Infallible>>,
    event: Option<&str>,
    payload: &str,
) {
    let chunk = if let Some(event) = event {
        format!("event: {event}\ndata: {payload}\n\n")
    } else {
        format!("data: {payload}\n\n")
    };
    let _ = tx.send(Ok(Bytes::from(chunk))).await;
}

async fn send_data(tx: &mpsc::Sender<Result<Bytes, Infallible>>, payload: &str) {
    send_event(tx, None, payload).await;
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn normalize_request_keeps_responses_as_primary_but_chat_compatible() {
        let responses_payload = json!({
            "model": "claude-3-7-sonnet-20250219",
            "stream": true,
            "tool_choice": { "type": "function", "name": "search_docs" },
            "tools": [
                {
                    "type": "function",
                    "name": "search_docs",
                    "description": "搜索文档",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "q": { "type": "string" }
                        },
                        "required": ["q"]
                    }
                }
            ],
            "input": [
                {
                    "type": "message",
                    "role": "user",
                    "content": [
                        { "type": "input_text", "text": "先检索 gateway" }
                    ]
                },
                {
                    "type": "function_call",
                    "call_id": "call_1",
                    "name": "search_docs",
                    "arguments": "{\"q\":\"gateway\"}"
                },
                {
                    "type": "function_call_output",
                    "call_id": "call_1",
                    "output": "命中结果"
                }
            ]
        });

        let chat_payload = json!({
            "model": "claude-3-7-sonnet-20250219",
            "stream": true,
            "tool_choice": { "type": "function", "name": "search_docs" },
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "search_docs",
                        "description": "搜索文档",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "q": { "type": "string" }
                            },
                            "required": ["q"]
                        }
                    }
                }
            ],
            "messages": [
                {
                    "role": "user",
                    "content": [
                        { "type": "input_text", "text": "先检索 gateway" }
                    ]
                },
                {
                    "role": "assistant",
                    "tool_calls": [
                        {
                            "id": "call_1",
                            "type": "function",
                            "function": {
                                "name": "search_docs",
                                "arguments": "{\"q\":\"gateway\"}"
                            }
                        }
                    ]
                },
                {
                    "role": "tool",
                    "tool_call_id": "call_1",
                    "content": "命中结果"
                }
            ]
        });

        let responses_request = normalize_request(ResponseFormat::Responses, &responses_payload)
            .expect("responses payload should normalize");
        let chat_request = normalize_request(ResponseFormat::OpenAi, &chat_payload)
            .expect("chat payload should normalize");

        assert_eq!(responses_request.model, chat_request.model);
        assert_eq!(responses_request.stream, chat_request.stream);
        assert_eq!(responses_request.tool_choice, chat_request.tool_choice);
        assert_eq!(responses_request.tools.as_ref().map(Vec::len), Some(1));
        assert_eq!(responses_request.tools.as_ref().map(Vec::len), Some(1));
        assert_eq!(chat_request.tools.as_ref().map(Vec::len), Some(1));
        assert_eq!(
            responses_request
                .tools
                .as_ref()
                .and_then(|items| items.first())
                .map(|tool| tool.function.name.as_str()),
            chat_request
                .tools
                .as_ref()
                .and_then(|items| items.first())
                .map(|tool| tool.function.name.as_str())
        );
        assert_eq!(responses_request.messages.len(), chat_request.messages.len());
        assert_eq!(responses_request.messages[0].content, chat_request.messages[0].content);
        assert_eq!(
            responses_request.messages[1]
                .tool_calls
                .as_ref()
                .and_then(|items| items.first())
                .map(|call| &call.function.arguments),
            chat_request.messages[1]
                .tool_calls
                .as_ref()
                .and_then(|items| items.first())
                .map(|call| &call.function.arguments)
        );
        assert_eq!(responses_request.messages[2].content, chat_request.messages[2].content);
    }

    #[test]
    fn parse_web_search_mcp_result_preserves_results_and_filters_domains() {
        let result = json!({
            "content": [{
                "type": "text",
                "text": "{\"results\":[{\"title\":\"Rust Blog\",\"url\":\"https://blog.rust-lang.org/inside-rust\"},{\"title\":\"Other\",\"url\":\"https://example.com/post\"}]}"
            }],
            "isError": false
        });
        let options = WebSearchToolOptions {
            max_uses: Some(3),
            allowed_domains: Some(vec!["blog.rust-lang.org".to_string()]),
            blocked_domains: Some(vec!["example.com".to_string()]),
            user_location: None,
        };

        let (content, tool_result_text) = parse_web_search_mcp_result(&result, Some(&options));

        assert_eq!(
            content,
            json!([{
                "type": "web_search_result",
                "title": "Rust Blog",
                "url": "https://blog.rust-lang.org/inside-rust"
            }])
        );
        assert!(tool_result_text.contains("blog.rust-lang.org"));
        assert!(!tool_result_text.contains("example.com"));
    }

    #[test]
    fn build_anthropic_response_emits_server_tool_blocks() {
        let aggregated = stream::AggregatedKiroResponse {
            text: "我查到了结果".to_string(),
            thinking: String::new(),
            tool_calls: Vec::new(),
            input_tokens: 10,
            output_tokens: 20,
            context_usage_percentage: None,
        };
        let response = build_anthropic_response(
            "claude-sonnet-4-5",
            &aggregated,
            &[ServerToolCall {
                id: "srv_1".to_string(),
                name: "web_search".to_string(),
                input: json!({ "query": "Rust release" }),
                result_content: json!([{
                    "type": "web_search_result",
                    "title": "Rust Blog",
                    "url": "https://blog.rust-lang.org"
                }]),
                tool_result_text: "{\"results\":[]}".to_string(),
            }],
        );

        assert_eq!(response["content"][0]["type"], "server_tool_use");
        assert_eq!(response["content"][1]["type"], "web_search_tool_result");
        assert_eq!(response["content"][2]["type"], "text");
        assert_eq!(response["content"][1]["tool_use_id"], "srv_1");
    }
}

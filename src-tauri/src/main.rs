#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod auth_social;
mod token;
mod callback_server;
mod kiro_auth_client;
mod oauth_callback_server;
mod provider_factory;

use auth::{
    AuthState, User, initiate_cognito_login, exchange_kiro_token,
    UsageAndLimitsResponse, refresh_token_desktop, get_usage_limits_desktop,
};
use base64::engine::Engine;
use std::sync::Mutex;
use tauri::{Manager, State, Window};
use callback_server::start_kiro_callback_server;
use kiro_auth_client::KiroAuthServiceClient;
use oauth_callback_server::OAuthCallbackServer;
use provider_factory::{get_provider_config, AuthMethod};
use token::{Token, TokenStore};

struct AppState {
    store: Mutex<TokenStore>,
    auth: AuthState,
    pending_login: Mutex<Option<PendingLogin>>,
    auth_temp_dir: Mutex<Option<std::path::PathBuf>>,
}

#[derive(Clone)]
#[allow(dead_code)]
struct PendingLogin {
    provider: String,
    code_verifier: String,
    state: String,
    machineid: String,
}

// ===== Kiro IDE 本地 Token =====

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KiroLocalToken {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub profile_arn: Option<String>,
    pub expires_at: Option<String>,
    pub auth_method: Option<String>,
    pub provider: Option<String>,
}

#[tauri::command]
fn get_kiro_local_token() -> Option<KiroLocalToken> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .ok()?;
    let path = std::path::Path::new(&home)
        .join(".aws")
        .join("sso")
        .join("cache")
        .join("kiro-auth-token.json");
    
    let content = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&content).ok()
}

// 切换账号 - 将指定 token 写入本地文件
#[tauri::command]
fn switch_kiro_account(
    access_token: String,
    refresh_token: String,
    provider: String,
) -> Result<(), String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Cannot find home directory")?;
    
    let dir_path = std::path::Path::new(&home)
        .join(".aws")
        .join("sso")
        .join("cache");
    
    // 确保目录存在
    std::fs::create_dir_all(&dir_path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    
    let file_path = dir_path.join("kiro-auth-token.json");
    
    // 构建新的 token 文件内容
    let expires_at = chrono::Utc::now() + chrono::Duration::hours(1);
    let token_data = serde_json::json!({
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "profileArn": "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK",
        "expiresAt": expires_at.to_rfc3339(),
        "authMethod": "social",
        "provider": provider
    });
    
    let content = serde_json::to_string_pretty(&token_data)
        .map_err(|e| format!("Failed to serialize: {}", e))?;
    
    std::fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    println!("Switched to account: provider={}", provider);
    Ok(())
}

// ===== Token 相关命令 =====

#[tauri::command]
fn get_tokens(state: State<AppState>) -> Vec<Token> {
    state.store.lock().unwrap().get_all()
}

#[tauri::command]
fn add_token(state: State<AppState>, email: String, label: String, quota: i32) -> Token {
    state.store.lock().unwrap().add(email, label, quota)
}

#[tauri::command]
fn update_token(
    state: State<AppState>,
    id: String,
    email: String,
    label: String,
    quota: i32,
    used: i32,
    status: String,
    access_token: Option<String>,
    refresh_token: Option<String>,
) -> Option<Token> {
    let mut store = state.store.lock().unwrap();
    let result = store.update(&id, email, label, quota, used, status);
    
    // 更新 token 信息
    if let Some(idx) = store.tokens.iter().position(|t| t.id == id) {
        if let Some(at) = access_token {
            if !at.is_empty() {
                store.tokens[idx].access_token = Some(at);
            }
        }
        if let Some(rt) = refresh_token {
            if !rt.is_empty() {
                store.tokens[idx].refresh_token = Some(rt);
            }
        }
        store.save_to_file();
        return Some(store.tokens[idx].clone());
    }
    result
}

#[tauri::command]
fn delete_token(state: State<AppState>, id: String) -> bool {
    state.store.lock().unwrap().delete(&id)
}

#[tauri::command]
fn delete_tokens(state: State<AppState>, ids: Vec<String>) -> usize {
    state.store.lock().unwrap().delete_many(&ids)
}

// 刷新 token 状态（本地简单刷新）
#[tauri::command]
fn refresh_token_status(state: State<AppState>, id: String) -> Option<Token> {
    state.store.lock().unwrap().refresh_status(&id)
}

// 真正调用 API 刷新 token 状态和配额
#[tauri::command]
async fn refresh_token_from_api(state: State<'_, AppState>, id: String) -> Result<Token, String> {
    // 获取 token
    let token = {
        let store = state.store.lock().unwrap();
        store.tokens.iter().find(|t| t.id == id).cloned()
    }.ok_or("Token not found")?;

    let refresh_token = token.refresh_token.as_ref().ok_or("No refresh token")?;

    // 1. 使用桌面端 API 刷新 token
    let refresh_result = refresh_token_desktop(refresh_token).await?;
    let new_access_token = refresh_result.access_token;

    // 2. 使用桌面端 API 获取配额
    let usage = get_usage_limits_desktop(&new_access_token).await?;
    
    // 从 usage_breakdown_list 提取配额信息
    let (quota, used) = if let Some(list) = &usage.usage_breakdown_list {
        if let Some(first) = list.first() {
            (first.usage_limit.unwrap_or(50), first.current_usage.unwrap_or(0))
        } else {
            (50, 0)
        }
    } else {
        (50, 0)
    };

    // 3. 计算过期时间
    let expires_at = chrono::Local::now() + chrono::Duration::seconds(refresh_result.expires_in);
    let expires_at_str = expires_at.format("%Y/%m/%d %H:%M:%S").to_string();

    // 4. 更新 token 信息
    let mut store = state.store.lock().unwrap();
    let token_idx = store.tokens.iter().position(|t| t.id == id);
    
    if let Some(idx) = token_idx {
        store.tokens[idx].quota = quota;
        store.tokens[idx].used = used;
        store.tokens[idx].access_token = Some(new_access_token);
        store.tokens[idx].expires_at = Some(expires_at_str);
        
        // 更新状态
        if store.tokens[idx].used >= store.tokens[idx].quota {
            store.tokens[idx].status = "已失效".to_string();
        } else {
            store.tokens[idx].status = "正常".to_string();
        }
        
        let result = store.tokens[idx].clone();
        store.save_to_file();
        return Ok(result);
    }

    Err("Token not found after update".to_string())
}

// 验证 token 是否有效
#[tauri::command]
async fn verify_token(
    _access_token: String,
    refresh_token: String,
    _csrf_token: Option<String>,
    _provider: String,
) -> Result<UsageAndLimitsResponse, String> {
    // 使用桌面端 API 刷新
    let refresh_result = refresh_token_desktop(&refresh_token).await?;
    let new_access_token = refresh_result.access_token;

    // 使用桌面端 API 获取配额
    let usage = get_usage_limits_desktop(&new_access_token).await?;
    
    // 转换为 UsageAndLimitsResponse 格式
    let (quota, used) = if let Some(list) = &usage.usage_breakdown_list {
        if let Some(first) = list.first() {
            (first.usage_limit, first.current_usage)
        } else {
            (None, None)
        }
    } else {
        (None, None)
    };
    
    Ok(UsageAndLimitsResponse {
        usage_limit: quota,
        current_usage: used,
        reset_date: None,
        subscription_type: usage.subscription_info.and_then(|s| s.subscription_type),
        user_id: usage.user_info.and_then(|u| u.user_id),
    })
}

// 通过 RefreshToken 添加账号（获取真实邮箱和配额）
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AddTokenResult {
    pub token: Token,
    pub email: String,
    pub quota: i32,
    pub used: i32,
}

/// 通过 RefreshToken 添加账号（使用桌面端 API，只需要 RefreshToken）
#[tauri::command]
async fn add_token_by_refresh(
    state: State<'_, AppState>,
    refresh_token: String,
    provider: Option<String>,
) -> Result<Token, String> {
    println!("Adding token by refresh (desktop API)");
    
    // 1. 使用桌面端 API 刷新获取 AccessToken
    let refresh_result = refresh_token_desktop(&refresh_token).await?;
    let access_token = refresh_result.access_token;
    println!("Got accessToken: {}...", &access_token[..30.min(access_token.len())]);
    
    // 2. 使用桌面端 API 获取用户信息和配额
    let usage_result = get_usage_limits_desktop(&access_token).await?;
    
    let email = usage_result.user_info.as_ref()
        .and_then(|u| u.email.clone())
        .unwrap_or_else(|| "unknown@kiro.dev".to_string());
    let user_id = usage_result.user_info.as_ref()
        .and_then(|u| u.user_id.clone());
    let subscription_type = usage_result.subscription_info.as_ref()
        .and_then(|s| s.subscription_title.clone());
    
    let (quota, used) = usage_result.usage_breakdown_list.as_ref()
        .and_then(|list| list.first())
        .map(|u| (u.usage_limit.unwrap_or(50), u.current_usage.unwrap_or(0)))
        .unwrap_or((50, 0));
    
    // 从邮箱推断 provider
    let idp = provider.unwrap_or_else(|| {
        if email.contains("gmail") { "Google".to_string() }
        else if email.contains("github") { "Github".to_string() }
        else { "Google".to_string() }
    });
    
    println!("Got: email={}, quota={}, used={}, subscription={:?}", email, quota, used, subscription_type);
    
    // 3. 添加到 token 列表
    let token = state.store.lock().unwrap().add_with_tokens(
        email.clone(),
        format!("Kiro {} 账号", idp),
        quota,
        access_token.clone(),
        refresh_token,
        idp.clone(),
        user_id,
        subscription_type,
    );
    
    // 更新 used
    {
        let mut store = state.store.lock().unwrap();
        if let Some(t) = store.tokens.iter_mut().find(|t| t.id == token.id) {
            t.used = used;
        }
        store.save_to_file();
    }
    
    // 更新当前用户
    let user = User {
        id: uuid::Uuid::new_v4().to_string(),
        email: email.clone(),
        name: email.split('@').next().unwrap_or("User").to_string(),
        avatar: None,
        provider: idp,
    };
    *state.auth.user.lock().unwrap() = Some(user);
    *state.auth.access_token.lock().unwrap() = Some(access_token);
    
    Ok(token)
}

#[tauri::command]
fn import_tokens(state: State<AppState>, tokens_json: String) -> Result<usize, String> {
    state.store.lock().unwrap().import_from_json(&tokens_json)
}

#[tauri::command]
fn export_tokens(state: State<AppState>) -> String {
    state.store.lock().unwrap().export_to_json()
}

// ===== Social 登录命令 =====

#[tauri::command]
async fn kiro_social_login(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    provider: String,
) -> Result<String, String> {
    // 验证 provider 是否受支持
    let config = get_provider_config(&provider)
        .ok_or_else(|| format!("Unsupported provider: {}", provider))?;

    if config.auth_method != AuthMethod::Social {
        return Err("provider 必须是 Social 类型 (Google / Github)".to_string());
    }

    // 使用预定义端口策略启动本地 OAuth 回调服务器（与 JS 版本保持一致）
    let social_auth_ports: Vec<u16> = vec![
        49153, 50153, 51153, 52153, 53153, 4649, 6588, 9091, 8008, 3128,
    ];

    let mut server = OAuthCallbackServer::new_predefined("localhost", social_auth_ports);

    // 启动服务器并获取 redirect_uri
    let redirect_uri = server
        .start()
        .map_err(|e| format!("Failed to start OAuth callback server: {}", e))?;

    // 生成 state（CSRF 防护）
    let state_str = uuid::Uuid::new_v4().to_string();

    // 生成 PKCE 参数（沿用现有的 social PKCE 实现）
    let code_verifier = auth_social::generate_code_verifier_social();
    let code_challenge = auth_social::generate_code_challenge_social(&code_verifier);

    // 打开浏览器到 Kiro Auth Service 登录页面
    let client = KiroAuthServiceClient::new();
    client
        .login(&provider, &redirect_uri, &code_challenge, &state_str)
        .await?;

    println!(
        "Social login URL opened via Kiro Auth Service: provider={}, redirect_uri={}",
        provider, redirect_uri
    );

    // 在阻塞线程中等待回调，避免阻塞异步运行时
    let wait_result = tokio::task::spawn_blocking(move || server.wait_for_callback())
        .await
        .map_err(|e| format!("Failed to join callback waiter: {}", e))?;

    let callback = wait_result.map_err(|e| format!("OAuth callback failed: {}", e))?;

    // 验证 state
    if callback.state != state_str {
        return Err("State mismatch - possible CSRF attack".to_string());
    }

    // 用授权码交换 token，这里暂时只完成协议调用并记录日志
    #[derive(serde::Deserialize)]
    struct SocialTokenResponse {
        #[serde(rename = "accessToken")]
        access_token: String,
        #[serde(rename = "refreshToken")]
        refresh_token: String,
        #[serde(rename = "profileArn")]
        profile_arn: Option<String>,
        #[serde(rename = "expiresIn")]
        expires_in: i64,
        #[serde(rename = "idToken")]
        id_token: Option<String>,
        #[serde(rename = "tokenType")]
        token_type: Option<String>,
    }

    let token_response: SocialTokenResponse = client
        .create_token(
            &callback.code,
            &code_verifier,
            &redirect_uri,
            None,
        )
        .await?;

    println!(
        "Social token exchange success via Kiro Auth Service: provider={}, profileArn={:?}",
        provider, token_response.profile_arn
    );

    // 用 access_token 获取用户信息和配额（沿用 handle_kiro_social_callback 的逻辑）
    let usage = get_usage_limits_desktop(&token_response.access_token).await.ok();

    let email = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|ui| ui.email.clone())
        .unwrap_or_else(|| format!("user@{}.com", provider.to_lowercase()));
    let user_id = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|ui| ui.user_id.clone());
    let subscription_type = usage.as_ref()
        .and_then(|u| u.subscription_info.as_ref())
        .and_then(|si| si.subscription_type.clone());

    let (quota, used) = usage.as_ref()
        .and_then(|u| u.usage_breakdown_list.as_ref())
        .and_then(|list| list.first())
        .map(|b| (b.usage_limit.unwrap_or(50), b.current_usage.unwrap_or(0)))
        .unwrap_or((50, 0));

    // 添加到 token 列表
    let mut token = state.store.lock().unwrap().add_with_tokens(
        email.clone(),
        format!("Kiro {} 账号", provider),
        quota,
        token_response.access_token.clone(),
        token_response.refresh_token.clone(),
        provider.clone(),
        user_id,
        subscription_type,
    );

    token.used = used;

    // 保存 used 等信息
    {
        let mut store = state.store.lock().unwrap();
        if let Some(t) = store.tokens.iter_mut().find(|t| t.id == token.id) {
            t.used = used;
        }
        store.save_to_file();
    }

    // 更新当前登录用户
    let user = User {
        id: uuid::Uuid::new_v4().to_string(),
        email: email.clone(),
        name: email.split('@').next().unwrap_or("User").to_string(),
        avatar: None,
        provider: provider.clone(),
    };
    *state.auth.user.lock().unwrap() = Some(user);
    *state.auth.access_token.lock().unwrap() = Some(token_response.access_token);
    *state.auth.refresh_token.lock().unwrap() = Some(token_response.refresh_token);
    *state.pending_login.lock().unwrap() = None;

    // 通知前端登录成功
    let _ = app_handle.emit_all("login-success", token.id.clone());

    Ok(format!("Social login completed for {}", provider))
}

#[tauri::command]
async fn handle_kiro_social_callback(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    code: String,
    callback_state: String,
) -> Result<(), String> {
    use auth_social::exchange_social_code_for_token;
    
    // 获取保存的登录状态
    let pending = {
        let lock = state.pending_login.lock().unwrap();
        lock.clone().ok_or("No pending login found")?
    };
    
    // 验证 state
    if pending.state != callback_state {
        return Err("State mismatch".to_string());
    }
    
    let redirect_uri = "kiro://app/callback";
    
    // 用 code 交换 token
    let token_response = exchange_social_code_for_token(
        &code,
        &pending.code_verifier,
        redirect_uri,
        &pending.machineid,
    ).await?;
    
    println!("Social token exchange success for {}", pending.provider);
    
    // 用 access_token 获取用户信息和配额
    let usage = get_usage_limits_desktop(&token_response.access_token).await.ok();
    
    let email = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|ui| ui.email.clone())
        .unwrap_or_else(|| format!("user@{}.com", pending.provider.to_lowercase()));
    let user_id = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|ui| ui.user_id.clone());
    let subscription_type = usage.as_ref()
        .and_then(|u| u.subscription_info.as_ref())
        .and_then(|si| si.subscription_type.clone());
    
    let (quota, used) = usage.as_ref()
        .and_then(|u| u.usage_breakdown_list.as_ref())
        .and_then(|list| list.first())
        .map(|b| (b.usage_limit.unwrap_or(50), b.current_usage.unwrap_or(0)))
        .unwrap_or((50, 0));
    
    // 添加到 token 列表
    let mut token = state.store.lock().unwrap().add_with_tokens(
        email.clone(),
        format!("Kiro {} 账号", pending.provider),
        quota,
        token_response.access_token.clone(),
        token_response.refresh_token.clone(),
        pending.provider.clone(),
        user_id,
        subscription_type,
    );
    
    token.used = used;
    
    // 保存
    {
        let mut store = state.store.lock().unwrap();
        if let Some(t) = store.tokens.iter_mut().find(|t| t.id == token.id) {
            t.used = used;
        }
        store.save_to_file();
    }
    
    // 更新当前登录用户
    let user = User {
        id: uuid::Uuid::new_v4().to_string(),
        email: email.clone(),
        name: email.split('@').next().unwrap_or("User").to_string(),
        avatar: None,
        provider: pending.provider.clone(),
    };
    *state.auth.user.lock().unwrap() = Some(user);
    *state.auth.access_token.lock().unwrap() = Some(token_response.access_token);
    *state.auth.refresh_token.lock().unwrap() = Some(token_response.refresh_token);
    *state.pending_login.lock().unwrap() = None;
    
    // 通知前端登录成功
    let _ = app_handle.emit_all("login-success", token.id);
    
    println!("Social login completed and account added: {}", email);
    
    Ok(())
}

// ===== Auth 相关命令 =====

#[tauri::command]
fn get_current_user(state: State<AppState>) -> Option<User> {
    state.auth.user.lock().unwrap().clone()
}

#[tauri::command]
fn logout(state: State<AppState>) {
    *state.auth.user.lock().unwrap() = None;
    *state.auth.csrf_token.lock().unwrap() = None;
    *state.auth.access_token.lock().unwrap() = None;
}

#[tauri::command]
async fn login_with_google(window: Window, state: State<'_, AppState>) -> Result<String, String> {
    start_oauth_flow(window, state, "Google").await
}

#[tauri::command]
async fn login_with_github(window: Window, state: State<'_, AppState>) -> Result<String, String> {
    start_oauth_flow(window, state, "GitHub").await
}

async fn start_oauth_flow(
    window: Window,
    state: State<'_, AppState>,
    _provider: &str,
) -> Result<String, String> {
    println!("Opening Kiro signin page...");

    // 直接打开 Kiro 登录页面
    let signin_url = "https://app.kiro.dev/signin";

    // 清空之前的登录状态
    *state.pending_login.lock().unwrap() = None;

    // 创建内置浏览器窗口（使用临时数据目录实现隔离，避免 Cognito session 复用）
    let temp_data_dir = std::env::temp_dir().join(format!("kiro-auth-{}", uuid::Uuid::new_v4()));
    
    // 保存临时目录路径，关闭窗口时清理
    *state.auth_temp_dir.lock().unwrap() = Some(temp_data_dir.clone());
    
    let auth_window = tauri::WindowBuilder::new(
        &window.app_handle(),
        "auth",
        tauri::WindowUrl::External(signin_url.parse().unwrap()),
    )
    .title("登录 - Kiro")
    .inner_size(500.0, 700.0)
    .center()
    .data_directory(temp_data_dir)
    .initialization_script(r#"
        (async function() {
            if (window.location.hostname !== 'app.kiro.dev') return;
            if (window.__kiro_login_done) return;
            if (window.location.pathname.includes('signin')) return;
            
            window.__kiro_login_done = true;
            console.log('Login detected, fetching user info...');
            
            try {
                // 0. 从页面 meta 标签获取 csrfToken
                let metaCsrf = document.querySelector('meta[name="csrf-token"]');
                let csrfToken = metaCsrf ? metaCsrf.getAttribute('content') : '';
                console.log('csrfToken from meta:', csrfToken);
                
                // 如果没有 csrfToken，跳转到 account/usage 页面
                if (!csrfToken) {
                    if (!window.location.pathname.includes('/account')) {
                        console.log('No csrfToken, redirecting to /account/usage...');
                        window.location.href = '/account/usage';
                        return;
                    }
                    // 等待页面加载完成后重试
                    await new Promise(r => setTimeout(r, 500));
                    metaCsrf = document.querySelector('meta[name="csrf-token"]');
                    csrfToken = metaCsrf ? metaCsrf.getAttribute('content') : '';
                    if (!csrfToken) throw new Error('No csrfToken found');
                }
                
                // 1. 从 Cookie 获取 AccessToken
                const getCookie = (name) => {
                    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
                    return match ? match[2] : '';
                };
                const accessToken = getCookie('AccessToken') || '';
                const refreshToken = getCookie('RefreshToken') || '';
                const idp = getCookie('Idp') || 'Google';
                
                console.log('accessToken:', accessToken.substring(0, 30) + '...');
                console.log('refreshToken:', refreshToken.substring(0, 30) + '...');
                
                // 如果 Cookie 读不到（HttpOnly），尝试从 RefreshToken API 获取
                if (!accessToken || !refreshToken) {
                    console.log('Cookies not readable, trying RefreshToken API...');
                    throw new Error('Cookies are HttpOnly, cannot read');
                }
                
                // 2. 从页面 meta 获取 userId
                const userIdMeta = document.querySelector('meta[name="user-id"]');
                const userId = userIdMeta ? userIdMeta.getAttribute('content') : '';
                
                // 3. 直接把 token 信息传给 Rust，让 Rust 调用 API 获取详细信息
                // 这里只传基本信息，quota/email 由 Rust 端获取
                let email = userId || 'unknown';
                let quota = 50, used = 0;
                console.log('userId:', userId, 'idp:', idp);
                
                // 4. 把数据编码到 document.title，让 Rust 端读取
                const tokenData = { email, accessToken, refreshToken, csrfToken, idp, quota, used };
                document.title = 'KIRO_LOGIN_SUCCESS:' + btoa(JSON.stringify(tokenData));
                console.log('Token data encoded to title');
            } catch (err) {
                console.error('Error:', err);
            }
        })();
    "#)
    .build()
    .map_err(|e| format!("Failed to create auth window: {}", e))?;

    // 监听窗口关闭事件，通知主窗口
    let main_window = window.clone();
    auth_window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            // 窗口关闭时通知主窗口检查登录状态
            let _ = main_window.emit("auth-window-closed", ());
        }
    });

    // 定时注入检查脚本（与 initialization_script 相同的逻辑）
    let app_handle = window.app_handle().clone();
    std::thread::spawn(move || {
        let check_script = r#"
            (async function() {
                if (window.location.hostname !== 'app.kiro.dev') return;
                if (window.__kiro_login_done) return;
                if (window.location.pathname.includes('signin')) return;
                
                window.__kiro_login_done = true;
                console.log('Login detected via polling, fetching user info...');
                
                try {
                    // 从页面 meta 标签获取 csrfToken
                    let metaCsrf = document.querySelector('meta[name="csrf-token"]');
                    let csrfToken = metaCsrf ? metaCsrf.getAttribute('content') : '';
                    
                    // 如果没有 csrfToken，跳转到 account/usage 页面
                    if (!csrfToken) {
                        if (!window.location.pathname.includes('/account')) {
                            window.location.href = '/account/usage';
                            return;
                        }
                        await new Promise(r => setTimeout(r, 500));
                        metaCsrf = document.querySelector('meta[name="csrf-token"]');
                        csrfToken = metaCsrf ? metaCsrf.getAttribute('content') : '';
                        if (!csrfToken) throw new Error('No csrfToken found');
                    }
                    
                    // 从 Cookie 获取 token
                    const getCookie = (name) => {
                        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
                        return match ? match[2] : '';
                    };
                    const accessToken = getCookie('AccessToken') || '';
                    const refreshToken = getCookie('RefreshToken') || '';
                    const idp = getCookie('Idp') || 'Google';
                    
                    // GetUserInfo 获取邮箱
                    const userRes = await fetch('/service/KiroWebPortalService/operation/GetUserInfo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/cbor', 'Accept': 'application/cbor', 'smithy-protocol': 'rpc-v2-cbor', 'Authorization': 'Bearer ' + accessToken, 'x-csrf-token': csrfToken },
                        body: new Uint8Array([0xa1, 0x66, 0x6f, 0x72, 0x69, 0x67, 0x69, 0x6e, 0x68, 0x4b, 0x49, 0x52, 0x4f, 0x5f, 0x49, 0x44, 0x45]),
                        credentials: 'include'
                    });
                    let email = 'unknown@kiro.dev';
                    if (userRes.ok) {
                        const userText = new TextDecoder().decode(await userRes.arrayBuffer());
                        const emailMatch = userText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                        if (emailMatch) email = emailMatch[0];
                    }
                    
                    // GetUserUsageAndLimits
                    const usageRes = await fetch('/service/KiroWebPortalService/operation/GetUserUsageAndLimits', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/cbor', 'Accept': 'application/cbor', 'smithy-protocol': 'rpc-v2-cbor', 'Authorization': 'Bearer ' + accessToken, 'x-csrf-token': csrfToken },
                        body: new Uint8Array([0xa2, 0x6f, 0x69, 0x73, 0x45, 0x6d, 0x61, 0x69, 0x6c, 0x52, 0x65, 0x71, 0x75, 0x69, 0x72, 0x65, 0x64, 0xf4, 0x66, 0x6f, 0x72, 0x69, 0x67, 0x69, 0x6e, 0x68, 0x4b, 0x49, 0x52, 0x4f, 0x5f, 0x49, 0x44, 0x45]),
                        credentials: 'include'
                    });
                    let quota = 50, used = 0;
                    if (usageRes.ok) {
                        const usageText = new TextDecoder().decode(await usageRes.arrayBuffer());
                        const limitMatch = usageText.match(/usageLimit[^\d]*(\d+)/);
                        const usedMatch = usageText.match(/currentUsage[^\d]*(\d+)/);
                        if (limitMatch) quota = parseInt(limitMatch[1]) || 50;
                        if (usedMatch) used = parseInt(usedMatch[1]) || 0;
                    }
                    
                    // 把数据编码到 document.title，让 Rust 端读取
                    const tokenData = { email, accessToken, refreshToken, csrfToken, idp, quota, used };
                    document.title = 'KIRO_LOGIN_SUCCESS:' + btoa(JSON.stringify(tokenData));
                    console.log('Token data encoded to title');
                } catch (err) {
                    console.error('Polling error:', err);
                }
            })();
        "#;
        
        for _ in 0..120 {
            std::thread::sleep(std::time::Duration::from_millis(500));
            if let Some(auth_win) = app_handle.get_window("auth") {
                // 检查窗口标题是否包含登录数据
                if let Ok(title) = auth_win.title() {
                    if title.starts_with("KIRO_LOGIN_SUCCESS:") {
                        let data_base64 = title.trim_start_matches("KIRO_LOGIN_SUCCESS:");
                        if let Ok(data_json) = base64::engine::general_purpose::STANDARD.decode(data_base64) {
                            if let Ok(data_str) = String::from_utf8(data_json) {
                                println!("Got login data from title: {}", &data_str[..data_str.len().min(100)]);
                                // 发送事件到主窗口
                                let _ = app_handle.emit_all("kiro-login-data", data_str);
                                // 关闭 auth 窗口
                                let _ = auth_win.close();
                                break;
                            }
                        }
                    }
                }
                // 注入检查脚本
                let _ = auth_win.eval(check_script);
            } else {
                break;
            }
        }
    });

    Ok("Auth window opened".to_string())
}

// 直接 OAuth 登录（使用真实的 GitHub/Google OAuth URL）
#[tauri::command]
async fn login_direct_google(window: Window, state: State<'_, AppState>) -> Result<String, String> {
    start_direct_oauth_flow(window, state, "Google").await
}

#[tauri::command]
async fn login_direct_github(window: Window, state: State<'_, AppState>) -> Result<String, String> {
    start_direct_oauth_flow(window, state, "GitHub").await
}

async fn start_direct_oauth_flow(
    window: Window,
    state: State<'_, AppState>,
    provider: &str,
) -> Result<String, String> {
    println!("Starting direct {} login...", provider);

    // 直接构建 Cognito OAuth URL
    let (redirect_url, code_verifier, login_state) = initiate_cognito_login(provider)?;
    println!("Cognito OAuth URL: {}", redirect_url);

    // 保存登录状态
    *state.pending_login.lock().unwrap() = Some(PendingLogin {
        provider: provider.to_string(),
        code_verifier,
        state: login_state,
        machineid: String::new(), // Social 登录时单独设置
    });

    // 创建内置浏览器窗口
    let _auth_window = tauri::WindowBuilder::new(
        &window.app_handle(),
        "auth",
        tauri::WindowUrl::External(redirect_url.parse().unwrap()),
    )
    .title(format!("登录 - {}", provider))
    .inner_size(500.0, 700.0)
    .center()
    .build()
    .map_err(|e| format!("Failed to create auth window: {}", e))?;

    Ok("Auth window opened".to_string())
}

// 使用系统浏览器打开 OAuth（备用方案）
#[tauri::command]
fn open_oauth_in_browser(provider: String) -> Result<String, String> {
    let (redirect_url, _code_verifier, _state) = initiate_cognito_login(&provider)?;
    open::that(&redirect_url).map_err(|e| format!("Failed to open browser: {}", e))?;
    Ok(redirect_url)
}

// 手动登录 - 用户在内置浏览器完成登录后确认
#[tauri::command]
fn manual_login(state: State<AppState>, email: String, provider: String) -> User {
    let user = User {
        id: uuid::Uuid::new_v4().to_string(),
        email: email.clone(),
        name: email.split('@').next().unwrap_or("User").to_string(),
        avatar: None,
        provider,
    };
    *state.auth.user.lock().unwrap() = Some(user.clone());
    user
}

// 关闭 auth 窗口并清理临时目录
#[tauri::command]
fn close_auth_window(window: Window, state: State<AppState>) {
    if let Some(auth_window) = window.app_handle().get_window("auth") {
        let _ = auth_window.close();
    }
    
    // 清理临时数据目录
    if let Some(temp_dir) = state.auth_temp_dir.lock().unwrap().take() {
        std::thread::spawn(move || {
            // 延迟一点再删除，确保窗口已完全关闭
            std::thread::sleep(std::time::Duration::from_millis(500));
            if let Err(e) = std::fs::remove_dir_all(&temp_dir) {
                println!("Failed to cleanup temp dir: {}", e);
            } else {
                println!("Cleaned up temp dir: {:?}", temp_dir);
            }
        });
    }
}

// 处理 OAuth 回调 - 从 URL 中提取 code 并交换 token
#[tauri::command]
async fn handle_oauth_callback(
    state: State<'_, AppState>,
    code: String,
    callback_state: String,
) -> Result<User, String> {
    println!("Handling OAuth callback: code={}, state={}", code, callback_state);
    
    // 获取保存的登录状态
    let pending = state.pending_login.lock().unwrap().clone()
        .ok_or("No pending login found")?;
    
    // 验证 state（可选，因为 Kiro 服务端已经验证过了）
    // if pending.state != callback_state {
    //     return Err("State mismatch".to_string());
    // }
    
    // 用 code 交换 token
    let token_response = exchange_kiro_token(
        &pending.provider,
        &code,
        &pending.code_verifier,
        &callback_state,
    ).await?;
    
    println!("Token exchange response: csrf={:?}", token_response.csrf_token);
    
    // 保存 token
    if let Some(csrf) = &token_response.csrf_token {
        *state.auth.csrf_token.lock().unwrap() = Some(csrf.clone());
    }
    if let Some(access) = &token_response.access_token {
        *state.auth.access_token.lock().unwrap() = Some(access.clone());
    }
    
    // 创建用户（暂时用简单信息，后续可以调用 GetUserInfo）
    let user = User {
        id: uuid::Uuid::new_v4().to_string(),
        email: "user@example.com".to_string(), // TODO: 从 GetUserInfo 获取
        name: "User".to_string(),
        avatar: None,
        provider: pending.provider,
    };
    
    *state.auth.user.lock().unwrap() = Some(user.clone());
    *state.pending_login.lock().unwrap() = None;
    
    Ok(user)
}

// 获取 pending login 信息
#[tauri::command]
fn get_pending_login(state: State<AppState>) -> Option<(String, String)> {
    state.pending_login.lock().unwrap().as_ref().map(|p| (p.provider.clone(), p.state.clone()))
}

// 完成 OAuth 登录 - 从 Cookie 中获取 token
// 添加 Kiro token 到管理列表
#[tauri::command]
async fn add_kiro_token(
    state: State<'_, AppState>,
    email: String,
    access_token: String,
    refresh_token: String,
    csrf_token: String,
    idp: String,
    quota: Option<i32>,
    used: Option<i32>,
) -> Result<Token, String> {
    println!("Adding Kiro token: email={}, idp={}", email, idp);
    println!("  accessToken: {}...", &access_token[..30.min(access_token.len())]);
    println!("  refreshToken: {}...", &refresh_token[..30.min(refresh_token.len())]);
    
    // 使用桌面端 API 获取完整信息
    let (final_email, final_quota, final_used, subscription_type, user_id) = 
        if !access_token.is_empty() {
            // 使用桌面端 API 获取配额和用户信息
            let usage = get_usage_limits_desktop(&access_token).await.ok();
            
            let email_from_api = usage.as_ref()
                .and_then(|u| u.user_info.as_ref())
                .and_then(|ui| ui.email.clone())
                .unwrap_or(email.clone());
            let user_id = usage.as_ref()
                .and_then(|u| u.user_info.as_ref())
                .and_then(|ui| ui.user_id.clone());
            let sub_type = usage.as_ref()
                .and_then(|u| u.subscription_info.as_ref())
                .and_then(|si| si.subscription_type.clone());
            let (quota_from_api, used_from_api) = usage.as_ref()
                .and_then(|u| u.usage_breakdown_list.as_ref())
                .and_then(|list| list.first())
                .map(|b| (b.usage_limit.unwrap_or(50), b.current_usage.unwrap_or(0)))
                .unwrap_or((quota.unwrap_or(50), used.unwrap_or(0)));
            
            (email_from_api, quota_from_api, used_from_api, sub_type, user_id)
        } else {
            (email.clone(), quota.unwrap_or(50), used.unwrap_or(0), None, None)
        };
    
    println!("  final: email={}, quota={}, used={}", final_email, final_quota, final_used);
    
    // 保存认证信息
    *state.auth.access_token.lock().unwrap() = Some(access_token.clone());
    *state.auth.refresh_token.lock().unwrap() = Some(refresh_token.clone());
    *state.auth.csrf_token.lock().unwrap() = Some(csrf_token.clone());
    
    // 创建用户
    let user = User {
        id: uuid::Uuid::new_v4().to_string(),
        email: final_email.clone(),
        name: final_email.split('@').next().unwrap_or("User").to_string(),
        avatar: None,
        provider: idp.clone(),
    };
    *state.auth.user.lock().unwrap() = Some(user);
    *state.pending_login.lock().unwrap() = None;
    
    // 添加到 token 列表
    let mut token = state.store.lock().unwrap().add_with_tokens(
        final_email,
        format!("Kiro {} 账号", idp),
        final_quota,
        access_token,
        refresh_token,
        idp,
        user_id,
        subscription_type,
    );
    
    token.used = final_used;
    
    // 保存
    {
        let mut store = state.store.lock().unwrap();
        if let Some(t) = store.tokens.iter_mut().find(|t| t.id == token.id) {
            t.used = final_used;
            t.csrf_token = Some(csrf_token);
        }
        store.save_to_file();
    }
    
    Ok(token)
}

#[tauri::command]
fn complete_oauth_login(
    state: State<AppState>,
    access_token: String,
    refresh_token: String,
    idp: String,
) -> Result<User, String> {
    println!("Completing OAuth login: idp={}, token_len={}", idp, access_token.len());
    
    // 保存 token
    *state.auth.access_token.lock().unwrap() = Some(access_token);
    *state.auth.refresh_token.lock().unwrap() = Some(refresh_token);
    
    // 创建用户
    let user = User {
        id: uuid::Uuid::new_v4().to_string(),
        email: format!("user@{}.com", idp.to_lowercase()),
        name: format!("{} User", idp),
        avatar: None,
        provider: idp,
    };
    
    *state.auth.user.lock().unwrap() = Some(user.clone());
    *state.pending_login.lock().unwrap() = None;
    
    Ok(user)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();

            // 在后台线程启动 HTTP 服务器
            std::thread::spawn(move || {
                start_kiro_callback_server(app_handle);
            });
            
            Ok(())
        })
        .manage(AppState {
            store: Mutex::new(TokenStore::new()),
            auth: AuthState::new(),
            pending_login: Mutex::new(None),
            auth_temp_dir: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            get_tokens,
            add_token,
            update_token,
            delete_token,
            delete_tokens,
            refresh_token_status,
            refresh_token_from_api,
            verify_token,
            add_token_by_refresh,
            import_tokens,
            export_tokens,
            get_current_user,
            logout,
            login_with_google,
            login_with_github,
            login_direct_google,
            login_direct_github,
            open_oauth_in_browser,
            add_kiro_token,
            manual_login,
            close_auth_window,
            handle_oauth_callback,
            get_pending_login,
            complete_oauth_login,
            get_kiro_local_token,
            switch_kiro_account,
            kiro_social_login,
            handle_kiro_social_callback
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

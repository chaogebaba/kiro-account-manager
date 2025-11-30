#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod token;

use auth::{AuthState, User, initiate_kiro_login, initiate_direct_login, exchange_kiro_token};
use std::sync::Mutex;
use tauri::{Manager, State, Window};
use token::{Token, TokenStore};

struct AppState {
    store: Mutex<TokenStore>,
    auth: AuthState,
    pending_login: Mutex<Option<PendingLogin>>,
}

#[derive(Clone)]
#[allow(dead_code)]
struct PendingLogin {
    provider: String,
    code_verifier: String,
    state: String,
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
) -> Option<Token> {
    state.store.lock().unwrap().update(&id, email, label, quota, used, status)
}

#[tauri::command]
fn delete_token(state: State<AppState>, id: String) -> bool {
    state.store.lock().unwrap().delete(&id)
}

#[tauri::command]
fn delete_tokens(state: State<AppState>, ids: Vec<String>) -> usize {
    state.store.lock().unwrap().delete_many(&ids)
}

#[tauri::command]
fn refresh_token_status(state: State<AppState>, id: String) -> Option<Token> {
    state.store.lock().unwrap().refresh_status(&id)
}

#[tauri::command]
fn import_tokens(state: State<AppState>, tokens_json: String) -> Result<usize, String> {
    state.store.lock().unwrap().import_from_json(&tokens_json)
}

#[tauri::command]
fn export_tokens(state: State<AppState>) -> String {
    state.store.lock().unwrap().export_to_json()
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
    provider: &str,
) -> Result<String, String> {
    println!("Starting {} login...", provider);

    // 调用 Kiro API 获取授权 URL
    let (redirect_url, code_verifier, login_state) = initiate_kiro_login(provider).await?;
    println!("Got redirect URL: {}", redirect_url);

    // 保存登录状态
    *state.pending_login.lock().unwrap() = Some(PendingLogin {
        provider: provider.to_string(),
        code_verifier,
        state: login_state,
    });

    // 创建内置浏览器窗口
    let auth_window = tauri::WindowBuilder::new(
        &window.app_handle(),
        "auth",
        tauri::WindowUrl::External(redirect_url.parse().unwrap()),
    )
    .title("登录 - Kiro")
    .inner_size(500.0, 700.0)
    .center()
    .initialization_script(r#"
        (async function() {
            if (window.location.hostname !== 'app.kiro.dev') return;
            if (window.__kiro_login_done) return;
            if (window.location.pathname.includes('signin')) return;
            
            window.__kiro_login_done = true;
            console.log('Login detected, fetching user info...');
            
            try {
                // 1. RefreshToken 获取 accessToken 和 csrfToken
                const refreshRes = await fetch('/service/KiroWebPortalService/operation/RefreshToken', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/cbor', 'Accept': 'application/cbor', 'smithy-protocol': 'rpc-v2-cbor' },
                    body: new Uint8Array([0xa1, 0x69, 0x63, 0x73, 0x72, 0x66, 0x54, 0x6f, 0x6b, 0x65, 0x6e, 0x60]),
                    credentials: 'include'
                });
                if (!refreshRes.ok) throw new Error('RefreshToken failed');
                const refreshText = new TextDecoder().decode(await refreshRes.arrayBuffer());
                
                const accessToken = (refreshText.match(/aoa[A-Za-z0-9_\-:\/+=]+/) || [''])[0];
                const csrfToken = (refreshText.match(/csrfToken.{1,5}([A-Za-z0-9+\/=]{20,50})/) || ['',''])[1];
                console.log('accessToken:', accessToken.substring(0,30) + '...');
                
                // 2. GetUserInfo 获取邮箱和 idp
                const userRes = await fetch('/service/KiroWebPortalService/operation/GetUserInfo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/cbor', 'Accept': 'application/cbor', 'smithy-protocol': 'rpc-v2-cbor', 'Authorization': 'Bearer ' + accessToken, 'x-csrf-token': csrfToken },
                    body: new Uint8Array([0xa1, 0x66, 0x6f, 0x72, 0x69, 0x67, 0x69, 0x6e, 0x68, 0x4b, 0x49, 0x52, 0x4f, 0x5f, 0x49, 0x44, 0x45]),
                    credentials: 'include'
                });
                if (!userRes.ok) throw new Error('GetUserInfo failed');
                const userText = new TextDecoder().decode(await userRes.arrayBuffer());
                
                const email = (userText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/) || ['unknown@kiro.dev'])[0];
                const idp = (userText.match(/cidp.([A-Za-z]+)/) || ['','Google'])[1];
                console.log('email:', email, 'idp:', idp);
                
                // 3. GetUserUsageAndLimits 获取配额信息
                // body: {isEmailRequired: false, origin: "KIRO_IDE"}
                const usageRes = await fetch('/service/KiroWebPortalService/operation/GetUserUsageAndLimits', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/cbor', 'Accept': 'application/cbor', 'smithy-protocol': 'rpc-v2-cbor', 'Authorization': 'Bearer ' + accessToken, 'x-csrf-token': csrfToken },
                    body: new Uint8Array([0xa2, 0x6f, 0x69, 0x73, 0x45, 0x6d, 0x61, 0x69, 0x6c, 0x52, 0x65, 0x71, 0x75, 0x69, 0x72, 0x65, 0x64, 0xf4, 0x66, 0x6f, 0x72, 0x69, 0x67, 0x69, 0x6e, 0x68, 0x4b, 0x49, 0x52, 0x4f, 0x5f, 0x49, 0x44, 0x45]),
                    credentials: 'include'
                });
                
                let quota = 50, used = 0;
                if (usageRes.ok) {
                    const usageText = new TextDecoder().decode(await usageRes.arrayBuffer());
                    // 尝试提取 usageLimit 和 currentUsage
                    const limitMatch = usageText.match(/usageLimit[^\d]*(\d+)/);
                    const usedMatch = usageText.match(/currentUsage[^\d]*(\d+)/);
                    if (limitMatch) quota = parseInt(limitMatch[1]) || 50;
                    if (usedMatch) used = parseInt(usedMatch[1]) || 0;
                    console.log('quota:', quota, 'used:', used);
                }
                
                // 4. 添加到 token 列表
                if (window.__TAURI__) {
                    const result = await window.__TAURI__.invoke('add_kiro_token', { email, accessToken, csrfToken, idp, quota, used });
                    console.log('Token added:', result);
                    window.__TAURI__.event.emit('login-success', result);
                    window.__TAURI__.invoke('close_auth_window');
                }
            } catch (err) {
                console.error('Error:', err);
                if (window.__TAURI__) window.__TAURI__.invoke('close_auth_window');
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
                    const refreshRes = await fetch('/service/KiroWebPortalService/operation/RefreshToken', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/cbor', 'Accept': 'application/cbor', 'smithy-protocol': 'rpc-v2-cbor' },
                        body: new Uint8Array([0xa1, 0x69, 0x63, 0x73, 0x72, 0x66, 0x54, 0x6f, 0x6b, 0x65, 0x6e, 0x60]),
                        credentials: 'include'
                    });
                    if (!refreshRes.ok) throw new Error('RefreshToken failed');
                    const refreshText = new TextDecoder().decode(await refreshRes.arrayBuffer());
                    const accessToken = (refreshText.match(/aoa[A-Za-z0-9_\-:\/+=]+/) || [''])[0];
                    const csrfToken = (refreshText.match(/csrfToken.{1,5}([A-Za-z0-9+\/=]{20,50})/) || ['',''])[1];
                    
                    const userRes = await fetch('/service/KiroWebPortalService/operation/GetUserInfo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/cbor', 'Accept': 'application/cbor', 'smithy-protocol': 'rpc-v2-cbor', 'Authorization': 'Bearer ' + accessToken, 'x-csrf-token': csrfToken },
                        body: new Uint8Array([0xa1, 0x66, 0x6f, 0x72, 0x69, 0x67, 0x69, 0x6e, 0x68, 0x4b, 0x49, 0x52, 0x4f, 0x5f, 0x49, 0x44, 0x45]),
                        credentials: 'include'
                    });
                    if (!userRes.ok) throw new Error('GetUserInfo failed');
                    const userText = new TextDecoder().decode(await userRes.arrayBuffer());
                    const email = (userText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/) || ['unknown@kiro.dev'])[0];
                    const idp = (userText.match(/cidp.([A-Za-z]+)/) || ['','Google'])[1];
                    
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
                    
                    if (window.__TAURI__) {
                        const result = await window.__TAURI__.invoke('add_kiro_token', { email, accessToken, csrfToken, idp, quota, used });
                        window.__TAURI__.event.emit('login-success', result);
                        window.__TAURI__.invoke('close_auth_window');
                    }
                } catch (err) {
                    console.error('Polling error:', err);
                    if (window.__TAURI__) window.__TAURI__.invoke('close_auth_window');
                }
            })();
        "#;
        
        for _ in 0..60 {
            std::thread::sleep(std::time::Duration::from_millis(500));
            if let Some(auth_win) = app_handle.get_window("auth") {
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

    // 直接构建 OAuth URL（不调用 Kiro API）
    let (redirect_url, code_verifier, login_state) = initiate_direct_login(provider)?;
    println!("Direct OAuth URL: {}", redirect_url);

    // 保存登录状态
    *state.pending_login.lock().unwrap() = Some(PendingLogin {
        provider: provider.to_string(),
        code_verifier,
        state: login_state,
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
    let (redirect_url, _code_verifier, _state) = initiate_direct_login(&provider)?;
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

// 关闭 auth 窗口
#[tauri::command]
fn close_auth_window(window: Window) {
    if let Some(auth_window) = window.app_handle().get_window("auth") {
        let _ = auth_window.close();
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
fn add_kiro_token(
    state: State<AppState>,
    email: String,
    access_token: String,
    csrf_token: String,
    idp: String,
    quota: Option<i32>,
    used: Option<i32>,
) -> Result<Token, String> {
    println!("Adding Kiro token: email={}, idp={}, quota={:?}, used={:?}", email, idp, quota, used);
    
    // 保存认证信息
    *state.auth.access_token.lock().unwrap() = Some(access_token);
    *state.auth.csrf_token.lock().unwrap() = Some(csrf_token);
    
    // 创建用户
    let user = User {
        id: uuid::Uuid::new_v4().to_string(),
        email: email.clone(),
        name: email.split('@').next().unwrap_or("User").to_string(),
        avatar: None,
        provider: idp.clone(),
    };
    *state.auth.user.lock().unwrap() = Some(user);
    *state.pending_login.lock().unwrap() = None;
    
    // 添加到 token 列表（包含完整的 token 信息用于切号）
    let mut token = state.store.lock().unwrap().add_with_tokens(
        email,
        format!("Kiro {} 账号", idp),
        quota.unwrap_or(50),
        access_token,
        csrf_token, // 用 csrf_token 作为 refresh_token
        idp
    );
    
    // 更新已使用量
    if let Some(u) = used {
        token.used = u;
        // 重新保存
        let mut store = state.store.lock().unwrap();
        if let Some(t) = store.tokens.iter_mut().find(|t| t.id == token.id) {
            t.used = u;
        }
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
        .manage(AppState {
            store: Mutex::new(TokenStore::new()),
            auth: AuthState::new(),
            pending_login: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            get_tokens,
            add_token,
            update_token,
            delete_token,
            delete_tokens,
            refresh_token_status,
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
            switch_kiro_account
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

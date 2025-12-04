// [LEGACY] 旧的认证命令，已被 kiro_social_login 替代
// 这些是之前尝试直接对接 Cognito OAuth 但没跑通的方法
// 保留供参考，不再使用

#![allow(dead_code)]
#![allow(unused_imports)]

use tauri::{State, Window, Manager};
use crate::state::AppState;
use crate::auth::User;

// ============================================================
// [LEGACY] WebView 登录方式 - 已废弃
// ============================================================

#[tauri::command]
pub async fn login_with_google(window: Window, state: State<'_, AppState>) -> Result<String, String> {
    start_oauth_flow(window, state, "Google").await
}

#[tauri::command]
pub async fn login_with_github(window: Window, state: State<'_, AppState>) -> Result<String, String> {
    start_oauth_flow(window, state, "GitHub").await
}

async fn start_oauth_flow(
    window: Window,
    state: State<'_, AppState>,
    _provider: &str,
) -> Result<String, String> {
    println!("[LEGACY] Opening Kiro signin page...");

    let signin_url = "https://app.kiro.dev/signin";
    *state.pending_login.lock().unwrap() = None;

    let temp_data_dir = std::env::temp_dir().join(format!("kiro-auth-{}", uuid::Uuid::new_v4()));
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
    .initialization_script(include_str!("../scripts/auth_inject.js"))
    .build()
    .map_err(|e| format!("Failed to create auth window: {}", e))?;

    let main_window = window.clone();
    auth_window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            let _ = main_window.emit("auth-window-closed", ());
        }
    });

    Ok("Auth window opened".to_string())
}


// ============================================================
// [LEGACY] 直接 Cognito OAuth 登录 - 没跑通
// ============================================================

#[tauri::command]
pub async fn login_direct_google(window: Window, state: State<'_, AppState>) -> Result<String, String> {
    start_direct_oauth_flow(window, state, "Google").await
}

#[tauri::command]
pub async fn login_direct_github(window: Window, state: State<'_, AppState>) -> Result<String, String> {
    start_direct_oauth_flow(window, state, "GitHub").await
}

async fn start_direct_oauth_flow(
    window: Window,
    state: State<'_, AppState>,
    provider: &str,
) -> Result<String, String> {
    use crate::auth::initiate_cognito_login;
    use crate::state::PendingLogin;
    
    println!("[LEGACY] Starting direct {} login...", provider);

    let (redirect_url, code_verifier, login_state) = initiate_cognito_login(provider)?;
    println!("Cognito OAuth URL: {}", redirect_url);

    *state.pending_login.lock().unwrap() = Some(PendingLogin {
        provider: provider.to_string(),
        code_verifier,
        state: login_state,
        machineid: String::new(),
    });

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

#[tauri::command]
pub fn open_oauth_in_browser(provider: String) -> Result<String, String> {
    use crate::auth::initiate_cognito_login;
    
    let (redirect_url, _code_verifier, _state) = initiate_cognito_login(&provider)?;
    open::that(&redirect_url).map_err(|e| format!("Failed to open browser: {}", e))?;
    Ok(redirect_url)
}

// ============================================================
// [LEGACY] 旧的回调处理 - 没跑通
// ============================================================

#[tauri::command]
pub async fn handle_oauth_callback(
    state: State<'_, AppState>,
    code: String,
    callback_state: String,
) -> Result<User, String> {
    use crate::auth::exchange_kiro_token;
    
    println!("[LEGACY] Handling OAuth callback: code={}, state={}", code, callback_state);
    
    let pending = state.pending_login.lock().unwrap().clone()
        .ok_or("No pending login found")?;
    
    let token_response = exchange_kiro_token(
        &pending.provider,
        &code,
        &pending.code_verifier,
        &callback_state,
    ).await?;
    
    println!("Token exchange response: csrf={:?}", token_response.csrf_token);
    
    if let Some(csrf) = &token_response.csrf_token {
        *state.auth.csrf_token.lock().unwrap() = Some(csrf.clone());
    }
    if let Some(access) = &token_response.access_token {
        *state.auth.access_token.lock().unwrap() = Some(access.clone());
    }
    
    let user = User {
        id: uuid::Uuid::new_v4().to_string(),
        email: "user@example.com".to_string(),
        name: "User".to_string(),
        avatar: None,
        provider: pending.provider,
    };
    
    *state.auth.user.lock().unwrap() = Some(user.clone());
    *state.pending_login.lock().unwrap() = None;
    
    Ok(user)
}

// ============================================================
// [LEGACY] 辅助方法 - 调试/旧流程用
// ============================================================

#[tauri::command]
pub fn manual_login(state: State<AppState>, email: String, provider: String) -> User {
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

#[tauri::command]
pub fn close_auth_window(window: Window, state: State<AppState>) {
    if let Some(auth_window) = window.app_handle().get_window("auth") {
        let _ = auth_window.close();
    }
    
    if let Some(temp_dir) = state.auth_temp_dir.lock().unwrap().take() {
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(500));
            if let Err(e) = std::fs::remove_dir_all(&temp_dir) {
                println!("Failed to cleanup temp dir: {}", e);
            } else {
                println!("Cleaned up temp dir: {:?}", temp_dir);
            }
        });
    }
}

#[tauri::command]
pub fn get_pending_login(state: State<AppState>) -> Option<(String, String)> {
    state.pending_login.lock().unwrap().as_ref().map(|p| (p.provider.clone(), p.state.clone()))
}

#[tauri::command]
pub fn complete_oauth_login(
    state: State<AppState>,
    access_token: String,
    refresh_token: String,
    idp: String,
) -> Result<User, String> {
    println!("[LEGACY] Completing OAuth login: idp={}, token_len={}", idp, access_token.len());
    
    *state.auth.access_token.lock().unwrap() = Some(access_token);
    *state.auth.refresh_token.lock().unwrap() = Some(refresh_token);
    
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

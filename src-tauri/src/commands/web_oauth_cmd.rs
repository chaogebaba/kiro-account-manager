// Web OAuth 命令 - 独立的 Cognito + CBOR 登录
// 不影响现有的 auth_cmd.rs
// 支持两种模式：
// 1. 两步流程：initiate -> complete (手动复制 URL)
// 2. 一键登录：web_oauth_login (WebView 自动捕获回调)

use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use crate::state::AppState;
use crate::auth::User;
use crate::providers::web_oauth::{WebOAuthProvider, WebOAuthInitResult, GetUserUsageAndLimitsResponse};

// 保存 pending 的登录状态
static PENDING_LOGIN: OnceLock<Mutex<Option<WebOAuthInitResult>>> = OnceLock::new();

fn get_pending_login() -> &'static Mutex<Option<WebOAuthInitResult>> {
    PENDING_LOGIN.get_or_init(|| Mutex::new(None))
}

// ============================================================
// Web OAuth 两步登录命令
// ============================================================

/// 第一步:发起登录,返回授权 URL(前端用 WebView 打开)
#[tauri::command]
pub async fn web_oauth_initiate(provider: String) -> Result<WebOAuthInitResponse, String> {
    println!("\n========== web_oauth_initiate START ==========");
    println!("Provider: {}", provider);
    
    if provider != "Google" && provider != "GitHub" && provider != "BuilderId" {
        return Err(format!("Unsupported provider: {}. Use 'Google', 'GitHub' or 'BuilderId'", provider));
    }

    let web_provider = WebOAuthProvider::new(&provider);
    println!("Created WebOAuthProvider");
    
    match web_provider.initiate_login().await {
        Ok(init_result) => {
            println!("initiate_login SUCCESS");
            println!("Authorize URL: {}", init_result.authorize_url);
            println!("State: {}", init_result.state);
            
            let response = WebOAuthInitResponse {
                authorize_url: init_result.authorize_url.clone(),
                state: init_result.state.clone(),
            };
            
            // 保存到全局状态
            *get_pending_login().lock().unwrap() = Some(init_result);
            println!("Saved to PENDING_LOGIN");
            println!("========== web_oauth_initiate SUCCESS ==========\n");
            
            Ok(response)
        },
        Err(e) => {
            println!("initiate_login FAILED: {}", e);
            println!("========== web_oauth_initiate FAILED ==========\n");
            Err(e)
        }
    }
}

#[derive(serde::Serialize)]
pub struct WebOAuthInitResponse {
    pub authorize_url: String,
    pub state: String,
}

/// 第二步：用回调 URL 完成登录
/// callback_url: 浏览器地址栏的完整 URL，如 https://app.kiro.dev/signin/oauth?code=xxx&state=xxx
#[tauri::command]
pub async fn web_oauth_complete(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    callback_url: String,
) -> Result<String, String> {
    println!("[WebOAuth] web_oauth_complete: {}", serde_json::json!({
        "callbackUrl": format!("{}...", &callback_url[..80.min(callback_url.len())])
    }));
    
    // 解析 URL 获取 code 和 state
    let url = url::Url::parse(&callback_url)
        .map_err(|e| format!("Invalid callback URL: {}", e))?;
    
    let code = url.query_pairs()
        .find(|(k, _)| k == "code")
        .map(|(_, v)| v.to_string())
        .ok_or("No 'code' parameter in callback URL")?;
    
    let returned_state = url.query_pairs()
        .find(|(k, _)| k == "state")
        .map(|(_, v)| v.to_string())
        .ok_or("No 'state' parameter in callback URL")?;
    
    println!("[WebOAuth] Parsed callback: {}", serde_json::json!({
        "code": format!("{}...{}", &code[..10.min(code.len())], if code.len() > 20 { &code[code.len()-10..] } else { "" }),
        "state": format!("{}...", &returned_state[..40.min(returned_state.len())])
    }));
    
    // 获取 pending 的登录状态
    let init_result = {
        let mut pending_guard = get_pending_login().lock().unwrap();
        pending_guard.take()
    }.ok_or("No pending authentication state found")?;
    
    println!("[WebOAuth] PENDING_LOGIN: {}", serde_json::json!({
        "provider": init_result.provider_id,
        "state": init_result.state
    }));
    
    // 完成登录
    let web_provider = WebOAuthProvider::new(&init_result.provider_id);
    let auth_result = web_provider.complete_login(
        &code,
        &returned_state,
        &init_result.code_verifier,
        &init_result.state,
    ).await?;

    // 立即刷新一次 token，验证 csrfToken 可用并获取最新 token
    let csrf_token = auth_result.csrf_token.as_ref()
        .ok_or("No csrf_token from ExchangeToken")?;
    let session_token = auth_result.session_token.as_ref()
        .ok_or("No session_token from ExchangeToken")?;
    let refresh_result = web_provider.refresh_token_impl(
        &auth_result.access_token,
        csrf_token,
        session_token,
    ).await?;
    
    println!("[WebOAuth] RefreshToken after login: {}", serde_json::json!({
        "success": true,
        "newCsrfToken": refresh_result.csrf_token
    }));

    // 用刷新后的 token 获取用户配额信息 (使用 KiroWebPortalService)
    let portal_client = crate::providers::web_oauth::KiroWebPortalClient::new();
    let usage = portal_client.get_user_usage_and_limits(
        &refresh_result.access_token,
        refresh_result.csrf_token.as_deref().unwrap_or(""),
        session_token,
        &init_result.idp,
    ).await.ok();

    if let Some(ref u) = usage {
        println!("[WebOAuth] GetUserUsageAndLimits Response: {}", serde_json::to_string_pretty(u).unwrap_or_default());
    } else {
        println!("[WebOAuth] GetUserUsageAndLimits: null");
    }

    let provider = &init_result.provider_id;
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

    // 保存 Token（使用刷新后的 token）
    let (mut token, _is_new) = state.store.lock().unwrap().add_with_tokens(
        email.clone(),
        format!("Kiro {} (Web OAuth)", provider),
        quota,
        refresh_result.access_token.clone(),
        refresh_result.refresh_token.clone(),
        provider.clone(),
        user_id,
        subscription_type,
    );

    token.used = used;
    token.expires_at = Some(refresh_result.expires_at.clone());
    token.profile_arn = auth_result.profile_arn.clone();
    token.csrf_token = refresh_result.csrf_token;
    token.session_token = auth_result.session_token.clone();  // 保存 SessionToken
    token.auth_method = Some("web_oauth".to_string());
    extract_usage_fields_web_portal(&mut token, &usage);

    {
        let mut store = state.store.lock().unwrap();
        if let Some(t) = store.tokens.iter_mut().find(|t| t.id == token.id) {
            *t = token.clone();
        }
        store.save_to_file();
    }

    // 更新认证状态
    update_auth_state_web(&state, &email, provider, &auth_result.access_token, &auth_result.refresh_token);

    // 登录成功后清空 pending 状态
    {
        let mut pending_guard = get_pending_login().lock().unwrap();
        *pending_guard = None;
    }

    println!("[WebOAuth] LOGIN SUCCESS: {}", serde_json::json!({
        "email": token.email,
        "provider": provider,
        "quota": token.quota,
        "used": token.used,
        "csrfToken": token.csrf_token,
        "authMethod": token.auth_method,
        "expiresAt": token.expires_at
    }));

    let _ = app_handle.emit("login-success", token.id.clone());
    Ok(format!("Web OAuth login completed for {}", provider))
}

/// 刷新 Web OAuth Token
#[tauri::command]
pub async fn web_oauth_refresh(
    state: State<'_, AppState>,
    token_id: String,
) -> Result<crate::token::Token, String> {
    let token = {
        let store = state.store.lock().unwrap();
        store.tokens.iter()
            .find(|t| t.id == token_id)
            .cloned()
            .ok_or("Token not found")?
    };

    if token.auth_method.as_deref() != Some("web_oauth") {
        return Err("This token is not a Web OAuth token".to_string());
    }

    let access_token = token.access_token.as_ref()
        .ok_or("No access_token found")?;
    let csrf_token = token.csrf_token.as_ref()
        .ok_or("No csrf_token found")?;
    let session_token = token.session_token.as_ref()
        .ok_or("No session_token found")?;

    let provider = token.provider.as_ref().ok_or("No provider found")?;
    let web_provider = WebOAuthProvider::new(provider);
    let auth_result = web_provider.refresh_token_impl(access_token, csrf_token, session_token).await?;

    let new_csrf = auth_result.csrf_token.clone();
    let mut updated_token = token.clone();
    updated_token.access_token = Some(auth_result.access_token.clone());
    updated_token.refresh_token = Some(auth_result.refresh_token.clone());
    updated_token.csrf_token = auth_result.csrf_token;
    updated_token.expires_at = Some(auth_result.expires_at);

    // 获取用量 (使用 KiroWebPortalService)
    let portal_client = crate::providers::web_oauth::KiroWebPortalClient::new();
    let idp = match provider.as_str() {
        "GitHub" => "Github",
        other => other,
    };
    if let Ok(usage) = portal_client.get_user_usage_and_limits(
        &auth_result.access_token,
        new_csrf.as_deref().unwrap_or(""),
        session_token,
        idp,
    ).await {
        if let Some(list) = &usage.usage_breakdown_list {
            if let Some(b) = list.first() {
                updated_token.quota = b.usage_limit.unwrap_or(updated_token.quota);
                updated_token.used = b.current_usage.unwrap_or(updated_token.used);
            }
        }
        extract_usage_fields_web_portal(&mut updated_token, &Some(usage));
    }

    {
        let mut store = state.store.lock().unwrap();
        if let Some(t) = store.tokens.iter_mut().find(|t| t.id == token_id) {
            *t = updated_token.clone();
        }
        store.save_to_file();
    }

    println!("[WebOAuth] Token refreshed: {}", updated_token.email);
    Ok(updated_token)
}

// ============================================================
// 辅助函数
// ============================================================

fn update_auth_state_web(
    state: &State<'_, AppState>,
    email: &str,
    provider: &str,
    access_token: &str,
    refresh_token: &str,
) {
    let user = User {
        id: uuid::Uuid::new_v4().to_string(),
        email: email.to_string(),
        name: email.split('@').next().unwrap_or("User").to_string(),
        avatar: None,
        provider: provider.to_string(),
    };
    *state.auth.user.lock().unwrap() = Some(user);
    *state.auth.access_token.lock().unwrap() = Some(access_token.to_string());
    *state.auth.refresh_token.lock().unwrap() = Some(refresh_token.to_string());
}

fn extract_usage_fields_web_portal(
    token: &mut crate::token::Token,
    usage: &Option<GetUserUsageAndLimitsResponse>,
) {
    if let Some(u) = usage {
        if let Some(si) = &u.subscription_info {
            token.subscription_plan = si.subscription_title.clone();
            token.subscription_type = si.subscription_type.clone();
        }
        token.days_until_reset = u.days_until_reset;
        if let Some(reset_ts) = u.next_date_reset {
            if let Some(dt) = chrono::DateTime::from_timestamp(reset_ts, 0) {
                token.reset_date = Some(dt.format("%Y/%m/%d").to_string());
            }
        }
        if let Some(list) = &u.usage_breakdown_list {
            if let Some(b) = list.first() {
                token.overage_rate = b.overage_rate;
                token.overage_cap = b.overage_cap;
                token.currency = b.currency.clone();
                if let Some(ft) = &b.free_trial_info {
                    let is_active = ft.free_trial_status.as_ref().map(|s| s == "ACTIVE").unwrap_or(false);
                    token.free_trial_status = ft.free_trial_status.clone();
                    if is_active {
                        token.free_trial_quota = ft.usage_limit;
                        token.free_trial_used = ft.current_usage;
                        if let Some(exp_ts) = ft.free_trial_expiry {
                            if let Some(dt) = chrono::DateTime::from_timestamp(exp_ts, 0) {
                                token.free_trial_expiry = Some(dt.format("%Y/%m/%d").to_string());
                            }
                        }
                    }
                }
                if let Some(bonus_list) = &b.bonuses {
                    let total_quota: i32 = bonus_list.iter().filter_map(|b| b.usage_limit.map(|v| v as i32)).sum();
                    let total_used: i32 = bonus_list.iter().filter_map(|b| b.current_usage.map(|v| v as i32)).sum();
                    token.bonus_quota = if total_quota > 0 { Some(total_quota) } else { None };
                    token.bonus_used = if total_quota > 0 { Some(total_used) } else { None };
                    if let Some(first) = bonus_list.first() {
                        token.bonus_code = first.bonus_code.clone();
                        token.bonus_name = first.display_name.clone();
                        token.bonus_status = first.status.clone();
                        if let Some(exp_ts) = first.expires_at {
                            if let Some(dt) = chrono::DateTime::from_timestamp(exp_ts, 0) {
                                token.bonus_expiry = Some(dt.format("%Y/%m/%d").to_string());
                            }
                        }
                    }
                    token.bonuses = Some(bonus_list.iter().map(|b| crate::token::BonusItem {
                        bonus_code: b.bonus_code.clone(),
                        display_name: b.display_name.clone(),
                        description: None,
                        usage_limit: b.usage_limit,
                        current_usage: b.current_usage,
                        expires_at: b.expires_at.map(|ts| {
                            chrono::DateTime::from_timestamp(ts, 0)
                                .map(|dt| dt.format("%Y/%m/%d %H:%M").to_string())
                                .unwrap_or_default()
                        }),
                        redeemed_at: None,
                        status: b.status.clone(),
                    }).collect());
                }
            }
        }
    }
}


// ============================================================
// 一键登录 - 使用 WebView 窗口自动捕获回调 (Tauri v2)
// ============================================================

/// 一键登录：打开 WebView 窗口，自动监听 URL 变化捕获回调
#[tauri::command]
pub async fn web_oauth_login(
    app_handle: AppHandle,
    provider: String,
) -> Result<WebOAuthLoginResponse, String> {
    println!("\n========== web_oauth_login START ==========");
    println!("Provider: {}", provider);
    
    if provider != "Google" && provider != "GitHub" && provider != "BuilderId" {
        return Err(format!("Unsupported provider: {}. Use 'Google', 'GitHub' or 'BuilderId'", provider));
    }

    // 1. 发起登录获取授权 URL
    let web_provider = WebOAuthProvider::new(&provider);
    let init_result = web_provider.initiate_login().await?;
    
    println!("Authorize URL: {}", init_result.authorize_url);
    println!("State: {}", init_result.state);
    
    // 保存到全局状态
    *get_pending_login().lock().unwrap() = Some(init_result.clone());
    println!("Saved init_result to PENDING_LOGIN, state: {}", init_result.state);
    
    // 2. 创建 WebView 窗口 (Tauri v2 API)
    let window_label = format!("oauth_{}", provider.to_lowercase());
    
    // 先关闭已存在的同名窗口
    if let Some(existing) = app_handle.get_webview_window(&window_label) {
        let _ = existing.close();
    }
    
    let app_handle_clone = app_handle.clone();
    let window_label_clone = window_label.clone();
    
    let window = WebviewWindowBuilder::new(
        &app_handle,
        &window_label,
        WebviewUrl::External(init_result.authorize_url.parse().unwrap())
    )
    .title(format!("Login with {}", provider))
    .inner_size(500.0, 700.0)
    .center()
    .incognito(true)  // 隐私模式：不保留 Cookie，每次都是全新登录
    .on_navigation(move |url| {
        let url_str = url.as_str();
        println!("[WebView] Navigation: {}", url_str);
        
        // 检查是否是回调 URL
        if url_str.starts_with("https://app.kiro.dev/signin/oauth") && url_str.contains("code=") {
            println!("[WebView] Callback URL detected! Emitting event...");
            
            // 发送事件到前端
            let _ = app_handle_clone.emit("web-oauth-callback", url_str.to_string());
            
            // 关闭窗口
            if let Some(win) = app_handle_clone.get_webview_window(&window_label_clone) {
                let _ = win.close();
            }
            
            return false; // 阻止导航到回调页面
        }
        
        true // 允许其他导航
    })
    .build()
    .map_err(|e| format!("Failed to create auth window: {}", e))?;
    
    println!("Created auth window: {}", window.label());
    println!("========== web_oauth_login WINDOW OPENED ==========\n");
    
    Ok(WebOAuthLoginResponse {
        window_label,
        state: init_result.state,
    })
}

#[derive(serde::Serialize)]
pub struct WebOAuthLoginResponse {
    pub window_label: String,
    pub state: String,
}

/// 关闭 OAuth 窗口
#[tauri::command]
pub fn web_oauth_close_window(
    app_handle: AppHandle,
    window_label: String,
) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window(&window_label) {
        window.close().map_err(|e| format!("Failed to close window: {}", e))?;
    }
    Ok(())
}

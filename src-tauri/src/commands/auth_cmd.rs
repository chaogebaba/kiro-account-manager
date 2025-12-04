// Auth 相关命令 - 当前使用的版本

use tauri::{State, Manager};
use crate::state::AppState;
use crate::auth::{User, get_usage_limits_desktop};
use crate::auth_social;
use crate::aws_sso_client::AWSSSOClient;
use crate::kiro_auth_client::KiroAuthServiceClient;
use crate::oauth_callback_server::OAuthCallbackServer;
use crate::provider_factory::{get_provider_config, AuthMethod};

// ============================================================
// 基础认证命令
// ============================================================

#[tauri::command]
pub fn get_current_user(state: State<AppState>) -> Option<User> {
    state.auth.user.lock().unwrap().clone()
}

#[tauri::command]
pub fn logout(state: State<AppState>) {
    *state.auth.user.lock().unwrap() = None;
    *state.auth.csrf_token.lock().unwrap() = None;
    *state.auth.access_token.lock().unwrap() = None;
}

// ============================================================
// 统一登录入口 - 根据 provider 自动选择认证方式
// ============================================================

#[tauri::command]
pub async fn kiro_login(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    provider: String,
) -> Result<String, String> {
    let config = get_provider_config(&provider)
        .ok_or_else(|| format!("Unsupported provider: {}", provider))?;

    match config.auth_method {
        AuthMethod::Social => login_social(app_handle, state, config).await,
        AuthMethod::Idc => login_idc(app_handle, state, config).await,
    }
}

// ============================================================
// Social Login (Google / GitHub)
// ============================================================

async fn login_social(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    config: crate::provider_factory::ProviderConfig,
) -> Result<String, String> {
    let provider = config.provider_id.clone();

    let social_auth_ports: Vec<u16> = vec![
        49153, 50153, 51153, 52153, 53153, 4649, 6588, 9091, 8008, 3128,
    ];

    let mut server = OAuthCallbackServer::new_predefined("localhost", social_auth_ports);
    let redirect_uri = server
        .start()
        .map_err(|e| format!("Failed to start OAuth callback server: {}", e))?;

    let state_str = uuid::Uuid::new_v4().to_string();
    let code_verifier = auth_social::generate_code_verifier_social();
    let code_challenge = auth_social::generate_code_challenge_social(&code_verifier);

    println!("\n[2] OAUTH CALLBACK SERVER STARTED");
    println!("Redirect URI: {}", redirect_uri);
    println!();

    println!("[3] PKCE GENERATED");
    println!("Code Verifier: {}", code_verifier);
    println!("Code Challenge: {}", code_challenge);
    println!("State: {}", state_str);
    println!();

    let client = KiroAuthServiceClient::new();
    client
        .login(&provider, &redirect_uri, &code_challenge, &state_str)
        .await?;

    println!("[4] WAITING FOR BROWSER CALLBACK...");

    let wait_result = tokio::task::spawn_blocking(move || server.wait_for_callback())
        .await
        .map_err(|e| format!("Failed to join callback waiter: {}", e))?;

    let callback = wait_result.map_err(|e| format!("OAuth callback failed: {}", e))?;

    if callback.state != state_str {
        return Err("State mismatch - possible CSRF attack".to_string());
    }

    #[derive(serde::Deserialize)]
    #[allow(dead_code)]
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
        .create_token(&callback.code, &code_verifier, &redirect_uri, None)
        .await?;

    let usage = get_usage_limits_desktop(&token_response.access_token).await.ok();

    // 提取基础信息
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

    let (mut token, _is_new) = state.store.lock().unwrap().add_with_tokens(
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

    // 提取额外字段
    if let Some(u) = &usage {
        // 订阅详情
        if let Some(si) = &u.subscription_info {
            token.subscription_plan = si.subscription_title.clone();
        }
        // 重置日期
        token.days_until_reset = u.days_until_reset;
        if let Some(reset_ts) = u.next_date_reset {
            if let Some(dt) = chrono::DateTime::from_timestamp(reset_ts as i64, 0) {
                token.reset_date = Some(dt.format("%Y/%m/%d").to_string());
            }
        }
        // 配额详情
        if let Some(list) = &u.usage_breakdown_list {
            if let Some(b) = list.first() {
                token.overage_rate = b.overage_rate;
                token.overage_cap = b.overage_cap;
                // 免费试用
                if let Some(ft) = &b.free_trial_info {
                    token.free_trial_quota = ft.usage_limit;
                    token.free_trial_used = ft.current_usage;
                    token.free_trial_status = ft.free_trial_status.clone();
                    if let Some(exp_ts) = ft.free_trial_expiry {
                        if let Some(dt) = chrono::DateTime::from_timestamp(exp_ts as i64, 0) {
                            token.free_trial_expiry = Some(dt.format("%Y/%m/%d").to_string());
                        }
                    }
                }
                // 奖励额度
                if let Some(bonuses) = &b.bonuses {
                    if let Some(bonus) = bonuses.iter().find(|b| b.status.as_deref() == Some("ACTIVE")) {
                        token.bonus_code = bonus.bonus_code.clone();
                        token.bonus_name = bonus.display_name.clone();
                        token.bonus_quota = bonus.usage_limit.map(|v| v as i32);
                        token.bonus_used = bonus.current_usage.map(|v| v as i32);
                        token.bonus_status = bonus.status.clone();
                        if let Some(exp_ts) = bonus.expires_at {
                            if let Some(dt) = chrono::DateTime::from_timestamp(exp_ts as i64, 0) {
                                token.bonus_expiry = Some(dt.format("%Y/%m/%d").to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    // 保存 token
    {
        let mut store = state.store.lock().unwrap();
        if let Some(t) = store.tokens.iter_mut().find(|t| t.id == token.id) {
            *t = token.clone();
        }
        store.save_to_file();
    }

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

    println!("\n[8] LOGIN SUCCESS");
    println!("Email: {}", token.email);
    println!("Provider: {}", provider);
    println!("Quota: {}/{}", token.used, token.quota);
    println!();

    let _ = app_handle.emit_all("login-success", token.id.clone());

    Ok(format!("Social login completed for {}", provider))
}

// ============================================================
// handle_kiro_social_callback - 被 AuthCallback.jsx 调用
// ============================================================

#[tauri::command]
pub async fn handle_kiro_social_callback(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    code: String,
    callback_state: String,
) -> Result<(), String> {
    let pending = {
        let lock = state.pending_login.lock().unwrap();
        lock.clone().ok_or("No pending login found")?
    };
    
    if pending.state != callback_state {
        return Err("State mismatch".to_string());
    }
    
    let redirect_uri = "kiro://app/callback";
    
    let token_response = auth_social::exchange_social_code_for_token(
        &code,
        &pending.code_verifier,
        redirect_uri,
        &pending.machineid,
    ).await?;
    
    println!("Social token exchange success for {}", pending.provider);
    
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
    
    let (mut token, _is_new) = state.store.lock().unwrap().add_with_tokens(
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
    
    {
        let mut store = state.store.lock().unwrap();
        if let Some(t) = store.tokens.iter_mut().find(|t| t.id == token.id) {
            t.used = used;
        }
        store.save_to_file();
    }
    
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
    
    let _ = app_handle.emit_all("login-success", token.id);
    
    println!("Social login completed and account added: {}", email);
    
    Ok(())
}

// ============================================================
// add_kiro_token - 被 TokenManager.jsx 的 kiro-login-data 事件调用
// ============================================================

#[tauri::command]
pub async fn add_kiro_token(
    state: State<'_, AppState>,
    email: String,
    access_token: String,
    refresh_token: String,
    csrf_token: String,
    idp: String,
    _quota: Option<i32>,
    _used: Option<i32>,
) -> Result<crate::token::Token, String> {
    println!("Adding Kiro token: email={}, idp={}", email, idp);
    
    let usage = if !access_token.is_empty() {
        get_usage_limits_desktop(&access_token).await.ok()
    } else {
        None
    };
    
    let final_email = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|ui| ui.email.clone())
        .unwrap_or(email.clone());
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
        .unwrap_or((_quota.unwrap_or(50), _used.unwrap_or(0)));
    
    *state.auth.access_token.lock().unwrap() = Some(access_token.clone());
    *state.auth.refresh_token.lock().unwrap() = Some(refresh_token.clone());
    *state.auth.csrf_token.lock().unwrap() = Some(csrf_token.clone());
    
    let user = User {
        id: uuid::Uuid::new_v4().to_string(),
        email: final_email.clone(),
        name: final_email.split('@').next().unwrap_or("User").to_string(),
        avatar: None,
        provider: idp.clone(),
    };
    *state.auth.user.lock().unwrap() = Some(user);
    *state.pending_login.lock().unwrap() = None;
    
    let (mut token, _is_new) = state.store.lock().unwrap().add_with_tokens(
        final_email,
        format!("Kiro {} 账号", idp),
        quota,
        access_token,
        refresh_token,
        idp,
        user_id,
        subscription_type,
    );
    
    token.used = used;
    token.csrf_token = Some(csrf_token);
    
    {
        let mut store = state.store.lock().unwrap();
        if let Some(t) = store.tokens.iter_mut().find(|t| t.id == token.id) {
            t.used = used;
            t.csrf_token = token.csrf_token.clone();
        }
        store.save_to_file();
    }
    
    Ok(token)
}


// ============================================================
// IdC Login (BuilderId / Enterprise) - AWS SSO OIDC 认证
// ============================================================

async fn login_idc(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    config: crate::provider_factory::ProviderConfig,
) -> Result<String, String> {
    let region = &config.region;
    let start_url = config.start_url.as_deref()
        .unwrap_or_else(|| AWSSSOClient::get_builder_id_start_url());
    let provider = config.provider_id.clone();
    
    println!("\n[{}] Starting AWS SSO OIDC authentication...", provider);
    println!("Region: {}", region);
    println!("Start URL: {}", start_url);

    // Step 1: 创建 AWS SSO 客户端
    let sso_client = AWSSSOClient::new(&region);

    // Step 2: 注册 OAuth 客户端
    println!("\n[{}] Registering OAuth client...", provider);
    let client_reg = sso_client.register_client(&start_url).await?;
    println!("Client ID: {}...", &client_reg.client_id[..20.min(client_reg.client_id.len())]);

    // Step 3: 启动 OAuth 回调服务器（随机端口）
    let mut server = OAuthCallbackServer::new_random("127.0.0.1");
    let redirect_uri = server
        .start()
        .map_err(|e| format!("Failed to start OAuth callback server: {}", e))?;
    println!("Redirect URI: {}", redirect_uri);

    // Step 4: 生成 PKCE 参数
    let pkce = AWSSSOClient::generate_pkce();
    let state_str = AWSSSOClient::generate_state();
    println!("PKCE Code Challenge: {}...", &pkce.code_challenge[..20]);
    println!("State: {}", state_str);

    // Step 5: 构建授权 URL
    let auth_url = sso_client.build_authorization_url(
        &client_reg.client_id,
        &redirect_uri,
        &state_str,
        &pkce.code_challenge,
    );

    // Step 6: 打开浏览器
    println!("\n[{}] Opening browser for authentication...", provider);
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &auth_url])
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        open::that(&auth_url)
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }

    // Step 7: 等待回调
    println!("[{}] Waiting for authentication callback...", provider);
    let callback = tokio::task::spawn_blocking(move || server.wait_for_callback())
        .await
        .map_err(|e| format!("Failed to join callback waiter: {}", e))?
        .map_err(|e| format!("OAuth callback failed: {}", e))?;

    // 验证 state
    if callback.state != state_str {
        return Err("State mismatch - possible CSRF attack".to_string());
    }
    println!("[{}] Callback received, exchanging code for tokens...", provider);

    // Step 8: 交换授权码获取 Token
    let token_response = sso_client.create_token(
        &client_reg.client_id,
        &client_reg.client_secret,
        &callback.code,
        &pkce.code_verifier,
        &redirect_uri,
    ).await?;

    println!("[{}] Tokens obtained successfully!", provider);

    // Step 9: 获取用户信息和配额
    let usage = get_usage_limits_desktop(&token_response.access_token).await.ok();

    let email = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|ui| ui.email.clone())
        .unwrap_or_else(|| "user@builder.id".to_string());
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

    // Step 10: 保存账号
    let (mut token, _is_new) = state.store.lock().unwrap().add_with_tokens(
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
    // 保存 AWS SSO 客户端信息（用于刷新 token）
    token.sso_client_id = Some(client_reg.client_id.clone());
    token.sso_client_secret = Some(client_reg.client_secret.clone());
    token.sso_region = Some(region.to_string());

    // 提取额外字段
    if let Some(u) = &usage {
        if let Some(si) = &u.subscription_info {
            token.subscription_plan = si.subscription_title.clone();
        }
        token.days_until_reset = u.days_until_reset;
        if let Some(reset_ts) = u.next_date_reset {
            if let Some(dt) = chrono::DateTime::from_timestamp(reset_ts as i64, 0) {
                token.reset_date = Some(dt.format("%Y/%m/%d").to_string());
            }
        }
        if let Some(list) = &u.usage_breakdown_list {
            if let Some(b) = list.first() {
                token.overage_rate = b.overage_rate;
                token.overage_cap = b.overage_cap;
                if let Some(ft) = &b.free_trial_info {
                    token.free_trial_quota = ft.usage_limit;
                    token.free_trial_used = ft.current_usage;
                    token.free_trial_status = ft.free_trial_status.clone();
                    if let Some(exp_ts) = ft.free_trial_expiry {
                        if let Some(dt) = chrono::DateTime::from_timestamp(exp_ts as i64, 0) {
                            token.free_trial_expiry = Some(dt.format("%Y/%m/%d").to_string());
                        }
                    }
                }
                if let Some(bonuses) = &b.bonuses {
                    if let Some(bonus) = bonuses.iter().find(|b| b.status.as_deref() == Some("ACTIVE")) {
                        token.bonus_code = bonus.bonus_code.clone();
                        token.bonus_name = bonus.display_name.clone();
                        token.bonus_quota = bonus.usage_limit.map(|v| v as i32);
                        token.bonus_used = bonus.current_usage.map(|v| v as i32);
                        token.bonus_status = bonus.status.clone();
                        if let Some(exp_ts) = bonus.expires_at {
                            if let Some(dt) = chrono::DateTime::from_timestamp(exp_ts as i64, 0) {
                                token.bonus_expiry = Some(dt.format("%Y/%m/%d").to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    // 保存更新
    {
        let mut store = state.store.lock().unwrap();
        if let Some(t) = store.tokens.iter_mut().find(|t| t.id == token.id) {
            *t = token.clone();
        }
        store.save_to_file();
    }

    // 更新认证状态
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

    println!("\n[{}] LOGIN SUCCESS", provider);
    println!("Email: {}", token.email);
    println!("Quota: {}/{}", token.used, token.quota);

    let _ = app_handle.emit_all("login-success", token.id.clone());

    Ok(format!("{} login completed for {}", provider, email))
}


// ============================================================
// 获取支持的登录方式
// ============================================================

#[tauri::command]
pub fn get_supported_providers() -> Vec<&'static str> {
    crate::provider_factory::get_supported_providers()
}

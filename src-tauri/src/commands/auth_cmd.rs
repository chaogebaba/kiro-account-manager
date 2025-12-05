// Auth 相关命令
// 使用 providers 模块进行认证

use tauri::{State, Manager};
use crate::state::AppState;
use crate::auth::{User, get_usage_limits_desktop};
use crate::auth_social;
use crate::codewhisperer_client::CodeWhispererClient;
use crate::providers::{AuthMethod, AuthProvider, get_provider_config, create_social_provider, create_idc_provider};

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
// 统一登录入口
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
        AuthMethod::Social => login_social(app_handle, state, &config).await,
        AuthMethod::Idc => login_idc(app_handle, state, &config).await,
    }
}


// ============================================================
// Social Login (Google / GitHub)
// ============================================================

async fn login_social(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    config: &crate::providers::ProviderConfig,
) -> Result<String, String> {
    let social_provider = create_social_provider(config);
    let provider_id = social_provider.get_provider_id().to_string();
    let auth_method = social_provider.get_auth_method();
    
    let auth_result = social_provider.login().await?;

    let usage = get_usage_limits_desktop(&auth_result.access_token).await.ok();

    let email = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|ui| ui.email.clone())
        .unwrap_or_else(|| format!("user@{}.com", provider_id.to_lowercase()));
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
        format!("Kiro {} 账号", provider_id),
        quota,
        auth_result.access_token.clone(),
        auth_result.refresh_token.clone(),
        provider_id.clone(),
        user_id,
        subscription_type,
    );

    token.used = used;
    token.expires_at = Some(auth_result.expires_at.clone());
    token.profile_arn = auth_result.profile_arn;
    token.csrf_token = auth_result.csrf_token;
    extract_usage_fields(&mut token, &usage);

    {
        let mut store = state.store.lock().unwrap();
        if let Some(t) = store.tokens.iter_mut().find(|t| t.id == token.id) {
            *t = token.clone();
        }
        store.save_to_file();
    }

    update_auth_state(&state, &email, &provider_id, &auth_result.access_token, &auth_result.refresh_token);

    println!("\n[{}] LOGIN SUCCESS: {} - {}/{}", auth_method, token.email, token.used, token.quota);

    let _ = app_handle.emit_all("login-success", token.id.clone());
    Ok(format!("{} login completed for {}", auth_method, provider_id))
}


// ============================================================
// IdC Login (BuilderId / Enterprise)
// ============================================================

async fn login_idc(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    config: &crate::providers::ProviderConfig,
) -> Result<String, String> {
    let idc_provider = create_idc_provider(config);
    let provider_id = idc_provider.get_provider_id().to_string();
    let auth_method = idc_provider.get_auth_method();
    
    let auth_result = idc_provider.login().await?;

    // 尝试用 CodeWhisperer API 获取限额
    let machine_id = "66c23a8c5d15afabec89ef9954ef52a119f10d369df04d548fc6c1eac694b0d1";
    let cw_client = CodeWhispererClient::new(machine_id);
    let usage = cw_client.get_usage_limits(&auth_result.access_token).await.ok();

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

    let (mut token, _is_new) = state.store.lock().unwrap().add_with_tokens(
        email.clone(),
        format!("Kiro {} 账号", provider_id),
        quota,
        auth_result.access_token.clone(),
        auth_result.refresh_token.clone(),
        provider_id.clone(),
        user_id,
        subscription_type,
    );

    token.used = used;
    token.expires_at = Some(auth_result.expires_at.clone());
    token.client_id_hash = auth_result.client_id_hash;
    token.sso_client_id = auth_result.client_id;
    token.sso_client_secret = auth_result.client_secret;
    token.sso_region = auth_result.region;
    token.auth_method = Some(auth_result.auth_method.clone());
    token.profile_arn = auth_result.profile_arn.clone();
    extract_usage_fields_cw(&mut token, &usage);

    {
        let mut store = state.store.lock().unwrap();
        if let Some(t) = store.tokens.iter_mut().find(|t| t.id == token.id) {
            *t = token.clone();
        }
        store.save_to_file();
    }

    update_auth_state(&state, &email, &provider_id, &auth_result.access_token, &auth_result.refresh_token);

    println!("\n[{}] LOGIN SUCCESS: {} - {}/{}", auth_method, token.email, token.used, token.quota);

    let _ = app_handle.emit_all("login-success", token.id.clone());
    Ok(format!("{} login completed for {}", auth_method, email))
}


// ============================================================
// 辅助函数
// ============================================================

fn extract_usage_fields(token: &mut crate::token::Token, usage: &Option<crate::auth::DesktopUsageResponse>) {
    if let Some(u) = usage {
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
                token.currency = b.currency.clone();
                if let Some(ft) = &b.free_trial_info {
                    let is_active = ft.free_trial_status.as_ref().map(|s| s == "ACTIVE").unwrap_or(false);
                    token.free_trial_status = ft.free_trial_status.clone();
                    if is_active {
                        token.free_trial_quota = ft.usage_limit;
                        token.free_trial_used = ft.current_usage;
                        if let Some(exp_ts) = ft.free_trial_expiry {
                            if let Some(dt) = chrono::DateTime::from_timestamp(exp_ts as i64, 0) {
                                token.free_trial_expiry = Some(dt.format("%Y/%m/%d").to_string());
                            }
                        }
                    }
                }
                // 处理 bonuses 数组
                if let Some(bonus_list) = &b.bonuses {
                    // 汇总
                    let total_quota: i32 = bonus_list.iter().filter_map(|b| b.usage_limit.map(|v| v as i32)).sum();
                    let total_used: i32 = bonus_list.iter().filter_map(|b| b.current_usage.map(|v| v as i32)).sum();
                    token.bonus_quota = if total_quota > 0 { Some(total_quota) } else { None };
                    token.bonus_used = if total_quota > 0 { Some(total_used) } else { None };
                    // 第一个 bonus 的信息
                    if let Some(first) = bonus_list.first() {
                        token.bonus_code = first.bonus_code.clone();
                        token.bonus_name = first.display_name.clone();
                        token.bonus_status = first.status.clone();
                        token.bonus_description = first.description.clone();
                        if let Some(exp_ts) = first.expires_at {
                            if let Some(dt) = chrono::DateTime::from_timestamp(exp_ts as i64, 0) {
                                token.bonus_expiry = Some(dt.format("%Y/%m/%d").to_string());
                            }
                        }
                        if let Some(red_ts) = first.redeemed_at {
                            if let Some(dt) = chrono::DateTime::from_timestamp(red_ts as i64, 0) {
                                token.bonus_redeemed_at = Some(dt.format("%Y/%m/%d").to_string());
                            }
                        }
                    }
                    // 完整数组
                    token.bonuses = Some(bonus_list.iter().map(|b| crate::token::BonusItem {
                        bonus_code: b.bonus_code.clone(),
                        display_name: b.display_name.clone(),
                        description: b.description.clone(),
                        usage_limit: b.usage_limit,
                        current_usage: b.current_usage,
                        expires_at: b.expires_at.map(|ts| {
                            chrono::DateTime::from_timestamp(ts as i64, 0)
                                .map(|dt| dt.format("%Y/%m/%d %H:%M").to_string())
                                .unwrap_or_default()
                        }),
                        redeemed_at: b.redeemed_at.map(|ts| {
                            chrono::DateTime::from_timestamp(ts as i64, 0)
                                .map(|dt| dt.format("%Y/%m/%d %H:%M").to_string())
                                .unwrap_or_default()
                        }),
                        status: b.status.clone(),
                    }).collect());
                }
            }
        }
    }
}

/// 从 CodeWhisperer API 响应提取 usage 字段 (用于 IdC)
fn extract_usage_fields_cw(token: &mut crate::token::Token, usage: &Option<crate::codewhisperer_client::CodeWhispererUsageResponse>) {
    if let Some(u) = usage {
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
                token.overage_cap_with_precision = b.overage_cap_with_precision;
                token.current_overages = b.current_overages;
                token.current_overages_with_precision = b.current_overages_with_precision;
                token.overage_charges = b.overage_charges;
                token.display_name = b.display_name.clone();
                token.display_name_plural = b.display_name_plural.clone();
                token.resource_type = b.resource_type.clone();
                token.unit = b.unit.clone();
                token.currency = b.currency.clone();
                token.quota_with_precision = b.usage_limit_with_precision;
                token.used_with_precision = b.current_usage_with_precision;
                
                if let Some(ft) = &b.free_trial_info {
                    let is_active = ft.free_trial_status.as_ref().map(|s| s == "ACTIVE").unwrap_or(false);
                    token.free_trial_status = ft.free_trial_status.clone();
                    if is_active {
                        token.free_trial_quota = ft.usage_limit;
                        token.free_trial_used = ft.current_usage;
                        token.free_trial_quota_with_precision = ft.usage_limit_with_precision;
                        token.free_trial_used_with_precision = ft.current_usage_with_precision;
                        if let Some(exp_ts) = ft.free_trial_expiry {
                            if let Some(dt) = chrono::DateTime::from_timestamp(exp_ts as i64, 0) {
                                token.free_trial_expiry = Some(dt.format("%Y/%m/%d").to_string());
                            }
                        }
                    }
                }
                // 处理 bonuses 数组
                if let Some(bonus_list) = &b.bonuses {
                    // 汇总
                    let total_quota: i32 = bonus_list.iter().filter_map(|b| b.usage_limit.map(|v| v as i32)).sum();
                    let total_used: i32 = bonus_list.iter().filter_map(|b| b.current_usage.map(|v| v as i32)).sum();
                    token.bonus_quota = if total_quota > 0 { Some(total_quota) } else { None };
                    token.bonus_used = if total_quota > 0 { Some(total_used) } else { None };
                    // 第一个 bonus 的信息
                    if let Some(first) = bonus_list.first() {
                        token.bonus_code = first.bonus_code.clone();
                        token.bonus_name = first.display_name.clone();
                        token.bonus_status = first.status.clone();
                        if let Some(exp_ts) = first.expires_at {
                            if let Some(dt) = chrono::DateTime::from_timestamp(exp_ts as i64, 0) {
                                token.bonus_expiry = Some(dt.format("%Y/%m/%d").to_string());
                            }
                        }
                    }
                    // 完整数组 (IdC BonusInfo 没有 description 和 redeemed_at)
                    token.bonuses = Some(bonus_list.iter().map(|b| crate::token::BonusItem {
                        bonus_code: b.bonus_code.clone(),
                        display_name: b.display_name.clone(),
                        description: None,
                        usage_limit: b.usage_limit,
                        current_usage: b.current_usage,
                        expires_at: b.expires_at.map(|ts| {
                            chrono::DateTime::from_timestamp(ts as i64, 0)
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

fn update_auth_state(state: &State<'_, AppState>, email: &str, provider: &str, access_token: &str, refresh_token: &str) {
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
    *state.pending_login.lock().unwrap() = None;
}


// ============================================================
// handle_kiro_social_callback
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
        &code, &pending.code_verifier, redirect_uri, &pending.machineid,
    ).await?;
    
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
    
    let (mut token, _) = state.store.lock().unwrap().add_with_tokens(
        email.clone(), format!("Kiro {} 账号", pending.provider), quota,
        token_response.access_token.clone(), token_response.refresh_token.clone(),
        pending.provider.clone(), user_id, subscription_type,
    );
    token.used = used;
    extract_usage_fields(&mut token, &usage);
    
    {
        let mut store = state.store.lock().unwrap();
        if let Some(t) = store.tokens.iter_mut().find(|t| t.id == token.id) {
            *t = token.clone();
        }
        store.save_to_file();
    }
    
    update_auth_state(&state, &email, &pending.provider, &token_response.access_token, &token_response.refresh_token);
    let _ = app_handle.emit_all("login-success", token.id);
    println!("Social callback login completed: {}", email);
    Ok(())
}


// ============================================================
// add_kiro_token
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
    
    let (mut token, _) = state.store.lock().unwrap().add_with_tokens(
        final_email, format!("Kiro {} 账号", idp), quota,
        access_token, refresh_token, idp, user_id, subscription_type,
    );
    token.used = used;
    token.csrf_token = Some(csrf_token.clone());
    extract_usage_fields(&mut token, &usage);
    
    {
        let mut store = state.store.lock().unwrap();
        if let Some(t) = store.tokens.iter_mut().find(|t| t.id == token.id) {
            *t = token.clone();
        }
        store.save_to_file();
    }
    
    Ok(token)
}

// ============================================================
// 获取支持的登录方式
// ============================================================

#[tauri::command]
pub fn get_supported_providers() -> Vec<&'static str> {
    crate::providers::get_supported_providers()
}

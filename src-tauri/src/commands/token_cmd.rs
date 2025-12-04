// Token 相关命令

use tauri::State;
use crate::state::AppState;
use crate::token::Token;
use crate::auth::{User, refresh_token_desktop, get_usage_limits_desktop};
use serde::{Deserialize, Serialize};

/// verify_token 返回的简化响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageAndLimitsResponse {
    #[serde(rename = "usageLimit")]
    pub usage_limit: Option<i32>,
    #[serde(rename = "currentUsage")]
    pub current_usage: Option<i32>,
    #[serde(rename = "resetDate")]
    pub reset_date: Option<String>,
    #[serde(rename = "subscriptionType")]
    pub subscription_type: Option<String>,
    #[serde(rename = "userId")]
    pub user_id: Option<String>,
}

#[tauri::command]
pub fn get_tokens(state: State<AppState>) -> Vec<Token> {
    state.store.lock().unwrap().get_all()
}

#[tauri::command]
pub fn update_token(
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
pub fn delete_token(state: State<AppState>, id: String) -> bool {
    state.store.lock().unwrap().delete(&id)
}

#[tauri::command]
pub fn delete_tokens(state: State<AppState>, ids: Vec<String>) -> usize {
    state.store.lock().unwrap().delete_many(&ids)
}

#[allow(dead_code)]
#[tauri::command]
pub fn refresh_token_status(state: State<AppState>, id: String) -> Option<Token> {
    state.store.lock().unwrap().refresh_status(&id)
}

#[tauri::command]
pub async fn refresh_token_from_api(state: State<'_, AppState>, id: String) -> Result<Token, String> {
    let token = {
        let store = state.store.lock().unwrap();
        store.tokens.iter().find(|t| t.id == id).cloned()
    }.ok_or("Token not found")?;

    let refresh_token_str = token.refresh_token.as_ref().ok_or("No refresh token")?;
    
    // 根据 provider 选择刷新方式
    let (new_access_token, new_refresh_token, expires_in) = if token.provider.as_deref() == Some("BuilderId") {
        // BuilderId 使用 AWS SSO OIDC API 刷新
        let client_id = token.sso_client_id.as_ref().ok_or("No SSO client_id")?;
        let client_secret = token.sso_client_secret.as_ref().ok_or("No SSO client_secret")?;
        let region = token.sso_region.as_deref().unwrap_or("us-east-1");
        
        let sso_client = crate::aws_sso_client::AWSSSOClient::new(region);
        let sso_result = sso_client.refresh_token(client_id, client_secret, refresh_token_str).await?;
        (sso_result.access_token, Some(sso_result.refresh_token), sso_result.expires_in)
    } else {
        // Google/GitHub 使用 Kiro Desktop API 刷新
        let refresh_result = refresh_token_desktop(refresh_token_str).await?;
        (refresh_result.access_token, Some(refresh_result.refresh_token), refresh_result.expires_in)
    };
    
    let new_access_token = new_access_token;
    let usage = get_usage_limits_desktop(&new_access_token).await?;
    
    let breakdown = usage.usage_breakdown_list.as_ref().and_then(|list| list.first());
    let quota = breakdown.and_then(|b| b.usage_limit).unwrap_or(50);
    let used = breakdown.and_then(|b| b.current_usage).unwrap_or(0);
    
    let (reset_date, days_until_reset) = breakdown.and_then(|b| b.next_date_reset).map(|ts| {
        let reset_dt = chrono::DateTime::from_timestamp(ts as i64, 0);
        let date_str = reset_dt.map(|dt| dt.format("%Y/%m/%d").to_string()).unwrap_or_default();
        let days = reset_dt.map(|dt| {
            let now = chrono::Utc::now();
            let diff = dt.signed_duration_since(now);
            diff.num_days() as i32
        }).unwrap_or(0);
        (date_str, days)
    }).map(|(d, days)| (Some(d), Some(days))).unwrap_or((None, None));
    
    let free_trial = breakdown.and_then(|b| b.free_trial_info.as_ref());
    let free_trial_quota = free_trial.and_then(|f| f.usage_limit);
    let free_trial_used = free_trial.and_then(|f| f.current_usage);
    let free_trial_expiry = free_trial.and_then(|f| f.free_trial_expiry).map(|ts| {
        chrono::DateTime::from_timestamp(ts as i64, 0)
            .map(|dt| dt.format("%Y/%m/%d").to_string())
            .unwrap_or_default()
    });
    let free_trial_status = free_trial.and_then(|f| f.free_trial_status.clone());
    
    let (bonus_quota, bonus_used, bonus_expiry, bonus_name, bonus_code, bonus_status) = breakdown
        .and_then(|b| b.bonuses.as_ref())
        .map(|bonuses| {
            let total_quota: i32 = bonuses.iter().filter_map(|b| b.usage_limit.map(|v| v as i32)).sum();
            let total_used: i32 = bonuses.iter().filter_map(|b| b.current_usage.map(|v| v as i32)).sum();
            let first = bonuses.first();
            let expiry = first.and_then(|b| b.expires_at).map(|ts| {
                chrono::DateTime::from_timestamp(ts as i64, 0)
                    .map(|dt| dt.format("%Y/%m/%d").to_string())
                    .unwrap_or_default()
            });
            let name = first.and_then(|b| b.display_name.clone());
            let code = first.and_then(|b| b.bonus_code.clone());
            let status = first.and_then(|b| b.status.clone());
            (total_quota, total_used, expiry, name, code, status)
        })
        .unwrap_or((0, 0, None, None, None, None));
    
    let overage_rate = breakdown.and_then(|b| b.overage_rate);
    let overage_cap = breakdown.and_then(|b| b.overage_cap);
    
    let subscription_info = usage.subscription_info.as_ref();
    let subscription_type = subscription_info.and_then(|s| s.subscription_title.clone());
    let subscription_plan = subscription_info.and_then(|s| s.subscription_type.clone());
    let overage_capable = subscription_info.and_then(|s| s.overage_capability.as_ref())
        .map(|c| c == "OVERAGE_CAPABLE");
    let upgrade_capable = subscription_info.and_then(|s| s.upgrade_capability.as_ref())
        .map(|c| c == "UPGRADE_CAPABLE");

    let expires_at = chrono::Local::now() + chrono::Duration::seconds(expires_in);
    let expires_at_str = expires_at.format("%Y/%m/%d %H:%M:%S").to_string();

    let mut store = state.store.lock().unwrap();
    let token_idx = store.tokens.iter().position(|t| t.id == id);
    
    if let Some(idx) = token_idx {
        store.tokens[idx].quota = quota;
        store.tokens[idx].used = used;
        store.tokens[idx].access_token = Some(new_access_token);
        if let Some(rt) = new_refresh_token {
            store.tokens[idx].refresh_token = Some(rt);
        }
        store.tokens[idx].expires_at = Some(expires_at_str);
        store.tokens[idx].reset_date = reset_date;
        store.tokens[idx].days_until_reset = days_until_reset;
        
        store.tokens[idx].free_trial_quota = free_trial_quota;
        store.tokens[idx].free_trial_used = free_trial_used;
        store.tokens[idx].free_trial_expiry = free_trial_expiry;
        store.tokens[idx].free_trial_status = free_trial_status;
        
        store.tokens[idx].bonus_quota = if bonus_quota > 0 { Some(bonus_quota) } else { None };
        store.tokens[idx].bonus_used = if bonus_quota > 0 { Some(bonus_used) } else { None };
        store.tokens[idx].bonus_expiry = bonus_expiry;
        store.tokens[idx].bonus_name = bonus_name;
        store.tokens[idx].bonus_code = bonus_code;
        store.tokens[idx].bonus_status = bonus_status;
        
        store.tokens[idx].overage_rate = overage_rate;
        store.tokens[idx].overage_cap = overage_cap;
        store.tokens[idx].overage_capable = overage_capable;
        
        if subscription_type.is_some() {
            store.tokens[idx].subscription_type = subscription_type;
        }
        store.tokens[idx].subscription_plan = subscription_plan;
        store.tokens[idx].upgrade_capable = upgrade_capable;
        
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

#[tauri::command]
pub async fn verify_token(
    _access_token: String,
    refresh_token: String,
    _csrf_token: Option<String>,
    _provider: String,
) -> Result<UsageAndLimitsResponse, String> {
    let refresh_result = refresh_token_desktop(&refresh_token).await?;
    let new_access_token = refresh_result.access_token;
    let usage = get_usage_limits_desktop(&new_access_token).await?;
    
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

#[tauri::command]
pub async fn add_token_by_refresh(
    state: State<'_, AppState>,
    refresh_token: String,
    provider: Option<String>,
) -> Result<Token, String> {
    println!("Adding token by refresh (desktop API)");
    
    let refresh_result = refresh_token_desktop(&refresh_token).await?;
    let access_token = refresh_result.access_token;
    println!("Got accessToken: {}...", &access_token[..30.min(access_token.len())]);
    
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
    
    let idp = provider.unwrap_or_else(|| {
        if email.contains("gmail") { "Google".to_string() }
        else if email.contains("github") { "Github".to_string() }
        else { "Google".to_string() }
    });
    
    println!("Got: email={}, quota={}, used={}, subscription={:?}", email, quota, used, subscription_type);
    
    let (token, is_new) = state.store.lock().unwrap().add_with_tokens(
        email.clone(),
        format!("Kiro {} 账号", idp),
        quota,
        access_token.clone(),
        refresh_token,
        idp.clone(),
        user_id,
        subscription_type,
    );
    println!("Token {}: {}", if is_new { "added" } else { "updated" }, email);
    
    // 如果账号已存在，返回错误
    if !is_new {
        return Err(format!("账号 {} 已存在", email));
    }
    
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
        provider: idp,
    };
    *state.auth.user.lock().unwrap() = Some(user);
    *state.auth.access_token.lock().unwrap() = Some(access_token);
    
    Ok(token)
}

#[tauri::command]
pub fn import_tokens(state: State<AppState>, tokens_json: String) -> Result<usize, String> {
    state.store.lock().unwrap().import_from_json(&tokens_json)
}

#[tauri::command]
pub fn export_tokens(state: State<AppState>) -> String {
    state.store.lock().unwrap().export_to_json()
}

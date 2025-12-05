// Token 相关命令

use tauri::State;
use crate::state::AppState;
use crate::token::{Token, BonusItem};
use crate::auth::{User, refresh_token_desktop, get_usage_limits_desktop};
use crate::codewhisperer_client::CodeWhispererClient;
use crate::providers::{AuthProvider, SocialProvider, IdcProvider, RefreshMetadata};
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



#[tauri::command]
pub async fn refresh_token_from_api(state: State<'_, AppState>, id: String) -> Result<Token, String> {
    let token = {
        let store = state.store.lock().unwrap();
        store.tokens.iter().find(|t| t.id == id).cloned()
    }.ok_or("Token not found")?;

    let refresh_token_str = token.refresh_token.as_ref().ok_or("No refresh token")?;
    let provider_str = token.provider.as_deref().unwrap_or("Google");
    
    // 根据 provider 选择刷新方式
    let (new_access_token, new_refresh_token, expires_in, new_csrf_token) = if provider_str == "BuilderId" {
        // BuilderId 使用 IdcProvider 刷新
        let metadata = RefreshMetadata {
            client_id: token.sso_client_id.clone(),
            client_secret: token.sso_client_secret.clone(),
            region: token.sso_region.clone(),
            ..Default::default()
        };
        
        let idc_provider = IdcProvider::new("BuilderId", metadata.region.as_deref().unwrap_or("us-east-1"), None);
        let auth_result = idc_provider.refresh_token(refresh_token_str, metadata).await?;
        (auth_result.access_token, Some(auth_result.refresh_token), auth_result.expires_in, auth_result.csrf_token)
    } else {
        // Google/GitHub 使用 SocialProvider 刷新
        let metadata = RefreshMetadata {
            profile_arn: token.profile_arn.clone(),
            ..Default::default()
        };
        
        let social_provider = SocialProvider::new(provider_str);
        let auth_result = social_provider.refresh_token(refresh_token_str, metadata).await?;
        (auth_result.access_token, Some(auth_result.refresh_token), auth_result.expires_in, auth_result.csrf_token)
    };
    
    // 根据 provider 类型选择获取限额的 API
    let (quota, used, quota_with_precision, used_with_precision, reset_date, days_until_reset,
         free_trial_quota, free_trial_used, free_trial_quota_with_precision, free_trial_used_with_precision, free_trial_expiry, free_trial_status,
         bonus_quota, bonus_used, bonus_expiry, bonus_name, bonus_code, bonus_status, bonus_description, bonus_redeemed_at, bonuses,
         overage_rate, overage_cap, overage_cap_with_precision, subscription_type, subscription_plan, overage_capable, upgrade_capable,
         current_overages, current_overages_with_precision, overage_charges, display_name, display_name_plural, resource_type, unit, currency,
         subscription_management_target, overage_status) = 
    if provider_str == "BuilderId" {
        // BuilderId 使用 CodeWhisperer API
        let machine_id = "66c23a8c5d15afabec89ef9954ef52a119f10d369df04d548fc6c1eac694b0d1";
        let cw_client = CodeWhispererClient::new(machine_id);
        let usage = cw_client.get_usage_limits(&new_access_token).await.ok();
        
        let breakdown = usage.as_ref().and_then(|u| u.usage_breakdown_list.as_ref()).and_then(|list| list.first());
        let quota = breakdown.and_then(|b| b.usage_limit).unwrap_or(50);
        let used = breakdown.and_then(|b| b.current_usage).unwrap_or(0);
        let quota_with_precision = breakdown.and_then(|b| b.usage_limit_with_precision);
        let used_with_precision = breakdown.and_then(|b| b.current_usage_with_precision);
        
        let (reset_date, days_until_reset) = usage.as_ref().and_then(|u| u.next_date_reset).map(|ts| {
            let reset_dt = chrono::DateTime::from_timestamp(ts as i64, 0);
            let date_str = reset_dt.map(|dt| dt.format("%Y/%m/%d").to_string()).unwrap_or_default();
            let days = usage.as_ref().and_then(|u| u.days_until_reset).unwrap_or(0);
            (date_str, days)
        }).map(|(d, days)| (Some(d), Some(days))).unwrap_or((None, None));
        
        let free_trial = breakdown.and_then(|b| b.free_trial_info.as_ref());
        let free_trial_status = free_trial.and_then(|f| f.free_trial_status.clone());
        // 只有 freeTrialStatus === "ACTIVE" 时才使用 freeTrialInfo
        let is_free_trial_active = free_trial_status.as_ref().map(|s| s == "ACTIVE").unwrap_or(false);
        let free_trial_quota = if is_free_trial_active { free_trial.and_then(|f| f.usage_limit) } else { None };
        let free_trial_used = if is_free_trial_active { free_trial.and_then(|f| f.current_usage) } else { None };
        let free_trial_quota_with_precision = if is_free_trial_active { free_trial.and_then(|f| f.usage_limit_with_precision) } else { None };
        let free_trial_used_with_precision = if is_free_trial_active { free_trial.and_then(|f| f.current_usage_with_precision) } else { None };
        let free_trial_expiry = if is_free_trial_active {
            free_trial.and_then(|f| f.free_trial_expiry).map(|ts| {
                chrono::DateTime::from_timestamp(ts as i64, 0)
                    .map(|dt| dt.format("%Y/%m/%d").to_string())
                    .unwrap_or_default()
            })
        } else { None };
        
        let (bonus_quota, bonus_used, bonus_expiry, bonus_name, bonus_code, bonus_status, bonus_description, bonus_redeemed_at, bonuses) = breakdown
            .and_then(|b| b.bonuses.as_ref())
            .map(|bonus_list| {
                let total_quota: i32 = bonus_list.iter().filter_map(|b| b.usage_limit.map(|v| v as i32)).sum();
                let total_used: i32 = bonus_list.iter().filter_map(|b| b.current_usage.map(|v| v as i32)).sum();
                let first = bonus_list.first();
                let expiry = first.and_then(|b| b.expires_at).map(|ts| {
                    chrono::DateTime::from_timestamp(ts as i64, 0)
                        .map(|dt| dt.format("%Y/%m/%d").to_string())
                        .unwrap_or_default()
                });
                let name = first.and_then(|b| b.display_name.clone());
                let code = first.and_then(|b| b.bonus_code.clone());
                let status = first.and_then(|b| b.status.clone());
                // IdC BonusInfo 没有 description 和 redeemed_at
                let description: Option<String> = None;
                let redeemed_at: Option<String> = None;
                // 转换为 BonusItem 数组
                let items: Vec<BonusItem> = bonus_list.iter().map(|b| BonusItem {
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
                }).collect();
                (total_quota, total_used, expiry, name, code, status, description, redeemed_at, Some(items))
            })
            .unwrap_or((0, 0, None, None, None, None, None, None, None));
        
        let overage_rate = breakdown.and_then(|b| b.overage_rate);
        let overage_cap = breakdown.and_then(|b| b.overage_cap);
        let overage_cap_with_precision = breakdown.and_then(|b| b.overage_cap_with_precision);
        let current_overages = breakdown.and_then(|b| b.current_overages);
        let current_overages_with_precision = breakdown.and_then(|b| b.current_overages_with_precision);
        let overage_charges = breakdown.and_then(|b| b.overage_charges);
        let display_name = breakdown.and_then(|b| b.display_name.clone());
        let display_name_plural = breakdown.and_then(|b| b.display_name_plural.clone());
        let resource_type = breakdown.and_then(|b| b.resource_type.clone());
        let unit = breakdown.and_then(|b| b.unit.clone());
        let currency = breakdown.and_then(|b| b.currency.clone());
        
        let subscription_info = usage.as_ref().and_then(|u| u.subscription_info.as_ref());
        let subscription_type = subscription_info.and_then(|s| s.subscription_type.clone());
        let subscription_plan = subscription_info.and_then(|s| s.subscription_title.clone());
        let overage_capable = subscription_info.and_then(|s| s.overage_capability.as_ref())
            .map(|c| c == "OVERAGE_CAPABLE");
        let upgrade_capable = subscription_info.and_then(|s| s.upgrade_capability.as_ref())
            .map(|c| c == "UPGRADE_CAPABLE");
        let subscription_management_target = subscription_info.and_then(|s| s.subscription_management_target.clone());
        
        let overage_status = usage.as_ref()
            .and_then(|u| u.overage_configuration.as_ref())
            .and_then(|c| c.overage_status.clone());
        
        (quota, used, quota_with_precision, used_with_precision, reset_date, days_until_reset,
         free_trial_quota, free_trial_used, free_trial_quota_with_precision, free_trial_used_with_precision, free_trial_expiry, free_trial_status,
         bonus_quota, bonus_used, bonus_expiry, bonus_name, bonus_code, bonus_status, bonus_description, bonus_redeemed_at, bonuses,
         overage_rate, overage_cap, overage_cap_with_precision, subscription_type, subscription_plan, overage_capable, upgrade_capable,
         current_overages, current_overages_with_precision, overage_charges, display_name, display_name_plural, resource_type, unit, currency,
         subscription_management_target, overage_status)
    } else {
        // Social 使用 Desktop API
        let usage = get_usage_limits_desktop(&new_access_token).await?;
        
        let breakdown = usage.usage_breakdown_list.as_ref().and_then(|list| list.first());
        let quota = breakdown.and_then(|b| b.usage_limit).unwrap_or(50);
        let used = breakdown.and_then(|b| b.current_usage).unwrap_or(0);
        // Social API 没有精度字段
        let quota_with_precision: Option<f64> = None;
        let used_with_precision: Option<f64> = None;
        
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
        let free_trial_status = free_trial.and_then(|f| f.free_trial_status.clone());
        // 只有 freeTrialStatus === "ACTIVE" 时才使用 freeTrialInfo
        let is_free_trial_active = free_trial_status.as_ref().map(|s| s == "ACTIVE").unwrap_or(false);
        let free_trial_quota = if is_free_trial_active { free_trial.and_then(|f| f.usage_limit) } else { None };
        let free_trial_used = if is_free_trial_active { free_trial.and_then(|f| f.current_usage) } else { None };
        let free_trial_quota_with_precision: Option<f64> = None;
        let free_trial_used_with_precision: Option<f64> = None;
        let free_trial_expiry = if is_free_trial_active {
            free_trial.and_then(|f| f.free_trial_expiry).map(|ts| {
                chrono::DateTime::from_timestamp(ts as i64, 0)
                    .map(|dt| dt.format("%Y/%m/%d").to_string())
                    .unwrap_or_default()
            })
        } else { None };
        
        let (bonus_quota, bonus_used, bonus_expiry, bonus_name, bonus_code, bonus_status, bonus_description, bonus_redeemed_at, bonuses) = breakdown
            .and_then(|b| b.bonuses.as_ref())
            .map(|bonus_list| {
                let total_quota: i32 = bonus_list.iter().filter_map(|b| b.usage_limit.map(|v| v as i32)).sum();
                let total_used: i32 = bonus_list.iter().filter_map(|b| b.current_usage.map(|v| v as i32)).sum();
                let first = bonus_list.first();
                let expiry = first.and_then(|b| b.expires_at).map(|ts| {
                    chrono::DateTime::from_timestamp(ts as i64, 0)
                        .map(|dt| dt.format("%Y/%m/%d").to_string())
                        .unwrap_or_default()
                });
                let name = first.and_then(|b| b.display_name.clone());
                let code = first.and_then(|b| b.bonus_code.clone());
                let status = first.and_then(|b| b.status.clone());
                let description = first.and_then(|b| b.description.clone());
                let redeemed_at = first.and_then(|b| b.redeemed_at).map(|ts| {
                    chrono::DateTime::from_timestamp(ts as i64, 0)
                        .map(|dt| dt.format("%Y/%m/%d").to_string())
                        .unwrap_or_default()
                });
                // 转换为 BonusItem 数组
                let items: Vec<BonusItem> = bonus_list.iter().map(|b| BonusItem {
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
                }).collect();
                (total_quota, total_used, expiry, name, code, status, description, redeemed_at, Some(items))
            })
            .unwrap_or((0, 0, None, None, None, None, None, None, None));
        
        let overage_rate = breakdown.and_then(|b| b.overage_rate);
        let overage_cap = breakdown.and_then(|b| b.overage_cap);
        let overage_cap_with_precision: Option<f64> = None;
        // Social API 没有这些字段
        let current_overages: Option<i32> = None;
        let current_overages_with_precision: Option<f64> = None;
        let overage_charges: Option<f64> = None;
        let display_name: Option<String> = None;
        let display_name_plural: Option<String> = None;
        let resource_type: Option<String> = None;
        let unit: Option<String> = None;
        let currency = breakdown.and_then(|b| b.currency.clone());
        let subscription_management_target: Option<String> = None;
        let overage_status: Option<String> = None;
        
        let subscription_info = usage.subscription_info.as_ref();
        let subscription_type = subscription_info.and_then(|s| s.subscription_type.clone());
        let subscription_plan = subscription_info.and_then(|s| s.subscription_title.clone());
        let overage_capable = subscription_info.and_then(|s| s.overage_capability.as_ref())
            .map(|c| c == "OVERAGE_CAPABLE");
        let upgrade_capable = subscription_info.and_then(|s| s.upgrade_capability.as_ref())
            .map(|c| c == "UPGRADE_CAPABLE");
        
        (quota, used, quota_with_precision, used_with_precision, reset_date, days_until_reset,
         free_trial_quota, free_trial_used, free_trial_quota_with_precision, free_trial_used_with_precision, free_trial_expiry, free_trial_status,
         bonus_quota, bonus_used, bonus_expiry, bonus_name, bonus_code, bonus_status, bonus_description, bonus_redeemed_at, bonuses,
         overage_rate, overage_cap, overage_cap_with_precision, subscription_type, subscription_plan, overage_capable, upgrade_capable,
         current_overages, current_overages_with_precision, overage_charges, display_name, display_name_plural, resource_type, unit, currency,
         subscription_management_target, overage_status)
    };

    let expires_at = chrono::Local::now() + chrono::Duration::seconds(expires_in);
    let expires_at_str = expires_at.format("%Y/%m/%d %H:%M:%S").to_string();

    let mut store = state.store.lock().unwrap();
    let token_idx = store.tokens.iter().position(|t| t.id == id);
    
    if let Some(idx) = token_idx {
        store.tokens[idx].quota = quota;
        store.tokens[idx].used = used;
        store.tokens[idx].quota_with_precision = quota_with_precision;
        store.tokens[idx].used_with_precision = used_with_precision;
        store.tokens[idx].access_token = Some(new_access_token);
        if let Some(rt) = new_refresh_token {
            store.tokens[idx].refresh_token = Some(rt);
        }
        if let Some(csrf) = new_csrf_token {
            store.tokens[idx].csrf_token = Some(csrf);
        }
        store.tokens[idx].expires_at = Some(expires_at_str);
        store.tokens[idx].reset_date = reset_date;
        store.tokens[idx].days_until_reset = days_until_reset;
        
        store.tokens[idx].free_trial_quota = free_trial_quota;
        store.tokens[idx].free_trial_used = free_trial_used;
        store.tokens[idx].free_trial_quota_with_precision = free_trial_quota_with_precision;
        store.tokens[idx].free_trial_used_with_precision = free_trial_used_with_precision;
        store.tokens[idx].free_trial_expiry = free_trial_expiry;
        store.tokens[idx].free_trial_status = free_trial_status;
        
        store.tokens[idx].bonus_quota = if bonus_quota > 0 { Some(bonus_quota) } else { None };
        store.tokens[idx].bonus_used = if bonus_quota > 0 { Some(bonus_used) } else { None };
        store.tokens[idx].bonus_expiry = bonus_expiry;
        store.tokens[idx].bonus_name = bonus_name;
        store.tokens[idx].bonus_code = bonus_code;
        store.tokens[idx].bonus_status = bonus_status;
        store.tokens[idx].bonus_description = bonus_description;
        store.tokens[idx].bonus_redeemed_at = bonus_redeemed_at;
        store.tokens[idx].bonuses = bonuses;
        
        store.tokens[idx].overage_rate = overage_rate;
        store.tokens[idx].overage_cap = overage_cap;
        store.tokens[idx].overage_cap_with_precision = overage_cap_with_precision;
        store.tokens[idx].overage_capable = overage_capable;
        store.tokens[idx].current_overages = current_overages;
        store.tokens[idx].current_overages_with_precision = current_overages_with_precision;
        store.tokens[idx].overage_charges = overage_charges;
        
        if subscription_type.is_some() {
            store.tokens[idx].subscription_type = subscription_type;
        }
        store.tokens[idx].subscription_plan = subscription_plan;
        store.tokens[idx].upgrade_capable = upgrade_capable;
        store.tokens[idx].display_name = display_name;
        store.tokens[idx].display_name_plural = display_name_plural;
        store.tokens[idx].resource_type = resource_type;
        store.tokens[idx].unit = unit;
        store.tokens[idx].currency = currency;
        store.tokens[idx].subscription_management_target = subscription_management_target;
        store.tokens[idx].overage_status = overage_status;
        
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
pub async fn add_account_by_social(
    state: State<'_, AppState>,
    refresh_token: String,
    provider: Option<String>,
) -> Result<Token, String> {
    println!("Adding token by refresh (desktop API)");
    
    let refresh_result = refresh_token_desktop(&refresh_token).await?;
    let access_token = refresh_result.access_token;
    let new_refresh_token = refresh_result.refresh_token;
    println!("Got accessToken: {}", access_token);
    
    let usage_result = get_usage_limits_desktop(&access_token).await?;
    
    let email = usage_result.user_info.as_ref()
        .and_then(|u| u.email.clone())
        .unwrap_or_else(|| "unknown@kiro.dev".to_string());
    let user_id = usage_result.user_info.as_ref()
        .and_then(|u| u.user_id.clone());
    let subscription_type = usage_result.subscription_info.as_ref()
        .and_then(|s| s.subscription_title.clone());
    
    let breakdown = usage_result.usage_breakdown_list.as_ref().and_then(|list| list.first());
    let quota = breakdown.and_then(|b| b.usage_limit).unwrap_or(50);
    let used = breakdown.and_then(|b| b.current_usage).unwrap_or(0);
    
    // 处理 free trial
    let free_trial = breakdown.and_then(|b| b.free_trial_info.as_ref());
    let free_trial_status = free_trial.and_then(|f| f.free_trial_status.clone());
    let is_free_trial_active = free_trial_status.as_ref().map(|s| s == "ACTIVE").unwrap_or(false);
    let free_trial_quota = if is_free_trial_active { free_trial.and_then(|f| f.usage_limit) } else { None };
    let free_trial_used = if is_free_trial_active { free_trial.and_then(|f| f.current_usage) } else { None };
    let free_trial_expiry = if is_free_trial_active {
        free_trial.and_then(|f| f.free_trial_expiry).map(|ts| {
            chrono::DateTime::from_timestamp(ts as i64, 0)
                .map(|dt| dt.format("%Y/%m/%d").to_string())
                .unwrap_or_default()
        })
    } else { None };
    
    // 处理 bonuses 数组
    let (bonus_quota, bonus_used, bonus_expiry, bonus_name, bonus_code, bonus_status, bonus_description, bonus_redeemed_at, bonuses) = breakdown
        .and_then(|b| b.bonuses.as_ref())
        .map(|bonus_list| {
            let total_quota: i32 = bonus_list.iter().filter_map(|b| b.usage_limit.map(|v| v as i32)).sum();
            let total_used: i32 = bonus_list.iter().filter_map(|b| b.current_usage.map(|v| v as i32)).sum();
            let first = bonus_list.first();
            let expiry = first.and_then(|b| b.expires_at).map(|ts| {
                chrono::DateTime::from_timestamp(ts as i64, 0)
                    .map(|dt| dt.format("%Y/%m/%d").to_string())
                    .unwrap_or_default()
            });
            let name = first.and_then(|b| b.display_name.clone());
            let code = first.and_then(|b| b.bonus_code.clone());
            let status = first.and_then(|b| b.status.clone());
            let description = first.and_then(|b| b.description.clone());
            let redeemed_at = first.and_then(|b| b.redeemed_at).map(|ts| {
                chrono::DateTime::from_timestamp(ts as i64, 0)
                    .map(|dt| dt.format("%Y/%m/%d").to_string())
                    .unwrap_or_default()
            });
            // 转换为 BonusItem 数组
            let items: Vec<BonusItem> = bonus_list.iter().map(|b| BonusItem {
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
            }).collect();
            (total_quota, total_used, expiry, name, code, status, description, redeemed_at, Some(items))
        })
        .unwrap_or((0, 0, None, None, None, None, None, None, None));
    
    // 处理 reset_date
    let reset_date = breakdown.and_then(|b| b.next_date_reset).map(|ts| {
        chrono::DateTime::from_timestamp(ts as i64, 0)
            .map(|dt| dt.format("%Y/%m/%d").to_string())
            .unwrap_or_default()
    });
    
    let idp = provider.unwrap_or_else(|| {
        if email.contains("gmail") { "Google".to_string() }
        else if email.contains("github") { "Github".to_string() }
        else { "Google".to_string() }
    });
    
    println!("Got: email={}, quota={}, used={}, subscription={:?}, bonuses={}", 
             email, quota, used, subscription_type, bonuses.as_ref().map(|b| b.len()).unwrap_or(0));
    
    let (token, is_new) = state.store.lock().unwrap().add_with_tokens(
        email.clone(),
        format!("Kiro {} 账号", idp),
        quota,
        access_token.clone(),
        new_refresh_token,
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
            t.reset_date = reset_date;
            // free trial
            t.free_trial_quota = free_trial_quota;
            t.free_trial_used = free_trial_used;
            t.free_trial_expiry = free_trial_expiry;
            t.free_trial_status = free_trial_status;
            // bonuses
            t.bonus_quota = if bonus_quota > 0 { Some(bonus_quota) } else { None };
            t.bonus_used = if bonus_quota > 0 { Some(bonus_used) } else { None };
            t.bonus_expiry = bonus_expiry;
            t.bonus_name = bonus_name;
            t.bonus_code = bonus_code;
            t.bonus_status = bonus_status;
            t.bonus_description = bonus_description;
            t.bonus_redeemed_at = bonus_redeemed_at;
            t.bonuses = bonuses;
            // overage
            t.overage_rate = breakdown.and_then(|b| b.overage_rate);
            t.overage_cap = breakdown.and_then(|b| b.overage_cap);
            t.currency = breakdown.and_then(|b| b.currency.clone());
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

/// 添加本地 Kiro IDE 账号（支持 Social 和 BuilderId）
#[tauri::command]
pub async fn add_local_kiro_account(state: State<'_, AppState>) -> Result<Token, String> {
    use crate::kiro::{get_kiro_local_token, get_client_registration};
    
    let local_token = get_kiro_local_token()
        .ok_or("未找到本地 Kiro 账号，请先在 Kiro IDE 中登录")?;
    
    let refresh_token = local_token.refresh_token
        .ok_or("本地账号缺少 refresh_token")?;
    
    let auth_method = local_token.auth_method.as_deref().unwrap_or("social");
    let provider = local_token.provider.clone().unwrap_or_else(|| "Google".to_string());
    
    let (access_token, new_refresh_token, expires_in, client_id, client_secret, client_id_hash, region) = 
        if auth_method == "IdC" {
            let hash = local_token.client_id_hash.clone()
                .ok_or("IdC 账号缺少 clientIdHash")?;
            let region = local_token.region.clone().unwrap_or_else(|| "us-east-1".to_string());
            
            let client_reg = get_client_registration(&hash)
                .ok_or(format!("未找到客户端注册信息: {}.json", hash))?;
            
            let metadata = RefreshMetadata {
                client_id: Some(client_reg.client_id.clone()),
                client_secret: Some(client_reg.client_secret.clone()),
                region: Some(region.clone()),
                ..Default::default()
            };
            
            let idc_provider = IdcProvider::new("BuilderId", &region, None);
            let auth_result = idc_provider.refresh_token(&refresh_token, metadata).await?;
            
            (auth_result.access_token, auth_result.refresh_token, auth_result.expires_in,
             Some(client_reg.client_id), Some(client_reg.client_secret), Some(hash), Some(region))
        } else {
            let metadata = RefreshMetadata {
                profile_arn: local_token.profile_arn.clone(),
                ..Default::default()
            };
            
            let social_provider = SocialProvider::new(&provider);
            let auth_result = social_provider.refresh_token(&refresh_token, metadata).await?;
            
            (auth_result.access_token, auth_result.refresh_token, auth_result.expires_in,
             None, None, None, None)
        };
    
    let machine_id = "66c23a8c5d15afabec89ef9954ef52a119f10d369df04d548fc6c1eac694b0d1";
    let cw_client = CodeWhispererClient::new(machine_id);
    let usage = cw_client.get_usage_limits(&access_token).await
        .map_err(|e| format!("获取配额失败: {}", e))?;
    
    let email = usage.user_info.as_ref()
        .and_then(|u| u.email.clone())
        .unwrap_or_else(|| format!("{}@kiro.dev", provider.to_lowercase()));
    
    let breakdown = usage.usage_breakdown_list.as_ref().and_then(|list| list.first());
    let quota = breakdown.and_then(|b| b.usage_limit).unwrap_or(50) as i32;
    let used = breakdown.and_then(|b| b.current_usage).unwrap_or(0) as i32;
    
    let subscription_type = usage.subscription_info.as_ref()
        .and_then(|s| s.subscription_title.clone());
    let user_id = usage.user_info.as_ref()
        .and_then(|u| u.user_id.clone());
    
    let (mut token, is_new) = state.store.lock().unwrap().add_with_tokens(
        email.clone(),
        format!("Kiro {} 账号", provider),
        quota,
        access_token,
        new_refresh_token,
        provider.clone(),
        user_id,
        subscription_type,
    );
    
    if !is_new {
        return Err(format!("账号 {} 已存在", email));
    }
    
    {
        let mut store = state.store.lock().unwrap();
        if let Some(t) = store.tokens.iter_mut().find(|t| t.id == token.id) {
            t.used = used;
            t.auth_method = Some(auth_method.to_string());
            t.client_id_hash = client_id_hash;
            t.sso_client_id = client_id;
            t.sso_client_secret = client_secret;
            t.sso_region = region;
            t.profile_arn = local_token.profile_arn;
            
            let expires_at = chrono::Local::now() + chrono::Duration::seconds(expires_in);
            t.expires_at = Some(expires_at.format("%Y/%m/%d %H:%M:%S").to_string());
            
            if let Some(ts) = usage.next_date_reset {
                if let Some(dt) = chrono::DateTime::from_timestamp(ts as i64, 0) {
                    t.reset_date = Some(dt.format("%Y/%m/%d").to_string());
                    t.days_until_reset = usage.days_until_reset;
                }
            }
            
            token = t.clone();
            store.save_to_file();
        }
    }
    
    Ok(token)
}

/// 手动添加 BuilderId 账号
#[tauri::command]
pub async fn add_account_by_idc(
    state: State<'_, AppState>,
    refresh_token: String,
    client_id: String,
    client_secret: String,
    region: Option<String>,
) -> Result<Token, String> {
    let region = region.unwrap_or_else(|| "us-east-1".to_string());
    let metadata = RefreshMetadata {
        client_id: Some(client_id.clone()),
        client_secret: Some(client_secret.clone()),
        region: Some(region.clone()),
        ..Default::default()
    };
    
    let idc_provider = IdcProvider::new("BuilderId", &region, None);
    let auth_result = idc_provider.refresh_token(&refresh_token, metadata).await?;
    
    let machine_id = "66c23a8c5d15afabec89ef9954ef52a119f10d369df04d548fc6c1eac694b0d1";
    let cw_client = CodeWhispererClient::new(machine_id);
    let usage = cw_client.get_usage_limits(&auth_result.access_token).await
        .map_err(|e| format!("获取配额失败: {}", e))?;
    
    let email = usage.user_info.as_ref()
        .and_then(|u| u.email.clone())
        .unwrap_or_else(|| "builderid@kiro.dev".to_string());
    
    let breakdown = usage.usage_breakdown_list.as_ref().and_then(|list| list.first());
    let quota = breakdown.and_then(|b| b.usage_limit).unwrap_or(50) as i32;
    let used = breakdown.and_then(|b| b.current_usage).unwrap_or(0) as i32;
    
    let subscription_type = usage.subscription_info.as_ref()
        .and_then(|s| s.subscription_title.clone());
    let user_id = usage.user_info.as_ref()
        .and_then(|u| u.user_id.clone());
    
    use sha2::{Digest, Sha256};
    let start_url = "https://view.awsapps.com/start";
    let mut hasher = Sha256::new();
    hasher.update(start_url.as_bytes());
    let client_id_hash = hex::encode(hasher.finalize());
    
    let (mut token, is_new) = state.store.lock().unwrap().add_with_tokens(
        email.clone(),
        "Kiro BuilderId 账号".to_string(),
        quota,
        auth_result.access_token,
        auth_result.refresh_token,
        "BuilderId".to_string(),
        user_id,
        subscription_type,
    );
    
    if !is_new {
        return Err(format!("账号 {} 已存在", email));
    }
    
    {
        let mut store = state.store.lock().unwrap();
        if let Some(t) = store.tokens.iter_mut().find(|t| t.id == token.id) {
            t.used = used;
            t.auth_method = Some("IdC".to_string());
            t.client_id_hash = Some(client_id_hash);
            t.sso_client_id = Some(client_id);
            t.sso_client_secret = Some(client_secret);
            t.sso_region = Some(region);
            
            let expires_at = chrono::Local::now() + chrono::Duration::seconds(auth_result.expires_in);
            t.expires_at = Some(expires_at.format("%Y/%m/%d %H:%M:%S").to_string());
            
            if let Some(ts) = usage.next_date_reset {
                if let Some(dt) = chrono::DateTime::from_timestamp(ts as i64, 0) {
                    t.reset_date = Some(dt.format("%Y/%m/%d").to_string());
                    t.days_until_reset = usage.days_until_reset;
                }
            }
            
            token = t.clone();
            store.save_to_file();
        }
    }
    
    Ok(token)
}

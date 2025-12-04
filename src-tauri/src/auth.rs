// Auth 模块 - 当前使用的认证相关代码

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

// ============================================================
// User 和 AuthState
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub email: String,
    pub name: String,
    pub avatar: Option<String>,
    pub provider: String,
}

pub struct AuthState {
    pub user: Mutex<Option<User>>,
    pub csrf_token: Mutex<Option<String>>,
    pub access_token: Mutex<Option<String>>,
    pub refresh_token: Mutex<Option<String>>,
}

impl AuthState {
    pub fn new() -> Self {
        Self {
            user: Mutex::new(None),
            csrf_token: Mutex::new(None),
            access_token: Mutex::new(None),
            refresh_token: Mutex::new(None),
        }
    }
}

// ============================================================
// API 常量
// ============================================================

pub const DESKTOP_AUTH_API: &str = "https://prod.us-east-1.auth.desktop.kiro.dev";
const DESKTOP_USAGE_API: &str = "https://codewhisperer.us-east-1.amazonaws.com";
const PROFILE_ARN: &str = "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK";

// ============================================================
// 桌面端 API 响应结构
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopRefreshResponse {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "refreshToken")]
    pub refresh_token: String,
    #[serde(rename = "expiresIn")]
    pub expires_in: i64,
    #[serde(rename = "profileArn")]
    pub profile_arn: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopUsageResponse {
    #[serde(rename = "daysUntilReset")]
    pub days_until_reset: Option<i32>,
    #[serde(rename = "nextDateReset")]
    pub next_date_reset: Option<f64>,
    #[serde(rename = "userInfo")]
    pub user_info: Option<DesktopUserInfo>,
    #[serde(rename = "subscriptionInfo")]
    pub subscription_info: Option<DesktopSubscriptionInfo>,
    #[serde(rename = "usageBreakdownList")]
    pub usage_breakdown_list: Option<Vec<DesktopUsageBreakdown>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopUserInfo {
    pub email: Option<String>,
    #[serde(rename = "userId")]
    pub user_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopSubscriptionInfo {
    #[serde(rename = "subscriptionTitle")]
    pub subscription_title: Option<String>,
    #[serde(rename = "type")]
    pub subscription_type: Option<String>,
    #[serde(rename = "overageCapability")]
    pub overage_capability: Option<String>,
    #[serde(rename = "upgradeCapability")]
    pub upgrade_capability: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopUsageBreakdown {
    #[serde(rename = "usageLimit")]
    pub usage_limit: Option<i32>,
    #[serde(rename = "currentUsage")]
    pub current_usage: Option<i32>,
    #[serde(rename = "nextDateReset")]
    pub next_date_reset: Option<f64>,
    #[serde(rename = "freeTrialInfo")]
    pub free_trial_info: Option<FreeTrialInfo>,
    pub bonuses: Option<Vec<BonusInfo>>,
    #[serde(rename = "overageRate")]
    pub overage_rate: Option<f64>,
    #[serde(rename = "overageCap")]
    pub overage_cap: Option<i32>,
    pub currency: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FreeTrialInfo {
    #[serde(rename = "usageLimit")]
    pub usage_limit: Option<i32>,
    #[serde(rename = "currentUsage")]
    pub current_usage: Option<i32>,
    #[serde(rename = "freeTrialExpiry")]
    pub free_trial_expiry: Option<f64>,
    #[serde(rename = "freeTrialStatus")]
    pub free_trial_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BonusInfo {
    #[serde(rename = "bonusCode")]
    pub bonus_code: Option<String>,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "usageLimit")]
    pub usage_limit: Option<f64>,
    #[serde(rename = "currentUsage")]
    pub current_usage: Option<f64>,
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<f64>,
    #[serde(rename = "redeemedAt")]
    pub redeemed_at: Option<f64>,
    pub status: Option<String>,
}


// ============================================================
// 桌面端 API 方法
// ============================================================

/// 使用桌面端 API 刷新 Token（只需要 RefreshToken）
pub async fn refresh_token_desktop(refresh_token: &str) -> Result<DesktopRefreshResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;
    
    let body = serde_json::json!({
        "refreshToken": refresh_token
    });
    
    // 重试机制
    let mut last_error = String::new();
    for attempt in 0..3 {
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
        }
        
        match client
            .post(format!("{}/refreshToken", DESKTOP_AUTH_API))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .json(&body)
            .send()
            .await
        {
            Ok(response) => {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                
                if !status.is_success() {
                    if status.as_u16() == 401 {
                        return Err("RefreshToken 已过期或无效".to_string());
                    }
                    return Err(format!("RefreshToken failed ({})", status));
                }
                
                return serde_json::from_str(&text)
                    .map_err(|e| format!("Parse failed: {}", e));
            }
            Err(e) => {
                last_error = format!("网络错误: {}", e);
                continue;
            }
        }
    }
    
    Err(last_error)
}

/// 使用桌面端 API 获取配额和用户信息
pub async fn get_usage_limits_desktop(access_token: &str) -> Result<DesktopUsageResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;
    
    let url = format!(
        "{}/getUsageLimits?isEmailRequired=true&origin=AI_EDITOR&profileArn={}",
        DESKTOP_USAGE_API,
        urlencoding::encode(PROFILE_ARN)
    );

    // println!("\n[7] GET USAGE LIMITS REQUEST");
    // println!("URL: {}", url);
    // println!("Token: {}", access_token);
    
    // 重试机制
    let mut last_error = String::new();
    for attempt in 0..3 {
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
        }
        
        match client
            .get(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Accept", "application/json")
            .send()
            .await
        {
            Ok(response) => {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                
                // println!("\n[7] USAGE LIMITS RESPONSE");
                // println!("Status: {}", status);
                
                // // 完整格式化打印 JSON
                // match serde_json::from_str::<serde_json::Value>(&text) {
                //     Ok(json) => {
                //         match serde_json::to_string_pretty(&json) {
                //             Ok(pretty) => println!("{}", pretty),
                //             Err(_) => println!("{}", text),
                //         }
                //     }
                //     Err(_) => println!("{}", text),
                // }
                // println!();
                
                if !status.is_success() {
                    return Err(format!("GetUsageLimits failed ({})", status));
                }
                
                return serde_json::from_str(&text)
                    .map_err(|e| format!("Parse failed: {}", e));
            }
            Err(e) => {
                last_error = format!("网络错误: {}", e);
                continue;
            }
        }
    }
    
    Err(last_error)
}

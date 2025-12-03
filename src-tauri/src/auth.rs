use serde::{Deserialize, Serialize};
use std::sync::Mutex;

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

const KIRO_API: &str = "https://app.kiro.dev/service/KiroWebPortalService/operation";

// 桌面端 API
pub const DESKTOP_AUTH_API: &str = "https://prod.us-east-1.auth.desktop.kiro.dev";
const DESKTOP_USAGE_API: &str = "https://codewhisperer.us-east-1.amazonaws.com";
const PROFILE_ARN: &str = "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK";

// AWS Cognito OAuth 配置
const COGNITO_DOMAIN: &str = "https://kiro-prod-us-east-1.auth.us-east-1.amazoncognito.com";
const COGNITO_CLIENT_ID: &str = "59bd15eh40ee7pc20h0bkcu7id";

// Kiro redirect_uri (用于 token 交换)
const REDIRECT_URI: &str = "https://app.kiro.dev/signin/oauth";



#[derive(Debug, Serialize)]
#[allow(dead_code)]
struct ExchangeTokenRequest {
    idp: String,
    code: String,
    #[serde(rename = "codeVerifier")]
    code_verifier: String,
    #[serde(rename = "redirectUri")]
    redirect_uri: String,
    state: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ExchangeTokenResponse {
    #[serde(rename = "csrfToken")]
    pub csrf_token: Option<String>,
    #[serde(rename = "accessToken")]
    pub access_token: Option<String>,
    pub state: Option<String>,
}

#[derive(Debug, Serialize)]
#[allow(dead_code)]
struct GetUserInfoRequest {
    #[serde(rename = "csrfToken")]
    csrf_token: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct GetUserInfoResponse {
    pub email: Option<String>,
    pub name: Option<String>,
    #[serde(rename = "userId")]
    pub user_id: Option<String>,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
}

fn generate_code_verifier() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    base64_url_encode(&bytes)
}



fn generate_code_challenge(verifier: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let result = hasher.finalize();
    base64_url_encode(&result)
}

fn base64_url_encode(data: &[u8]) -> String {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
    URL_SAFE_NO_PAD.encode(data)
}

fn generate_state() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// 将 provider 转换为 Kiro API 的 idp 格式
fn map_provider_to_idp(provider: &str) -> String {
    match provider {
        "GitHub" => "Github".to_string(),
        "Google" => "Google".to_string(),
        "BuilderId" => "BuilderId".to_string(),
        _ => provider.to_string(),
    }
}

/// 构建 Cognito OAuth URL（直接跳转 Cognito 授权页面）
/// 
/// 流程：Cognito -> Google/GitHub -> Cognito idpresponse -> app.kiro.dev/signin/oauth
pub fn build_cognito_oauth_url(provider: &str, code_verifier: &str, state: &str) -> Result<String, String> {
    let code_challenge = generate_code_challenge(code_verifier);
    
    // identity_provider: Google, Github (注意 GitHub 在 Cognito 里是 Github)
    let identity_provider = match provider {
        "GitHub" => "Github",
        "Google" => "Google",
        _ => return Err(format!("Unsupported provider: {}", provider))
    };
    
    // 构建 Cognito 授权 URL
    let url = format!(
        "{}/oauth2/authorize?client_id={}&response_type=code&scope={}&redirect_uri={}&state={}&code_challenge={}&code_challenge_method=S256&identity_provider={}",
        COGNITO_DOMAIN,
        COGNITO_CLIENT_ID,
        urlencoding::encode("email openid"),
        urlencoding::encode(REDIRECT_URI),
        urlencoding::encode(state),
        urlencoding::encode(&code_challenge),
        identity_provider
    );
    
    Ok(url)
}

/// 初始化 Cognito OAuth 登录
/// 
/// 直接构建 Cognito 授权 URL，不需要调用 Kiro API
pub fn initiate_cognito_login(provider: &str) -> Result<(String, String, String), String> {
    let code_verifier = generate_code_verifier();
    let state = generate_state();
    
    let redirect_url = build_cognito_oauth_url(provider, &code_verifier, &state)?;
    
    Ok((redirect_url, code_verifier, state))
}

#[allow(dead_code)]
pub async fn exchange_kiro_token(provider: &str, code: &str, code_verifier: &str, state: &str) -> Result<ExchangeTokenResponse, String> {
    let idp = map_provider_to_idp(provider);

    // 构建 CBOR body
    let cbor_body = encode_exchange_token_cbor(&idp, code, code_verifier, REDIRECT_URI, state);

    let client = reqwest::Client::new();
    
    println!("ExchangeToken: idp={}, code={}...", idp, &code[..code.len().min(20)]);
    
    let response = client
        .post(format!("{}/ExchangeToken", KIRO_API))
        .header("Content-Type", "application/cbor")
        .header("Accept", "application/cbor")
        .header("smithy-protocol", "rpc-v2-cbor")
        .header("Origin", "https://app.kiro.dev")
        .header("Referer", "https://app.kiro.dev/signin/oauth")
        .body(cbor_body)
        .send()
        .await
        .map_err(|e| format!("ExchangeToken request failed: {}", e))?;

    let status = response.status();
    
    // 获取 Set-Cookie 头中的 RefreshToken
    let mut refresh_token_from_cookie: Option<String> = None;
    for cookie_header in response.headers().get_all("set-cookie") {
        if let Ok(cookie_str) = cookie_header.to_str() {
            if cookie_str.contains("RefreshToken=") {
                if let Some(start) = cookie_str.find("RefreshToken=") {
                    let value_start = start + 13;
                    if let Some(end) = cookie_str[value_start..].find(';') {
                        refresh_token_from_cookie = Some(cookie_str[value_start..value_start + end].to_string());
                    }
                }
            }
        }
    }
    println!("RefreshToken from cookie: {:?}", refresh_token_from_cookie.as_ref().map(|s| &s[..s.len().min(30)]));
    
    let body = response.bytes().await.unwrap_or_default();

    if !status.is_success() {
        let text = String::from_utf8_lossy(&body);
        return Err(format!("ExchangeToken failed ({}): {}", status, text));
    }

    // 从 CBOR 响应中提取 token
    let text = String::from_utf8_lossy(&body);
    println!("ExchangeToken response: {}", &text[..text.len().min(200)]);
    
    let access_token = extract_pattern(&text, r"aoa[A-Za-z0-9_\-:\/+=]+");
    let csrf_token = extract_pattern(&text, r"csrfToken.{1,5}([A-Za-z0-9+/=]{20,50})");

    Ok(ExchangeTokenResponse {
        access_token,
        csrf_token,
        state: Some(state.to_string()),
    })
}

#[allow(dead_code)]
pub async fn get_kiro_user_info(csrf_token: &str) -> Result<GetUserInfoResponse, String> {
    let request = GetUserInfoRequest {
        csrf_token: csrf_token.to_string(),
    };

    let client = reqwest::Client::new();
    
    let response = client
        .post(format!("{}/GetUserInfo", KIRO_API))
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("GetUserInfo request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("GetUserInfo failed ({}): {}", status, text));
    }

    let result: GetUserInfoResponse = response
        .json()
        .await
        .map_err(|e| format!("Parse GetUserInfo response failed: {}", e))?;

    Ok(result)
}

/// GetUserUsageAndLimits 响应
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
// 辅助函数：提取正则匹配
fn extract_pattern(text: &str, pattern: &str) -> Option<String> {
    use regex::Regex;
    if let Ok(re) = Regex::new(pattern) {
        if let Some(caps) = re.captures(text) {
            if caps.len() > 1 {
                return caps.get(1).map(|m| m.as_str().to_string());
            }
            return caps.get(0).map(|m| m.as_str().to_string());
        }
    }
    None
}





/// CBOR 编码 ExchangeToken 请求
fn encode_exchange_token_cbor(idp: &str, code: &str, code_verifier: &str, redirect_uri: &str, state: &str) -> Vec<u8> {
    let mut result = Vec::new();
    // map(5) - 5个键值对
    result.push(0xa5);
    
    // "idp": value
    encode_cbor_string(&mut result, "idp");
    encode_cbor_string(&mut result, idp);
    
    // "code": value
    encode_cbor_string(&mut result, "code");
    encode_cbor_string(&mut result, code);
    
    // "codeVerifier": value
    encode_cbor_string(&mut result, "codeVerifier");
    encode_cbor_string(&mut result, code_verifier);
    
    // "redirectUri": value
    encode_cbor_string(&mut result, "redirectUri");
    encode_cbor_string(&mut result, redirect_uri);
    
    // "state": value
    encode_cbor_string(&mut result, "state");
    encode_cbor_string(&mut result, state);
    
    result
}

fn encode_cbor_string(result: &mut Vec<u8>, s: &str) {
    let bytes = s.as_bytes();
    if bytes.len() < 24 {
        result.push(0x60 + bytes.len() as u8);
    } else if bytes.len() < 256 {
        result.push(0x78);
        result.push(bytes.len() as u8);
    } else {
        result.push(0x79);
        result.push((bytes.len() >> 8) as u8);
        result.push(bytes.len() as u8);
    }
    result.extend_from_slice(bytes);
}

// ===== 桌面端 API =====

/// 桌面端 RefreshToken 响应
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

/// 桌面端 GetUsageLimits 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopUsageResponse {
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopUsageBreakdown {
    #[serde(rename = "usageLimit")]
    pub usage_limit: Option<i32>,
    #[serde(rename = "currentUsage")]
    pub current_usage: Option<i32>,
}

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

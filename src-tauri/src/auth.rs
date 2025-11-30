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

// AWS Cognito OAuth 配置
const COGNITO_DOMAIN: &str = "https://kiro-prod-us-east-1.auth.us-east-1.amazoncognito.com";
const COGNITO_REDIRECT_URI: &str = "https://kiro-prod-us-east-1.auth.us-east-1.amazoncognito.com/oauth2/idpresponse";

// GitHub OAuth 配置
const GITHUB_CLIENT_ID: &str = "Ov23lilbEuhqkZak4Bfh";
const GITHUB_AUTH_URL: &str = "https://github.com/login/oauth/authorize";

// Google OAuth 配置
const GOOGLE_CLIENT_ID: &str = "183617306620-gqedod9q1su19ghqs84m1tje4lp761ks.apps.googleusercontent.com";
const GOOGLE_AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";

// Kiro 原始 redirect_uri (用于 token 交换)
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

/// 直接构建 OAuth URL（绕过 Kiro API，直接使用 Cognito）
pub fn build_direct_oauth_url(provider: &str, code_verifier: &str, state: &str) -> Result<String, String> {
    let code_challenge = generate_code_challenge(code_verifier);
    
    match provider {
        "GitHub" => {
            // GitHub OAuth URL
            let url = format!(
                "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}",
                GITHUB_AUTH_URL,
                GITHUB_CLIENT_ID,
                urlencoding::encode(COGNITO_REDIRECT_URI),
                urlencoding::encode("read:user user:email openid"),
                urlencoding::encode(state)
            );
            Ok(url)
        }
        "Google" => {
            // Google OAuth URL with PKCE
            let url = format!(
                "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&access_type=offline&code_challenge={}&code_challenge_method=S256",
                GOOGLE_AUTH_URL,
                GOOGLE_CLIENT_ID,
                urlencoding::encode(COGNITO_REDIRECT_URI),
                urlencoding::encode("email openid"),
                urlencoding::encode(state),
                urlencoding::encode(&code_challenge)
            );
            Ok(url)
        }
        "BuilderId" => {
            // AWS Builder ID - 使用 Cognito hosted UI
            let url = format!(
                "{}/oauth2/authorize?identity_provider=BuilderId&client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&code_challenge={}&code_challenge_method=S256",
                COGNITO_DOMAIN,
                "your-cognito-client-id", // 需要从 Kiro 获取
                urlencoding::encode(COGNITO_REDIRECT_URI),
                urlencoding::encode("openid email"),
                urlencoding::encode(state),
                urlencoding::encode(&code_challenge)
            );
            Ok(url)
        }
        _ => Err(format!("Unsupported provider: {}", provider))
    }
}

/// 通过 Kiro API 初始化登录（原有方式）
pub async fn initiate_kiro_login(provider: &str) -> Result<(String, String, String), String> {
    let code_verifier = generate_code_verifier();
    let code_challenge = generate_code_challenge(&code_verifier);
    let state = generate_state();
    let idp = map_provider_to_idp(provider);

    // 构建 CBOR 请求
    let request = serde_json::json!({
        "idp": idp,
        "redirectUri": REDIRECT_URI,
        "codeChallenge": code_challenge,
        "codeChallengeMethod": "S256",
        "state": state
    });

    // 序列化为 CBOR
    let mut cbor_data = Vec::new();
    ciborium::into_writer(&request, &mut cbor_data)
        .map_err(|e| format!("CBOR serialize failed: {}", e))?;

    let client = reqwest::Client::new();

    let response = client
        .post(format!("{}/InitiateLogin", KIRO_API))
        .header("Content-Type", "application/cbor")
        .header("Accept", "application/cbor")
        .header("smithy-protocol", "rpc-v2-cbor")
        .body(cbor_data)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    let body = response.bytes().await.unwrap_or_default();

    println!("InitiateLogin status: {}", status);

    if !status.is_success() {
        let error_text = String::from_utf8_lossy(&body);
        return Err(format!("InitiateLogin failed ({}): {}", status, error_text));
    }

    // 解析 CBOR 响应
    let result: serde_json::Value = ciborium::from_reader(&body[..])
        .map_err(|e| format!("CBOR parse failed: {} - raw: {:?}", e, &body[..50.min(body.len())]))?;

    println!("InitiateLogin response: {:?}", result);

    let redirect_url = result
        .get("redirectUrl")
        .or_else(|| result.get("authorizationUrl"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("No redirect URL in response: {:?}", result))?
        .to_string();

    Ok((redirect_url, code_verifier, state))
}

/// 直接初始化登录（不调用 Kiro API）
pub fn initiate_direct_login(provider: &str) -> Result<(String, String, String), String> {
    let code_verifier = generate_code_verifier();
    let state = generate_state();
    
    let redirect_url = build_direct_oauth_url(provider, &code_verifier, &state)?;
    
    Ok((redirect_url, code_verifier, state))
}

#[allow(dead_code)]
pub async fn exchange_kiro_token(provider: &str, code: &str, code_verifier: &str, state: &str) -> Result<ExchangeTokenResponse, String> {
    let idp = map_provider_to_idp(provider);

    let request = ExchangeTokenRequest {
        idp,
        code: code.to_string(),
        code_verifier: code_verifier.to_string(),
        redirect_uri: REDIRECT_URI.to_string(),
        state: state.to_string(),
    };

    let client = reqwest::Client::new();
    
    let response = client
        .post(format!("{}/ExchangeToken", KIRO_API))
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("ExchangeToken request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("ExchangeToken failed ({}): {}", status, text));
    }

    let result: ExchangeTokenResponse = response
        .json()
        .await
        .map_err(|e| format!("Parse ExchangeToken response failed: {}", e))?;

    Ok(result)
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

/// RefreshToken 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshTokenResponse {
    #[serde(rename = "accessToken")]
    pub access_token: Option<String>,
    #[serde(rename = "csrfToken")]
    pub csrf_token: Option<String>,
    #[serde(rename = "expiresIn")]
    pub expires_in: Option<i64>,
    #[serde(rename = "profileArn")]
    pub profile_arn: Option<String>,
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

/// 使用 RefreshToken 刷新 AccessToken（通过 Cookie）
pub async fn refresh_kiro_token_with_cookie(
    access_token: &str,
    refresh_token: &str,
    idp: &str,
) -> Result<RefreshTokenResponse, String> {
    // CBOR 编码: {csrfToken: ""}
    let cbor_body: Vec<u8> = vec![0xa1, 0x69, 0x63, 0x73, 0x72, 0x66, 0x54, 0x6f, 0x6b, 0x65, 0x6e, 0x60];

    let client = reqwest::Client::new();
    
    let response = client
        .post(format!("{}/RefreshToken", KIRO_API))
        .header("Content-Type", "application/cbor")
        .header("Accept", "application/cbor")
        .header("smithy-protocol", "rpc-v2-cbor")
        .header("Cookie", format!("AccessToken={}; RefreshToken={}; Idp={}", access_token, refresh_token, idp))
        .body(cbor_body)
        .send()
        .await
        .map_err(|e| format!("RefreshToken request failed: {}", e))?;

    let status = response.status();
    let body = response.bytes().await.unwrap_or_default();

    if !status.is_success() {
        let text = String::from_utf8_lossy(&body);
        return Err(format!("RefreshToken failed ({}): {}", status, text));
    }

    // 从响应文本中提取 token（CBOR 解析可能有问题，用正则提取）
    let text = String::from_utf8_lossy(&body);
    let access_token = extract_pattern(&text, r"aoa[A-Za-z0-9_\-:\/+=]+");
    let csrf_token = extract_pattern(&text, r"csrfToken.{1,5}([A-Za-z0-9+/=]{20,50})");

    Ok(RefreshTokenResponse {
        access_token,
        csrf_token,
        expires_in: Some(3600),
        profile_arn: None,
    })
}

/// 获取用户信息
pub async fn get_user_info_with_token(
    access_token: &str,
    csrf_token: &str,
) -> Result<GetUserInfoResponse, String> {
    // CBOR 编码: {origin: "KIRO_IDE"}
    let cbor_body: Vec<u8> = vec![
        0xa1, 0x66, 0x6f, 0x72, 0x69, 0x67, 0x69, 0x6e, 
        0x68, 0x4b, 0x49, 0x52, 0x4f, 0x5f, 0x49, 0x44, 0x45
    ];

    let client = reqwest::Client::new();
    
    let response = client
        .post(format!("{}/GetUserInfo", KIRO_API))
        .header("Content-Type", "application/cbor")
        .header("Accept", "application/cbor")
        .header("smithy-protocol", "rpc-v2-cbor")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("x-csrf-token", csrf_token)
        .body(cbor_body)
        .send()
        .await
        .map_err(|e| format!("GetUserInfo request failed: {}", e))?;

    let status = response.status();
    let body = response.bytes().await.unwrap_or_default();

    if !status.is_success() {
        let text = String::from_utf8_lossy(&body);
        return Err(format!("GetUserInfo failed ({}): {}", status, text));
    }

    // 从响应文本中提取信息
    let text = String::from_utf8_lossy(&body);
    let email = extract_email(&text);
    let idp = extract_pattern(&text, r"cidp.([A-Za-z]+)");
    let user_id = extract_pattern(&text, r"userId.{1,5}(d-[a-zA-Z0-9\.\-]+)");

    Ok(GetUserInfoResponse {
        email,
        name: idp.clone(),
        user_id,
        avatar_url: None,
    })
}

/// 获取用户配额使用情况
pub async fn get_user_usage_and_limits(
    access_token: &str,
    csrf_token: &str,
) -> Result<UsageAndLimitsResponse, String> {
    // CBOR 编码: {isEmailRequired: false, origin: "KIRO_IDE"}
    let cbor_body: Vec<u8> = vec![
        0xa2, 0x6f, 0x69, 0x73, 0x45, 0x6d, 0x61, 0x69, 0x6c, 
        0x52, 0x65, 0x71, 0x75, 0x69, 0x72, 0x65, 0x64, 0xf4, 
        0x66, 0x6f, 0x72, 0x69, 0x67, 0x69, 0x6e, 0x68, 0x4b, 
        0x49, 0x52, 0x4f, 0x5f, 0x49, 0x44, 0x45
    ];

    let client = reqwest::Client::new();
    
    let response = client
        .post(format!("{}/GetUserUsageAndLimits", KIRO_API))
        .header("Content-Type", "application/cbor")
        .header("Accept", "application/cbor")
        .header("smithy-protocol", "rpc-v2-cbor")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("x-csrf-token", csrf_token)
        .body(cbor_body)
        .send()
        .await
        .map_err(|e| format!("GetUserUsageAndLimits request failed: {}", e))?;

    let status = response.status();
    let body = response.bytes().await.unwrap_or_default();

    if !status.is_success() {
        let text = String::from_utf8_lossy(&body);
        return Err(format!("GetUserUsageAndLimits failed ({}): {}", status, text));
    }

    // 从响应文本中提取配额信息
    let text = String::from_utf8_lossy(&body);
    let limit = extract_number(&text, r"usageLimit[^\d]*(\d+)");
    let used = extract_number(&text, r"currentUsage[^\d]*(\d+)");
    // 提取订阅类型: subscriptionTitle 后面的值如 "KIRO PRO+"
    let subscription_type = extract_pattern(&text, r"subscriptionTitle.{1,5}([A-Z][A-Z0-9\s\+]+)");
    // 提取 userId
    let user_id = extract_pattern(&text, r"userId.{1,5}(d-[a-zA-Z0-9\.\-]+)");

    Ok(UsageAndLimitsResponse {
        usage_limit: limit,
        current_usage: used,
        reset_date: None,
        subscription_type,
        user_id,
    })
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

fn extract_email(text: &str) -> Option<String> {
    extract_pattern(text, r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})")
}

fn extract_number(text: &str, pattern: &str) -> Option<i32> {
    extract_pattern(text, pattern).and_then(|s| s.parse().ok())
}



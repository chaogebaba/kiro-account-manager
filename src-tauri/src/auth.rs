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
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
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

/// 使用 RefreshToken 刷新 AccessToken
#[allow(dead_code)]
pub async fn refresh_kiro_token(refresh_token: &str, csrf_token: &str) -> Result<RefreshTokenResponse, String> {
    let request = serde_json::json!({
        "csrfToken": csrf_token
    });

    // 序列化为 CBOR
    let mut cbor_data = Vec::new();
    ciborium::into_writer(&request, &mut cbor_data)
        .map_err(|e| format!("CBOR serialize failed: {}", e))?;

    let client = reqwest::Client::new();
    
    let response = client
        .post(format!("{}/RefreshToken", KIRO_API))
        .header("Content-Type", "application/cbor")
        .header("Accept", "application/cbor")
        .header("smithy-protocol", "rpc-v2-cbor")
        .header("x-csrf-token", csrf_token)
        .header("Cookie", format!("RefreshToken={}", refresh_token))
        .body(cbor_data)
        .send()
        .await
        .map_err(|e| format!("RefreshToken request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.bytes().await.unwrap_or_default();
        let text = String::from_utf8_lossy(&body);
        return Err(format!("RefreshToken failed ({}): {}", status, text));
    }

    let body = response.bytes().await.unwrap_or_default();
    let result: RefreshTokenResponse = ciborium::from_reader(&body[..])
        .map_err(|e| format!("Parse RefreshToken response failed: {}", e))?;

    Ok(result)
}



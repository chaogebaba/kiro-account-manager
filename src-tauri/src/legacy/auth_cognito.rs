// [LEGACY] 旧的 Cognito OAuth 相关代码
// 这些是之前尝试直接对接 AWS Cognito 但没跑通的实现
// 保留供参考，不再使用

#![allow(dead_code)]

use serde::{Deserialize, Serialize};

// AWS Cognito OAuth 配置
const COGNITO_DOMAIN: &str = "https://kiro-prod-us-east-1.auth.us-east-1.amazoncognito.com";
const COGNITO_CLIENT_ID: &str = "59bd15eh40ee7pc20h0bkcu7id";
const REDIRECT_URI: &str = "https://app.kiro.dev/signin/oauth";

#[derive(Debug, Serialize)]
pub struct ExchangeTokenRequest {
    idp: String,
    code: String,
    #[serde(rename = "codeVerifier")]
    code_verifier: String,
    #[serde(rename = "redirectUri")]
    redirect_uri: String,
    state: String,
}

#[derive(Debug, Deserialize)]
pub struct ExchangeTokenResponse {
    #[serde(rename = "csrfToken")]
    pub csrf_token: Option<String>,
    #[serde(rename = "accessToken")]
    pub access_token: Option<String>,
    pub state: Option<String>,
}

#[derive(Debug, Serialize)]
struct GetUserInfoRequest {
    #[serde(rename = "csrfToken")]
    csrf_token: String,
}

#[derive(Debug, Deserialize)]
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
pub fn build_cognito_oauth_url(provider: &str, code_verifier: &str, state: &str) -> Result<String, String> {
    let code_challenge = generate_code_challenge(code_verifier);
    
    let identity_provider = match provider {
        "GitHub" => "Github",
        "Google" => "Google",
        _ => return Err(format!("Unsupported provider: {}", provider))
    };
    
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
pub fn initiate_cognito_login(provider: &str) -> Result<(String, String, String), String> {
    let code_verifier = generate_code_verifier();
    let state = generate_state();
    
    let redirect_url = build_cognito_oauth_url(provider, &code_verifier, &state)?;
    
    Ok((redirect_url, code_verifier, state))
}

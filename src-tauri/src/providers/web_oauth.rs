// Web OAuth Provider - Cognito + KiroWebPortalService (CBOR) 登录
// 基于 docs/api/web/OAuth.md 流程实现
// 独立于现有的 AuthDesktopService 登录

use super::{AuthProvider, AuthResult, RefreshMetadata};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

// ============================================================
// 常量配置
// ============================================================

const KIRO_WEB_PORTAL: &str = "https://app.kiro.dev";
const KIRO_REDIRECT_URI: &str = "https://app.kiro.dev/signin/oauth";

// ============================================================
// CBOR 编解码
// ============================================================

/// CBOR 编码请求体
fn cbor_encode<T: Serialize>(value: &T) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    ciborium::into_writer(value, &mut buf)
        .map_err(|e| format!("CBOR encode error: {}", e))?;
    Ok(buf)
}

/// CBOR 解码响应体
fn cbor_decode<T: for<'de> Deserialize<'de>>(data: &[u8]) -> Result<T, String> {
    ciborium::from_reader(data)
        .map_err(|e| format!("CBOR decode error: {}", e))
}

// ============================================================
// 请求/响应结构
// ============================================================

/// InitiateLogin 请求
#[derive(Debug, Serialize)]
struct InitiateLoginRequest {
    idp: String,
    #[serde(rename = "redirectUri")]
    redirect_uri: String,
    #[serde(rename = "codeChallenge")]
    code_challenge: String,
    #[serde(rename = "codeChallengeMethod")]
    code_challenge_method: String,
    state: String,
}

/// InitiateLogin 响应
#[derive(Debug, Deserialize)]
pub struct InitiateLoginResponse {
    #[serde(rename = "redirectUrl")]
    redirect_url: Option<String>,
    #[allow(dead_code)]
    #[serde(rename = "clientSecret")]
    client_secret: Option<String>,
}

/// ExchangeToken 请求
#[derive(Debug, Serialize)]
struct ExchangeTokenRequest {
    idp: String,
    code: String,
    #[serde(rename = "codeVerifier")]
    code_verifier: String,
    #[serde(rename = "redirectUri")]
    redirect_uri: String,
}

/// ExchangeToken 响应
#[derive(Debug, Deserialize)]
pub struct ExchangeTokenResponse {
    #[serde(rename = "accessToken")]
    access_token: Option<String>,
    #[serde(rename = "csrfToken")]
    csrf_token: Option<String>,
    #[serde(rename = "expiresIn")]
    expires_in: Option<i64>,
    #[serde(rename = "profileArn")]
    profile_arn: Option<String>,
}

/// RefreshToken 请求
#[derive(Debug, Serialize)]
struct RefreshTokenRequest {
    #[serde(rename = "csrfToken")]
    csrf_token: String,
}

/// RefreshToken 响应
#[derive(Debug, Deserialize)]
pub struct RefreshTokenResponse {
    #[serde(rename = "accessToken")]
    access_token: Option<String>,
    #[serde(rename = "csrfToken")]
    csrf_token: Option<String>,
    #[serde(rename = "expiresIn")]
    expires_in: Option<i64>,
}

// ============================================================
// PKCE 工具函数
// ============================================================

/// 生成 code_verifier (43-128 字符的随机字符串)
pub fn generate_code_verifier() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    base64_url_encode(&bytes)
}

/// 生成 code_challenge = Base64URL(SHA256(code_verifier))
pub fn generate_code_challenge(verifier: &str) -> String {
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

// ============================================================
// KiroWebPortalClient - CBOR API 客户端
// ============================================================

pub struct KiroWebPortalClient {
    client: reqwest::Client,
    endpoint: String,
}

impl KiroWebPortalClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            endpoint: KIRO_WEB_PORTAL.to_string(),
        }
    }

    /// 调用 InitiateLogin 接口 - 获取 OAuth 重定向 URL
    pub async fn initiate_login(
        &self,
        idp: &str,
        redirect_uri: &str,
        code_challenge: &str,
        state: &str,
    ) -> Result<InitiateLoginResponse, String> {
        let url = format!(
            "{}/service/KiroWebPortalService/operation/InitiateLogin",
            self.endpoint
        );

        let request = InitiateLoginRequest {
            idp: idp.to_string(),
            redirect_uri: redirect_uri.to_string(),
            code_challenge: code_challenge.to_string(),
            code_challenge_method: "S256".to_string(),
            state: state.to_string(),
        };

        let body = cbor_encode(&request)?;

        let response = self.client
            .post(&url)
            .header("Content-Type", "application/cbor")
            .header("Accept", "application/cbor")
            .header("smithy-protocol", "rpc-v2-cbor")
            .body(body)
            .send()
            .await
            .map_err(|e| format!("InitiateLogin request failed: {}", e))?;

        let status = response.status();
        let bytes = response.bytes().await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        if !status.is_success() {
            return Err(format!("InitiateLogin failed ({}): {:?}", status, bytes));
        }

        cbor_decode(&bytes)
    }

    /// 调用 ExchangeToken 接口
    pub async fn exchange_token(
        &self,
        idp: &str,
        code: &str,
        code_verifier: &str,
        redirect_uri: &str,
    ) -> Result<ExchangeTokenResponse, String> {
        let url = format!(
            "{}/service/KiroWebPortalService/operation/ExchangeToken",
            self.endpoint
        );

        let request = ExchangeTokenRequest {
            idp: idp.to_string(),
            code: code.to_string(),
            code_verifier: code_verifier.to_string(),
            redirect_uri: redirect_uri.to_string(),
        };

        let body = cbor_encode(&request)?;

        let response = self.client
            .post(&url)
            .header("Content-Type", "application/cbor")
            .header("Accept", "application/cbor")
            .header("smithy-protocol", "rpc-v2-cbor")
            .body(body)
            .send()
            .await
            .map_err(|e| format!("ExchangeToken request failed: {}", e))?;

        let status = response.status();
        let bytes = response.bytes().await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        if !status.is_success() {
            return Err(format!("ExchangeToken failed ({}): {:?}", status, bytes));
        }

        cbor_decode(&bytes)
    }

    /// 调用 RefreshToken 接口
    pub async fn refresh_token(&self, csrf_token: &str) -> Result<RefreshTokenResponse, String> {
        let url = format!(
            "{}/service/KiroWebPortalService/operation/RefreshToken",
            self.endpoint
        );

        let request = RefreshTokenRequest {
            csrf_token: csrf_token.to_string(),
        };

        let body = cbor_encode(&request)?;

        let response = self.client
            .post(&url)
            .header("Content-Type", "application/cbor")
            .header("Accept", "application/cbor")
            .header("smithy-protocol", "rpc-v2-cbor")
            .body(body)
            .send()
            .await
            .map_err(|e| format!("RefreshToken request failed: {}", e))?;

        let status = response.status();
        let bytes = response.bytes().await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        if !status.is_success() {
            return Err(format!("RefreshToken failed ({}): {:?}", status, bytes));
        }

        cbor_decode(&bytes)
    }
}

// ============================================================
// WebOAuthProvider
// ============================================================

pub struct WebOAuthProvider {
    provider_id: String, // "Google" 或 "GitHub"
}

impl WebOAuthProvider {
    pub fn new(provider_id: &str) -> Self {
        Self {
            provider_id: provider_id.to_string(),
        }
    }

    /// 获取 API 使用的 idp 名称
    fn get_idp_name(&self) -> &str {
        match self.provider_id.as_str() {
            "Google" => "Google",
            "GitHub" => "Github",
            "BuilderId" => "BuilderId",
            other => other,
        }
    }
}

#[async_trait]
impl AuthProvider for WebOAuthProvider {
    async fn login(&self) -> Result<AuthResult, String> {
        // Web OAuth 需要两步流程，不能用单一的 login 方法
        // 请使用 initiate_login() 和 complete_login()
        Err("Web OAuth requires two-step flow: use initiate_login() and complete_login()".to_string())
    }

    async fn refresh_token(&self, refresh_token: &str, _metadata: RefreshMetadata) -> Result<AuthResult, String> {
        self.refresh_token_impl(refresh_token).await
    }

    fn get_provider_id(&self) -> &str {
        &self.provider_id
    }

    fn get_auth_method(&self) -> &str {
        "web_oauth"
    }
}

impl WebOAuthProvider {
    /// 发起登录 - 返回授权 URL 和需要保存的参数（不自动打开浏览器）
    pub async fn initiate_login(&self) -> Result<WebOAuthInitResult, String> {
        let state = uuid::Uuid::new_v4().to_string();
        let code_verifier = generate_code_verifier();
        let code_challenge = generate_code_challenge(&code_verifier);
        let redirect_uri = KIRO_REDIRECT_URI.to_string();

        let idp = self.get_idp_name();
        println!("\n[WebOAuth] Starting {} authentication...", self.provider_id);
        println!("IDP: {}", idp);
        println!("Redirect URI: {}", redirect_uri);
        println!("State: {}", state);

        // 调用 InitiateLogin 获取 redirectUrl
        println!("[WebOAuth] Calling InitiateLogin...");
        let client = KiroWebPortalClient::new();
        let initiate_response = client
            .initiate_login(idp, &redirect_uri, &code_challenge, &state)
            .await?;

        let authorize_url = initiate_response.redirect_url
            .ok_or("No redirectUrl in InitiateLogin response")?;
        
        println!("[WebOAuth] Got redirect URL: {}", authorize_url);

        Ok(WebOAuthInitResult {
            authorize_url,
            state,
            code_verifier,
            redirect_uri,
            idp: idp.to_string(),
            provider_id: self.provider_id.clone(),
        })
    }

    /// 完成登录 - 用回调 URL 中的 code 换取 token
    pub async fn complete_login(&self, code: &str, state: &str, code_verifier: &str, expected_state: &str) -> Result<AuthResult, String> {
        // 验证 state
        if state != expected_state {
            return Err("State mismatch - possible CSRF attack".to_string());
        }

        let idp = self.get_idp_name();
        let redirect_uri = KIRO_REDIRECT_URI;

        // 调用 ExchangeToken
        println!("[WebOAuth] Exchanging code for tokens via CBOR API...");
        let client = KiroWebPortalClient::new();
        let token_response = client
            .exchange_token(idp, code, code_verifier, redirect_uri)
            .await?;

        // 构建 AuthResult
        let access_token = token_response.access_token
            .ok_or("No access_token in response")?;
        let csrf_token = token_response.csrf_token
            .ok_or("No csrf_token in response")?;
        let expires_in = token_response.expires_in.unwrap_or(3600);
        let expires_at = chrono::Local::now() + chrono::Duration::seconds(expires_in);

        println!("[WebOAuth] {} login successful!", self.provider_id);

        Ok(AuthResult {
            access_token,
            refresh_token: csrf_token.clone(),
            expires_at: expires_at.format("%Y/%m/%d %H:%M:%S").to_string(),
            provider: self.provider_id.clone(),
            auth_method: "web_oauth".to_string(),
            id_token: None,
            token_type: Some("Bearer".to_string()),
            expires_in,
            region: None,
            client_id: None,
            client_secret: None,
            client_id_hash: None,
            sso_session_id: None,
            profile_arn: token_response.profile_arn,
            csrf_token: Some(csrf_token),
        })
    }

    pub async fn refresh_token_impl(&self, csrf_token: &str) -> Result<AuthResult, String> {
        let client = KiroWebPortalClient::new();
        let token_response = client.refresh_token(csrf_token).await?;

        let access_token = token_response.access_token
            .ok_or("No access_token in response")?;
        let new_csrf_token = token_response.csrf_token
            .ok_or("No csrf_token in response")?;
        let expires_in = token_response.expires_in.unwrap_or(3600);
        let expires_at = chrono::Local::now() + chrono::Duration::seconds(expires_in);

        Ok(AuthResult {
            access_token,
            refresh_token: new_csrf_token.clone(),
            expires_at: expires_at.format("%Y/%m/%d %H:%M:%S").to_string(),
            provider: self.provider_id.clone(),
            auth_method: "web_oauth".to_string(),
            id_token: None,
            token_type: Some("Bearer".to_string()),
            expires_in,
            region: None,
            client_id: None,
            client_secret: None,
            client_id_hash: None,
            sso_session_id: None,
            profile_arn: None,
            csrf_token: Some(new_csrf_token),
        })
    }
}

/// InitiateLogin 返回的结果，需要保存用于 complete_login
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WebOAuthInitResult {
    pub authorize_url: String,
    pub state: String,
    pub code_verifier: String,
    pub redirect_uri: String,
    pub idp: String,
    pub provider_id: String,
}

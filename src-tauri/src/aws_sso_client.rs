/// AWS SSO OIDC Client
/// 实现 AWS SSO OIDC API 调用，用于 BuilderId 认证

use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use std::time::Duration;



/// AWS SSO OIDC 客户端
pub struct AWSSSOClient {
    region: String,
    base_url: String,
    client: Client,
}

/// 客户端注册响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientRegistration {
    #[serde(rename = "clientId")]
    pub client_id: String,
    #[serde(rename = "clientSecret")]
    pub client_secret: String,
    #[serde(rename = "clientIdIssuedAt")]
    pub client_id_issued_at: Option<i64>,
    #[serde(rename = "clientSecretExpiresAt")]
    pub client_secret_expires_at: Option<i64>,
    #[serde(rename = "authorizationEndpoint")]
    pub authorization_endpoint: Option<String>,
    #[serde(rename = "tokenEndpoint")]
    pub token_endpoint: Option<String>,
}

/// Token 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenResponse {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "refreshToken")]
    pub refresh_token: String,
    #[serde(rename = "idToken")]
    pub id_token: Option<String>,
    #[serde(rename = "tokenType")]
    pub token_type: Option<String>,
    #[serde(rename = "expiresIn")]
    pub expires_in: i64,
}

/// PKCE 参数
#[derive(Debug, Clone)]
pub struct PKCEParams {
    pub code_verifier: String,
    pub code_challenge: String,
}

impl AWSSSOClient {
    pub fn new(region: &str) -> Self {
        let base_url = format!("https://oidc.{}.amazonaws.com", region);
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            region: region.to_string(),
            base_url,
            client,
        }
    }

    /// 获取 Builder ID 的 start URL
    pub fn get_builder_id_start_url() -> &'static str {
        "https://view.awsapps.com/start"
    }

    /// 注册 OAuth 客户端
    pub async fn register_client(&self, issuer_url: &str) -> Result<ClientRegistration, String> {
        let url = format!("{}/client/register", self.base_url);
        
        let body = serde_json::json!({
            "clientName": "Kiro Token Manager",
            "clientType": "public",
            "scopes": [
                "codewhisperer:completions",
                "codewhisperer:analysis",
                "codewhisperer:conversations",
                "codewhisperer:transformations",
                "codewhisperer:taskassist"
            ],
            "grantTypes": ["authorization_code", "refresh_token"],
            "redirectUris": ["http://127.0.0.1/oauth/callback"],
            "issuerUrl": issuer_url
        });

        println!("\n[AWS SSO] Register Client (region: {})", self.region);
        println!("URL: {}", url);
        println!("Issuer URL: {}", issuer_url);

        let resp = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Client registration request failed: {}", e))?;

        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(format!("Client registration failed ({}): {}", status, text));
        }

        println!("Client registered successfully");
        
        serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse client registration: {}", e))
    }


    /// 交换授权码获取 Token
    pub async fn create_token(
        &self,
        client_id: &str,
        client_secret: &str,
        code: &str,
        code_verifier: &str,
        redirect_uri: &str,
    ) -> Result<TokenResponse, String> {
        let url = format!("{}/token", self.base_url);

        let body = serde_json::json!({
            "clientId": client_id,
            "clientSecret": client_secret,
            "grantType": "authorization_code",
            "code": code,
            "codeVerifier": code_verifier,
            "redirectUri": redirect_uri
        });

        println!("\n[AWS SSO] Create Token");
        println!("URL: {}", url);

        let resp = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Token creation request failed: {}", e))?;

        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(format!("Token creation failed ({}): {}", status, text));
        }

        println!("Token created successfully");

        serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse token response: {}", e))
    }

    /// 刷新 Token（Builder ID 账号刷新时使用）
    pub async fn refresh_token(
        &self,
        client_id: &str,
        client_secret: &str,
        refresh_token: &str,
    ) -> Result<TokenResponse, String> {
        let url = format!("{}/token", self.base_url);

        let body = serde_json::json!({
            "clientId": client_id,
            "clientSecret": client_secret,
            "grantType": "refresh_token",
            "refreshToken": refresh_token
        });

        println!("\n[AWS SSO] Refresh Token");

        let resp = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Token refresh request failed: {}", e))?;

        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(format!("Token refresh failed ({}): {}", status, text));
        }

        serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse token response: {}", e))
    }

    /// 生成 PKCE 参数
    pub fn generate_pkce() -> PKCEParams {
        // 生成 32 字节随机数作为 code_verifier
        let random_bytes: [u8; 32] = rand::random();
        let code_verifier = URL_SAFE_NO_PAD.encode(random_bytes);

        // 计算 SHA256 哈希作为 code_challenge
        let mut hasher = Sha256::new();
        hasher.update(code_verifier.as_bytes());
        let hash = hasher.finalize();
        let code_challenge = URL_SAFE_NO_PAD.encode(hash);

        PKCEParams {
            code_verifier,
            code_challenge,
        }
    }

    /// 生成随机 state
    pub fn generate_state() -> String {
        uuid::Uuid::new_v4().to_string()
    }

    /// 构建授权 URL
    pub fn build_authorization_url(
        &self,
        client_id: &str,
        redirect_uri: &str,
        state: &str,
        code_challenge: &str,
    ) -> String {
        let scopes = [
            "codewhisperer:completions",
            "codewhisperer:analysis",
            "codewhisperer:conversations",
            "codewhisperer:transformations",
            "codewhisperer:taskassist",
        ].join(",");

        format!(
            "{}/authorize?response_type=code&client_id={}&redirect_uri={}&scopes={}&state={}&code_challenge={}&code_challenge_method=S256",
            self.base_url,
            urlencoding::encode(client_id),
            urlencoding::encode(redirect_uri),
            urlencoding::encode(&scopes),
            state,
            code_challenge
        )
    }

    /// 计算 clientIdHash（用于存储）
    #[allow(dead_code)]
    pub fn compute_client_id_hash(start_url: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(start_url.as_bytes());
        let hash = hasher.finalize();
        hex::encode(hash)
    }
}

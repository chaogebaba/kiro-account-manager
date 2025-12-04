// Social Provider - Google/GitHub 登录
// 参考 kiro-batch-login/src/providers/social-provider.js

use crate::kiro_auth_client::KiroAuthServiceClient;
use crate::oauth_callback_server::OAuthCallbackServer;
use crate::auth_social;
use super::{AuthResult, AuthProvider, RefreshMetadata};
use serde::Deserialize;
use async_trait::async_trait;

/// Social 登录 Token 响应
#[derive(Debug, Deserialize)]
struct SocialTokenResponse {
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "refreshToken")]
    refresh_token: String,
    #[serde(rename = "profileArn")]
    profile_arn: Option<String>,
    #[serde(rename = "expiresIn")]
    expires_in: i64,
    #[serde(rename = "idToken")]
    id_token: Option<String>,
    #[serde(rename = "tokenType")]
    token_type: Option<String>,
}

/// Social 刷新 Token 响应
#[derive(Debug, Deserialize)]
struct SocialRefreshResponse {
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "refreshToken")]
    refresh_token: String,
    #[serde(rename = "profileArn")]
    profile_arn: Option<String>,
    #[serde(rename = "expiresIn")]
    expires_in: i64,
}

// Social 登录使用的端口列表
const SOCIAL_AUTH_PORTS: [u16; 10] = [49153, 50153, 51153, 52153, 53153, 4649, 6588, 9091, 8008, 3128];

pub struct SocialProvider {
    provider_id: String,
}

impl SocialProvider {
    pub fn new(provider_id: &str) -> Self {
        Self {
            provider_id: provider_id.to_string(),
        }
    }
}

#[async_trait]
impl AuthProvider for SocialProvider {
    async fn login(&self) -> Result<AuthResult, String> {
        let provider = &self.provider_id;

        // Step 1: 启动 OAuth 回调服务器
        let mut server = OAuthCallbackServer::new_predefined("localhost", SOCIAL_AUTH_PORTS.to_vec());
        let redirect_uri = server
            .start()
            .map_err(|e| format!("Failed to start OAuth callback server: {}", e))?;

        // Step 2: 生成 PKCE 参数
        let state = uuid::Uuid::new_v4().to_string();
        let code_verifier = auth_social::generate_code_verifier_social();
        let code_challenge = auth_social::generate_code_challenge_social(&code_verifier);

        println!("\n[Social] Starting {} authentication...", provider);
        println!("Redirect URI: {}", redirect_uri);
        println!("State: {}", state);

        // Step 3: 打开浏览器登录
        let client = KiroAuthServiceClient::new();
        client.login(provider, &redirect_uri, &code_challenge, &state).await?;

        // Step 4: 等待回调
        println!("[Social] Waiting for callback...");
        let callback = tokio::task::spawn_blocking(move || server.wait_for_callback())
            .await
            .map_err(|e| format!("Failed to join callback waiter: {}", e))?
            .map_err(|e| format!("OAuth callback failed: {}", e))?;

        // Step 5: 验证 state
        if callback.state != state {
            return Err("State mismatch - possible CSRF attack".to_string());
        }

        // Step 6: 交换 token
        println!("[Social] Exchanging code for tokens...");
        let token_response: SocialTokenResponse = client
            .create_token(&callback.code, &code_verifier, &redirect_uri, None)
            .await?;

        // Step 7: 构建 AuthResult
        let expires_at = chrono::Local::now() + chrono::Duration::seconds(token_response.expires_in);

        println!("[Social] {} login successful!", provider);

        Ok(AuthResult {
            access_token: token_response.access_token,
            refresh_token: token_response.refresh_token,
            expires_at: expires_at.format("%Y/%m/%d %H:%M:%S").to_string(),
            provider: provider.clone(),
            auth_method: "social".to_string(),
            id_token: token_response.id_token,
            token_type: token_response.token_type,
            expires_in: token_response.expires_in,
            region: None,
            client_id: None,
            client_secret: None,
            client_id_hash: None,
            sso_session_id: None,
            profile_arn: token_response.profile_arn,
        })
    }

    async fn refresh_token(&self, refresh_token: &str, metadata: RefreshMetadata) -> Result<AuthResult, String> {
        let client = KiroAuthServiceClient::new();
        let token_response: SocialRefreshResponse = client.refresh_token(refresh_token).await?;

        let expires_at = chrono::Local::now() + chrono::Duration::seconds(token_response.expires_in);

        Ok(AuthResult {
            access_token: token_response.access_token,
            refresh_token: token_response.refresh_token,
            expires_at: expires_at.format("%Y/%m/%d %H:%M:%S").to_string(),
            provider: self.provider_id.clone(),
            auth_method: "social".to_string(),
            id_token: None,
            token_type: Some("Bearer".to_string()),
            expires_in: token_response.expires_in,
            region: None,
            client_id: None,
            client_secret: None,
            client_id_hash: None,
            sso_session_id: None,
            // 保留 metadata 中的 profileArn
            profile_arn: metadata.profile_arn.or(token_response.profile_arn),
        })
    }

    fn get_provider_id(&self) -> &str {
        &self.provider_id
    }

    fn get_auth_method(&self) -> &str {
        "social"
    }
}

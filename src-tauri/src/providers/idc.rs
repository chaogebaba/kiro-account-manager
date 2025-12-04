// IdC Provider - BuilderId/Enterprise 登录
// 参考 kiro-batch-login/src/providers/idc-provider.js

use crate::aws_sso_client::AWSSSOClient;
use crate::oauth_callback_server::OAuthCallbackServer;
use sha2::{Digest, Sha256};
use super::{AuthResult, AuthProvider, RefreshMetadata};
use async_trait::async_trait;

const BUILDER_ID_START_URL: &str = "https://view.awsapps.com/start";

pub struct IdcProvider {
    provider_id: String,
    region: String,
    start_url: Option<String>,
}

impl IdcProvider {
    pub fn new(provider_id: &str, region: &str, start_url: Option<String>) -> Self {
        Self {
            provider_id: provider_id.to_string(),
            region: region.to_string(),
            start_url,
        }
    }

    /// 获取 start URL
    fn get_start_url(&self) -> &str {
        self.start_url.as_deref().unwrap_or(BUILDER_ID_START_URL)
    }

    /// 计算 clientIdHash
    fn compute_client_id_hash(start_url: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(start_url.as_bytes());
        let hash = hasher.finalize();
        hex::encode(hash)
    }
}

#[async_trait]
impl AuthProvider for IdcProvider {
    async fn login(&self) -> Result<AuthResult, String> {
        let provider = &self.provider_id;
        let region = &self.region;
        let start_url = self.get_start_url();

        println!("\n[IdC] Starting {} authentication...", provider);
        println!("Region: {}", region);
        println!("Start URL: {}", start_url);

        // Step 1: 创建 AWS SSO 客户端
        let sso_client = AWSSSOClient::new(region);

        // Step 2: 注册 OAuth 客户端
        println!("[IdC] Registering OAuth client...");
        let client_reg = sso_client.register_client(start_url).await?;
        println!("Client ID: {}", client_reg.client_id);

        // Step 3: 启动 OAuth 回调服务器
        let mut server = OAuthCallbackServer::new_random("127.0.0.1");
        let redirect_uri = server
            .start()
            .map_err(|e| format!("Failed to start OAuth callback server: {}", e))?;
        println!("Redirect URI: {}", redirect_uri);

        // Step 4: 生成 PKCE 参数
        let pkce = AWSSSOClient::generate_pkce();
        let state = AWSSSOClient::generate_state();
        println!("State: {}", state);

        // Step 5: 构建授权 URL
        let auth_url = sso_client.build_authorization_url(
            &client_reg.client_id,
            &redirect_uri,
            &state,
            &pkce.code_challenge,
        );

        // Step 6: 打开浏览器
        println!("[IdC] Opening browser...");
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("rundll32")
                .args(["url.dll,FileProtocolHandler", &auth_url])
                .spawn()
                .map_err(|e| format!("Failed to open browser: {}", e))?;
        }
        #[cfg(not(target_os = "windows"))]
        {
            open::that(&auth_url)
                .map_err(|e| format!("Failed to open browser: {}", e))?;
        }

        // Step 7: 等待回调
        println!("[IdC] Waiting for callback...");
        let callback = tokio::task::spawn_blocking(move || server.wait_for_callback())
            .await
            .map_err(|e| format!("Failed to join callback waiter: {}", e))?
            .map_err(|e| format!("OAuth callback failed: {}", e))?;

        // Step 8: 验证 state
        if callback.state != state {
            return Err("State mismatch - possible CSRF attack".to_string());
        }

        // Step 9: 交换 token
        println!("[IdC] Exchanging code for tokens...");
        let token_response = sso_client.create_token(
            &client_reg.client_id,
            &client_reg.client_secret,
            &callback.code,
            &pkce.code_verifier,
            &redirect_uri,
        ).await?;

        // Step 10: 构建 AuthResult
        let expires_at = chrono::Local::now() + chrono::Duration::seconds(token_response.expires_in);
        let client_id_hash = Self::compute_client_id_hash(start_url);

        println!("[IdC] {} login successful!", provider);

        Ok(AuthResult {
            access_token: token_response.access_token,
            refresh_token: token_response.refresh_token,
            expires_at: expires_at.format("%Y/%m/%d %H:%M:%S").to_string(),
            provider: provider.clone(),
            auth_method: "IdC".to_string(),
            id_token: token_response.id_token,
            token_type: token_response.token_type,
            expires_in: token_response.expires_in,
            region: Some(region.clone()),
            client_id: Some(client_reg.client_id),
            client_secret: Some(client_reg.client_secret),
            client_id_hash: Some(client_id_hash),
            sso_session_id: token_response.aws_sso_app_session_id,
            profile_arn: None,
        })
    }

    async fn refresh_token(&self, refresh_token: &str, metadata: RefreshMetadata) -> Result<AuthResult, String> {
        // IdC 刷新需要 client_id 和 client_secret
        let client_id = metadata.client_id.ok_or("Client ID is required for IdC token refresh")?;
        let client_secret = metadata.client_secret.ok_or("Client secret is required for IdC token refresh")?;
        let region = metadata.region.as_deref().unwrap_or(&self.region);

        let sso_client = AWSSSOClient::new(region);
        let token_response = sso_client.refresh_token(&client_id, &client_secret, refresh_token).await?;

        let expires_at = chrono::Local::now() + chrono::Duration::seconds(token_response.expires_in);
        let client_id_hash = metadata.client_id_hash.unwrap_or_else(|| Self::compute_client_id_hash(self.get_start_url()));

        Ok(AuthResult {
            access_token: token_response.access_token,
            refresh_token: token_response.refresh_token,
            expires_at: expires_at.format("%Y/%m/%d %H:%M:%S").to_string(),
            provider: self.provider_id.clone(),
            auth_method: "IdC".to_string(),
            id_token: token_response.id_token,
            token_type: token_response.token_type,
            expires_in: token_response.expires_in,
            region: Some(region.to_string()),
            client_id: Some(client_id),
            client_secret: Some(client_secret),
            client_id_hash: Some(client_id_hash),
            sso_session_id: token_response.aws_sso_app_session_id,
            profile_arn: None,
        })
    }

    fn get_provider_id(&self) -> &str {
        &self.provider_id
    }

    fn get_auth_method(&self) -> &str {
        "IdC"
    }
}

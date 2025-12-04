#![allow(dead_code)]

use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;

/// Kiro Authentication Service Client
/// 负责与 https://prod.us-east-1.auth.desktop.kiro.dev 通信
pub struct KiroAuthServiceClient {
    endpoint: String,
    client: Client,
}

impl KiroAuthServiceClient {
    pub fn new() -> Self {
        let endpoint = "https://prod.us-east-1.auth.desktop.kiro.dev".to_string();

        let client = Client::builder()
            .timeout(Duration::from_millis(10_000))
            .user_agent("KiroBatchLoginCLI/1.0.0")
            .build()
            .expect("failed to build reqwest client");

        Self { endpoint, client }
    }

    fn login_url(&self) -> String {
        format!("{}/login", self.endpoint)
    }

    fn create_token_url(&self) -> String {
        format!("{}/oauth/token", self.endpoint)
    }

    fn refresh_token_url(&self) -> String {
        format!("{}/refreshToken", self.endpoint)
    }

    fn logout_url(&self) -> String {
        format!("{}/logout", self.endpoint)
    }

    fn delete_account_url(&self) -> String {
        format!("{}/account", self.endpoint)
    }

    /// 打开浏览器到登录页面
    pub async fn login(
        &self,
        provider: &str,
        redirect_uri: &str,
        code_challenge: &str,
        state: &str,
    ) -> Result<(), String> {
        let login_url = format!(
            "{}?idp={}&redirect_uri={}&code_challenge={}&code_challenge_method=S256&state={}",
            self.login_url(),
            provider,
            urlencoding::encode(redirect_uri),
            code_challenge,
            state,
        );

        println!("\n[1] KIRO AUTH LOGIN");
        println!("Provider: {}", provider);
        println!("Redirect URI: {}", redirect_uri);
        println!("Code Challenge: {}", code_challenge);
        println!("State: {}", state);
        println!();

        let login_url = login_url.trim().to_string();
        
        #[cfg(target_os = "windows")]
        {
            // Windows: 使用 explorer 打开 URL，避免 start 命令的空格问题
            std::process::Command::new("explorer")
                .arg(&login_url)
                .spawn()
                .map_err(|e| format!("Failed to open browser: {}", e))?;
        }
        
        #[cfg(not(target_os = "windows"))]
        {
            open::that(&login_url)
                .map_err(|e| format!("Failed to open browser for Kiro Auth login: {}", e))?;
        }

        Ok(())
    }

    /// 交换授权码为访问令牌
    pub async fn create_token<T: for<'de> Deserialize<'de>>(
        &self,
        code: &str,
        code_verifier: &str,
        redirect_uri: &str,
        invitation_code: Option<&str>,
    ) -> Result<T, String> {
        println!("\n[6] CREATE TOKEN REQUEST");
        println!("URL: {}", self.create_token_url());
        println!("Code: {}", code);
        println!("Code Verifier: {}", code_verifier);
        println!("Redirect URI: {}", redirect_uri);

        #[derive(serde::Serialize)]
        struct Body<'a> {
            code: &'a str,
            code_verifier: &'a str,
            redirect_uri: &'a str,
            #[serde(skip_serializing_if = "Option::is_none")]
            invitation_code: Option<&'a str>,
        }

        let body = Body {
            code,
            code_verifier,
            redirect_uri,
            invitation_code,
        };

        let resp = self
            .client
            .post(self.create_token_url())
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Kiro Auth Service request failed: {}", e))?;

        let status = resp.status();
        let bytes = resp
            .bytes()
            .await
            .map_err(|e| format!("Kiro Auth Service read body failed: {}", e))?;

        println!("\n[6] CREATE TOKEN RESPONSE");
        println!("Status: {}", status);
        
        let body_str = String::from_utf8_lossy(&bytes);
        
        if !status.is_success() {
            println!("Error: {}", body_str);
            return Err(format!(
                "Kiro Auth Service token creation failed: {} - {}",
                status,
                body_str
            ));
        }

        // 完整格式化打印 JSON
        match serde_json::from_str::<serde_json::Value>(&body_str) {
            Ok(json) => {
                match serde_json::to_string_pretty(&json) {
                    Ok(pretty) => println!("{}", pretty),
                    Err(_) => println!("{}", body_str),
                }
            }
            Err(_) => println!("{}", body_str),
        }
        println!();

        serde_json::from_slice::<T>(&bytes).map_err(|e| format!(
            "Kiro Auth Service token creation parse failed: {}",
            e
        ))
    }

    /// 刷新访问令牌
    pub async fn refresh_token<T: for<'de> Deserialize<'de>>(
        &self,
        refresh_token: &str,
    ) -> Result<T, String> {
        #[derive(serde::Serialize)]
        struct Body<'a> {
            #[serde(rename = "refreshToken")]
            refresh_token: &'a str,
        }

        let body = Body { refresh_token };

        let resp = self
            .client
            .post(self.refresh_token_url())
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Kiro Auth Service request failed: {}", e))?;

        let status = resp.status();
        let bytes = resp
            .bytes()
            .await
            .map_err(|e| format!("Kiro Auth Service read body failed: {}", e))?;

        if !status.is_success() {
            let body_str = String::from_utf8_lossy(&bytes);
            return Err(format!(
                "Kiro Auth Service token refresh failed: {} - {}",
                status,
                body_str
            ));
        }

        serde_json::from_slice::<T>(&bytes).map_err(|e| format!(
            "Kiro Auth Service token refresh parse failed: {}",
            e
        ))
    }

    /// 注销并失效 refresh token
    pub async fn logout(&self, refresh_token: &str) -> Result<(), String> {
        #[derive(serde::Serialize)]
        struct Body<'a> {
            #[serde(rename = "refreshToken")]
            refresh_token: &'a str,
        }

        let body = Body { refresh_token };

        let resp = self
            .client
            .post(self.logout_url())
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Kiro Auth Service request failed: {}", e))?;

        let status = resp.status();
        if !status.is_success() {
            let bytes = resp
                .bytes()
                .await
                .map_err(|e| format!("Kiro Auth Service read body failed: {}", e))?;
            let body_str = String::from_utf8_lossy(&bytes);
            return Err(format!(
                "Kiro Auth Service logout failed: {} - {}",
                status,
                body_str
            ));
        }

        Ok(())
    }

    /// 删除用户账号
    pub async fn delete_account(&self, access_token: &str) -> Result<(), String> {
        let resp = self
            .client
            .delete(self.delete_account_url())
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| format!("Kiro Auth Service request failed: {}", e))?;

        let status = resp.status();
        if !status.is_success() {
            let bytes = resp
                .bytes()
                .await
                .map_err(|e| format!("Kiro Auth Service read body failed: {}", e))?;
            let body_str = String::from_utf8_lossy(&bytes);
            return Err(format!(
                "Kiro Auth Service account deletion failed: {} - {}",
                status,
                body_str
            ));
        }

        Ok(())
    }
}

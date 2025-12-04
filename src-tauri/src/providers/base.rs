// Base Provider - 认证提供者接口和结果结构
// 参考 kiro-batch-login/src/providers/base-provider.js

use serde::{Deserialize, Serialize};
use async_trait::async_trait;

/// 认证结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResult {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: String,
    pub provider: String,
    pub auth_method: String,  // "social" 或 "IdC"
    
    // 可选字段
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_type: Option<String>,
    pub expires_in: i64,
    
    // IdC 专用
    #[serde(skip_serializing_if = "Option::is_none")]
    pub region: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_secret: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_id_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sso_session_id: Option<String>,
    
    // Social 专用
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_arn: Option<String>,
}

/// 刷新 Token 所需的元数据
#[derive(Debug, Clone, Default)]
pub struct RefreshMetadata {
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    pub region: Option<String>,
    pub client_id_hash: Option<String>,
    pub profile_arn: Option<String>,
}

/// 认证提供者接口
#[async_trait]
pub trait AuthProvider: Send + Sync {
    /// 执行登录认证
    async fn login(&self) -> Result<AuthResult, String>;
    
    /// 刷新 Token
    async fn refresh_token(&self, refresh_token: &str, metadata: RefreshMetadata) -> Result<AuthResult, String>;
    
    /// 获取 Provider ID
    fn get_provider_id(&self) -> &str;
    
    /// 获取认证方式
    fn get_auth_method(&self) -> &str;
}

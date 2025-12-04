#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AuthMethod {
    Idc,
    Social,
}

#[derive(Clone, Debug)]
pub struct ProviderConfig {
    pub provider_id: String,
    pub auth_method: AuthMethod,
    pub region: String,
    pub start_url: Option<String>,
}

// AWS SSO 常量
const BUILDER_ID_START_URL: &str = "https://view.awsapps.com/start";
const DEFAULT_REGION: &str = "us-east-1";

/// 支持的 Provider 配置
pub fn get_provider_config(provider_id: &str) -> Option<ProviderConfig> {
    match provider_id {
        // IdC Providers (AWS SSO OIDC)
        "BuilderId" => Some(ProviderConfig {
            provider_id: provider_id.to_string(),
            auth_method: AuthMethod::Idc,
            region: DEFAULT_REGION.to_string(),
            start_url: Some(BUILDER_ID_START_URL.to_string()),
        }),

        // Social Providers (Kiro Auth Service)
        "Google" | "Github" => Some(ProviderConfig {
            provider_id: provider_id.to_string(),
            auth_method: AuthMethod::Social,
            region: DEFAULT_REGION.to_string(),
            start_url: None,
        }),

        _ => None,
    }
}




/// 返回支持的 provider ID 列表
pub fn get_supported_providers() -> Vec<&'static str> {
    vec!["BuilderId", "Google", "Github"]
}

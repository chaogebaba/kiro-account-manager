// 账号相关命令 - 直接存储原始 usage_data

use tauri::State;
use crate::state::AppState;
use crate::account::Account;
use crate::auth::{User, refresh_token_desktop, get_usage_limits_desktop};
use crate::codewhisperer_client::CodeWhispererClient;
use crate::providers::{AuthProvider, SocialProvider, IdcProvider, RefreshMetadata};
use crate::kiro::get_machine_id;
use serde::{Deserialize, Serialize};

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

#[tauri::command]
pub fn get_accounts(state: State<AppState>) -> Vec<Account> {
    state.store.lock().unwrap().get_all()
}

#[tauri::command]
pub fn delete_account(state: State<AppState>, id: String) -> bool {
    state.store.lock().unwrap().delete(&id)
}

#[tauri::command]
pub fn delete_accounts(state: State<AppState>, ids: Vec<String>) -> usize {
    state.store.lock().unwrap().delete_many(&ids)
}

#[tauri::command]
pub async fn sync_account(state: State<'_, AppState>, id: String) -> Result<Account, String> {
    let account = {
        let store = state.store.lock().unwrap();
        store.accounts.iter().find(|a| a.id == id).cloned()
    }.ok_or("Account not found")?;

    let provider_str = account.provider.as_deref().unwrap_or("Google");
    let refresh_token_str = account.refresh_token.as_ref().ok_or("No refresh token")?;
    
    println!("[sync_account] Refreshing {} account", provider_str);
    
    // 根据 provider 选择刷新接口
    // 注意：Web OAuth 的 refresh_token 也是 aor 开头的 RefreshToken Cookie，可以用 Desktop API
    let (new_access_token, new_refresh_token, expires_in, new_profile_arn, new_id_token, new_sso_session_id) = 
        if provider_str == "BuilderId" {
            // BuilderId -> AWS OIDC
            let metadata = RefreshMetadata {
                client_id: account.sso_client_id.clone(),
                client_secret: account.sso_client_secret.clone(),
                region: account.sso_region.clone(),
                ..Default::default()
            };
            let idc_provider = IdcProvider::new("BuilderId", metadata.region.as_deref().unwrap_or("us-east-1"), None);
            let auth_result = idc_provider.refresh_token(refresh_token_str, metadata).await?;
            (auth_result.access_token, Some(auth_result.refresh_token), auth_result.expires_in, None, auth_result.id_token, auth_result.sso_session_id)
        } else {
            // Google/Github (Desktop OAuth 或 Web OAuth) -> Desktop API
            // Web OAuth 的 refresh_token 是 RefreshToken Cookie (aor开头)，跟 Desktop OAuth 相同
            let metadata = RefreshMetadata {
                profile_arn: account.profile_arn.clone(),
                ..Default::default()
            };
            let social_provider = SocialProvider::new(provider_str);
            let auth_result = social_provider.refresh_token(refresh_token_str, metadata).await?;
            (auth_result.access_token, Some(auth_result.refresh_token), auth_result.expires_in, auth_result.profile_arn, None, None)
        };
    
    // 获取 usage 数据
    let (usage_data, is_banned): (serde_json::Value, bool) = if provider_str == "BuilderId" {
        let machine_id = get_machine_id();
        let cw_client = CodeWhispererClient::new(&machine_id);
        let usage_call = cw_client.get_usage_limits(&new_access_token).await;
        let (usage, banned) = match &usage_call {
            Ok(u) => (Some(u.clone()), false),
            Err(e) if e.starts_with("BANNED:") => (None, true),
            Err(_) => (None, false),
        };
        (serde_json::to_value(&usage).unwrap_or(serde_json::Value::Null), banned)
    } else {
        let usage_call = get_usage_limits_desktop(&new_access_token).await;
        let (usage, banned) = match &usage_call {
            Ok(u) => (Some(u.clone()), false),
            Err(e) if e.starts_with("BANNED:") => (None, true),
            Err(_) => (None, false),
        };
        (serde_json::to_value(&usage).unwrap_or(serde_json::Value::Null), banned)
    };

    let expires_at = chrono::Local::now() + chrono::Duration::seconds(expires_in);
    let expires_at_str = expires_at.format("%Y/%m/%d %H:%M:%S").to_string();

    // 更新账号
    let mut store = state.store.lock().unwrap();
    if let Some(a) = store.accounts.iter_mut().find(|a| a.id == id) {
        a.access_token = Some(new_access_token);
        if let Some(rt) = new_refresh_token {
            a.refresh_token = Some(rt);
        }
        if let Some(arn) = new_profile_arn {
            a.profile_arn = Some(arn);
        }
        if let Some(id_token) = new_id_token {
            a.id_token = Some(id_token);
        }
        if let Some(session_id) = new_sso_session_id {
            a.sso_session_id = Some(session_id);
        }
        a.expires_at = Some(expires_at_str);
        a.usage_data = Some(usage_data);
        a.status = if is_banned { "已封禁".to_string() } else { "正常".to_string() };
        
        let result = a.clone();
        store.save_to_file();
        return Ok(result);
    }

    Err("Account not found after update".to_string())
}



#[tauri::command]
pub async fn verify_account(
    _access_token: String,
    refresh_token: String,
    _csrf_token: Option<String>,
    _provider: String,
) -> Result<UsageAndLimitsResponse, String> {
    let refresh_result = refresh_token_desktop(&refresh_token).await?;
    let new_access_token = refresh_result.access_token;
    let usage = get_usage_limits_desktop(&new_access_token).await?;
    
    let (quota, used) = usage.usage_breakdown_list.as_ref()
        .and_then(|list| list.first())
        .map(|b| (b.usage_limit, b.current_usage))
        .unwrap_or((None, None));
    
    Ok(UsageAndLimitsResponse {
        usage_limit: quota,
        current_usage: used,
        reset_date: None,
        subscription_type: usage.subscription_info.and_then(|s| s.subscription_type),
        user_id: usage.user_info.and_then(|u| u.user_id),
    })
}

#[tauri::command]
pub async fn add_account_by_social(
    state: State<'_, AppState>,
    refresh_token: String,
    provider: Option<String>,
) -> Result<Account, String> {
    println!("Adding account by refresh (desktop API)");
    
    let refresh_result = refresh_token_desktop(&refresh_token).await?;
    let access_token = refresh_result.access_token;
    let new_refresh_token = refresh_result.refresh_token;
    
    let usage_call = get_usage_limits_desktop(&access_token).await;
    let (usage_result, ban_reason) = match &usage_call {
        Ok(usage) => (Some(usage.clone()), None),
        Err(e) if e.starts_with("BANNED:") => (None, Some(e.strip_prefix("BANNED:").unwrap_or("UNKNOWN").to_string())),
        Err(_) => (None, None),
    };
    let usage_data = serde_json::to_value(&usage_result).unwrap_or(serde_json::Value::Null);
    let is_banned = ban_reason.is_some();
    
    let email = usage_result.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|u| u.email.clone())
        .unwrap_or_else(|| "unknown@kiro.dev".to_string());
    let user_id = usage_result.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|u| u.user_id.clone());
    
    let idp = provider.unwrap_or_else(|| {
        if email.contains("gmail") { "Google".to_string() }
        else if email.contains("github") { "Github".to_string() }
        else { "Google".to_string() }
    });
    
    let mut store = state.store.lock().unwrap();
    
    let account = if let Some(existing) = store.accounts.iter_mut().find(|a| a.email == email) {
        existing.access_token = Some(access_token.clone());
        existing.refresh_token = Some(new_refresh_token);
        existing.provider = Some(idp.clone());
        existing.user_id = user_id;
        existing.usage_data = Some(usage_data);
        existing.status = if is_banned { "已封禁".to_string() } else { "正常".to_string() };
        existing.clone()
    } else {
        let mut account = Account::new(email.clone(), format!("Kiro {} 账号", idp));
        account.access_token = Some(access_token.clone());
        account.refresh_token = Some(new_refresh_token);
        account.provider = Some(idp.clone());
        account.user_id = user_id;
        account.usage_data = Some(usage_data);
        account.status = if is_banned { "已封禁".to_string() } else { "正常".to_string() };
        store.accounts.insert(0, account.clone());
        account
    };
    
    store.save_to_file();
    drop(store);
    
    let user = User {
        id: uuid::Uuid::new_v4().to_string(),
        email: email.clone(),
        name: email.split('@').next().unwrap_or("User").to_string(),
        avatar: None,
        provider: idp,
    };
    *state.auth.user.lock().unwrap() = Some(user);
    *state.auth.access_token.lock().unwrap() = Some(access_token);
    
    Ok(account)
}

#[tauri::command]
pub fn import_accounts(state: State<AppState>, json: String) -> Result<usize, String> {
    state.store.lock().unwrap().import_from_json(&json)
}

#[tauri::command]
pub fn export_accounts(state: State<AppState>) -> String {
    state.store.lock().unwrap().export_to_json()
}

/// 添加本地 Kiro IDE 账号
#[tauri::command]
pub async fn add_local_kiro_account(state: State<'_, AppState>) -> Result<Account, String> {
    use crate::kiro::{get_kiro_local_token, get_client_registration};
    
    let local_token = get_kiro_local_token()
        .ok_or("未找到本地 Kiro 账号，请先在 Kiro IDE 中登录")?;
    
    let refresh_token = local_token.refresh_token
        .ok_or("本地账号缺少 refresh_token")?;
    
    let auth_method = local_token.auth_method.as_deref().unwrap_or("social");
    let provider = local_token.provider.clone().unwrap_or_else(|| "Google".to_string());
    
    let (access_token, new_refresh_token, expires_in, client_id, client_secret, client_id_hash, region) = 
        if auth_method == "IdC" {
            let hash = local_token.client_id_hash.clone()
                .ok_or("IdC 账号缺少 clientIdHash")?;
            let region = local_token.region.clone().unwrap_or_else(|| "us-east-1".to_string());
            
            let client_reg = get_client_registration(&hash)
                .ok_or(format!("未找到客户端注册信息: {}.json", hash))?;
            
            let metadata = RefreshMetadata {
                client_id: Some(client_reg.client_id.clone()),
                client_secret: Some(client_reg.client_secret.clone()),
                region: Some(region.clone()),
                ..Default::default()
            };
            
            let idc_provider = IdcProvider::new("BuilderId", &region, None);
            let auth_result = idc_provider.refresh_token(&refresh_token, metadata).await?;
            
            (auth_result.access_token, auth_result.refresh_token, auth_result.expires_in,
             Some(client_reg.client_id), Some(client_reg.client_secret), Some(hash), Some(region))
        } else {
            let metadata = RefreshMetadata {
                profile_arn: local_token.profile_arn.clone(),
                ..Default::default()
            };
            
            let social_provider = SocialProvider::new(&provider);
            let auth_result = social_provider.refresh_token(&refresh_token, metadata).await?;
            
            (auth_result.access_token, auth_result.refresh_token, auth_result.expires_in,
             None, None, None, None)
        };
    
    // 获取 usage 数据（根据 auth_method 选择不同的 API）
    let (usage_data, email, user_id, is_banned) = if auth_method == "IdC" {
        let machine_id = get_machine_id();
        let cw_client = CodeWhispererClient::new(&machine_id);
        let usage_call = cw_client.get_usage_limits(&access_token).await;
        let (usage, is_banned) = match &usage_call {
            Ok(u) => (Some(u.clone()), false),
            Err(e) if e.starts_with("BANNED:") => (None, true),
            Err(_) => (None, false),
        };
        let data = serde_json::to_value(&usage).unwrap_or(serde_json::Value::Null);
        let email = usage.as_ref()
            .and_then(|u| u.user_info.as_ref())
            .and_then(|u| u.email.clone())
            .unwrap_or_else(|| format!("{}@kiro.dev", provider.to_lowercase()));
        let user_id = usage.as_ref()
            .and_then(|u| u.user_info.as_ref())
            .and_then(|u| u.user_id.clone());
        (data, email, user_id, is_banned)
    } else {
        let usage_call = get_usage_limits_desktop(&access_token).await;
        let (usage, is_banned) = match &usage_call {
            Ok(u) => (Some(u.clone()), false),
            Err(e) if e.starts_with("BANNED:") => (None, true),
            Err(_) => (None, false),
        };
        let data = serde_json::to_value(&usage).unwrap_or(serde_json::Value::Null);
        let email = usage.as_ref()
            .and_then(|u| u.user_info.as_ref())
            .and_then(|u| u.email.clone())
            .unwrap_or_else(|| format!("{}@kiro.dev", provider.to_lowercase()));
        let user_id = usage.as_ref()
            .and_then(|u| u.user_info.as_ref())
            .and_then(|u| u.user_id.clone());
        (data, email, user_id, is_banned)
    };
    
    let expires_at = chrono::Local::now() + chrono::Duration::seconds(expires_in);
    
    // 检查是否已存在，存在则更新，不存在则新建
    let mut store = state.store.lock().unwrap();
    
    if let Some(existing) = store.accounts.iter_mut().find(|a| a.email == email) {
        // 更新现有账号
        existing.access_token = Some(access_token);
        existing.refresh_token = Some(new_refresh_token);
        existing.provider = Some(provider);
        existing.user_id = user_id;
        existing.expires_at = Some(expires_at.format("%Y/%m/%d %H:%M:%S").to_string());
        existing.sso_client_id = client_id;
        existing.sso_client_secret = client_secret;
        existing.sso_region = region;
        existing.client_id_hash = client_id_hash;
        existing.profile_arn = local_token.profile_arn;
        existing.usage_data = Some(usage_data);
        existing.status = if is_banned { "已封禁".to_string() } else { "正常".to_string() };
        
        let result = existing.clone();
        store.save_to_file();
        return Ok(result);
    }
    
    // 新建账号
    let mut account = Account::new(email.clone(), format!("Kiro {} 账号", provider));
    account.access_token = Some(access_token);
    account.refresh_token = Some(new_refresh_token);
    account.provider = Some(provider);
    account.user_id = user_id;
    account.expires_at = Some(expires_at.format("%Y/%m/%d %H:%M:%S").to_string());
    account.sso_client_id = client_id;
    account.sso_client_secret = client_secret;
    account.sso_region = region;
    account.client_id_hash = client_id_hash;
    account.profile_arn = local_token.profile_arn;
    account.usage_data = Some(usage_data);
    account.status = if is_banned { "已封禁".to_string() } else { "正常".to_string() };
    
    store.accounts.insert(0, account.clone());
    store.save_to_file();
    
    Ok(account)
}

/// 手动添加 BuilderId 账号
#[tauri::command]
pub async fn add_account_by_idc(
    state: State<'_, AppState>,
    refresh_token: String,
    client_id: String,
    client_secret: String,
    region: Option<String>,
) -> Result<Account, String> {
    let region = region.unwrap_or_else(|| "us-east-1".to_string());
    let metadata = RefreshMetadata {
        client_id: Some(client_id.clone()),
        client_secret: Some(client_secret.clone()),
        region: Some(region.clone()),
        ..Default::default()
    };
    
    let idc_provider = IdcProvider::new("BuilderId", &region, None);
    let auth_result = idc_provider.refresh_token(&refresh_token, metadata).await?;
    
    let machine_id = get_machine_id();
    let cw_client = CodeWhispererClient::new(&machine_id);
    let usage_call = cw_client.get_usage_limits(&auth_result.access_token).await;
    let (usage, is_banned) = match &usage_call {
        Ok(u) => (Some(u.clone()), false),
        Err(e) if e.starts_with("BANNED:") => (None, true),
        Err(_) => (None, false),
    };
    let usage_data = serde_json::to_value(&usage).unwrap_or(serde_json::Value::Null);
    
    let email = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|u| u.email.clone())
        .unwrap_or_else(|| "builderid@kiro.dev".to_string());
    let user_id = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|u| u.user_id.clone());
    
    use sha2::{Digest, Sha256};
    let start_url = "https://view.awsapps.com/start";
    let mut hasher = Sha256::new();
    hasher.update(start_url.as_bytes());
    let client_id_hash = hex::encode(hasher.finalize());
    
    let expires_at = chrono::Local::now() + chrono::Duration::seconds(auth_result.expires_in);
    
    let mut store = state.store.lock().unwrap();
    
    let account = if let Some(existing) = store.accounts.iter_mut().find(|a| a.email == email) {
        existing.access_token = Some(auth_result.access_token);
        existing.refresh_token = Some(auth_result.refresh_token);
        existing.provider = Some("BuilderId".to_string());
        existing.user_id = user_id;
        existing.expires_at = Some(expires_at.format("%Y/%m/%d %H:%M:%S").to_string());
        existing.sso_client_id = Some(client_id);
        existing.sso_client_secret = Some(client_secret);
        existing.sso_region = Some(region);
        existing.client_id_hash = Some(client_id_hash);
        existing.id_token = auth_result.id_token;
        existing.sso_session_id = auth_result.sso_session_id;
        existing.usage_data = Some(usage_data);
        existing.status = if is_banned { "已封禁".to_string() } else { "正常".to_string() };
        existing.clone()
    } else {
        let mut account = Account::new(email.clone(), "Kiro BuilderId 账号".to_string());
        account.access_token = Some(auth_result.access_token);
        account.refresh_token = Some(auth_result.refresh_token);
        account.provider = Some("BuilderId".to_string());
        account.user_id = user_id;
        account.expires_at = Some(expires_at.format("%Y/%m/%d %H:%M:%S").to_string());
        account.sso_client_id = Some(client_id);
        account.sso_client_secret = Some(client_secret);
        account.sso_region = Some(region);
        account.client_id_hash = Some(client_id_hash);
        account.id_token = auth_result.id_token;
        account.sso_session_id = auth_result.sso_session_id;
        account.usage_data = Some(usage_data);
        account.status = if is_banned { "已封禁".to_string() } else { "正常".to_string() };
        store.accounts.insert(0, account.clone());
        account
    };
    
    store.save_to_file();
    
    Ok(account)
}

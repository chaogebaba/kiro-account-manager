use crate::account::Account;
use crate::kiro_cli_db::read_kiro_cli_accounts;
use crate::kiro_portal_client::KiroPortalClient;
use crate::state::AppState;
use tauri::State;
use serde::Serialize;

#[derive(Serialize)]
pub struct KiroCliImportResult {
    pub success: bool,
    pub is_new: bool,
    pub account: Option<Account>,
    pub error: Option<String>,
}

/// 获取 kiro-cli 默认数据库路径
#[tauri::command]
pub fn get_kiro_cli_default_path() -> Result<String, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "无法获取用户主目录".to_string())?;

    #[cfg(target_os = "windows")]
    let default_path = format!("{}/.local/share/kiro-cli/data.sqlite3", home);

    #[cfg(not(target_os = "windows"))]
    let default_path = format!("{}/.local/share/kiro-cli/data.sqlite3", home);

    // 检查文件是否存在
    if std::path::Path::new(&default_path).exists() {
        Ok(default_path)
    } else {
        // 文件不存在，返回空字符串（前端会显示占位符）
        Ok(String::new())
    }
}

/// 从 kiro-cli 数据库导入账号
#[tauri::command]
pub async fn import_from_kiro_cli(
    db_path: String,
    state: State<'_, AppState>,
) -> Result<KiroCliImportResult, String> {
    eprintln!("[Kiro CLI Import] 开始导入，数据库路径: {}", db_path);

    // 展开 ~ 为用户主目录
    let expanded_path = if db_path.starts_with("~") {
        let home = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .map_err(|_| "无法获取用户主目录".to_string())?;
        db_path.replacen("~", &home, 1)
    } else {
        db_path.clone()
    };

    eprintln!("[Kiro CLI Import] 展开后的路径: {}", expanded_path);

    // 1. 读取 kiro-cli 数据库
    let cli_accounts = read_kiro_cli_accounts(&expanded_path)?;
    
    if cli_accounts.is_empty() {
        return Err("数据库中没有账号数据".to_string());
    }
    
    if cli_accounts.len() > 1 {
        return Err("数据库中有多个账号，请联系开发者".to_string());
    }
    
    let cli_account = &cli_accounts[0];
    eprintln!("[Kiro CLI Import] 读取到账号: auth_method={}, token_key={}", 
        cli_account.auth_method, cli_account.token_key);

    // 2. 调用 Kiro Portal API 获取配额
    let portal_client = KiroPortalClient::new();
    
    // 判断 idp（根据 auth_method）
    let idp = if cli_account.auth_method == "social" {
        "social"
    } else {
        "idc"
    };
    
    let usage_result = portal_client
        .get_user_usage_and_limits(&cli_account.access_token, idp)
        .await;

    let (email, user_id, provider, usage_data) = match usage_result {
        Ok(usage) => {
            let email = usage.get("email")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            
            let user_id = usage.get("userId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            // 判断 provider
            let provider = if cli_account.auth_method == "social" {
                // Social Login，通过 profile_arn 判断
                if let Some(ref arn) = cli_account.profile_arn {
                    if arn.contains("google") {
                        "Google"
                    } else if arn.contains("github") {
                        "GitHub"
                    } else {
                        "Unknown"
                    }
                } else {
                    "Unknown"
                }
            } else {
                // OIDC，默认 BuilderId
                "BuilderId"
            };

            (email, user_id, provider.to_string(), Some(usage))
        }
        Err(e) => {
            eprintln!("[Kiro CLI Import] 获取配额失败: {}", e);
            return Ok(KiroCliImportResult {
                success: false,
                is_new: false,
                account: None,
                error: Some(format!("获取账号信息失败: {}", e)),
            });
        }
    };

    // 3. 检查账号是否已存在
    let mut store = state.store.lock().unwrap();
    let existing_index = store.accounts.iter().position(|a| {
        // 使用 user_id 或 email 去重
        if let (Some(ref uid), Some(ref a_uid)) = (&user_id, &a.user_id) {
            return uid == a_uid;
        }
        if let (Some(ref e), Some(ref a_e)) = (&email, &a.email) {
            return e == a_e;
        }
        false
    });

    let is_new = existing_index.is_none();

    // 4. 创建或更新 Account
    let label = if is_new {
        format!("从 kiro-cli 导入 ({})", cli_account.token_key)
    } else {
        // 保留原有的 label
        store.accounts[existing_index.unwrap()].label.clone()
    };
    
    let mut account = if email.is_some() {
        Account::new(email.clone().unwrap(), label)
    } else if user_id.is_some() {
        Account::new_enterprise(user_id.clone().unwrap(), label)
    } else {
        return Ok(KiroCliImportResult {
            success: false,
            is_new: false,
            account: None,
            error: Some("无法获取账号标识（email 或 userId）".to_string()),
        });
    };

    // 5. 填充字段
    account.access_token = Some(cli_account.access_token.clone());
    account.refresh_token = Some(cli_account.refresh_token.clone());
    account.expires_at = cli_account.expires_at.clone();
    account.provider = Some(provider);
    account.user_id = user_id;
    account.region = Some(cli_account.region.clone());
    account.usage_data = usage_data;

    // 6. 根据认证类型填充字段
    if cli_account.auth_method == "social" {
        account.auth_method = Some("social".to_string());
        account.profile_arn = cli_account.profile_arn.clone();
    } else {
        account.auth_method = Some("IdC".to_string());
        account.client_id = cli_account.client_id.clone();
        account.client_secret = cli_account.client_secret.clone();
    }

    // 7. 生成或保留 machine_id
    if let Some(idx) = existing_index {
        // 更新现有账号，保留 machine_id
        account.machine_id = store.accounts[idx].machine_id.clone();
        account.id = store.accounts[idx].id.clone();
        store.accounts[idx] = account.clone();
    } else {
        // 新账号，生成 machine_id
        if account.machine_id.is_none() {
            account.machine_id = Some(uuid::Uuid::new_v4().to_string().to_lowercase());
        }
        store.accounts.push(account.clone());
    }

    store.save_to_file();
    drop(store);

    eprintln!("[Kiro CLI Import] 导入成功: is_new={}, email={:?}, user_id={:?}", 
        is_new, account.email, account.user_id);

    Ok(KiroCliImportResult {
        success: true,
        is_new,
        account: Some(account),
        error: None,
    })
}

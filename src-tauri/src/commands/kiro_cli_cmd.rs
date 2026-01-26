use crate::account::Account;
use crate::kiro_cli_db::read_kiro_cli_accounts;
use crate::kiro_portal_client::KiroPortalClient;
use crate::state::AppState;
use tauri::State;

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
) -> Result<Vec<Account>, String> {
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
    eprintln!("[Kiro CLI Import] 读取到 {} 个账号", cli_accounts.len());

    let mut imported_accounts = Vec::new();

    // 2. 遍历每个账号，获取配额信息
    for cli_account in cli_accounts {
        eprintln!("[Kiro CLI Import] 处理账号: auth_method={}, token_key={}", 
            cli_account.auth_method, cli_account.token_key);

        // 3. 调用 Kiro Portal API 获取配额
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
                // 如果获取配额失败，使用默认值
                (None, None, "Unknown".to_string(), None)
            }
        };

        // 4. 检查去重
        let store = state.store.lock().unwrap();
        let exists = store.accounts.iter().any(|a| {
            // 使用 user_id 或 email 去重
            if let (Some(ref uid), Some(ref a_uid)) = (&user_id, &a.user_id) {
                return uid == a_uid;
            }
            if let (Some(ref e), Some(ref a_e)) = (&email, &a.email) {
                return e == a_e;
            }
            false
        });

        if exists {
            eprintln!("[Kiro CLI Import] 账号已存在，跳过");
            continue;
        }
        drop(store);

        // 5. 创建 Account
        let label = format!("从 kiro-cli 导入 ({})", cli_account.token_key);
        let mut account = if email.is_some() {
            Account::new(email.clone().unwrap(), label)
        } else if user_id.is_some() {
            Account::new_enterprise(user_id.clone().unwrap(), label)
        } else {
            return Err("无法获取账号标识（email 或 userId）".to_string());
        };

        // 6. 填充字段
        account.access_token = Some(cli_account.access_token);
        account.refresh_token = Some(cli_account.refresh_token);
        account.expires_at = cli_account.expires_at;
        account.provider = Some(provider);
        account.user_id = user_id;
        account.region = Some(cli_account.region);
        account.usage_data = usage_data;

        // 7. 根据认证类型填充字段
        if cli_account.auth_method == "social" {
            account.auth_method = Some("social".to_string());
            account.profile_arn = cli_account.profile_arn;
        } else {
            account.auth_method = Some("IdC".to_string());
            account.client_id = cli_account.client_id;
            account.client_secret = cli_account.client_secret;
        }

        // 8. 生成 machine_id
        if account.machine_id.is_none() {
            account.machine_id = Some(uuid::Uuid::new_v4().to_string().to_lowercase());
        }

        eprintln!("[Kiro CLI Import] 账号创建成功: email={:?}, user_id={:?}", 
            account.email, account.user_id);

        imported_accounts.push(account.clone());

        // 9. 保存到存储
        let mut store = state.store.lock().unwrap();
        store.accounts.push(account);
        store.save_to_file();
    }

    eprintln!("[Kiro CLI Import] 导入完成，成功导入 {} 个账号", imported_accounts.len());
    Ok(imported_accounts)
}

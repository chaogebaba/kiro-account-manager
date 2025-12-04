// Kiro IDE 相关功能

use serde::{Deserialize, Serialize};
use rusqlite::{Connection, OpenFlags};

// ===== Kiro IDE 本地 Token =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KiroLocalToken {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub profile_arn: Option<String>,
    pub expires_at: Option<String>,
    pub auth_method: Option<String>,
    pub provider: Option<String>,
}

#[tauri::command]
pub fn get_kiro_local_token() -> Option<KiroLocalToken> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .ok()?;
    let path = std::path::Path::new(&home)
        .join(".aws")
        .join("sso")
        .join("cache")
        .join("kiro-auth-token.json");
    
    let content = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&content).ok()
}

// ===== Kiro IDE 遥测信息 =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KiroTelemetryInfo {
    pub machine_id: Option<String>,
    pub sqm_id: Option<String>,
    pub dev_device_id: Option<String>,
    pub service_machine_id: Option<String>,
}

#[tauri::command]
pub fn get_kiro_telemetry_info() -> Option<KiroTelemetryInfo> {
    let appdata = std::env::var("APPDATA").ok()?;
    
    // 从 storage.json 读取
    let storage_path = std::path::Path::new(&appdata)
        .join("Kiro")
        .join("User")
        .join("globalStorage")
        .join("storage.json");
    
    let content = std::fs::read_to_string(&storage_path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    
    let mut info = KiroTelemetryInfo {
        machine_id: json.get("telemetry.machineId").and_then(|v| v.as_str()).map(|s| s.to_string()),
        sqm_id: json.get("telemetry.sqmId").and_then(|v| v.as_str()).map(|s| s.to_string()),
        dev_device_id: json.get("telemetry.devDeviceId").and_then(|v| v.as_str()).map(|s| s.to_string()),
        service_machine_id: None,
    };
    
    // 从 state.vscdb 读取 serviceMachineId
    let db_path = std::path::Path::new(&appdata)
        .join("Kiro")
        .join("User")
        .join("globalStorage")
        .join("state.vscdb");
    
    if db_path.exists() {
        // 只读模式打开，避免被 Kiro IDE 占用时出错
        if let Ok(conn) = Connection::open_with_flags(&db_path, OpenFlags::SQLITE_OPEN_READ_ONLY) {
            if let Ok(value) = conn.query_row(
                "SELECT value FROM ItemTable WHERE key = 'storage.serviceMachineId'",
                [],
                |row| row.get::<_, String>(0)
            ) {
                info.service_machine_id = Some(value);
            }
        }
    }
    
    Some(info)
}

// ===== 切换账号 =====

use crate::process::{check_kiro_running, kill_kiro, launch_kiro};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchAccountResult {
    pub success: bool,
    pub message: String,
    pub kiro_was_running: bool,
    pub kiro_restarted: bool,
}

/// 切换 Kiro 账号（完整流程：关闭IDE → 重置机器ID → 替换Token → 启动IDE）
#[tauri::command]
pub async fn switch_kiro_account(
    access_token: String,
    refresh_token: String,
    provider: String,
    reset_machine_id: Option<bool>,
    auto_restart: Option<bool>,
) -> Result<SwitchAccountResult, String> {
    // 使用 spawn_blocking 避免阻塞异步运行时
    tokio::task::spawn_blocking(move || {
        let kiro_was_running = check_kiro_running();
        let should_reset = reset_machine_id.unwrap_or(false);
        let should_restart = auto_restart.unwrap_or(true);
        
        // 1. 如果 Kiro 正在运行，先关闭
        if kiro_was_running {
            kill_kiro()?;
            // 等待进程退出
            std::thread::sleep(std::time::Duration::from_millis(300));
        }
        
        // 2. 如果需要重置机器 ID
        if should_reset {
            let _ = reset_kiro_machine_id_inner();
        }
        
        // 3. 替换 Token
        let home = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .map_err(|_| "Cannot find home directory")?;
        
        let dir_path = std::path::Path::new(&home)
            .join(".aws")
            .join("sso")
            .join("cache");
        
        std::fs::create_dir_all(&dir_path)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
        
        let file_path = dir_path.join("kiro-auth-token.json");
        
        let expires_at = chrono::Utc::now() + chrono::Duration::hours(1);
        let token_data = serde_json::json!({
            "accessToken": access_token,
            "refreshToken": refresh_token,
            "profileArn": "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK",
            "expiresAt": expires_at.to_rfc3339(),
            "authMethod": "social",
            "provider": provider
        });
        
        let content = serde_json::to_string_pretty(&token_data)
            .map_err(|e| format!("Failed to serialize: {}", e))?;
        
        std::fs::write(&file_path, content)
            .map_err(|e| format!("Failed to write file: {}", e))?;
        
        // 4. 如果之前在运行且需要自动重启，则启动 Kiro
        let kiro_restarted = if kiro_was_running && should_restart {
            launch_kiro().is_ok()
        } else {
            false
        };
        
        Ok(SwitchAccountResult {
            success: true,
            message: format!("Switched to {} account", provider),
            kiro_was_running,
            kiro_restarted,
        })
    }).await.map_err(|e| format!("Task failed: {}", e))?
}

// ===== 重置机器 ID =====

/// 生成新的机器 ID（64位十六进制字符串）
fn generate_machine_id() -> String {
    use sha2::{Sha256, Digest};
    let random_bytes: [u8; 32] = rand::random();
    let mut hasher = Sha256::new();
    hasher.update(&random_bytes);
    hasher.update(chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0).to_le_bytes());
    hex::encode(hasher.finalize())
}

/// 生成新的 SQM ID（GUID 格式）
fn generate_sqm_id() -> String {
    format!("{{{}}}", uuid::Uuid::new_v4().to_string().to_uppercase())
}

/// 生成新的 Dev Device ID（UUID 格式）
fn generate_dev_device_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// 重置机器 ID（内部函数）
fn reset_kiro_machine_id_inner() -> Result<KiroTelemetryInfo, String> {
    let appdata = std::env::var("APPDATA")
        .map_err(|_| "Cannot find APPDATA")?;
    
    let new_machine_id = generate_machine_id();
    let new_sqm_id = generate_sqm_id();
    let new_dev_device_id = generate_dev_device_id();
    
    let storage_path = std::path::Path::new(&appdata)
        .join("Kiro")
        .join("User")
        .join("globalStorage")
        .join("storage.json");
    
    let content = std::fs::read_to_string(&storage_path)
        .map_err(|e| format!("Failed to read storage.json: {}", e))?;
    let mut json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse storage.json: {}", e))?;
    
    if let Some(obj) = json.as_object_mut() {
        obj.insert("telemetry.machineId".to_string(), serde_json::json!(new_machine_id));
        obj.insert("telemetry.sqmId".to_string(), serde_json::json!(new_sqm_id));
        obj.insert("telemetry.devDeviceId".to_string(), serde_json::json!(new_dev_device_id));
    }
    
    let new_content = serde_json::to_string_pretty(&json)
        .map_err(|e| format!("Failed to serialize: {}", e))?;
    std::fs::write(&storage_path, new_content)
        .map_err(|e| format!("Failed to write storage.json: {}", e))?;
    
    let db_path = std::path::Path::new(&appdata)
        .join("Kiro")
        .join("User")
        .join("globalStorage")
        .join("state.vscdb");
    
    let mut new_service_machine_id = None;
    if db_path.exists() {
        if let Ok(conn) = Connection::open(&db_path) {
            let service_id = generate_machine_id();
            if conn.execute(
                "UPDATE ItemTable SET value = ? WHERE key = 'storage.serviceMachineId'",
                [&service_id]
            ).is_ok() {
                new_service_machine_id = Some(service_id);
            }
        }
    }
    
    Ok(KiroTelemetryInfo {
        machine_id: Some(new_machine_id),
        sqm_id: Some(new_sqm_id),
        dev_device_id: Some(new_dev_device_id),
        service_machine_id: new_service_machine_id,
    })
}

#[tauri::command]
pub fn reset_kiro_machine_id() -> Result<KiroTelemetryInfo, String> {
    reset_kiro_machine_id_inner()
}



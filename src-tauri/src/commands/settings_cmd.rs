// 设置相关命令

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use chrono::Local;
use uuid::Uuid;

// ============================================================
// Kiro IDE 设置 (读写 Kiro IDE 的 settings.json)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct KiroSettings {
    pub http_proxy: Option<String>,
    pub model_selection: Option<String>,
}

// ============================================================
// 应用自身设置 (存到 ~/.kiro-account-manager/app-settings.json)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: Option<String>,
    pub lock_model: Option<bool>,
    pub locked_model: Option<String>,
    pub auto_refresh: Option<bool>,
    pub browser_path: Option<String>,  // 自定义浏览器路径，如 "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe --incognito"
}

fn get_app_settings_path() -> PathBuf {
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| {
            let home = std::env::var("USERPROFILE")
                .or_else(|_| std::env::var("HOME"))
                .unwrap_or_else(|_| ".".to_string());
            PathBuf::from(home)
        });
    data_dir
        .join(".kiro-account-manager")
        .join("app-settings.json")
}

fn get_kiro_settings_path() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA").ok().map(|appdata| {
            PathBuf::from(appdata).join("Kiro").join("User").join("settings.json")
        })
    }
    #[cfg(target_os = "macos")]
    {
        std::env::var("HOME").ok().map(|home| {
            PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("Kiro")
                .join("User")
                .join("settings.json")
        })
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        None
    }
}

// ===== 内部同步函数 =====

fn get_app_settings_inner() -> Result<AppSettings, String> {
    let path = get_app_settings_path();
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取设置失败: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("解析设置失败: {}", e))
}

fn save_app_settings_inner(settings: AppSettings) -> Result<(), String> {
    let path = get_app_settings_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化失败: {}", e))?;
    std::fs::write(&path, content)
        .map_err(|e| format!("写入失败: {}", e))?;
    Ok(())
}

fn get_kiro_settings_inner() -> Result<KiroSettings, String> {
    let path = get_kiro_settings_path()
        .ok_or("无法获取 Kiro 设置路径")?;
    
    if !path.exists() {
        return Ok(KiroSettings::default());
    }
    
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取设置文件失败: {}", e))?;
    
    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析设置文件失败: {}", e))?;
    
    Ok(KiroSettings {
        http_proxy: json.get("http.proxy").and_then(|v| v.as_str()).map(|s| s.to_string()),
        model_selection: json.get("kiroAgent.modelSelection").and_then(|v| v.as_str()).map(|s| s.to_string()),
    })
}

fn set_kiro_proxy_inner(proxy: String) -> Result<(), String> {
    let path = get_kiro_settings_path()
        .ok_or("无法获取 Kiro 设置路径")?;
    
    let mut settings: serde_json::Value = if path.exists() {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("读取设置文件失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    
    if let Some(obj) = settings.as_object_mut() {
        if proxy.is_empty() {
            obj.remove("http.proxy");
        } else {
            obj.insert("http.proxy".to_string(), serde_json::Value::String(proxy));
            obj.insert("http.proxyStrictSSL".to_string(), serde_json::Value::Bool(false));
            obj.insert("http.proxySupport".to_string(), serde_json::Value::String("on".to_string()));
        }
    }
    
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化设置失败: {}", e))?;
    
    std::fs::write(&path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))?;
    
    Ok(())
}

fn set_kiro_model_inner(model: String) -> Result<(), String> {
    let path = get_kiro_settings_path()
        .ok_or("无法获取 Kiro 设置路径")?;
    
    let mut settings: serde_json::Value = if path.exists() {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("读取设置文件失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    
    if let Some(obj) = settings.as_object_mut() {
        obj.insert("kiroAgent.modelSelection".to_string(), serde_json::Value::String(model));
    }
    
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化设置失败: {}", e))?;
    
    std::fs::write(&path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))?;
    
    Ok(())
}

// ===== Tauri Commands (异步) =====

#[tauri::command]
pub async fn get_app_settings() -> Result<AppSettings, String> {
    tokio::task::spawn_blocking(get_app_settings_inner)
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn save_app_settings(settings: AppSettings) -> Result<(), String> {
    tokio::task::spawn_blocking(move || save_app_settings_inner(settings))
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn get_kiro_settings() -> Result<KiroSettings, String> {
    tokio::task::spawn_blocking(get_kiro_settings_inner)
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn set_kiro_proxy(proxy: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || set_kiro_proxy_inner(proxy))
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn set_kiro_model(model: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || set_kiro_model_inner(model))
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

/// 获取自定义浏览器路径（供打开浏览器时使用）
pub fn get_browser_path() -> Option<String> {
    let path = get_app_settings_path();
    println!("[Settings] App settings path: {:?}", path);
    
    let result = get_app_settings_inner();
    println!("[Settings] get_app_settings_inner result: {:?}", result);
    
    let browser_path = result.ok().and_then(|s| s.browser_path).filter(|p| !p.is_empty());
    println!("[Settings] browser_path: {:?}", browser_path);
    
    browser_path
}

// ============================================================
// 系统机器码管理 (Windows MachineGuid)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemMachineInfo {
    pub machine_guid: Option<String>,
    pub backup_exists: bool,
    pub backup_time: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineGuidBackup {
    pub machine_guid: String,
    pub backup_time: String,
    pub computer_name: Option<String>,
}

fn get_machine_guid_backup_path() -> PathBuf {
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    data_dir
        .join(".kiro-account-manager")
        .join("machine-guid-backup.json")
}

#[cfg(target_os = "windows")]
fn get_system_machine_guid_inner() -> Result<SystemMachineInfo, String> {
    use winreg::enums::*;
    use winreg::RegKey;
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let crypto_key = hklm.open_subkey("SOFTWARE\\Microsoft\\Cryptography")
        .map_err(|e| format!("无法打开注册表: {}", e))?;
    
    let machine_guid: String = crypto_key.get_value("MachineGuid")
        .map_err(|e| format!("无法读取 MachineGuid: {}", e))?;
    
    // 检查备份
    let backup_path = get_machine_guid_backup_path();
    let (backup_exists, backup_time) = if backup_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&backup_path) {
            if let Ok(backup) = serde_json::from_str::<MachineGuidBackup>(&content) {
                (true, Some(backup.backup_time))
            } else {
                (false, None)
            }
        } else {
            (false, None)
        }
    } else {
        (false, None)
    };
    
    Ok(SystemMachineInfo {
        machine_guid: Some(machine_guid),
        backup_exists,
        backup_time,
    })
}

#[cfg(target_os = "macos")]
fn get_system_machine_guid_inner() -> Result<SystemMachineInfo, String> {
    use std::process::Command;
    
    // 使用 ioreg 获取硬件 UUID
    let output = Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
        .map_err(|e| format!("执行 ioreg 失败: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    
    // 解析 IOPlatformUUID
    let machine_guid = stdout
        .lines()
        .find(|line| line.contains("IOPlatformUUID"))
        .and_then(|line| {
            line.split('"')
                .nth(3)
                .map(|s| s.to_string())
        })
        .ok_or("无法获取 IOPlatformUUID")?;
    
    // 检查备份
    let backup_path = get_machine_guid_backup_path();
    let (backup_exists, backup_time) = if backup_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&backup_path) {
            if let Ok(backup) = serde_json::from_str::<MachineGuidBackup>(&content) {
                (true, Some(backup.backup_time))
            } else {
                (false, None)
            }
        } else {
            (false, None)
        }
    } else {
        (false, None)
    };
    
    Ok(SystemMachineInfo {
        machine_guid: Some(machine_guid),
        backup_exists,
        backup_time,
    })
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn get_system_machine_guid_inner() -> Result<SystemMachineInfo, String> {
    Err("此功能仅支持 Windows 和 macOS 系统".to_string())
}

#[cfg(target_os = "windows")]
fn backup_machine_guid_inner() -> Result<MachineGuidBackup, String> {
    use winreg::enums::*;
    use winreg::RegKey;
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let crypto_key = hklm.open_subkey("SOFTWARE\\Microsoft\\Cryptography")
        .map_err(|e| format!("无法打开注册表: {}", e))?;
    
    let machine_guid: String = crypto_key.get_value("MachineGuid")
        .map_err(|e| format!("无法读取 MachineGuid: {}", e))?;
    
    let computer_name = std::env::var("COMPUTERNAME").ok();
    let backup_time = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    let backup = MachineGuidBackup {
        machine_guid: machine_guid.clone(),
        backup_time: backup_time.clone(),
        computer_name,
    };
    
    let backup_path = get_machine_guid_backup_path();
    if let Some(parent) = backup_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    
    let content = serde_json::to_string_pretty(&backup)
        .map_err(|e| format!("序列化失败: {}", e))?;
    std::fs::write(&backup_path, content)
        .map_err(|e| format!("写入备份失败: {}", e))?;
    
    Ok(backup)
}

#[cfg(target_os = "macos")]
fn backup_machine_guid_inner() -> Result<MachineGuidBackup, String> {
    Err("macOS 的硬件 UUID 由系统固件管理，无法备份".to_string())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn backup_machine_guid_inner() -> Result<MachineGuidBackup, String> {
    Err("此功能仅支持 Windows 系统".to_string())
}

#[cfg(target_os = "windows")]
fn restore_machine_guid_inner() -> Result<String, String> {
    use winreg::enums::*;
    use winreg::RegKey;
    
    let backup_path = get_machine_guid_backup_path();
    if !backup_path.exists() {
        return Err("没有找到备份文件".to_string());
    }
    
    let content = std::fs::read_to_string(&backup_path)
        .map_err(|e| format!("读取备份失败: {}", e))?;
    let backup: MachineGuidBackup = serde_json::from_str(&content)
        .map_err(|e| format!("解析备份失败: {}", e))?;
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let crypto_key = hklm.open_subkey_with_flags("SOFTWARE\\Microsoft\\Cryptography", KEY_SET_VALUE)
        .map_err(|e| format!("无法打开注册表（需要管理员权限）: {}", e))?;
    
    crypto_key.set_value("MachineGuid", &backup.machine_guid)
        .map_err(|e| format!("写入注册表失败（需要管理员权限）: {}", e))?;
    
    Ok(backup.machine_guid)
}

#[cfg(target_os = "macos")]
fn restore_machine_guid_inner() -> Result<String, String> {
    Err("macOS 的硬件 UUID 由系统固件管理，无法恢复".to_string())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn restore_machine_guid_inner() -> Result<String, String> {
    Err("此功能仅支持 Windows 系统".to_string())
}

#[cfg(target_os = "windows")]
fn reset_machine_guid_inner() -> Result<String, String> {
    use winreg::enums::*;
    use winreg::RegKey;
    
    let new_guid = Uuid::new_v4().to_string().to_uppercase();
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let crypto_key = hklm.open_subkey_with_flags("SOFTWARE\\Microsoft\\Cryptography", KEY_SET_VALUE)
        .map_err(|e| format!("无法打开注册表（需要管理员权限）: {}", e))?;
    
    crypto_key.set_value("MachineGuid", &new_guid)
        .map_err(|e| format!("写入注册表失败（需要管理员权限）: {}", e))?;
    
    Ok(new_guid)
}

#[cfg(target_os = "macos")]
fn reset_machine_guid_inner() -> Result<String, String> {
    Err("macOS 的硬件 UUID 由系统固件管理，无法重置".to_string())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn reset_machine_guid_inner() -> Result<String, String> {
    Err("此功能仅支持 Windows 系统".to_string())
}

fn get_machine_guid_backup_inner() -> Result<Option<MachineGuidBackup>, String> {
    let backup_path = get_machine_guid_backup_path();
    if !backup_path.exists() {
        return Ok(None);
    }
    
    let content = std::fs::read_to_string(&backup_path)
        .map_err(|e| format!("读取备份失败: {}", e))?;
    let backup: MachineGuidBackup = serde_json::from_str(&content)
        .map_err(|e| format!("解析备份失败: {}", e))?;
    
    Ok(Some(backup))
}

// ===== 系统机器码 Tauri Commands =====

#[tauri::command]
pub async fn get_system_machine_guid() -> Result<SystemMachineInfo, String> {
    tokio::task::spawn_blocking(get_system_machine_guid_inner)
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn backup_machine_guid() -> Result<MachineGuidBackup, String> {
    tokio::task::spawn_blocking(backup_machine_guid_inner)
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn restore_machine_guid() -> Result<String, String> {
    tokio::task::spawn_blocking(restore_machine_guid_inner)
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn reset_system_machine_guid() -> Result<String, String> {
    tokio::task::spawn_blocking(reset_machine_guid_inner)
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn get_machine_guid_backup() -> Result<Option<MachineGuidBackup>, String> {
    tokio::task::spawn_blocking(get_machine_guid_backup_inner)
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

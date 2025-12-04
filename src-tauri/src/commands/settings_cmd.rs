// Kiro IDE 设置相关命令

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct KiroSettings {
    #[serde(rename = "http.proxy", skip_serializing_if = "Option::is_none")]
    pub http_proxy: Option<String>,
    #[serde(rename = "http.proxyStrictSSL", skip_serializing_if = "Option::is_none")]
    pub http_proxy_strict_ssl: Option<bool>,
    #[serde(rename = "http.proxySupport", skip_serializing_if = "Option::is_none")]
    pub http_proxy_support: Option<String>,
    #[serde(rename = "kiroAgent.modelSelection", skip_serializing_if = "Option::is_none")]
    pub model_selection: Option<String>,
    #[serde(rename = "kiroAgent.agentAutonomy", skip_serializing_if = "Option::is_none")]
    pub agent_autonomy: Option<String>,
    #[serde(flatten)]
    pub other: serde_json::Map<String, serde_json::Value>,
}

fn get_kiro_settings_path() -> Option<PathBuf> {
    std::env::var("APPDATA").ok().map(|appdata| {
        PathBuf::from(appdata).join("Kiro").join("User").join("settings.json")
    })
}

#[tauri::command]
pub fn get_kiro_settings() -> Result<KiroSettings, String> {
    let path = get_kiro_settings_path()
        .ok_or("无法获取 APPDATA 路径")?;
    
    if !path.exists() {
        return Ok(KiroSettings::default());
    }
    
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取设置文件失败: {}", e))?;
    
    serde_json::from_str(&content)
        .map_err(|e| format!("解析设置文件失败: {}", e))
}

#[tauri::command]
pub fn set_kiro_proxy(proxy: String) -> Result<(), String> {
    let path = get_kiro_settings_path()
        .ok_or("无法获取 APPDATA 路径")?;
    
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

#[tauri::command]
pub fn set_kiro_model(model: String) -> Result<(), String> {
    let path = get_kiro_settings_path()
        .ok_or("无法获取 APPDATA 路径")?;
    
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

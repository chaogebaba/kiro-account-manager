// Powers 注册表读取（只读）

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PowersRegistry {
    #[serde(default)]
    pub powers: HashMap<String, PowerInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PowerInfo {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub publisher: String,
    #[serde(default, rename = "installPath")]
    pub install_path: Option<String>,
    #[serde(default, rename = "installedAt")]
    pub installed_at: Option<String>,
    #[serde(default)]
    pub keywords: Vec<String>,
}

impl PowersRegistry {
    /// 获取 Powers 注册表文件路径
    pub fn registry_path() -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".kiro").join("powers").join("registry.json"))
    }

    /// 读取注册表
    pub fn load() -> Result<Self, String> {
        let path = Self::registry_path().ok_or("无法获取用户目录")?;
        
        if !path.exists() {
            return Ok(Self::default());
        }
        
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("读取注册表失败: {}", e))?;
        
        serde_json::from_str(&content)
            .map_err(|e| format!("解析注册表失败: {}", e))
    }
}

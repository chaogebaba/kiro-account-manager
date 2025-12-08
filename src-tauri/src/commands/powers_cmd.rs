// Powers 管理命令

use crate::powers::PowersRegistry;

/// 获取 Powers 注册表
#[tauri::command]
pub fn get_powers_registry() -> Result<PowersRegistry, String> {
    PowersRegistry::load()
}

// Skills 管理命令

use crate::commands::common::run_blocking_task;
use crate::skills::{SkillInfo, SkillsManager};
use tauri::command;

#[command]
pub async fn get_skills(project_dir: Option<String>) -> Result<Vec<SkillInfo>, String> {
    run_blocking_task(move || SkillsManager::load_all(project_dir.as_deref())).await
}

#[command]
pub async fn get_skill(name: String, scope: Option<String>, project_dir: Option<String>) -> Result<SkillInfo, String> {
    let scope = scope.unwrap_or_else(|| "user".to_string());
    run_blocking_task(move || SkillsManager::load(&name, &scope, project_dir.as_deref())).await
}

#[command]
pub async fn save_skill(name: String, content: String, scope: Option<String>, project_dir: Option<String>) -> Result<(), String> {
    let scope = scope.unwrap_or_else(|| "user".to_string());
    run_blocking_task(move || SkillsManager::save(&name, &content, &scope, project_dir.as_deref()))
        .await
}

#[command]
pub async fn delete_skill(name: String, scope: Option<String>, project_dir: Option<String>) -> Result<(), String> {
    let scope = scope.unwrap_or_else(|| "user".to_string());
    run_blocking_task(move || SkillsManager::delete(&name, &scope, project_dir.as_deref())).await
}

#[command]
pub async fn create_skill(name: String, content: String, scope: Option<String>, project_dir: Option<String>) -> Result<SkillInfo, String> {
    let scope = scope.unwrap_or_else(|| "user".to_string());
    run_blocking_task(move || SkillsManager::create(&name, &content, &scope, project_dir.as_deref()))
        .await
}

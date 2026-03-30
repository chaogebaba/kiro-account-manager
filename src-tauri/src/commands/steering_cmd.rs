// Steering 管理命令

use crate::commands::common::run_blocking_task;
use crate::steering::{SteeringFile, SteeringManager};
use tauri::command;

#[command]
pub async fn get_steering_files(project_dir: Option<String>) -> Result<Vec<SteeringFile>, String> {
    run_blocking_task(move || SteeringManager::load_all(project_dir.as_deref())).await
}

#[command]
pub async fn get_steering_file(file_name: String, scope: Option<String>, project_dir: Option<String>) -> Result<SteeringFile, String> {
    let scope = scope.unwrap_or_else(|| "user".to_string());
    run_blocking_task(move || SteeringManager::load(&file_name, &scope, project_dir.as_deref()))
        .await
}

#[command]
pub async fn save_steering_file(file_name: String, content: String, scope: Option<String>, project_dir: Option<String>) -> Result<(), String> {
    let scope = scope.unwrap_or_else(|| "user".to_string());
    run_blocking_task(move || SteeringManager::save(&file_name, &content, &scope, project_dir.as_deref()))
        .await
}

#[command]
pub async fn delete_steering_file(file_name: String, scope: Option<String>, project_dir: Option<String>) -> Result<(), String> {
    let scope = scope.unwrap_or_else(|| "user".to_string());
    run_blocking_task(move || SteeringManager::delete(&file_name, &scope, project_dir.as_deref()))
        .await
}

#[command]
pub async fn create_steering_file(file_name: String, content: String, scope: Option<String>, project_dir: Option<String>) -> Result<SteeringFile, String> {
    let scope = scope.unwrap_or_else(|| "user".to_string());
    run_blocking_task(move || SteeringManager::create(&file_name, &content, &scope, project_dir.as_deref()))
        .await
}

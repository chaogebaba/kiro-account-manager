#![allow(clippy::needless_pass_by_value)] // Tauri 命令需要按值传参

use tauri::{AppHandle, State};

use crate::gateway::{
    GatewayConfig,
    GatewayStatus,
    get_gateway_config as get_gateway_config_inner,
    get_gateway_log_dir as get_gateway_log_dir_inner,
    get_gateway_status as get_gateway_status_inner,
    open_gateway_log_dir as open_gateway_log_dir_inner,
    save_gateway_config as save_gateway_config_inner,
    start_gateway as start_gateway_inner,
    stop_gateway as stop_gateway_inner,
};
use crate::state::AppState;

#[tauri::command]
pub async fn start_gateway(
    state: State<'_, AppState>,
    config: GatewayConfig,
) -> Result<GatewayStatus, String> {
    let mut next = config.clone();
    next.enabled = true;
    save_gateway_config_inner(&next)?;
    start_gateway_inner(&state, next).await
}

#[tauri::command]
pub async fn stop_gateway(state: State<'_, AppState>) -> Result<(), String> {
    stop_gateway_inner(&state).await?;
    let mut cfg = get_gateway_config_inner()?;
    cfg.enabled = false;
    save_gateway_config_inner(&cfg)
}

#[tauri::command]
pub async fn get_gateway_status(state: State<'_, AppState>) -> Result<GatewayStatus, String> {
    get_gateway_status_inner(&state).await
}

#[tauri::command]
pub async fn get_gateway_config() -> Result<GatewayConfig, String> {
    get_gateway_config_inner()
}

#[tauri::command]
pub async fn save_gateway_config(config: GatewayConfig) -> Result<(), String> {
    save_gateway_config_inner(&config)
}

#[tauri::command]
pub async fn get_gateway_log_dir(app: AppHandle) -> Result<String, String> {
    get_gateway_log_dir_inner(&app)
}

#[tauri::command]
pub async fn open_gateway_log_dir(app: AppHandle) -> Result<String, String> {
    open_gateway_log_dir_inner(&app)
}

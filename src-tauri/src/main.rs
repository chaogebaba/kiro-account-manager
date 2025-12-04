#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod auth_social;
mod aws_sso_client;
mod token;
mod kiro_auth_client;
mod oauth_callback_server;
mod provider_factory;
mod kiro;
mod process;
mod state;
mod commands;

use std::sync::Mutex;
use state::AppState;
use token::TokenStore;
use auth::AuthState;

// 导入命令
use commands::token_cmd::*;
use commands::auth_cmd::*;
use commands::settings_cmd::*;
use kiro::{get_kiro_local_token, get_kiro_telemetry_info, switch_kiro_account, reset_kiro_machine_id};
use process::{close_kiro_ide, start_kiro_ide, is_kiro_ide_running};

fn main() {
    tauri::Builder::default()
        .setup(|_app| {
            Ok(())
        })
        .manage(AppState {
            store: Mutex::new(TokenStore::new()),
            auth: AuthState::new(),
            pending_login: Mutex::new(None),
            auth_temp_dir: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            // Token 命令
            get_tokens,
            update_token,
            delete_token,
            delete_tokens,
            refresh_token_from_api,
            verify_token,
            add_token_by_refresh,
            import_tokens,
            export_tokens,
            // Auth 命令 (当前使用)
            get_current_user,
            logout,
            kiro_login,
            get_supported_providers,
            handle_kiro_social_callback,
            add_kiro_token,
            // Kiro IDE 命令
            get_kiro_local_token,
            switch_kiro_account,
            get_kiro_telemetry_info,
            reset_kiro_machine_id,
            // 进程管理命令
            close_kiro_ide,
            start_kiro_ide,
            is_kiro_ide_running,
            // Kiro IDE 设置命令
            get_kiro_settings,
            set_kiro_proxy,
            set_kiro_model,
            // 应用设置命令
            get_app_settings,
            save_app_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

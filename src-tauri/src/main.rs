#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod auth_social;
mod aws_sso_client;
mod codewhisperer_client;
mod commands;
mod kiro;
mod kiro_auth_client;
mod oauth_callback_server;
mod process;
mod providers;
mod state;
mod account;

use account::AccountStore;
use auth::AuthState;
use state::AppState;
use std::sync::Mutex;

// 导入命令
use commands::auth_cmd::*;
use commands::settings_cmd::*;
use commands::account_cmd::*;
use commands::web_oauth_cmd::*;
use kiro::{
    get_kiro_local_token, get_kiro_telemetry_info, reset_kiro_machine_id, switch_kiro_account,
};
use process::{close_kiro_ide, is_kiro_ide_running, start_kiro_ide};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| Ok(()))
        .manage(AppState {
            store: Mutex::new(AccountStore::new()),
            auth: AuthState::new(),
            pending_login: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            // 账号命令
            get_accounts,
            delete_account,
            delete_accounts,
            sync_account,
            verify_account,
            add_account_by_social,
            add_local_kiro_account,
            add_account_by_idc,
            import_accounts,
            export_accounts,
            // Auth 命令
            get_current_user,
            logout,
            kiro_login,
            get_supported_providers,
            handle_kiro_social_callback,
            add_kiro_account,
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
            save_app_settings,
            // Web OAuth 命令 (Cognito + CBOR)
            web_oauth_initiate,
            web_oauth_complete,
            web_oauth_refresh,
            web_oauth_login,
            web_oauth_close_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

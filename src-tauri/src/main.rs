#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod token;

use token::{Token, TokenStore};
use std::sync::Mutex;
use tauri::State;

struct AppState {
    store: Mutex<TokenStore>,
}

#[tauri::command]
fn get_tokens(state: State<AppState>) -> Vec<Token> {
    state.store.lock().unwrap().get_all()
}

#[tauri::command]
fn add_token(state: State<AppState>, email: String, label: String, quota: i32) -> Token {
    state.store.lock().unwrap().add(email, label, quota)
}

#[tauri::command]
fn update_token(state: State<AppState>, id: String, email: String, label: String, quota: i32, used: i32, status: String) -> Option<Token> {
    state.store.lock().unwrap().update(&id, email, label, quota, used, status)
}

#[tauri::command]
fn delete_token(state: State<AppState>, id: String) -> bool {
    state.store.lock().unwrap().delete(&id)
}

#[tauri::command]
fn delete_tokens(state: State<AppState>, ids: Vec<String>) -> usize {
    state.store.lock().unwrap().delete_many(&ids)
}

#[tauri::command]
fn refresh_token_status(state: State<AppState>, id: String) -> Option<Token> {
    state.store.lock().unwrap().refresh_status(&id)
}

#[tauri::command]
fn import_tokens(state: State<AppState>, tokens_json: String) -> Result<usize, String> {
    state.store.lock().unwrap().import_from_json(&tokens_json)
}

#[tauri::command]
fn export_tokens(state: State<AppState>) -> String {
    state.store.lock().unwrap().export_to_json()
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            store: Mutex::new(TokenStore::new()),
        })
        .invoke_handler(tauri::generate_handler![
            get_tokens,
            add_token,
            update_token,
            delete_token,
            delete_tokens,
            refresh_token_status,
            import_tokens,
            export_tokens
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

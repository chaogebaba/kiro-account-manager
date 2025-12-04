// [LEGACY] 旧的固定端口回调服务器，已被 oauth_callback_server.rs 替代
// 保留供参考，不再使用

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};
// use crate::{AppState, handle_kiro_social_callback};

/// 启动本地 HTTP 回调服务器，监听 127.0.0.1:17655
pub fn start_kiro_callback_server(_app_handle: AppHandle) {
    // let addr = "127.0.0.1:17655";
    // println!("Starting Kiro OAuth callback server on {}", addr);
    // ... 已废弃
}

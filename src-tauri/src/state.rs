// 应用全局状态

use std::sync::Mutex;
use crate::auth::AuthState;
use crate::token::TokenStore;

#[derive(Clone)]
#[allow(dead_code)]
pub struct PendingLogin {
    pub provider: String,
    pub code_verifier: String,
    pub state: String,
    pub machineid: String,
}

pub struct AppState {
    pub store: Mutex<TokenStore>,
    pub auth: AuthState,
    pub pending_login: Mutex<Option<PendingLogin>>,
    #[allow(dead_code)]
    pub auth_temp_dir: Mutex<Option<std::path::PathBuf>>,
}

impl AppState {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            store: Mutex::new(TokenStore::new()),
            auth: AuthState::new(),
            pending_login: Mutex::new(None),
            auth_temp_dir: Mutex::new(None),
        }
    }
}

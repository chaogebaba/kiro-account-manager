// 应用全局状态

use std::sync::Mutex;
use crate::auth::AuthState;
use crate::token::TokenStore;

#[derive(Clone)]
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
}

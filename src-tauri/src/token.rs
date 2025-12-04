use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Token {
    pub id: String,
    pub email: String,
    pub label: String,
    pub quota: i32,
    pub used: i32,
    pub status: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub access_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscription_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub csrf_token: Option<String>,
    // 配额相关
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reset_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub days_until_reset: Option<i32>,
    // 免费试用
    #[serde(skip_serializing_if = "Option::is_none")]
    pub free_trial_quota: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub free_trial_used: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub free_trial_expiry: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub free_trial_status: Option<String>,
    // 奖励额度
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bonus_quota: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bonus_used: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bonus_expiry: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bonus_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bonus_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bonus_status: Option<String>,
    // 超额相关
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overage_rate: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overage_cap: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overage_capable: Option<bool>,
    // 订阅详情
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscription_plan: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upgrade_capable: Option<bool>,
    // AWS SSO OIDC (BuilderId) 专用
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sso_client_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sso_client_secret: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sso_region: Option<String>,
}

impl Token {
    pub fn new_with_tokens(
        email: String,
        label: String,
        quota: i32,
        access_token: String,
        refresh_token: String,
        provider: String,
        user_id: Option<String>,
        subscription_type: Option<String>,
    ) -> Self {
        let now: DateTime<Local> = Local::now();
        Self {
            id: Uuid::new_v4().to_string(),
            email,
            label,
            quota,
            used: 0,
            status: "正常".to_string(),
            created_at: now.format("%Y/%m/%d %H:%M:%S").to_string(),
            access_token: Some(access_token),
            refresh_token: Some(refresh_token),
            provider: Some(provider),
            user_id,
            expires_at: None,
            subscription_type,
            csrf_token: None,
            reset_date: None,
            days_until_reset: None,
            free_trial_quota: None,
            free_trial_used: None,
            free_trial_expiry: None,
            free_trial_status: None,
            bonus_quota: None,
            bonus_used: None,
            bonus_expiry: None,
            bonus_name: None,
            bonus_code: None,
            bonus_status: None,
            overage_rate: None,
            overage_cap: None,
            overage_capable: None,
            subscription_plan: None,
            upgrade_capable: None,
            sso_client_id: None,
            sso_client_secret: None,
            sso_region: None,
        }
    }
}

pub struct TokenStore {
    pub tokens: Vec<Token>,
    file_path: PathBuf,
}

impl TokenStore {
    pub fn new() -> Self {
        let file_path = Self::get_storage_path();
        let tokens = Self::load_from_file(&file_path);
        Self { tokens, file_path }
    }

    fn get_storage_path() -> PathBuf {
        let home = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home)
            .join(".kiro-token-manager")
            .join("tokens.json")
    }

    fn load_from_file(path: &PathBuf) -> Vec<Token> {
        if let Ok(content) = std::fs::read_to_string(path) {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Vec::new()
        }
    }

    pub fn save_to_file(&self) {
        if let Some(parent) = self.file_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(&self.tokens) {
            let _ = std::fs::write(&self.file_path, json);
        }
    }

    pub fn get_all(&self) -> Vec<Token> {
        self.tokens.clone()
    }

    /// 返回 (Token, is_new) - is_new 为 true 表示新增，false 表示更新
    pub fn add_with_tokens(
        &mut self,
        email: String,
        label: String,
        quota: i32,
        access_token: String,
        refresh_token: String,
        provider: String,
        user_id: Option<String>,
        subscription_type: Option<String>,
    ) -> (Token, bool) {
        // 检查是否已存在相同邮箱的账号，如果存在则更新
        if let Some(idx) = self.tokens.iter().position(|t| t.email == email) {
            self.tokens[idx].label = label;
            self.tokens[idx].access_token = Some(access_token);
            self.tokens[idx].refresh_token = Some(refresh_token);
            self.tokens[idx].quota = quota;
            self.tokens[idx].provider = Some(provider);
            self.tokens[idx].user_id = user_id;
            self.tokens[idx].subscription_type = subscription_type;
            self.tokens[idx].status = "正常".to_string();
            self.tokens[idx].expires_at = Some(chrono::Local::now().format("%Y/%m/%d %H:%M:%S").to_string());
            let token = self.tokens[idx].clone();
            self.save_to_file();
            return (token, false);
        }
        
        let token = Token::new_with_tokens(email, label, quota, access_token, refresh_token, provider, user_id, subscription_type);
        self.tokens.insert(0, token.clone());
        self.save_to_file();
        (token, true)
    }

    pub fn update(&mut self, id: &str, email: String, label: String, quota: i32, used: i32, status: String) -> Option<Token> {
        let idx = self.tokens.iter().position(|t| t.id == id)?;
        self.tokens[idx].email = email;
        self.tokens[idx].label = label;
        self.tokens[idx].quota = quota;
        self.tokens[idx].used = used;
        self.tokens[idx].status = status;
        let result = self.tokens[idx].clone();
        self.save_to_file();
        Some(result)
    }

    pub fn delete(&mut self, id: &str) -> bool {
        let len_before = self.tokens.len();
        self.tokens.retain(|t| t.id != id);
        let deleted = self.tokens.len() < len_before;
        if deleted {
            self.save_to_file();
        }
        deleted
    }

    pub fn delete_many(&mut self, ids: &[String]) -> usize {
        let len_before = self.tokens.len();
        self.tokens.retain(|t| !ids.contains(&t.id));
        let deleted = len_before - self.tokens.len();
        if deleted > 0 {
            self.save_to_file();
        }
        deleted
    }

    #[allow(dead_code)]
    pub fn refresh_status(&mut self, id: &str) -> Option<Token> {
        let idx = self.tokens.iter().position(|t| t.id == id)?;
        if self.tokens[idx].used >= self.tokens[idx].quota {
            self.tokens[idx].status = "已失效".to_string();
        } else {
            self.tokens[idx].status = "正常".to_string();
        }
        let result = self.tokens[idx].clone();
        self.save_to_file();
        Some(result)
    }

    pub fn import_from_json(&mut self, json: &str) -> Result<usize, String> {
        match serde_json::from_str::<Vec<Token>>(json) {
            Ok(imported) => {
                let count = imported.len();
                for token in imported {
                    if !self.tokens.iter().any(|t| t.id == token.id) {
                        self.tokens.push(token);
                    }
                }
                self.save_to_file();
                Ok(count)
            }
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn export_to_json(&self) -> String {
        serde_json::to_string_pretty(&self.tokens).unwrap_or_default()
    }
}

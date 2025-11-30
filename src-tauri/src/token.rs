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
}

impl Token {
    pub fn new(email: String, label: String, quota: i32) -> Self {
        let now: DateTime<Local> = Local::now();
        Self {
            id: Uuid::new_v4().to_string(),
            email,
            label,
            quota,
            used: 0,
            status: "正常".to_string(),
            created_at: now.format("%Y/%m/%d %H:%M:%S").to_string(),
            access_token: None,
            refresh_token: None,
            provider: None,
        }
    }

    pub fn new_with_tokens(
        email: String,
        label: String,
        quota: i32,
        access_token: String,
        refresh_token: String,
        provider: String,
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

    pub fn add(&mut self, email: String, label: String, quota: i32) -> Token {
        let token = Token::new(email, label, quota);
        self.tokens.insert(0, token.clone());
        self.save_to_file();
        token
    }

    pub fn add_with_tokens(
        &mut self,
        email: String,
        label: String,
        quota: i32,
        access_token: String,
        refresh_token: String,
        provider: String,
    ) -> Token {
        let token = Token::new_with_tokens(email, label, quota, access_token, refresh_token, provider);
        self.tokens.insert(0, token.clone());
        self.save_to_file();
        token
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

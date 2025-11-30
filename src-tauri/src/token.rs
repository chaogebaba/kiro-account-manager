use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Token {
    pub id: String,
    pub email: String,
    pub label: String,
    pub quota: i32,
    pub used: i32,
    pub status: String,
    pub created_at: String,
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
        }
    }
}

pub struct TokenStore {
    tokens: Vec<Token>,
}

impl TokenStore {
    pub fn new() -> Self {
        // 初始化一些示例数据
        let samples = vec![
            Token {
                id: "d-9067-98495-01f81446-b011-70ec-42db-1c319e8039af".to_string(),
                email: "a109ce63@lbatrust.co.uk".to_string(),
                label: "d-9067-98495-01f81446-b011-70ec-42db-1c319e8039af".to_string(),
                quota: 2500,
                used: 2500,
                status: "有效".to_string(),
                created_at: "2025/11/30 14:00:09".to_string(),
            },
            Token {
                id: "d-9067-98495-24086408-60c1-702b-48a8-ab655c773b71".to_string(),
                email: "hj6395759@gmail.com".to_string(),
                label: "d-9067-98495-24086408-60c1-702b-48a8-ab655c773b71".to_string(),
                quota: 2500,
                used: 2500,
                status: "正常".to_string(),
                created_at: "2025/11/27 16:29:47".to_string(),
            },
            Token {
                id: "d-9067-98495-54760408-2011-70d1-b492-2a701c924ef3".to_string(),
                email: "hjj09903@gmail.com".to_string(),
                label: "d-9067-98495-54760408-2011-70d1-b492-2a701c924ef3".to_string(),
                quota: 2500,
                used: 2500,
                status: "正常".to_string(),
                created_at: "2025/11/27 16:20:34".to_string(),
            },
            Token {
                id: "d-9067-98495-34d8e448-a001-7081-3603-a29a23866614".to_string(),
                email: "1292548381@qq.com".to_string(),
                label: "d-9067-98495-34d8e448-a001-7081-3603-a29a23866614".to_string(),
                quota: 2500,
                used: 2138,
                status: "已失效".to_string(),
                created_at: "2025/11/27 16:14:36".to_string(),
            },
            Token {
                id: "d-9067-98495-14800448-5021-70d5-3977-511c2af434f6".to_string(),
                email: "hj01857654@gmail.com".to_string(),
                label: "d-9067-98495-14800448-5021-70d5-3977-511c2af434f6".to_string(),
                quota: 2500,
                used: 2500,
                status: "已失效".to_string(),
                created_at: "2025/11/27 15:40:39".to_string(),
            },
        ];
        Self { tokens: samples }
    }

    pub fn get_all(&self) -> Vec<Token> {
        self.tokens.clone()
    }

    pub fn add(&mut self, email: String, label: String, quota: i32) -> Token {
        let token = Token::new(email, label, quota);
        self.tokens.insert(0, token.clone());
        token
    }

    pub fn update(&mut self, id: &str, email: String, label: String, quota: i32, used: i32, status: String) -> Option<Token> {
        if let Some(token) = self.tokens.iter_mut().find(|t| t.id == id) {
            token.email = email;
            token.label = label;
            token.quota = quota;
            token.used = used;
            token.status = status;
            return Some(token.clone());
        }
        None
    }

    pub fn delete(&mut self, id: &str) -> bool {
        let len_before = self.tokens.len();
        self.tokens.retain(|t| t.id != id);
        self.tokens.len() < len_before
    }

    pub fn delete_many(&mut self, ids: &[String]) -> usize {
        let len_before = self.tokens.len();
        self.tokens.retain(|t| !ids.contains(&t.id));
        len_before - self.tokens.len()
    }

    pub fn refresh_status(&mut self, id: &str) -> Option<Token> {
        if let Some(token) = self.tokens.iter_mut().find(|t| t.id == id) {
            // 模拟刷新状态逻辑
            if token.used >= token.quota {
                token.status = "已失效".to_string();
            } else {
                token.status = "正常".to_string();
            }
            return Some(token.clone());
        }
        None
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
                Ok(count)
            }
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn export_to_json(&self) -> String {
        serde_json::to_string_pretty(&self.tokens).unwrap_or_default()
    }
}

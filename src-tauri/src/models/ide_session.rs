use serde::{Deserialize, Serialize};

/// IDE Session 完整数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdeSession {
    pub session_id: String,
    pub title: String,
    pub session_type: String,
    #[serde(default, deserialize_with = "deserialize_nullable_string")]
    pub workspace_directory: String,
    pub history: Vec<HistoryItem>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conversation_summary: Option<String>,
    // V1SessionFileSchema additional fields (with junk data tolerance)
    #[serde(default, skip_serializing_if = "Option::is_none", deserialize_with = "deserialize_optional_string")]
    pub model_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", deserialize_with = "deserialize_optional_string")]
    pub selected_model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub autonomy_mode: Option<String>,
}

/// Session 摘要（用于列表显示）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub title: String,
    #[serde(rename = "sessionType")]
    pub session_type: String,
    #[serde(rename = "workspaceDirectory")]
    pub workspace_directory: String,
    #[serde(rename = "workspaceHash")]
    pub workspace_hash: String,
    #[serde(rename = "messageCount")]
    pub message_count: usize,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
    #[serde(rename = "createdAt")]
    pub created_at: Option<i64>,
    #[serde(rename = "modifiedAt")]
    pub modified_at: Option<i64>,
}

/// 对话历史项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub message: Message,
    #[serde(default)]
    pub context_items: Vec<serde_json::Value>,
    #[serde(default)]
    pub editor_state: serde_json::Value,
    #[serde(default)]
    pub prompt_logs: Vec<PromptLog>,
    // V1HistoryItemSchema additional field
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub execution_id: Option<String>,
}

/// 消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    #[serde(with = "content_format")]
    pub content: Vec<ContentItem>,
    #[serde(rename = "isHidden", default)]
    pub is_hidden: bool,
    #[serde(default)]
    pub id: String,
}

/// 消息内容项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentItem {
    #[serde(rename = "type")]
    pub content_type: String,
    pub text: String,
}

// 自定义序列化/反序列化，支持字符串或数组格式
mod content_format {
    use super::ContentItem;
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(content: &Vec<ContentItem>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        use serde::Serialize;
        content.serialize(serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<ContentItem>, D::Error>
    where
        D: Deserializer<'de>,
    {
        use serde::de::Error;
        use serde_json::Value;

        let value = Value::deserialize(deserializer)?;

        match value {
            // 如果是字符串，转换为单个 ContentItem
            Value::String(s) => Ok(vec![ContentItem {
                content_type: "text".to_string(),
                text: s,
            }]),
            // 如果是数组，正常解析
            Value::Array(arr) => {
                let mut items = Vec::new();
                for item in arr {
                    if let Value::Object(obj) = item {
                        let content_type = obj
                            .get("type")
                            .and_then(|v| v.as_str())
                            .unwrap_or("text")
                            .to_string();
                        let text = obj
                            .get("text")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        items.push(ContentItem { content_type, text });
                    }
                }
                Ok(items)
            }
            _ => Err(Error::custom("content must be string or array")),
        }
    }
}

/// Prompt 日志
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptLog {
    pub model_title: String,
    pub prompt: String,
    pub completion: String,
    #[serde(default)]
    pub completion_options: serde_json::Value,
}

// V1 Session 兼容：处理垃圾数据 (selectedModel: {}, workspaceDirectory: null)
fn deserialize_nullable_string<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    match value {
        serde_json::Value::String(s) => Ok(s),
        serde_json::Value::Null => Ok(String::new()),
        _ => Ok(String::new()), // 忽略 {} 等垃圾值
    }
}

fn deserialize_optional_string<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    match value {
        serde_json::Value::String(s) if !s.is_empty() => Ok(Some(s)),
        _ => Ok(None), // null / {} / "" 全部映射为 None
    }
}

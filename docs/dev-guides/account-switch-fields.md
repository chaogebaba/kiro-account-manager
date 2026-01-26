# 账号切换字段需求文档

本文档以 JSON 格式详细说明ogle、GitHub、BuilderId、Enterprise）在切换账号时需要的字段。

---

## 目录

1. [字段总览](#字段总览)
2. [Google 账号](#google-账号)
3. [GitHub 账号](#github-账号)
4. [BuilderId 账号](#builderid-账号)
5. [Enterprise 账号](#enterprise-账号)
6. [字段对比表](#字段对比表)
7. [Kiro IDE 写入格式](#kiro-ide-写入格式)

---

## 字段总览

### Account 结构体（完整定义）

```rust
pub struct Account {
    pub id: String,                      // UUID
    pub email: Option<String>,           // 邮箱（Social 账号必需）
    pub user_id: Option<String>,         // 用户 ID（Enterprise 账号必需）
    pub label: String,                   // 备注
    pub access_token: Option<String>,    // 访问令牌
    pub refresh_token: Option<String>,   // 刷新令牌
    pub expires_at: Option<String>,      // 过期时间
    pub provider: Option<String>,        // 提供商（Google/GitHub/BuilderId/Enterprise）
    pub region: Option<String>,          // AWS 区域
    pub machine_id: Option<String>,      // 机器 ID
    pub auth_method: Option<String>,     // 认证方法（social/IdC）
    pub profile_arn: Option<String>,     // Profile ARN（Social 专用）
    pub client_id: Option<String>,       // 客户端 ID（IdC 专用）
    pub client_secret: Option<String>,   // 客户端密钥（IdC 专用）
    pub client_id_hash: Option<String>,  // 客户端 ID 哈希（IdC 专用）
    pub start_url: Option<String>,       // Start URL（Enterprise 专用）
    pub usage_data: Option<Value>,       // 配额数据
    pub status: String,                  // 状态（active/banned）
    pub created_at: String,              // 创建时间
    pub updated_at: String,              // 更新时间
    pub group: Option<String>,           // 分组
    pub tags: Vec<String>,               // 标签
}
```

---

## Google 账号

### 必需字段

```json
{
  "email": {
    "type": "String",
    "required": true,
    "description": "邮箱地址",
    "example": "user@gmail.com"
  },
  "refresh_token": {
    "type": "String",
    "required": true,
    "description": "刷新令牌",
    "example": "aor_xxx"
  },
  "provider": {
    "type": "String",
    "required": true,
    "description": "固定为 Google",
    "example": "Google"
  },
  "auth_method": {
    "type": "String",
    "required": true,
    "description": "固定为 social",
    "example": "social"
  }
}
```

### 可选字段

```json
{
  "access_token": {
    "type": "String",
    "required": false,
    "description": "访问令牌（可选，会自动刷新）",
    "example": "ya29.xxx"
  },
  "expires_at": {
    "type": "String",
    "required": false,
    "description": "过期时间",
    "example": "2024-01-27T12:00:00Z"
  },
  "profile_arn": {
    "type": "String",
    "required": false,
    "description": "Profile ARN",
    "example": "arn:aws:iam::xxx:oidc-provider/accounts.google.com"
  },
  "machine_id": {
    "type": "String",
    "required": false,
    "description": "机器 ID（可选，会自动生成）",
    "example": "uuid-xxx"
  }
}
```

### 不需要的字段

```json
[
  "user_id",
  "client_id",
  "client_secret",
  "client_id_hash",
  "start_url",
  "region"
]
```

### 切换账号流程

```rust
// 1. 读取账号数据
let account = store.get_account_by_id(&account_id)?;

// 2. 验证必需字段
if account.email.is_none() {
    return Err("缺少 email".to_string());
}
if account.refresh_token.is_none() {
    return Err("缺少 refresh_token".to_string());
}

// 3. 写入 Kiro IDE
let kiro_token = json!({
    "access_token": account.access_token,
    "refresh_token": account.refresh_token,
    "expires_at": account.expires_at,
    "profile_arn": account.profile_arn,
    "region": "us-east-1"  // 固定值
});
```

---

## GitHub 账号

### 必需字段

```json
{
  "email": {
    "type": "String",
    "required": true,
    "description": "邮箱地址",
    "example": "user@github.com"
  },
  "refresh_token": {
    "type": "String",
    "required": true,
    "description": "刷新令牌",
    "example": "aor_xxx"
  },
  "provider": {
    "type": "String",
    "required": true,
    "description": "固定为 GitHub",
    "example": "GitHub"
  },
  "auth_method": {
    "type": "String",
    "required": true,
    "description": "固定为 social",
    "example": "social"
  }
}
```

### 可选字段

```json
{
  "access_token": {
    "type": "String",
    "required": false,
    "description": "访问令牌（可选，会自动刷新）",
    "example": "gho_xxx"
  },
  "expires_at": {
    "type": "String",
    "required": false,
    "description": "过期时间",
    "example": "2024-01-27T12:00:00Z"
  },
  "profile_arn": {
    "type": "String",
    "required": false,
    "description": "Profile ARN",
    "example": "arn:aws:iam::xxx:oidc-provider/token.actions.githubusercontent.com"
  },
  "machine_id": {
    "type": "String",
    "required": false,
    "description": "机器 ID（可选，会自动生成）",
    "example": "uuid-xxx"
  }
}
```

### 不需要的字段

```json
[
  "user_id",
  "client_id",
  "client_secret",
  "client_id_hash",
  "start_url",
  "region"
]
```

### 切换账号流程

与 Google 账号完全相同，只是 `provider` 字段不同。

---

## BuilderId 账号

### 必需字段

```json
{
  "email": {
    "type": "String",
    "required": true,
    "description": "邮箱地址",
    "example": "user@example.com"
  },
  "refresh_token": {
    "type": "String",
    "required": true,
    "description": "刷新令牌",
    "example": "aor_xxx"
  },
  "client_id": {
    "type": "String",
    "required": true,
    "description": "客户端 ID",
    "example": "xxx"
  },
  "client_secret": {
    "type": "String",
    "required": true,
    "description": "客户端密钥",
    "example": "xxx"
  },
  "region": {
    "type": "String",
    "required": true,
    "description": "AWS 区域",
    "example": "us-east-1"
  },
  "provider": {
    "type": "String",
    "required": true,
    "description": "固定为 BuilderId",
    "example": "BuilderId"
  },
  "auth_method": {
    "type": "String",
    "required": true,
    "description": "固定为 IdC",
    "example": "IdC"
  }
}
```

### 可选字段

```json
{
  "access_token": {
    "type": "String",
    "required": false,
    "description": "访问令牌（可选，会自动刷新）",
    "example": "xxx"
  },
  "expires_at": {
    "type": "String",
    "required": false,
    "description": "过期时间",
    "example": "2024-01-27T12:00:00Z"
  },
  "client_id_hash": {
    "type": "String",
    "required": false,
    "description": "客户端 ID 哈希（可选，会自动计算）",
    "example": "sha256-xxx"
  },
  "machine_id": {
    "type": "String",
    "required": false,
    "description": "机器 ID（可选，会自动生成）",
    "example": "uuid-xxx"
  }
}
```

### 不需要的字段

```json
[
  "user_id",
  "profile_arn",
  "start_url"
]
```

**说明**：
- `user_id` - BuilderId 使用 `email` 作为标识
- `profile_arn` - IdC 账号不使用
- `start_url` - BuilderId 使用固定的 Start URL（`https://view.awsapps.com/start`）

### 切换账号流程

```rust
// 1. 读取账号数据
let account = store.get_account_by_id(&account_id)?;

// 2. 验证必需字段
if account.email.is_none() {
    return Err("缺少 email".to_string());
}
if account.refresh_token.is_none() {
    return Err("缺少 refresh_token".to_string());
}
if account.client_id.is_none() {
    return Err("缺少 client_id".to_string());
}
if account.client_secret.is_none() {
    return Err("缺少 client_secret".to_string());
}
if account.region.is_none() {
    return Err("缺少 region".to_string());
}

// 3. 计算 client_id_hash（如果没有）
let client_id_hash = account.client_id_hash.clone().unwrap_or_else(|| {
    let start_url = "https://view.awsapps.com/start";  // BuilderId 固定 Start URL
    compute_client_id_hash(start_url)
});

// 4. 写入 Kiro IDE
let kiro_token = json!({
    "access_token": account.access_token,
    "refresh_token": account.refresh_token,
    "expires_at": account.expires_at,
    "region": account.region,
    "scopes": ["codewhisperer:completions", "codewhisperer:analysis"],
    "client_id": account.client_id,
    "client_secret": account.client_secret,
    "client_id_hash": client_id_hash
});
```

---

## Enterprise 账号

### 必需字段

```json
{
  "user_id": {
    "type": "String",
    "required": true,
    "description": "用户 ID（Enterprise 专用）",
    "example": "xxx-xxx-xxx"
  },
  "refresh_token": {
    "type": "String",
    "required": true,
    "description": "刷新令牌",
    "example": "aor_xxx"
  },
  "client_id": {
    "type": "String",
    "required": true,
    "description": "客户端 ID",
    "example": "xxx"
  },
  "client_secret": {
    "type": "String",
    "required": true,
    "description": "客户端密钥",
    "example": "xxx"
  },
  "region": {
    "type": "String",
    "required": true,
    "description": "AWS 区域",
    "example": "ap-southeast-2"
  },
  "start_url": {
    "type": "String",
    "required": true,
    "description": "Start URL（Enterprise 专用）",
    "example": "https://xxx.awsapps.com/start"
  },
  "provider": {
    "type": "String",
    "required": true,
    "description": "固定为 Enterprise",
    "example": "Enterprise"
  },
  "auth_method": {
    "type": "String",
    "required": true,
    "description": "固定为 IdC",
    "example": "IdC"
  }
}
```

### 可选字段

```json
{
  "email": {
    "type": "String",
    "required": false,
    "description": "邮箱地址（Enterprise 可能没有）",
    "example": null
  },
  "access_token": {
    "type": "String",
    "required": false,
    "description": "访问令牌（可选，会自动刷新）",
    "example": "xxx"
  },
  "expires_at": {
    "type": "String",
    "required": false,
    "description": "过期时间",
    "example": "2024-01-27T12:00:00Z"
  },
  "client_id_hash": {
    "type": "String",
    "required": false,
    "description": "客户端 ID 哈希（可选，会自动计算）",
    "example": "sha256-xxx"
  },
  "machine_id": {
    "type": "String",
    "required": false,
    "description": "机器 ID（可选，会自动生成）",
    "example": "uuid-xxx"
  }
}
```

### 不需要的字段

```json
[
  "profile_arn"
]
```

**说明**：
- `profile_arn` - IdC 账号不使用

### 切换账号流程

```rust
// 1. 读取账号数据
let account = store.get_account_by_id(&account_id)?;

// 2. 验证必需字段
if account.user_id.is_none() {
    return Err("缺少 user_id".to_string());
}
if account.refresh_token.is_none() {
    return Err("缺少 refresh_token".to_string());
}
if account.client_id.is_none() {
    return Err("缺少 client_id".to_string());
}
if account.client_secret.is_none() {
    return Err("缺少 client_secret".to_string());
}
if account.region.is_none() {
    return Err("缺少 region".to_string());
}
if account.start_url.is_none() {
    return Err("缺少 start_url".to_string());
}

// 3. 计算 client_id_hash（如果没有）
let client_id_hash = account.client_id_hash.clone().unwrap_or_else(|| {
    compute_client_id_hash(&account.start_url.unwrap())
});

// 4. 写入 Kiro IDE
let kiro_token = json!({
    "access_token": account.access_token,
    "refresh_token": account.refresh_token,
    "expires_at": account.expires_at,
    "region": account.region,
    "scopes": ["codewhisperer:completions", "codewhisperer:analysis"],
    "client_id": account.client_id,
    "client_secret": account.client_secret,
    "client_id_hash": client_id_hash
});
```

---

## 字段对比

### 核心字段对比

```json
{
  "email": {
    "Google": "required",
    "GitHub": "required",
    "BuilderId": "required",
    "Enterprise": "optional",
    "note": "Enterprise 可能没有 email"
  },
  "user_id": {
    "Google": "not_used",
    "GitHub": "not_used",
    "BuilderId": "not_used",
    "Enterprise": "required",
    "note": "Enterprise 专用"
  },
  "refresh_token": {
    "Google": "required",
    "GitHub": "required",
    "BuilderId": "required",
    "Enterprise": "required",
    "note": "所有账号都需要"
  },
  "provider": {
    "Google": "Google",
    "GitHub": "GitHub",
    "BuilderId": "BuilderId",
    "Enterprise": "Enterprise",
    "note": "区分账号类型"
  },
  "auth_method": {
    "Google": "social",
    "GitHub": "social",
    "BuilderId": "IdC",
    "Enterprise": "IdC",
    "note": "认证方法"
  }
}
```

### Social 专用字段

```json
{
  "profile_arn": {
    "Google": "optional",
    "GitHub": "optional",
    "BuilderId": "not_used",
    "Enterprise": "not_used",
    "note": "Social 账号专用"
  }
}
```

### IdC 专用字段

```json
{
  "client_id": {
    "Google": "not_used",
    "GitHub": "not_used",
    "BuilderId": "required",
    "Enterprise": "required",
    "note": "IdC 账号必需"
  },
  "client_secret": {
    "Google": "not_used",
    "GitHub": "not_used",
    "BuilderId": "required",
    "Enterprise": "required",
    "note": "IdC 账号必需"
  },
  "client_id_hash": {
    "Google": "not_used",
    "GitHub": "not_used",
    "BuilderId": "optional",
    "Enterprise": "optional",
    "note": "可自动计算"
  },
  "region": {
    "Google": "not_used",
    "GitHub": "not_used",
    "BuilderId": "required",
    "Enterprise": "required",
    "note": "AWS 区域"
  },
  "start_url": {
    "Google": "not_used",
    "GitHub": "not_used",
    "BuilderId": "not_used",
    "Enterprise": "required",
    "note": "Enterprise 专用"
  }
}
```

### 通用可选字段

```json
{
  "access_token": "访问令牌（可选，会自动刷新）",
  "expires_at": "过期时间",
  "machine_id": "机器 ID（可选，会自动生成）",
  "usage_data": "配额数据（调用 API 获取）",
  "label": "备注",
  "group": "分组",
  "tags": "标签"
}
```

---

## Kiro IDE 写入格式

### Google/GitHub（Social）

**文件路径**：`~/.aws/sso/cache/kiro-auth-token.json`

```json
{
  "access_token": "ya29.xxx",
  "refresh_token": "aor_xxx",
  "expires_at": "2024-01-27T12:00:00Z",
  "profile_arn": "arn:aws:iam::xxx:oidc-provider/accounts.google.com",
  "region": "us-east-1"
}
```

**关键点**：
- ✅ 不需要 `client_id`、`client_secret`
- ✅ 不需要 `scopes`
- ✅ `region` 固定为 `"us-east-1"`
- ✅ 有 `profile_arn` 字段

### BuilderId（IdC）

**文件路径**：`~/.aws/sso/cache/kiro-auth-token.json`

```json
{
  "access_token": "xxx",
  "refresh_token": "aor_xxx",
  "expires_at": "2024-01-27T12:00:00Z",
  "region": "us-east-1",
  "scopes": ["codewhisperer:completions", "codewhisperer:analysis"],
  "client_id": "xxx",
  "client_secret": "xxx",
  "client_id_hash": "sha256-xxx"
}
```

**关键点**：
- ✅ 需要 `client_id`、`client_secret`
- ✅ 需要 `scopes` 数组
- ✅ 需要 `client_id_hash`（根据固定 Start URL 计算）
- ✅ 没有 `profile_arn` 字段
- ✅ `region` 通常为 `"us-east-1"`

### Enterprise（IdC）

**文件路径**：`~/.aws/sso/cache/kiro-auth-token.json`

```json
{
  "access_token": "xxx",
  "refresh_token": "aor_xxx",
  "expires_at": "2024-01-27T12:00:00Z",
  "region": "ap-southeast-2",
  "scopes": ["codewhisperer:completions", "codewhisperer:analysis"],
  "client_id": "xxx",
  "client_secret": "xxx",
  "client_id_hash": "sha256-xxx"
}
```

**关键点**：
- ✅ 需要 `client_id`、`client_secret`
- ✅ 需要 `scopes` 数组
- ✅ 需要 `client_id_hash`（根据 `start_url` 计算）
- ✅ 没有 `profile_arn` 字段
- ✅ `region` 可以是任意 AWS 区域（如 `"ap-southeast-2"`）
- ⚠️ **注意**：写入文件时不包含 `start_url`，但切换账号时需要 `start_url` 来计算 `client_id_hash`

---

## 字段验证规则

### 切换账号前的验证

```rust
fn validate_account_for_switch(account: &Account) -> Result<(), String> {
    // 1. 验证 refresh_token（所有账号必需）
    if account.refresh_token.is_none() {
        return Err("缺少 refresh_token".to_string());
    }

    // 2. 根据 auth_method 验证
    match account.auth_method.as_deref() {
        Some("social") => {
            // Social 账号验证
            if account.email.is_none() {
                return Err("Social 账号缺少 email".to_string());
            }
        }
        Some("IdC") => {
            // IdC 账号验证
            if account.client_id.is_none() {
                return Err("IdC 账号缺少 client_id".to_string());
            }
            if account.client_secret.is_none() {
                return Err("IdC 账号缺少 client_secret".to_string());
            }
            if account.region.is_none() {
                return Err("IdC 账号缺少 region".to_string());
            }

            // Enterprise 额外验证
            if account.provider.as_deref() == Some("Enterprise") {
                if account.user_id.is_none() {
                    return Err("Enterprise 账号缺少 user_id".to_string());
                }
                if account.start_url.is_none() {
                    return Err("Enterprise 账号缺少 start_url".to_string());
                }
            } else {
                // BuilderId 验证
                if account.email.is_none() {
                    return Err("BuilderId 账号缺少 email".to_string());
                }
            }
        }
        _ => {
            return Err("未知的 auth_method".to_string());
        }
    }

    Ok(())
}
```

---

## 常见问题

### Q1: 为什么 Enterprise 账号可能没有 email？

**A**: Enterprise 账号使用 AWS IAM Identity Center，配额响应中只有 `userId`，没有 `email` 字段。这是 AWS 的设计，不是 bug。

### Q2: start_url 在哪里使用？

**A**: `start_url` 只在以下场景使用：
1. **切换账号时**：计算 `client_id_hash`（本地操作）
2. **刷新 token 时**：计算 `client_id_hash`（本地操作）
3. **不参与 API 调用**：刷新 token 的 API 不需要 `start_url` 参数

### Q3: client_id_hash 如何计算？

**A**: 
```rust
fn compute_client_id_hash(start_url: &str) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(start_url.as_bytes());
    format!("{:x}", hasher.finalize())
}
```

### Q4: BuilderId 的 start_url 是什么？

**A**: BuilderId 使用固定的 Start URL：`https://view.awsapps.com/start`

### Q5: 为什么 Social 账号不需要 region？

**A**: Social 账号（Google/GitHub）使用 Cognito 认证，不涉及 AWS SSO，所以不需要 `region` 字段。写入 Kiro IDE 时固定使用 `"us-east-1"`。

---

## 相关文档

- `docs/dev-guides/account-structure.md` - Account 结构体字段说明
- `docs/api-reference/Kiro Desktop Auth Provider.md` - 认证流程说明
- `src-tauri/src/account.rs` - Account 结构体定义
- `src-tauri/src/kiro.rs` - 切换账号实现

---

## 更新记录

- 2026-01-27: 创建文档，总结四种账号类型的字段需求

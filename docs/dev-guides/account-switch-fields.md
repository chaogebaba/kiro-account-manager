# 账号切换字段需求文档

本文档详细说明四种账号类型（Google、GitHub、BuilderId、Enterprise）在切换账号时需要的字段。

---

## 目录

1. [Google 账号](#google-账号)
2. [GitHub 账号](#github-账号)
3. [BuilderId 账号](#builderid-账号)
4. [Enterprise 账号](#enterprise-账号)
5. [字段对比](#字段对比)
6. [Kiro IDE 写入格式](#kiro-ide-写入格式)
7. [常见问题](#常见问题)

---

## Google 账号

### 完整示例

```json
{
  "id": "uuid-xxx",
  "email": "user@gmail.com",
  "label": "我的 Google 账号",
  "refresh_token": "aor_xxx",
  "access_token": "ya29.xxx",
  "expires_at": "2024-01-27T12:00:00Z",
  "provider": "Google",
  "auth_method": "social",
  "profile_arn": "arn:aws:iam::xxx:oidc-provider/accounts.google.com",
  "machine_id": "uuid-xxx",
  "status": "active",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-27T00:00:00Z"
}
```

### 必需字段（切换账号时）

```json
{
  "email": "user@gmail.com",
  "refresh_token": "aor_xxx",
  "provider": "Google",
  "auth_method": "social"
}
```

### 可选字段

```json
{
  "access_token": "ya29.xxx",
  "expires_at": "2024-01-27T12:00:00Z",
  "profile_arn": "arn:aws:iam::xxx:oidc-provider/accounts.google.com",
  "machine_id": "uuid-xxx"
}
```

### 不需要的字段

```json
{
  "user_id": null,
  "client_id": null,
  "client_secret": null,
  "client_id_hash": null,
  "start_url": null,
  "region": null
}
```

---

## GitHub 账号

### 完整示例

```json
{
  "id": "uuid-xxx",
  "email": "user@github.com",
  "label": "我的 GitHub 账号",
  "refresh_token": "aor_xxx",
  "access_token": "gho_xxx",
  "expires_at": "2024-01-27T12:00:00Z",
  "provider": "GitHub",
  "auth_method": "social",
  "profile_arn": "arn:aws:iam::xxx:oidc-provider/token.actions.githubusercontent.com",
  "machine_id": "uuid-xxx",
  "status": "active",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-27T00:00:00Z"
}
```

### 必需字段（切换账号时）

```json
{
  "email": "user@github.com",
  "refresh_token": "aor_xxx",
  "provider": "GitHub",
  "auth_method": "social"
}
```

### 可选字段

```json
{
  "access_token": "gho_xxx",
  "expires_at": "2024-01-27T12:00:00Z",
  "profile_arn": "arn:aws:iam::xxx:oidc-provider/token.actions.githubusercontent.com",
  "machine_id": "uuid-xxx"
}
```

### 不需要的字段

```json
{
  "user_id": null,
  "client_id": null,
  "client_secret": null,
  "client_id_hash": null,
  "start_url": null,
  "region": null
}
```

---

## BuilderId 账号

### 完整示例

```json
{
  "id": "uuid-xxx",
  "email": "user@example.com",
  "label": "我的 BuilderId 账号",
  "refresh_token": "aorAAAAAGnHNh06ug7STAHvenNZsAHSd_RXMWn2vIuIPln6_8Mbo_aMmk64tyoQ8NpjG3j68DpO8fkHkuCqAefwWMBkc0:MGYCMQCgCpeTGXN7yFoKJw/IhFnfxv7LGDXGzoyrM9DTvXlhb4TiYNvzoxLl7/W2h7iWkZkCMQCzCjqQIYNG8E3gRlRxBEWUNBU+DLn8UFlKhLumPnr39KfOGtco2JSgy4p7EIx6UrM",
  "access_token": "aoaAAAAAGlzmTAvqIzMpo_f68deMC_PKrY9FtnFBU7teMHJYsEfmTOVr_7NByZBus96RhFUJxA9Qpm_IkAaG4sOokBkc0:MGYCMQC6q7H+73sK0GsojCqjYVBzOUDielk5zt3sNOHmOpyYSGAKy2sOn9J7V7oqaqXnXrYCMQCc7OmVUvBGvCHyeZ8NC+eIAEEkVJ+ktchB+670Vpi3PqJL0hA4RKpzG4UPLPVVGsU",
  "expires_at": "2026-01-23T15:55:14.153942900+00:00",
  "provider": "BuilderId",
  "auth_method": "IdC",
  "region": "us-east-1",
  "client_id": "xxx",
  "client_secret": "xxx",
  "client_id_hash": "9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53",
  "machine_id": "uuid-xxx",
  "status": "active",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-27T00:00:00Z"
}
```

### 必需字段（切换账号时）

```json
{
  "email": "user@example.com",
  "refresh_token": "aorAAAAAGnHNh06ug7STAHvenNZsAHSd_RXMWn2vIuIPln6_8Mbo_aMmk64tyoQ8NpjG3j68DpO8fkHkuCqAefwWMBkc0:MGYCMQCgCpeTGXN7yFoKJw/IhFnfxv7LGDXGzoyrM9DTvXlhb4TiYNvzoxLl7/W2h7iWkZkCMQCzCjqQIYNG8E3gRlRxBEWUNBU+DLn8UFlKhLumPnr39KfOGtco2JSgy4p7EIx6UrM",
  "client_id": "xxx",
  "client_secret": "xxx",
  "region": "us-east-1",
  "provider": "BuilderId",
  "auth_method": "IdC"
}
```

### 可选字段

```json
{
  "access_token": "aoaAAAAAGlzmTAvqIzMpo_f68deMC_PKrY9FtnFBU7teMHJYsEfmTOVr_7NByZBus96RhFUJxA9Qpm_IkAaG4sOokBkc0:MGYCMQC6q7H+73sK0GsojCqjYVBzOUDielk5zt3sNOHmOpyYSGAKy2sOn9J7V7oqaqXnXrYCMQCc7OmVUvBGvCHyeZ8NC+eIAEEkVJ+ktchB+670Vpi3PqJL0hA4RKpzG4UPLPVVGsU",
  "expires_at": "2026-01-23T15:55:14.153942900+00:00",
  "client_id_hash": "9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53",
  "machine_id": "uuid-xxx"
}
```

**说明**：
- `client_id_hash` 可选，如果没有会根据固定的 Start URL（`https://view.awsapps.com/start`）自动计算

### 不需要的字段

```json
{
  "user_id": null,
  "profile_arn": null,
  "start_url": null
}
```

---

## Enterprise 账号

### 完整示例

```json
{
  "id": "uuid-xxx",
  "user_id": "xxx-xxx-xxx",
  "email": null,
  "label": "我的 Enterprise 账号",
  "refresh_token": "aor_xxx",
  "access_token": "xxx",
  "expires_at": "2024-01-27T12:00:00Z",
  "provider": "Enterprise",
  "auth_method": "IdC",
  "region": "ap-southeast-2",
  "start_url": "https://xxx.awsapps.com/start",
  "client_id": "xxx",
  "client_secret": "xxx",
  "client_id_hash": "sha256-xxx",
  "machine_id": "uuid-xxx",
  "status": "active",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-27T00:00:00Z"
}
```

### 必需字段（切换账号时）

```json
{
  "user_id": "xxx-xxx-xxx",
  "refresh_token": "aor_xxx",
  "client_id": "xxx",
  "client_secret": "xxx",
  "region": "ap-southeast-2",
  "start_url": "https://xxx.awsapps.com/start",
  "provider": "Enterprise",
  "auth_method": "IdC"
}
```

### 可选字段

```json
{
  "email": null,
  "access_token": "xxx",
  "expires_at": "2024-01-27T12:00:00Z",
  "client_id_hash": "sha256-xxx",
  "machine_id": "uuid-xxx"
}
```

**说明**：
- `email` 可选，Enterprise 账号可能没有 email
- `client_id_hash` 可选，如果没有会根据 `start_url` 自动计算

### 不需要的字段

```json
{
  "profile_arn": null
}
```

---

## 字段对比

### 核心字段对比

```json
{
  "Google": {
    "email": "required",
    "user_id": "not_used",
    "refresh_token": "required",
    "provider": "Google",
    "auth_method": "social",
    "client_id": "not_used",
    "client_secret": "not_used",
    "region": "not_used",
    "start_url": "not_used",
    "profile_arn": "optional"
  },
  "GitHub": {
    "email": "required",
    "user_id": "not_used",
    "refresh_token": "required",
    "provider": "GitHub",
    "auth_method": "social",
    "client_id": "not_used",
    "client_secret": "not_used",
    "region": "not_used",
    "start_url": "not_used",
    "profile_arn": "optional"
  },
  "BuilderId": {
    "email": "required",
    "user_id": "not_used",
    "refresh_token": "required",
    "provider": "BuilderId",
    "auth_method": "IdC",
    "client_id": "required",
    "client_secret": "required",
    "region": "required",
    "start_url": "not_used",
    "profile_arn": "not_used"
  },
  "Enterprise": {
    "email": "optional",
    "user_id": "required",
    "refresh_token": "required",
    "provider": "Enterprise",
    "auth_method": "IdC",
    "client_id": "required",
    "client_secret": "required",
    "region": "required",
    "start_url": "required",
    "profile_arn": "not_used"
  }
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
  "access_token": "aoaAAAAAGlzmTAvqIzMpo_f68deMC_PKrY9FtnFBU7teMHJYsEfmTOVr_7NByZBus96RhFUJxA9Qpm_IkAaG4sOokBkc0:MGYCMQC6q7H+73sK0GsojCqjYVBzOUDielk5zt3sNOHmOpyYSGAKy2sOn9J7V7oqaqXnXrYCMQCc7OmVUvBGvCHyeZ8NC+eIAEEkVJ+ktchB+670Vpi3PqJL0hA4RKpzG4UPLPVVGsU",
  "refresh_token": "aorAAAAAGnHNh06ug7STAHvenNZsAHSd_RXMWn2vIuIPln6_8Mbo_aMmk64tyoQ8NpjG3j68DpO8fkHkuCqAefwWMBkc0:MGYCMQCgCpeTGXN7yFoKJw/IhFnfxv7LGDXGzoyrM9DTvXlhb4TiYNvzoxLl7/W2h7iWkZkCMQCzCjqQIYNG8E3gRlRxBEWUNBU+DLn8UFlKhLumPnr39KfOGtco2JSgy4p7EIx6UrM",
  "expires_at": "2026-01-23T15:55:14.153942900+00:00",
  "region": "us-east-1",
  "scopes": ["codewhisperer:completions", "codewhisperer:analysis"],
  "client_id": "xxx",
  "client_secret": "xxx",
  "client_id_hash": "9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53"
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

## 常见问题

### Q1: 为什么 Enterprise 账号可能没有 email？

**A**: Enterprise 账号使用 AWS IAM Identity Center，配额响应中只有 `userId`，没有 `email` 字段。这是 AWS 的设计，不是 bug。

**示例**：
```json
{
  "email": null,
  "user_id": "xxx-xxx-xxx"
}
```

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

**示例**：
```json
{
  "start_url": "https://view.awsapps.com/start",
  "client_id_hash": "9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53"
}
```

### Q4: BuilderId 的 start_url 是什么？

**A**: BuilderId 使用固定的 Start URL：`https://view.awsapps.com/start`

**示例**：
```json
{
  "provider": "BuilderId",
  "start_url": null,
  "client_id_hash": "9b7accc909e1b8b5bc5fd05ee6c86fc891a78d53"
}
```

### Q5: 为什么 Social 账号不需要 region？

**A**: Social 账号（Google/GitHub）使用 Cognito 认证，不涉及 AWS SSO，所以不需要 `region` 字段。写入 Kiro IDE 时固定使用 `"us-east-1"`。

**示例**：
```json
{
  "provider": "Google",
  "auth_method": "social",
  "region": null
}
```

---

## 相关文档

- `docs/dev-guides/account-structure.md` - Account 结构体字段说明
- `docs/api-reference/Kiro Desktop Auth Provider.md` - 认证流程说明
- `src-tauri/src/account.rs` - Account 结构体定义
- `src-tauri/src/kiro.rs` - 切换账号实现

---

## 更新记录

- 2026-01-27: 创建文档，使用 JSON 格式展示字段需求

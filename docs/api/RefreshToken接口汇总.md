# RefreshToken 接口汇总

本项目账号管理使用 Desktop 类的两个刷新接口。

---

## 一、Desktop - Social (Google/Github)

### 接口信息
- **URL**: `https://desktop-prod.us-east-1.auth.codewhisperer.aws.dev/refreshToken`
- **Method**: POST
- **Content-Type**: application/json

### 请求参数
```json
{
  "refreshToken": "aor..."
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| refreshToken | string | 是 | 刷新令牌，以 `aor` 开头 |

### 响应字段
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "aor...",
  "profileArn": "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK",
  "expiresIn": 3600
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| accessToken | string | 新的访问令牌，以 `eyJ` 开头 (JWT) |
| refreshToken | string | 新的刷新令牌 |
| profileArn | string | AWS CodeWhisperer Profile ARN |
| expiresIn | number | 访问令牌有效期（秒），通常 3600 |

### 代码位置
- `src-tauri/src/auth.rs` → `refresh_token_desktop()`
- `src-tauri/src/providers/social.rs` → `SocialProvider::refresh_token()`

---

## 二、Desktop - BuilderId (IdC)

### 接口信息
- **URL**: `https://oidc.{region}.amazonaws.com/token`
- **Method**: POST
- **Content-Type**: application/json

### 请求参数
```json
{
  "clientId": "xxx",
  "clientSecret": "xxx",
  "grantType": "refresh_token",
  "refreshToken": "aor..."
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| clientId | string | 是 | SSO 客户端 ID |
| clientSecret | string | 是 | SSO 客户端密钥 |
| grantType | string | 是 | 固定值 `refresh_token` |
| refreshToken | string | 是 | 刷新令牌，以 `aor` 开头 |

### 响应字段
```json
{
  "accessToken": "aoa...",
  "refreshToken": "aor...",
  "idToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "aws_sso_app_session_id": "xxx"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| accessToken | string | 新的访问令牌，以 `aoa` 开头 |
| refreshToken | string | 新的刷新令牌 |
| idToken | string? | ID Token (JWT) |
| tokenType | string | 令牌类型，通常 `Bearer` |
| expiresIn | number | 访问令牌有效期（秒），通常 3600 |
| aws_sso_app_session_id | string? | AWS SSO 会话 ID |

### 代码位置
- `src-tauri/src/aws_sso_client.rs` → `AwsSsoClient::refresh_token()`
- `src-tauri/src/providers/idc.rs` → `IdcProvider::refresh_token()`

---

## 对比总结

| 特性 | Social (Google/Github) | BuilderId (IdC) |
|------|------------------------|-----------------|
| 服务端 | Kiro Desktop Auth | AWS OIDC |
| 认证方式 | refresh_token | refresh_token + client_id/secret |
| Access Token 格式 | `eyJ...` (JWT) | `aoa...` |
| 特有响应字段 | profileArn | idToken, aws_sso_app_session_id |

---

## 使用方式

在 `sync_account` 命令中，根据 `provider` 选择刷新接口：

```rust
if provider_str == "BuilderId" {
    // AWS OIDC
} else if provider_str == "Google" || provider_str == "Github" {
    // Desktop API
} else {
    return Err("不支持的 provider");
}
```

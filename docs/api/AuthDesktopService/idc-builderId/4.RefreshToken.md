# RefreshToken - 刷新 Token

## 说明

使用 refresh_token 获取新的 access_token。

**注意**: IdC 刷新 Token 需要 clientId 和 clientSecret，与 Social 不同。

## 请求

```
POST https://oidc.{region}.amazonaws.com/token
Content-Type: application/json
```

## 参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| clientId | string | 是 | RegisterClient 返回的 clientId |
| clientSecret | string | 是 | RegisterClient 返回的 clientSecret |
| grantType | string | 是 | `refresh_token` |
| refreshToken | string | 是 | 刷新令牌 |

## 请求示例

```json
{
  "clientId": "arn:aws:sso::123456789012:application/ssoins-xxx/apl-xxx",
  "clientSecret": "xxx-xxx-xxx",
  "grantType": "refresh_token",
  "refreshToken": "aorAAAAAGmn7mkq3ENoExbIwgk_OdwcuxkJyaq2ol..."
}
```

## 响应

| 字段 | 类型 | 说明 |
|------|------|------|
| accessToken | string | 新的访问令牌 |
| refreshToken | string | 刷新令牌 (可能更新) |
| tokenType | string | 固定 `Bearer` |
| expiresIn | number | 过期时间 (秒) |

## 响应示例

```json
{
  "accessToken": "aoaAAAAAGkxVbsc9qEYamDz5AxPKOmBINdU1kxbqppiqiZDYyiT3...",
  "refreshToken": "aorAAAAAGmn7mkq3ENoExbIwgk_OdwcuxkJyaq2ol...",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

## 错误

| 错误 | 说明 |
|------|------|
| ExpiredTokenException | refreshToken 已过期 |
| InvalidClientException | clientId 或 clientSecret 无效 |

## 与 Social 的区别

| | IdC | Social |
|---|---|---|
| 端点 | `oidc.{region}.amazonaws.com/token` | `prod.us-east-1.auth.desktop.kiro.dev/refreshToken` |
| 需要 clientId | ✅ 是 | ❌ 否 |
| 需要 clientSecret | ✅ 是 | ❌ 否 |
| grantType 参数 | ✅ 需要 | ❌ 不需要 |

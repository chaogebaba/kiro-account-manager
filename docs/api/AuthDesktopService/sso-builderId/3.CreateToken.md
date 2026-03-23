# CreateToken - 获取 Token

## 说明

用授权码换取 access_token 和 refresh_token。

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
| grantType | string | 是 | `authorization_code` |
| redirectUri | string | 是 | 必须与 Authorize 时一致 |
| code | string | 是 | 授权回调返回的 code |
| codeVerifier | string | 是 | PKCE code_verifier |

## 请求示例

```json
{
  "clientId": "arn:aws:sso::123456789012:application/ssoins-xxx/apl-xxx",
  "clientSecret": "xxx-xxx-xxx",
  "grantType": "authorization_code",
  "redirectUri": "http://127.0.0.1:54321/oauth/callback",
  "code": "AUTH_CODE",
  "codeVerifier": "xxx"
}
```

## 响应

| 字段 | 类型 | 说明 |
|------|------|------|
| accessToken | string | 访问令牌 |
| refreshToken | string | 刷新令牌 |
| tokenType | string | 固定 `Bearer` |
| expiresIn | number | 过期时间 (秒) |
| idToken | string | ID Token (可选) |

## 响应示例

```json
{
  "accessToken": "aoaAAAAAGkxVXo915Bfzy9BDBF1KPH7K...",
  "refreshToken": "aorAAAAAGmn7mkq3ENoExbIwgk_OdwcuxkJyaq2ol...",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

## 错误

| 错误 | 说明 |
|------|------|
| InvalidGrantException | 授权码无效或已过期 |
| InvalidClientException | clientId 或 clientSecret 无效 |

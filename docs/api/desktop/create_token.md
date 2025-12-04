# Kiro Auth Create Token API

用授权码换取 access_token 和 refresh_token

## 请求

```
POST https://prod.us-east-1.auth.desktop.kiro.dev/oauth/token
Content-Type: application/json
```

### Request Body

```json
{
  "code": "cc25fe27-d109-48eb-b24d-85a772444eeb",
  "code_verifier": "lWS3bcgCgLvgqKvmVuMx_lVrDMedsylZ2lAN8RnBMz0",
  "redirect_uri": "http://localhost:49153/oauth/callback"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | 是 | OAuth 回调返回的授权码 |
| code_verifier | string | 是 | PKCE code_verifier (与 code_challenge 对应) |
| redirect_uri | string | 是 | 必须与登录时的 redirect_uri 一致 |
| invitation_code | string | 否 | 邀请码 (可选) |

## 响应

### 成功 (200 OK)

```json
{
  "accessToken": "aoaAAAAAGkxVXo915Bfzy9BDBF1KPH7K-cUpa3Eqwv94zK_qRY7o5N_JFEoCpdEjmAQtwAROM6vplBmBlmhLc4OSgBkc0:MGQCME0Kkoji23avFmFaTRDUI8blPUhzT+kNCaqYHXTYNW0iqXcGZQefvwIB7nIKvLJBIAIwQsSFTI/nHN0LZtM1l0bIEXLzanrmrn41XoCmPqI/e5em1jMOB4QfuzClPDXr+lbt",
  "expiresIn": 3600,
  "profileArn": "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK",
  "refreshToken": "aorAAAAAGmn7mkq3ENoExbIwgk_OdwcuxkJyaq2ol_QY6gqmwCeb6D5a4F-FWILIO_HDHJsXNynJT-XdvRzblKptIBkc0:MGQCMBuTWX3CWkyOh2dO7j0FEM4RkoLn08ZaB4sJgNZQQ8TPG/bNjhGjIBvBBoEKtBFfPQIwA5tajK2obPdZO6HZmzqucKmm0SKjSeeX8Jg8LV0Cx6nLnOGRP/IbRlfoU3aF3PAp"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| accessToken | string | 访问令牌，用于调用 API |
| refreshToken | string | 刷新令牌，用于获取新的 accessToken |
| expiresIn | number | accessToken 过期时间 (秒) |
| profileArn | string | AWS CodeWhisperer Profile ARN |

### 错误

- `400 Bad Request` - 参数错误
- `401 Unauthorized` - code 无效或已过期

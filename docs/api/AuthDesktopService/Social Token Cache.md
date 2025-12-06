# Social 本地账号格式 (Google/Github)

## 文件位置

```
~/.aws/sso/cache/kiro-auth-token.json
```

## 格式

```json
{
  "accessToken": "aoaAAAAAGkxVXo915Bfzy9BDBF1KPH7K...",
  "refreshToken": "aorAAAAAGmn7mkq3ENoExbIwgk_OdwcuxkJyaq2ol...",
  "profileArn": "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK",
  "expiresAt": "2025-12-05T15:00:00.000Z",
  "authMethod": "social",
  "provider": "Google"
}
```

## 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| accessToken | string | ✅ | 访问令牌 (aoa 开头) |
| refreshToken | string | ✅ | 刷新令牌 (aor 开头) |
| profileArn | string | ✅ | AWS Profile ARN |
| expiresAt | string | ✅ | 过期时间 (ISO 8601) |
| authMethod | string | ✅ | 固定 `social` |
| provider | string | ✅ | `Google` 或 `Github` |

## 与 IdC 的区别

| 字段 | Social | IdC |
|------|--------|-----|
| profileArn | ✅ 有 | ❌ 无 |
| clientIdHash | ❌ 无 | ✅ 有 |
| region | ❌ 无 | ✅ 有 |
| authMethod | `social` | `IdC` |
| provider | `Google` / `Github` | `BuilderId` / `Enterprise` |

## 注意

- Social 账号使用 `profileArn` 标识用户
- IdC 账号格式见 `IdC 本地账号格式.md`

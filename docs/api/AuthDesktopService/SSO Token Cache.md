# IdC 本地账号格式 (BuilderId/Enterprise)

## 文件位置

```
~/.aws/sso/cache/kiro-auth-token.json
```

## 格式

```json
{
  "accessToken": "aoaAAAAAGkykGgThhak5-_ezmdTukod22yn37pRbIGHZ8mtrFqIC22bw4LhnmoJzrTCnjz90R90yDA73uxsSYk7VkBkc0:MGQCMFH2Km2sqG05U0IRi2/XScko+MVJqfI6tqoHfLyDwBDuapfrMONwzcjJj7Tnqt88PQIwSFLb1TpkpP3bEgfLJDfN8SfkCGsJZhHg9fdX4pSLB8Vwq0oiegSaGInYLNXBk289",
  "refreshToken": "aorAAAAAGmpKRgptSZF4vSazO1iYzflL-UESJaFZcGFbWGyfn5M-zLLtJRjT7z5w1rL-DeOltxaZ8mMTJWyZVenuQBkc0:MGUCMQDtroFr8XG6IkF558hGmBybd2CJ7Sru6nCV+JxGK3CfdWLyK2eOsDIKpEz/8C9FAFYCMBfzWVNVaKQDkRUNX1B7+azr/d535k9KUf8xE9iRi8q0DQ1lLKn9K2D+FmVXLn7kLg",
  "expiresAt": "2025-12-05T07:54:17.089Z",
  "clientIdHash": "e909a0580879b06ece1202964fbe9dda95ea4ce3",
  "authMethod": "IdC",
  "provider": "BuilderId",
  "region": "us-east-1"
}
```

## 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| accessToken | string | ✅ | 访问令牌 (aoa 开头) |
| refreshToken | string | ✅ | 刷新令牌 (aor 开头) |
| expiresAt | string | ✅ | 过期时间 (ISO 8601) |
| clientIdHash | string | ✅ | 客户端 ID 哈希 (SHA256) |
| authMethod | string | ✅ | 固定 `IdC` |
| provider | string | ✅ | `BuilderId` 或 `Enterprise` |
| region | string | ✅ | AWS 区域，如 `us-east-1` |

## 与 Social 的区别

| 字段 | Social | IdC |
|------|--------|-----|
| profileArn | ✅ 有 | ❌ 无 |
| clientIdHash | ❌ 无 | ✅ 有 |
| region | ❌ 无 | ✅ 有 |
| authMethod | `social` | `IdC` |
| provider | `Google` / `GitHub` | `BuilderId` / `Enterprise` |

## 客户端缓存

**文件位置**: `~/.aws/sso/cache/{clientIdHash}.json`

```json
{
  "clientId": "xxx",
  "clientSecret": "xxx",
  "expiresAt": "2025-03-01T00:00:00.000Z"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| clientId | string | OIDC 客户端 ID |
| clientSecret | string | OIDC 客户端密钥 |
| expiresAt | string | 客户端过期时间 (约 90 天) |

> 刷新 Token 时需要从此文件读取 clientId/clientSecret

---

## 注意

- Token 文件 (`kiro-auth-token.json`) 和客户端文件 (`{clientIdHash}.json`) 是分开的
- `clientIdHash` = SHA1(startUrl)
- 客户端过期后需要重新调用 RegisterClient

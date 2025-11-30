# RefreshToken - 刷新 Token

## 请求

```
POST https://app.kiro.dev/service/KiroWebPortalService/operation/RefreshToken
Content-Type: application/cbor
smithy-protocol: rpc-v2-cbor
Cookie: AccessToken=xxx; RefreshToken=xxx; Idp=Google
```

## 参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| csrfToken | string | 是 | 空字符串即可 |

## CBOR Body

```
[0xa1, 0x69, 0x63, 0x73, 0x72, 0x66, 0x54, 0x6f, 0x6b, 0x65, 0x6e, 0x60]
```
即 `{csrfToken: ""}`

## 响应

| 字段 | 类型 | 说明 |
|------|------|------|
| accessToken | string | 新的访问令牌 (aoa开头) |
| csrfToken | string | 新的 CSRF 令牌 |
| expiresIn | number | 过期时间(秒) |
| profileArn | string | AWS Profile ARN |

## 示例响应

```
accessToken: aoaAAAAAGksHmYJJJcuPyk4A3xGh4T-4FeHtZThgCFsBX65pKpYR0abA...
csrfToken: iPTgSQ6ptXbD1ndCCLO6GJ/BLBV5gvr9oHu0KfUe32M=
expiresIn: 3600
profileArn: arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK
```

## 说明

- 通过 Cookie 中的 RefreshToken 刷新获取新的 AccessToken
- AccessToken 有效期约 1 小时
- RefreshToken 有效期 7 天

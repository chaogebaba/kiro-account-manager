# ExchangeToken - 交换 Token

## 请求

```
POST https://app.kiro.dev/service/KiroWebPortalService/operation/ExchangeToken
Content-Type: application/cbor
smithy-protocol: rpc-v2-cbor
```

## 参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| idp | string | 是 | 登录提供商: Google / Github |
| code | string | 是 | OAuth 授权码 |
| codeVerifier | string | 是 | PKCE code_verifier |
| redirectUri | string | 是 | https://app.kiro.dev/signin/oauth |

## 响应

| 字段 | 类型 | 说明 |
|------|------|------|
| accessToken | string | 访问令牌 (aoa开头) |
| csrfToken | string | CSRF 令牌 |
| expiresIn | number | 过期时间(秒) |
| profileArn | string | AWS Profile ARN |

## Set-Cookie

| Cookie | 格式 | Max-Age |
|--------|------|---------|
| AccessToken | aoa开头 | 604800 (7天) |
| RefreshToken | aor开头 | 604800 (7天) |
| Idp | Google/Github | 604800 (7天) |

## 示例响应

```
accessToken: aoaAAAAAGksHWkoLPAh1oLC3lLrcbNScnpMIC_-s0PmStf-VNZnCsPUUSg...
csrfToken: 9Bd3FZZb1JoAvLvpUYmExKIqRTOAe0frjPpKwpe8Ql8=
expiresIn: 3600
profileArn: arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK
```

# Kiro Auth Login API

打开浏览器到 Kiro 登录页面

## 请求

```
GET https://prod.us-east-1.auth.desktop.kiro.dev/login
```

### Query Parameters

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| idp | string | 是 | 身份提供商: `Google` 或 `Github` |
| redirect_uri | string | 是 | 回调地址，如 `http://localhost:49153/oauth/callback` |
| code_challenge | string | 是 | PKCE code_challenge (SHA256 + base64url) |
| code_challenge_method | string | 是 | 固定值 `S256` |
| state | string | 是 | 随机状态字符串，用于防止 CSRF |

### 示例

```
https://prod.us-east-1.auth.desktop.kiro.dev/login?idp=Github&redirect_uri=http%3A%2F%2Flocalhost%3A49153%2Foauth%2Fcallback&code_challenge=-u5fiB_uGZTUe9jJk7C4bXWQ01tooleks41sjoOtnY8&code_challenge_method=S256&state=bfcb7510-6ad2-4c9a-825a-569ee20da0ce
```

## 响应

浏览器会重定向到身份提供商 (Google/Github) 的登录页面。

用户完成登录后，会重定向回 `redirect_uri`，带上 `code` 和 `state` 参数：

```
http://localhost:49153/oauth/callback?code=cc25fe27-d109-48eb-b24d-85a772444eeb&state=bfcb7510-6ad2-4c9a-825a-569ee20da0ce
```

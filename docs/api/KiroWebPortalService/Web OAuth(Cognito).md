# Kiro OAuth 登录流程

## 流程概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Kiro Google OAuth 完整流程                          │
└─────────────────────────────────────────────────────────────────────────────┘

[1] 用户点击 "Sign in with Google"
         │
         ▼
[2] 前端生成 PKCE
    • code_verifier: 随机字符串 (如: 5AoUKv_kJ4dg8VASWA4TNu0MFC70dg6M2yV4CwJaw0c)
    • code_challenge: Base64URL(SHA256(code_verifier))
    • state: 随机 UUID (如: 9055d0d5-8b05-45ec-8785-a2e08b43a1c2)
         │
         ▼
[3] 跳转 Cognito 授权端点
    GET https://kiro-prod-us-east-1.auth.us-east-1.amazoncognito.com/oauth2/authorize
         │
         ▼
[4] Cognito 302 → Google OAuth
    GET https://accounts.google.com/o/oauth2/v2/auth
         │
         ▼
[5] 用户在 Google 登录并授权
         │
         ▼
[6] Google 302 → Cognito idpresponse
    GET /oauth2/idpresponse?code=4/0Ab32j93Q...&scope=email+openid
         │
         ▼
[7] Cognito 302 → Kiro 前端
    GET https://app.kiro.dev/signin/oauth?code=3f0d5a84-...&state=9055d0d5-...
         │
         ▼
[8] 前端调用 ExchangeToken 接口
    POST /service/KiroWebPortalService/operation/ExchangeToken
    Body: { idp: "Google", code, codeVerifier, redirectUri }
         │
         ▼
[9] 后端返回 Token (Set-Cookie)
    • AccessToken
    • RefreshToken
    • Idp=Google
```

## 详细步骤

### Step 1: 前端生成 PKCE 参数

```javascript
// 生成 code_verifier
const codeVerifier = "5AoUKv_kJ4dg8VASWA4TNu0MFC70dg6M2yV4CwJaw0c";

// 生成 code_challenge = Base64URL(SHA256(code_verifier))
const codeChallenge = "vtYk0P9iEVfNgj7iiL14i66lvEhK6EntIWTQ442F_Mw";

// 生成随机 state
const state = "9055d0d5-8b05-45ec-8785-a2e08b43a1c2";
```

### Step 2: 跳转 Cognito 授权端点

**请求:**
```http
GET https://kiro-prod-us-east-1.auth.us-east-1.amazoncognito.com/oauth2/authorize
  ?client_id=59bd15eh40ee7pc20h0bkcu7id
  &response_type=code
  &scope=email+openid
  &redirect_uri=https://app.kiro.dev/signin/oauth
  &state=9055d0d5-8b05-45ec-8785-a2e08b43a1c2
  &code_challenge=vtYk0P9iEVfNgj7iiL14i66lvEhK6EntIWTQ442F_Mw
  &code_challenge_method=S256
  &identity_provider=Google
```

**参数说明:**

| 参数 | 值 | 说明 |
|------|-----|------|
| client_id | `59bd15eh40ee7pc20h0bkcu7id` | Cognito 应用客户端 ID |
| response_type | `code` | 授权码模式 |
| scope | `email openid` | 请求的权限范围 |
| redirect_uri | `https://app.kiro.dev/signin/oauth` | 回调地址 |
| state | 随机 UUID | 防 CSRF，前端保存用于验证 |
| code_challenge | Base64URL(SHA256(code_verifier)) | PKCE 挑战码 |
| code_challenge_method | `S256` | PKCE 方法 |
| identity_provider | `Google` | 身份提供商 |

### Step 3: Cognito 重定向到 Google

**响应:**
```http
HTTP 302
Location: https://accounts.google.com/o/oauth2/v2/auth
  ?client_id=183617306620-gqedod9q1su19ghqs84m1tje4lp761ks.apps.googleusercontent.com
  &redirect_uri=https://kiro-prod-us-east-1.auth.us-east-1.amazoncognito.com/oauth2/idpresponse
  &scope=email+openid
  &response_type=code
  &state=H4sIAAAAAAAAA...  (Cognito 内部 state，包含原始 state)
  &access_type=offline
```

**Set-Cookie:**
```
csrf-state=qUYHRKEcfcryJha--tVjtIJHSX_dGgZN2MlAwoSzRjB...; HttpOnly; Secure; SameSite=None
```

### Step 4: 用户在 Google 授权

用户在 Google 登录页面完成身份验证和授权。

### Step 5: Google 回调 Cognito

**请求:**
```http
GET https://kiro-prod-us-east-1.auth.us-east-1.amazoncognito.com/oauth2/idpresponse
  ?state=H4sIAAAAAAAAA...
  &code=4/0Ab32j93QclKESD0IpJfehnABqIWPf6KqStbt64laGusb_mWJqfVymyGGFn2KygbMZnpGVQ
  &scope=email+openid+https://www.googleapis.com/auth/userinfo.email
  &authuser=0
  &prompt=none
```

### Step 6: Cognito 回调 Kiro 前端

**响应:**
```http
HTTP 302
Location: https://app.kiro.dev/signin/oauth
  ?code=3f0d5a84-d116-4dda-a399-496255378f03
  &state=9055d0d5-8b05-45ec-8785-a2e08b43a1c2
```

**Set-Cookie:**
```
cognito="H4sIAAAAAAAAAAH1AAr/WfT3..."; Max-Age=3600; HttpOnly; Secure; SameSite=Lax
```

### Step 7: 前端验证 state

```javascript
// 验证返回的 state 与发起请求时的 state 一致
if (returnedState !== savedState) {
  throw new Error("State mismatch - possible CSRF attack");
}
```

### Step 8: 前端调用 ExchangeToken 接口

**请求:**
```http
POST https://app.kiro.dev/service/KiroWebPortalService/operation/ExchangeToken
Content-Type: application/cbor
smithy-protocol: rpc-v2-cbor
x-kiro-visitorid: 1764520187695-l664b8axz3
amz-sdk-request: attempt=1; max=1
```

**请求体 (CBOR 编码):**
```json
{
  "idp": "Google",
  "code": "3f0d5a84-d116-4dda-a399-496255378f03",
  "codeVerifier": "5AoUKv_kJ4dg8VASWA4TNu0MFC70dg6M2yV4CwJaw0c",
  "redirectUri": "https://app.kiro.dev/signin/oauth"
}
```

### Step 9: 后端返回 Token

**响应头:**
```http
HTTP 200
Content-Type: application/cbor
Set-Cookie: AccessToken=aoaAAAAAGksf_8IqSfYcdgODu7M8z2mXsIq11wOL3_Jclx2pJV15vQD1vYdxIsuUMaD9iYea0KYYi-mT-bGAJzxNgBkc0:MGYCMQDO...; HttpOnly; Secure; SameSite=Lax; Max-Age=604800; Path=/
Set-Cookie: RefreshToken=aorAAAAAGmjGO8n7XIC-JGEryJiBme89mFdqcqZGFTIQ-WDlulH_k576UY67fPnvu5-1DNzsZpho6Xywn00dWnOt8Bkc0:MGUCMG/M...; HttpOnly; Secure; SameSite=Lax; Max-Age=604800; Path=/
Set-Cookie: Idp=Google; HttpOnly; Secure; SameSite=Lax; Max-Age=604800; Path=/
```

**响应体 (CBOR 编码):**
```json
{
  "accessToken": "aoaAAAAAGksf_8IqSfYcdgODu7M8z2mXsIq11wOL3_Jclx2pJV15vQD1vYdxIsuUMaD9iYea0KYYi-mT-bGAJzxNgBkc0:MGYCMQDO...",
  "csrfToken": "eFe3BFmvYl1mTKU9PPHbSwaZY24zPWu9JEZkLcju6CY=",
  "expiresIn": 3600,
  "profileArn": "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK"
}
```

## 关键配置

### Kiro (Cognito)

| 配置项 | 值 |
|--------|-----|
| Cognito User Pool Region | `us-east-1` |
| Cognito Domain | `kiro-prod-us-east-1.auth.us-east-1.amazoncognito.com` |
| Cognito Client ID | `59bd15eh40ee7pc20h0bkcu7id` |
| Redirect URI | `https://app.kiro.dev/signin/oauth` |
| Token 交换接口 | `/service/KiroWebPortalService/operation/ExchangeToken` |

### Google OAuth (由 Cognito 配置)

| 配置项 | 值 |
|--------|-----|
| Google Client ID | `183617306620-gqedod9q1su19ghqs84m1tje4lp761ks.apps.googleusercontent.com` |
| Google OAuth Endpoint | `https://accounts.google.com/o/oauth2/v2/auth` |
| Cognito Callback | `https://kiro-prod-us-east-1.auth.us-east-1.amazoncognito.com/oauth2/idpresponse` |
| Scope | `email openid` |

## 安全机制

| 机制 | 说明 |
|------|------|
| **PKCE** | 使用 S256 方法，防止授权码拦截攻击 |
| **HttpOnly Cookie** | Token 存储在 HttpOnly Cookie，JS 无法访问 |
| **SameSite=Lax** | 防止 CSRF 攻击 |
| **state 参数** | 随机 UUID，验证请求来源 |

## PKCE 实现

```javascript
// 生成 code_verifier (43-128 字符的随机字符串)
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

// 生成 code_challenge
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

// Base64 URL 编码
function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
```

## 支持的身份提供商

- **Google** - `identity_provider=Google`
- **Github** - `identity_provider=Github`


---

## Token 刷新

登录成功后，AccessToken 有效期为 3600 秒（1小时）。过期前需要调用 RefreshToken 刷新。

### RefreshToken 请求

**端点**: `POST /service/KiroWebPortalService/operation/RefreshToken`

**请求头**:
```http
Content-Type: application/cbor
Accept: application/cbor
smithy-protocol: rpc-v2-cbor
Cookie: AccessToken=...; SessionToken=...; Idp=Google
```

**请求体 (CBOR)**:
```json
{
  "isEmailRequired": true,
  "origin": "KIRO_IDE"
}
```

### RefreshToken 响应

**响应头**:
```http
Set-Cookie: AccessToken=<new_token>; HttpOnly; Secure; SameSite=Lax; Max-Age=604800; Path=/
Set-Cookie: SessionToken=<new_session>; HttpOnly; Secure; SameSite=Lax; Max-Age=604800; Path=/
```

**响应体 (CBOR)**:
```json
{
  "accessToken": "aoaAAAAA...",
  "csrfToken": "xxx=",
  "expiresIn": 3600
}
```

> 详细文档见 [RefreshToken.md](./3.RefreshToken.md)

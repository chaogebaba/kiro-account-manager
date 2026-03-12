# AWS IAM Identity Center (Device Authorization Flow)

## 概述

**AWS IAM Identity Center** (原 AWS SSO) 使用 Device Authorization Flow 进行身份认证。

支持两种 IdC 类型：

| 类型 | Provider | Start URL |
|------|----------|-----------|
| **AWS Builder ID** | BuilderId | `https://view.awsapps.com/start` |
| **IAM Identity Center (Enterprise)** | Enterprise | 用户自定义 (如 `https://d-xxx.awsapps.com/start`) |

两种类型使用相同的 AWS SSO OIDC 协议，只是 `startUrl` / `issuerUrl` 不同。

### 涉及的服务

| 服务 | 端点 | 用途 |
|------|------|------|
| **AWS SSO OIDC** | `oidc.{region}.amazonaws.com` | 客户端注册、设备授权、Token 获取 |
| **AWS SSO Portal** | `portal.sso.{region}.amazonaws.com` | 身份验证、设备会话 |

### 与 KiroWebPortalService 的区别

| 项目 | KiroWebPortalService | AWS IAM Identity Center |
|------|---------------------|------------------------|
| 协议 | Smithy RPC v2 CBOR | REST JSON |
| 端点 | `app.kiro.dev` | `oidc.amazonaws.com` / `portal.sso.amazonaws.com` |
| 认证方式 | Cookie (AccessToken, SessionToken) | Bearer Token (JWE) |
| 适用场景 | Web OAuth (Google/Github) | BuilderId / Enterprise |

---

## 流程图

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  桌面应用    │     │  SSO Portal  │     │    OIDC     │
└─────────────┘     └──────────────┘     └─────────────┘
       │                   │                    │
       │ 1. RegisterClient │                    │
       │───────────────────────────────────────>│
       │<───────────────────────────────────────│
       │   clientId, clientSecret               │
       │                   │                    │
       │ 2. DeviceAuthorization                 │
       │───────────────────────────────────────>│
       │<───────────────────────────────────────│
       │   deviceCode, userCode                 │
       │                   │                    │
       │ 3. WhoAmI (验证已有 Token)              │
       │──────────────────>│                    │
       │<──────────────────│                    │
       │   userIdentifier  │                    │
       │                   │                    │
       │ 4. GetDeviceSessionToken               │
       │──────────────────>│                    │
       │<──────────────────│                    │
       │   deviceSessionToken (JWT)             │
       │                   │                    │
       │ 5. AcceptUserCode │                    │
       │───────────────────────────────────────>│
       │<───────────────────────────────────────│
       │   authorizationResumptionContext       │
       │                   │                    │
       │ 6. ConsentDetails (获取权限详情)        │
       │───────────────────────────────────────>│
       │<───────────────────────────────────────│
       │   clientName, consentDetails           │
       │                   │                    │
       │ 7. ApproveDeviceAuthorization          │
       │───────────────────────────────────────>│
       │<───────────────────────────────────────│
       │                   │                    │
       │ 8. CreateToken (轮询)                  │
       │───────────────────────────────────────>│
       │<───────────────────────────────────────│
       │   accessToken, refreshToken            │
```

---

## API 详解

### 1. RegisterClient - 注册 OIDC 客户端

**端点**: `POST https://oidc.{region}.amazonaws.com/client/register`

**请求**:
```json
{
  "clientName": "Kiro-BuilderId",
  "clientType": "public",
  "scopes": [
    "codewhisperer:completions",
    "codewhisperer:analysis",
    "codewhisperer:conversations",
    "codewhisperer:transformations",
    "codewhisperer:taskassist"
  ],
  "grantTypes": ["authorization_code", "refresh_token"],
  "redirectUris": ["http://127.0.0.1/oauth/callback"],
  "issuerUrl": "https://view.awsapps.com/start"
}
```

**响应**:
```json
{
  "clientId": "xxx",
  "clientSecret": "xxx",
  "clientIdIssuedAt": 1764520000,
  "clientSecretExpiresAt": 1767112000
}
```

---

### 2. DeviceAuthorization - 发起设备授权

**端点**: `POST https://oidc.{region}.amazonaws.com/device_authorization`

**请求**:
```json
{
  "clientId": "xxx",
  "clientSecret": "xxx",
  "startUrl": "https://view.awsapps.com/start"
}
```

**响应**:
```json
{
  "deviceCode": "xxx",
  "userCode": "XXXX-XXXX",
  "verificationUri": "https://device.sso.{region}.amazonaws.com/",
  "verificationUriComplete": "https://device.sso.{region}.amazonaws.com/?user_code=XXXX-XXXX",
  "expiresIn": 600,
  "interval": 1
}
```

---

### 3. WhoAmI - 验证用户身份

**端点**: `GET https://portal.sso.{region}.amazonaws.com/token/whoAmI`

**请求头**:
```http
Authorization: Bearer <已有的 JWE Token>
Accept: application/json
```

**响应结构**:
```typescript
interface WhoAmIResponse {
  userIdentifier: string;           // Base64 编码: "accountId/directoryId/identityStoreUserId"
  token: string | null;
  createDate: number;               // Token 创建时间戳
  tokenType: "NATIVE";              // 认证类型
  expireDate: number;               // Token 过期时间戳 (约30天)
  accountId: string;                // AWS 账户 ID
  directoryId: string;              // IAM Identity Center 目录 ID
  authenticationType: "NATIVE";
  identityStoreUserId: string;      // 用户唯一标识
  originSessionId: string;          // 原始会话 ID
}
```

**响应示例**:
```json
{
  "userIdentifier": "NDMyNjc3MTk2Mjc4L2QtOTA2NzY0MmFjNy80NGE4NTQ2OC00MGUxLTcwOGUtZTAxOC0wMWNlODFmMTJjZjU=",
  "accountId": "432677196278",
  "directoryId": "d-9067642ac7",
  "authenticationType": "NATIVE",
  "identityStoreUserId": "44a85468-40e1-708e-e018-01ce81f12cf5",
  "tokenType": "NATIVE",
  "createDate": 1764863388000,
  "expireDate": 1767455385000
}
```

---

### 4. GetDeviceSessionToken - 获取设备会话令牌

**端点**: `POST https://portal.sso.{region}.amazonaws.com/session/device`

**请求头**:
```http
Authorization: Bearer <已有的 JWE Token>
Content-Type: application/json
```

**请求体**: `{}`

**响应结构**:
```typescript
interface GetDeviceSessionTokenResponse {
  token: string;  // 设备会话 JWT (JWE 格式)
}
```

---

### 5. AcceptUserCode - 接受用户代码

**端点**: `POST https://oidc.{region}.amazonaws.com/device_authorization/accept_user_code`

**请求结构**:
```typescript
interface AcceptUserCodeRequest {
  userCode: string;  // 用户输入的验证码 (如 "XXXX-XXXX")
}
```

**响应**:
```json
{
  "authorizationResumptionContext": "<加密 blob>"
}
```

---

### 6. ConsentDetails - 获取授权同意详情

**端点**: `POST https://oidc.{region}.amazonaws.com/consent_details`

**请求结构**:
```typescript
interface ConsentDetailsRequest {
  authorizationResumptionContext: string;  // 授权恢复上下文 (加密 blob)
  clientId: string;                        // 客户端 ID
  clientType: "public" | "confidential";   // 客户端类型
  userSessionId: string;                   // 用户会话 JWT
}
```

**响应结构**:
```typescript
interface ConsentDetailsResponse {
  clientName: string;                      // 客户端名称 (如 "Kiro IDE")
  consentDetails: ConsentDetail[];
  nextToken: string | null;
}

interface ConsentDetail {
  applicationName: string;                 // 应用名称 (如 "Kiro")
  descriptions: ConsentDescription[];
}

interface ConsentDescription {
  detailedTitle: string;
  longDescription: string;
  resourceType: string;                    // 资源类型
  shortDescription: string;
}
```

**响应示例 (Kiro 权限)**:
```json
{
  "clientName": "Kiro IDE",
  "consentDetails": [{
    "applicationName": "Kiro",
    "descriptions": [
      {
        "resourceType": "completions",
        "shortDescription": "Enable access to Kiro inline code suggestions."
      },
      {
        "resourceType": "conversations",
        "shortDescription": "Enable access to Kiro chat."
      },
      {
        "resourceType": "analysis",
        "shortDescription": "Enable access to Kiro code analysis."
      },
      {
        "resourceType": "code transformations",
        "shortDescription": "Enable access to Kiro Agent for code transformation."
      },
      {
        "resourceType": "feature development",
        "shortDescription": "Enable access to Kiro Agent for software development."
      }
    ]
  }]
}
```

---

### 7. ApproveDeviceAuthorization - 批准设备授权

**端点**: `POST https://oidc.{region}.amazonaws.com/device_authorization/associate_token`

**请求结构**:
```typescript
interface ApproveDeviceAuthorizationRequest {
  authorizationResumptionContext: string;  // 授权恢复上下文
  userSessionId: string;                   // 用户会话 JWT
}
```

**响应结构**:
```typescript
interface ApproveDeviceAuthorizationResponse {
  location?: string;  // 重定向 URL (AuthCodeGrant 时返回)
}
```

---

### 8. CreateToken - 获取 Token (轮询)

**端点**: `POST https://oidc.{region}.amazonaws.com/token`

**请求**:
```json
{
  "clientId": "xxx",
  "clientSecret": "xxx",
  "grantType": "urn:ietf:params:oauth:grant-type:device_code",
  "deviceCode": "xxx"
}
```

**轮询中响应** (HTTP 400):
```json
{
  "error": "authorization_pending",
  "error_description": "User has not yet completed authorization"
}
```

**成功响应**:
```json
{
  "access_token": "aoaAAAAA...",
  "refresh_token": "aorAAAAA...",
  "token_type": "Bearer",
  "expires_in": 28800
}
```


---

## 授权类型 (Grant Types)

```typescript
enum GrantType {
  DeviceCodeGrant = "device-code",  // 设备代码授权 (Kiro IDE 使用)
  AuthCodeGrant = "auth-code"       // 授权码授权
}
```

---

## 授权状态机

```typescript
enum ConsentState {
  Consent = 0,        // 等待用户同意
  Cancelled = 1,      // 用户取消
  Successful = 2,     // 授权成功
  MissingRedirect = 3 // 缺少重定向 URL
}
```

---

## Token 结构 (JWE 格式)

### Header 解码示例
```json
{
  "enc": "A256GCM",        // 加密算法: AES-256-GCM
  "tag": "DiojnNCZfuyRnEPv",
  "alg": "A256GCMKW",      // 密钥包装算法
  "iv": "Phr6uQqwp-lpPfST" // 初始化向量
}
```

### 安全特性
- **加密算法**: AES-256-GCM
- **密钥管理**: AWS KMS
- **会话绑定**: 每个设备授权绑定到特定用户会话
- **权限范围明确**: 用户可清楚看到授权的具体权限
- **可撤销**: 用户可随时取消授权

---

## 本地缓存

**文件**: `~/.aws/sso/cache/kiro-auth-token.json`

```json
{
  "accessToken": "aoaAAAAA...",
  "refreshToken": "aorAAAAA...",
  "expiresAt": "2025-12-05T07:54:17.089Z",
  "clientIdHash": "e909a0580879b06ece1202964fbe9dda95ea4ce3",
  "authMethod": "IdC",
  "provider": "BuilderId",
  "region": "us-east-1"
}
```

---

## 与普通 Device Flow 的区别

| 项目 | 普通 Device Flow | 无感换号 |
|------|-----------------|---------|
| 用户操作 | 打开浏览器，输入 userCode | 无需操作 |
| 需要已有 Token | ❌ | ✅ |
| 自动批准 | ❌ | ✅ (通过 ApproveDeviceAuthorization) |
| 适用场景 | 首次登录 | 换号/刷新 |

---

## 端点汇总

| 端点 | 方法 | 服务 | 用途 |
|------|------|------|------|
| `/client/register` | POST | OIDC | 注册客户端 |
| `/device_authorization` | POST | OIDC | 发起设备授权 |
| `/token/whoAmI` | GET | SSO Portal | 验证身份 |
| `/session/device` | POST | SSO Portal | 获取设备会话 |
| `/device_authorization/accept_user_code` | POST | OIDC | 接受用户代码 |
| `/consent_details` | POST | OIDC | 获取权限详情 |
| `/device_authorization/associate_token` | POST | OIDC | 批准授权 |
| `/device_authorization/cancel` | POST | OIDC | 取消授权 |
| `/token` | POST | OIDC | 获取 Token |

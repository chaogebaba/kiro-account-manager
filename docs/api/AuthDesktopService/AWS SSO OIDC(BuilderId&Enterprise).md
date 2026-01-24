# IdC 登录流程 (AWS SSO OIDC)

Kiro 桌面端使用 **AWS SSO OIDC** (OpenID Connect) 协议进行身份认证。

## IdC 登录类型

IdC (Identity Center) 登录有两种类型，都使用相同的 AWS SSO OIDC 协议，区别在于身份提供商：

### 1. AWS Builder ID (个人账号)

- **Provider**: `BuilderId`
- **Start URL**: `https://view.awsapps.com/start`
- **适用场景**: 个人开发者、免费用户
- **特点**:
  - 免费注册，无需 AWS 账户
  - 使用邮箱注册，支持任意邮箱
  - 独立于 AWS 账户体系
  - Kiro 主要使用这种方式

### 2. IAM Identity Center (企业账号)

- **Provider**: `Enterprise`
- **Start URL**: 用户自定义 (如 `https://d-xxxxxxxxxx.awsapps.com/start`)
- **适用场景**: 企业/组织用户
- **特点**:
  - 需要 AWS 组织管理员配置
  - 支持 SSO 集成 (Okta, Azure AD, Google Workspace 等)
  - 可绑定多个 AWS 账户
  - 由企业 IT 管理员统一管理

### 对比

| 项目 | AWS Builder ID | IAM Identity Center |
|------|----------------|---------------------|
| 注册方式 | 自助注册 | 管理员邀请 |
| 费用 | 免费 | 需 AWS 组织 |
| Start URL | 固定 | 自定义 |
| 身份管理 | AWS 托管 | 企业自管/SSO |
| 适用人群 | 个人开发者 | 企业团队 |

> **注意**: 两种类型的 API 调用流程完全相同，只是 `issuerUrl` (Start URL) 不同。

## 流程图

```
┌─────────────┐     ┌───────────────┐     ┌──────────────────────┐
│  Kiro IDE   │     │ Local Server  │     │  AWS OIDC Service    │
│  (Client)   │     │ (127.0.0.1)   │     │ (oidc.*.amazonaws)   │
└──────┬──────┘     └───────┬───────┘     └──────────┬───────────┘
       │                    │                        │
       │ 1. Start local server                       │
       │───────────────────>│                        │
       │                    │                        │
       │ 2. RegisterClient  │                        │
       │─────────────────────────────────────────────>
       │<────────────────────────────────────────────│
       │    (clientId, clientSecret)                 │
       │                    │                        │
       │ 3. Generate PKCE (code_verifier, challenge) │
       │                    │                        │
       │ 4. Open browser → Authorize                 │
       │─────────────────────────────────────────────>
       │                    │                        │
       │                    │ 5. User logs in        │
       │                    │<───────────────────────│
       │                    │    (redirect with code)│
       │                    │                        │
       │ 6. CreateToken     │                        │
       │─────────────────────────────────────────────>
       │<────────────────────────────────────────────│
       │  (accessToken, refreshToken)                │
       │                    │                        │
       │ 7. GetUsageLimits  │                        │
       │─────────────────────────────────────────────>
       │<────────────────────────────────────────────│
       │  (quota, email, subscription)               │
       └────────────────────┴────────────────────────┘
```

---

## 1. RegisterClient - 注册客户端

**端点**: `POST https://oidc.{region}.amazonaws.com/client/register`

**请求结构**:
```typescript
interface RegisterClientRequest {
  clientName: string;           // "Kiro IDE"
  clientType: string;           // "public"
  scopes: string[];             // ["codewhisperer:completions", ...]
  grantTypes: string[];         // ["authorization_code", "refresh_token"]
  redirectUris: string[];       // ["http://127.0.0.1/oauth/callback"]
  issuerUrl: string;            // Start URL
}
```

**响应结构**:
```typescript
interface RegisterClientResponse {
  clientId: string;
  clientSecret: string;
  clientIdIssuedAt: number;       // Unix timestamp
  clientSecretExpiresAt: number;  // Unix timestamp
}
```

**Scopes**:
- `codewhisperer:completions` - 代码补全
- `codewhisperer:analysis` - 代码分析
- `codewhisperer:conversations` - 对话
- `codewhisperer:transformations` - 代码转换
- `codewhisperer:taskassist` - 任务助手

---

## 2. DeviceAuthorization - 设备授权 (可选)

**端点**: `POST https://oidc.{region}.amazonaws.com/device_authorization`

**请求结构**:
```typescript
interface DeviceAuthorizationRequest {
  clientId: string;
  clientSecret: string;
  startUrl: string;  // "https://view.awsapps.com/start"
}
```

**响应结构**:
```typescript
interface DeviceAuthorizationResponse {
  deviceCode: string;
  userCode: string;                  // "XXXX-XXXX"
  verificationUri: string;           // "https://device.sso.{region}.amazonaws.com/"
  verificationUriComplete: string;   // 带 user_code 的完整 URL
  expiresIn: number;                 // 600 秒
  interval: number;                  // 轮询间隔 1 秒
}
```

---

## 3. CreateToken - 获取 Token

**端点**: `POST https://oidc.{region}.amazonaws.com/token`

**请求结构**:
```typescript
interface CreateTokenRequest {
  clientId: string;
  clientSecret: string;
  grantType: "authorization_code" | "refresh_token" | "urn:ietf:params:oauth:grant-type:device_code";
  // 授权码模式
  code?: string;
  codeVerifier?: string;
  redirectUri?: string;
  // 设备码模式
  deviceCode?: string;
  // 刷新模式
  refreshToken?: string;
}
```

**响应结构**:
```typescript
interface CreateTokenResponse {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  tokenType: string;         // "Bearer"
  expiresIn: number;         // 28800 秒 (8小时)
  awsSsoAppSessionId?: string;
}
```

**轮询错误**:
```typescript
interface TokenPendingError {
  error: "authorization_pending" | "slow_down" | "expired_token" | "access_denied";
  error_description: string;
}
```

---

## 4. RefreshToken - 刷新 Token

**端点**: `POST https://oidc.{region}.amazonaws.com/token`

**请求**: `grantType: "refresh_token"`, `refreshToken: string`

**响应**: 同 CreateTokenResponse

---

## 5. GetUsageLimits - 获取配额

**端点**: `GET https://codewhisperer.us-east-1.amazonaws.com/getUsageLimits`

**Query 参数**:
- `isEmailRequired=true`
- `origin=AI_EDITOR`
- `profileArn=arn:aws:codewhisperer:...`

**请求头**: `Authorization: Bearer {accessToken}`

**响应结构**:
```typescript
interface GetUsageLimitsResponse {
  daysUntilReset: number;
  nextDateReset: number;
  subscriptionInfo: {
    subscriptionTitle: string;    // "KIRO PRO+"
    type: string;
    overageCapability: string;
    upgradeCapability: string;
  };
  usageBreakdownList: [{
    usageLimit: number;
    currentUsage: number;
    resourceType: string;         // "CREDIT"
    currency: string;             // "USD"
    overageRate: number;
    overageCap: number;
    freeTrialInfo?: {
      usageLimit: number;
      currentUsage: number;
      freeTrialExpiry: number;
      freeTrialStatus: string;    // "ACTIVE" | "EXPIRED"
    };
    bonuses?: [{
      bonusCode: string;
      displayName: string;
      usageLimit: number;
      currentUsage: number;
      expiresAt: number;
      status: string;             // "ACTIVE" | "EXHAUSTED" | "EXPIRED"
    }];
  }];
  userInfo: {
    email: string;
    userId: string;
  };
}
```

---

## 本地缓存

**Token 缓存**: `~/.aws/sso/cache/kiro-auth-token.json`
```typescript
interface TokenCacheData {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;        // ISO 8601
  clientIdHash: string;     // SHA1(startUrl)
  authMethod: "IdC";
  provider: "BuilderId" | "Enterprise";
  region: string;
}
```

**客户端缓存**: `~/.aws/sso/cache/{clientIdHash}.json`
```json
{
  "clientId": "...",
  "clientSecret": "...",
  "expiresAt": "2025-01-01T00:00:00.000Z"
}
```

---

## 与 Social 对比

| 项目 | Social | IdC |
|------|--------|-----|
| 认证服务 | Desktop Auth API | AWS SSO OIDC |
| 需要 clientId/Secret | ❌ | ✅ |
| csrfToken | ✅ | ❌ |
| Token 过期 | 3600秒 (1小时) | 28800秒 (8小时) |
| bonuses.description | ✅ | ❌ |
| bonuses.redeemedAt | ✅ | ❌ |
| WithPrecision 字段 | ❌ | ✅ |

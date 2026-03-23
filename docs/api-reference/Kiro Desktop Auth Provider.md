# Kiro Desktop Auth Provider 源码分析

> 来源: `C:\Users\12925\AppData\Local\Programs\Kiro\resources\app\extensions\kiro.kiro-agent\packages\kiro-shared\dist\social-auth-provider-cN_RAEO7.js`

## 概述

Kiro Desktop 有两种认证提供者：

- **SocialAuthProvider** - Google/GitHub 登录，使用 Desktop Auth Service
- **IDCAuthProvider** - BuilderId/Enterprise 登录，使用 AWS SSO OIDC

---

## 一、SocialAuthProvider (Google/GitHub)

### 认证流程

```
1. 生成 PKCE (codeVerifier + codeChallenge)
2. 调用 authServiceClient.login() 打开浏览器
3. 用户在浏览器完成登录
4. 通过 Deep Link 回调 kiro://kiro.kiroAgent/authenticate-success
5. 解析回调 URL 获取 code
6. 调用 authServiceClient.createToken() 交换 token
```

### 关键常量

```javascript
const REDIRECT_URI = "kiro://kiro.kiroAgent/authenticate-success"
const REDIRECT_TIMEOUT = 600000  // 10 分钟超时
```

### 核心方法

#### authenticate - 发起认证

```javascript
async authenticate(options) {
  const { invitationCode, provider } = options
  const redirectUri = REDIRECT_URI
  const state = crypto.randomUUID()
  const codeVerifier = crypto.randomBytes(32).toString("base64url")
  const codeChallenge = crypto.createHash("sha256")
    .update(codeVerifier)
    .digest()
    .toString("base64url")
  
  // 打开浏览器登录
  await this.authServiceClient.login({ provider, redirectUri, codeChallenge, state })
  
  // 等待 Deep Link 回调
  const code = await withTimeout(this.handleCodeResponse(state), REDIRECT_TIMEOUT)
  
  // 交换 token
  const response = await this.authServiceClient.createToken({
    code,
    codeVerifier,
    redirectUri,
    invitationCode
  })
  
  return this.tokenResponseToToken(response, provider)
}
```

#### refreshToken - 刷新 token

```javascript
async refreshToken(token) {
  const { refreshToken, profileArn, provider } = token
  const token2 = await this.authServiceClient.refreshToken({ refreshToken })
  token2.profileArn = profileArn
  return this.tokenResponseToToken(token2, provider)
}
```

#### deleteAccount - 删除账号

```javascript
async deleteAccount(token) {
  return this.authServiceClient.deleteAccount(token.accessToken)
}
```

### Token 结构

```typescript
interface SocialToken {
  accessToken: string
  refreshToken: string
  profileArn?: string
  expiresAt: string      // ISO 格式
  authMethod: "social"
  provider: string       // "Google" | "Github"
}
```

---

## 二、IDCAuthProvider (BuilderId/Enterprise)

### 认证流程 (Authorization Code Flow)

```
1. 注册客户端 (registerClient)
2. 启动本地 HTTP 服务器 (AuthSSOServer)
3. 生成 PKCE (codeVerifier + codeChallenge)
4. 打开浏览器到 AWS OIDC authorize 端点
5. 用户完成授权后重定向回本地服务器
6. 本地服务器接收 code
7. 调用 ssoClient.createToken() 交换 token
```

### 关键常量

```javascript
const BUILDER_ID_START_URL = "https://view.awsapps.com/start"
const INTERNAL_SSO_START_URL = "https://amzn.awsapps.com/start"
const CLIENT_REG_INVALIDATION_OFFSET_SECONDS = 15 * 60  // 15 分钟
const GRANT_SCOPES = ["completions", "analysis", "conversations", "transformations", "taskassist"]
```

### 核心方法

#### registerClient - 注册客户端

```javascript
async registerClient(startUrl, region, hasUserProvidedInput = false) {
  const clientIdHash = this.getClientIdHash(startUrl)
  const ssoClient = new SSOOIDCClient(region)
  
  const clientRegistrationResp = await ssoClient.registerClient({
    clientName: "Kiro IDE",
    clientType: "public",
    scopes: this.scopes,  // ["codewhisperer:completions", ...]
    grantTypes: ["authorization_code", "refresh_token"],
    redirectUris: ["http://127.0.0.1/oauth/callback"],
    issuerUrl: startUrl
  }, hasUserProvidedInput)
  
  const clientReg = {
    clientId: clientRegistrationResp.clientId,
    clientSecret: clientRegistrationResp.clientSecret,
    expiresAt: new Date(clientRegistrationResp.clientSecretExpiresAt * 1000).toISOString()
  }
  
  this.storage.writeClientRegistration(clientIdHash, clientReg)
  return clientReg
}
```

#### authenticate - 发起认证

```javascript
async authenticate(options) {
  const startUrl = this.getStartUrl(options)
  const region = options.region || "us-east-1"
  const ssoClient = new SSOOIDCClient(region)
  
  // 注册客户端
  const clientRegistration = await this.registerClient(startUrl, region)
  
  // 启动本地服务器
  const state = crypto.randomUUID()
  this.authServer = await AuthSSOServer.init(state)
  await this.authServer.start()
  
  // 生成 PKCE
  const codeVerifier = crypto.randomBytes(32).toString("base64url")
  const codeChallenge = crypto.createHash("sha256")
    .update(codeVerifier)
    .digest()
    .toString("base64url")
  
  const redirectUri = this.authServer.redirectUri  // http://127.0.0.1:{port}/oauth/callback
  
  // 构建授权 URL
  const parameters = new URLSearchParams({
    response_type: "code",
    client_id: clientRegistration.clientId,
    redirect_uri: redirectUri,
    scopes: this.scopes.join(","),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  })
  const authorizeUrl = `https://oidc.${region}.amazonaws.com/authorize?${parameters.toString()}`
  
  // 打开浏览器
  await vscode.env.openExternal(vscode.Uri.parse(authorizeUrl))
  
  // 等待回调
  const code = await this.authServer.waitForAuthorization()
  
  // 交换 token
  const response = await ssoClient.createToken({
    clientId: clientRegistration.clientId,
    clientSecret: clientRegistration.clientSecret,
    grantType: "authorization_code",
    redirectUri,
    code,
    codeVerifier
  })
  
  return this.tokenResponseToToken(response, this.getClientIdHash(startUrl), options.provider, region)
}
```

#### refreshToken - 刷新 token

```javascript
async refreshToken(token) {
  const { refreshToken, clientIdHash, provider, region } = token
  const clientToken = this.storage.readClientRegistration(clientIdHash)
  const tokenRegion = region || "us-east-1"
  const ssoClient = new SSOOIDCClient(tokenRegion)
  
  if (!clientToken || this.isClientRegistrationExpired(clientToken)) {
    throw new InvalidIdCAuthError("IdC auth: No valid client registration found")
  }
  
  const token2 = await ssoClient.createToken({
    clientId: clientToken.clientId,
    clientSecret: clientToken.clientSecret,
    refreshToken,
    grantType: "refresh_token"
  })
  
  return this.tokenResponseToToken(token2, clientIdHash, provider, tokenRegion)
}
```

#### deleteAccount - 删除账号

```javascript
async deleteAccount(token) {
  if (token.provider === "BuilderId") {
    return this.authServiceClient.deleteAccount(token.accessToken)
  } else {
    throw new Error("Account deletion not supported for enterprise auth")
  }
}
```

### clientIdHash 计算

```javascript
getClientIdHash(startUrl) {
  return crypto.createHash("sha1")
    .update(JSON.stringify({ startUrl }))
    .digest("hex")
}
```

### Token 结构

```typescript
interface IdCToken {
  accessToken: string
  refreshToken: string
  expiresAt: string      // ISO 格式
  clientIdHash: string   // SHA1 hash
  authMethod: "IdC"
  provider: string       // "BuilderId" | "Enterprise"
  region: string         // "us-east-1"
}
```

### 客户端注册存储

存储路径: `~/.aws/sso/cache/{clientIdHash}.json`

```typescript
interface ClientRegistration {
  clientId: string
  clientSecret: string
  expiresAt: string  // ISO 格式
}
```

---

## 三、AuthSSOServer (本地 HTTP 服务器)

用于接收 OAuth 回调的本地 HTTP 服务器。

### 关键配置

```javascript
const baseUrl = "http://127.0.0.1"
const oauthCallback = "/oauth/callback"
const authenticationFlowTimeoutInMs = 600000   // 10 分钟
const authenticationWarningTimeoutInMs = 60000 // 1 分钟警告
const listenTimeoutMs = 10000                  // 10 秒启动超时
```

### 回调处理

```javascript
handleAuthentication(parameters, response) {
  const error = parameters.get("error")
  if (error) {
    // 处理错误
    return
  }
  
  const code = parameters.get("code")
  if (!code) {
    throw new MissingCodeError()
  }
  
  const state = parameters.get("state")
  if (state !== this.state) {
    throw new InvalidStateError()
  }
  
  this.deferred.resolve(code)
}
```

---

## 四、与项目实现对比

### SocialAuthProvider

项目实现位置: `src-tauri/src/kiro_auth_client.rs` + `src-tauri/src/providers/social.rs`

| 功能 | Kiro Desktop | 项目实现 | 一致性 |
|------|-------------|----------|--------|
| login URL 拼接 | ✅ | ✅ | 完全一致 |
| createToken 参数 | ✅ | ✅ | 完全一致 |
| refreshToken | ✅ | ✅ | 完全一致 |
| deleteAccount | ✅ | ✅ | 完全一致 |
| Deep Link 回调 | kiro:// | 自定义 scheme | 不同 |

### IDCAuthProvider

项目实现位置: `src-tauri/src/providers/idc.rs` + `src-tauri/src/aws_sso_client.rs`

| 功能 | Kiro Desktop | 项目实现 | 一致性 |
|------|-------------|----------|--------|
| 认证流程 | Authorization Code Flow | Device Flow | **不同** |
| grantTypes | ["authorization_code", "refresh_token"] | ["device_code", "refresh_token"] | **不同** |
| refreshToken | ✅ | ✅ | 完全一致 |
| clientIdHash 计算 | SHA1 | SHA256 | **不同** |

### 说明

1. **Social 认证**: 项目实现与 Kiro Desktop 基本一致
2. **IDC 认证**: 
   - 项目用 Device Flow，Kiro Desktop 用 Authorization Code Flow
   - 但 `refreshToken` 逻辑完全一致
   - 项目的 `idc.rs` 中 `login()` 方法（Device Flow）实际未被调用
   - 只有 `refresh_token()` 方法被使用

---

## 五、端点汇总

### Desktop Auth Service

- 基础路径: `https://prod.us-east-1.auth.desktop.kiro.dev`
- login: `GET /login?idp={provider}&redirect_uri={uri}&code_challenge={challenge}&code_challenge_method=S256&state={state}`
- createToken: `POST /oauth/token`
- refreshToken: `POST /refreshToken`
- deleteAccount: `DELETE /deleteAccount`

### AWS SSO OIDC

- 基础路径: `https://oidc.{region}.amazonaws.com`
- registerClient: `POST /client/register`
- authorize: `GET /authorize`
- createToken: `POST /token`

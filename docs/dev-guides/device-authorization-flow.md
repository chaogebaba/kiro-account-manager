# 设备授权流程详解

> 本文档详细说明 Kiro Account Manager 中 BuilderId 和 Enterprise 的设备授权流程

## 📋 目录

1. [流程概览](#流程概览)
2. [详细步骤](#详细步骤)
3. [PKCE 机制](#pkce-机制)
4. [代码实现](#代码实现)
5. [安全性分析](#安全性分析)

---

## 流程概览

设备授权流程（Device Authorization Flow）是 OAuth 2.0 的一种授权模式，适用于：
- 无浏览器的设备（IoT 设备、智能电视）
- 输入受限的设备（游戏机、机顶盒）
- **桌面应用**（Kiro Account Manager）

### 核心特点

- ✅ 使用 **Authorization Code Flow + PKCE**
- ✅ 本地 HTTP 服务器接收回调
- ✅ 浏览器完成用户授权
- ✅ 安全性高（PKCE 防止授权码拦截）

---

## 详细步骤

### 完整流程图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    设备授权流程（BuilderId/Enterprise）                   │
└─────────────────────────────────────────────────────────────────────────┘

步骤 1：创建 AWS SSO 客户端
┌──────────────────────────────────────────────────────────────────┐
│  Kiro Account Manager                                            │
│                                                                  │
│  let sso_client = AWSSSOClient::new(region);                    │
│                                                                  │
│  • region: "us-east-1" (BuilderId) 或用户指定（Enterprise）      │
│  • 创建 HTTP 客户端，准备调用 AWS SSO API                        │
└──────────────────────────────────────────────────────────────────┘
                          ↓

步骤 2：启动本地 HTTP 服务器
┌──────────────────────────────────────────────────────────────────┐
│  Kiro Account Manager                                            │
│                                                                  │
│  let server = tiny_http::Server::http("127.0.0.1:0")?;         │
│  let port = server.server_addr().to_ip().unwrap().port();      │
│  let redirect_uri = format!("http://127.0.0.1:{}/oauth/callback", port);│
│                                                                  │
│  示例：                                                           │
│  • 端口：54321（随机分配）                                        │
│  • redirect_uri: "http://127.0.0.1:54321/oauth/callback"       │
│                                                                  │
│  ⚠️ 为什么需要本地服务器？                                        │
│  因为 AWS SSO 授权后会重定向到 redirect_uri，需要接收回调        │
└──────────────────────────────────────────────────────────────────┘
                          ↓

步骤 3：注册客户端（Register Client）
┌──────────────────────────────────────────────────────────────────┐
│  Kiro Account Manager → AWS SSO                                  │
│                                                                  │
│  POST https://{region}.awsapps.com/start/user-consent/v2/client │
│  {                                                               │
│    "clientName": "Kiro Account Manager",                        │
│    "clientType": "public",                                       │
│    "scopes": [                                                   │
│      "codewhisperer:completions",                               │
│      "codewhisperer:analysis",                                  │
│      ...                                                         │
│    ],                                                            │
│    "grantTypes": ["authorization_code", "refresh_token"],       │
│    "redirectUris": ["http://127.0.0.1:54321/oauth/callback"],  │
│    "issuerUrl": "https://view.awsapps.com/start"               │
│  }                                                               │
│                                                                  │
│  ← 返回：                                                         │
│  {                                                               │
│    "clientId": "abc123...",                                     │
│    "clientSecret": "xyz789...",                                 │
│    "clientIdIssuedAt": 1234567890,                              │
│    "clientSecretExpiresAt": 0                                   │
│  }                                                               │
│                                                                  │
│  ⚠️ 注意：                                                        │
│  • Enterprise 需要传 hasUserProvidedInput=true                   │
│  • clientSecret 永不过期（clientSecretExpiresAt=0）             │
└──────────────────────────────────────────────────────────────────┘
                          ↓

步骤 4：生成 PKCE 参数
┌──────────────────────────────────────────────────────────────────┐
│  Kiro Account Manager                                            │
│                                                                  │
│  1. 生成 code_verifier（随机 32 字节）                           │
│     ┌─────────────────────────────────────────────────┐         │
│     │ let bytes: Vec<u8> = (0..32).map(|_| rng.gen()) │         │
│     │ code_verifier = base64_url_encode(bytes)        │         │
│     │                                                  │         │
│     │ 示例: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" │         │
│     └─────────────────────────────────────────────────┘         │
│                          ↓                                       │
│  2. 生成 code_challenge（SHA256 哈希）                           │
│     ┌─────────────────────────────────────────────────┐         │
│     │ hasher = SHA256(code_verifier)                  │         │
│     │ code_challenge = base64_url_encode(hasher)      │         │
│     │                                                  │         │
│     │ 示例: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM" │         │
│     └─────────────────────────────────────────────────┘         │
│                          ↓                                       │
│  3. 生成 state（防 CSRF 攻击）                                   │
│     ┌─────────────────────────────────────────────────┐         │
│     │ state = uuid::Uuid::new_v4().to_string()        │         │
│     │                                                  │         │
│     │ 示例: "af0ifjsldkj-52d1-4a9b-a721-348f6b0c0e4f"  │         │
│     └─────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────┘
                          ↓

步骤 5：构建授权 URL
┌──────────────────────────────────────────────────────────────────┐
│  Kiro Account Manager                                            │
│                                                                  │
│  let authorize_url = format!(                                    │
│    "{}?response_type=code&client_id={}&redirect_uri={}&scopes={}&state={}&code_challenge={}&code_challenge_method=S256",│
│    sso_client.get_authorize_url(),                              │
│    client_reg.client_id,                                         │
│    urlencoding::encode(&redirect_uri),                          │
│    urlencoding::encode(&scopes),                                │
│    &state,                                                       │
│    &code_challenge                                               │
│  );                                                              │
│                                                                  │
│  示例 URL：                                                       │
│  https://device.sso.us-east-1.amazonaws.com/                    │
│    ?response_type=code                                           │
│    &client_id=abc123...                                          │
│    &redirect_uri=http%3A%2F%2F127.0.0.1%3A54321%2Foauth%2Fcallback│
│    &scopes=codewhisperer%3Acompletions%2C...                    │
│    &state=af0ifjsldkj-52d1-4a9b-a721-348f6b0c0e4f                │
│    &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM   │
│    &code_challenge_method=S256                                   │
│                                                                  │
│  ⚠️ 注意：只发送 code_challenge，不发送 code_verifier！          │
└──────────────────────────────────────────────────────────────────┘
                          ↓

步骤 6：打开浏览器
┌──────────────────────────────────────────────────────────────────┐
│  Kiro Account Manager                                            │
│                                                                  │
│  open_browser(&authorize_url)?;                                 │
│                                                                  │
│  • Windows: 使用 cmd /c start                                    │
│  • macOS: 使用 open                                              │
│  • Linux: 使用 xdg-open                                          │
│                                                                  │
│  浏览器打开授权页面 →                                             │
└──────────────────────────────────────────────────────────────────┘
                          ↓

步骤 7：用户授权
┌──────────────────────────────────────────────────────────────────┐
│  浏览器 → AWS SSO 授权服务器                                      │
│                                                                  │
│  1. 用户看到授权页面：                                            │
│     ┌─────────────────────────────────────────────────┐         │
│     │  Kiro Account Manager 请求访问您的账号           │         │
│     │                                                  │         │
│     │  权限：                                           │         │
│     │  • 访问 CodeWhisperer 补全                       │         │
│     │  • 访问 CodeWhisperer 分析                       │         │
│     │  • ...                                           │         │
│     │                                                  │         │
│     │  [拒绝]  [允许]                                  │         │
│     └─────────────────────────────────────────────────┘         │
│                                                                  │
│  2. 用户点击"允许"                                                │
│                                                                  │
│  3. AWS SSO 服务器：                                             │
│     • 验证 client_id                                             │
│     • 保存 code_challenge 和 state                              │
│     • 生成授权码（authorization code）                          │
│     • 重定向到 redirect_uri                                      │
└──────────────────────────────────────────────────────────────────┘
                          ↓

步骤 8：回调返回授权码
┌──────────────────────────────────────────────────────────────────┐
│  AWS SSO → 浏览器 → 本地 HTTP 服务器                             │
│                                                                  │
│  浏览器重定向到：                                                 │
│  http://127.0.0.1:54321/oauth/callback?                         │
│      code=SplxlOBeZQQYbYS6WxSbIA                                 │
│      &state=af0ifjsldkj-52d1-4a9b-a721-348f6b0c0e4f              │
│                                                                  │
│  本地服务器接收请求：                                             │
│  1. 解析 URL 参数                                                │
│  2. 验证 state 是否匹配（防 CSRF）                               │
│  3. 提取 code                                                    │
│  4. 返回成功页面给浏览器                                          │
│     ┌─────────────────────────────────────────────────┐         │
│     │  <html>                                          │         │
│     │    <body>                                        │         │
│     │      <h1>授权成功</h1>                            │         │
│     │      <p>您可以关闭此窗口</p>                      │         │
│     │    </body>                                       │         │
│     │  </html>                                         │         │
│     └─────────────────────────────────────────────────┘         │
│  5. 通过 channel 发送 code 给主线程                              │
└──────────────────────────────────────────────────────────────────┘
                          ↓

步骤 9：交换 Token（关键！）
┌──────────────────────────────────────────────────────────────────┐
│  Kiro Account Manager → AWS SSO                                  │
│                                                                  │
│  POST https://{region}.awsapps.com/token                        │
│  {                                                               │
│    "clientId": "abc123...",                                     │
│    "clientSecret": "xyz789...",                                 │
│    "grantType": "authorization_code",                           │
│    "code": "SplxlOBeZQQYbYS6WxSbIA",                            │
│    "codeVerifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",│
│    "redirectUri": "http://127.0.0.1:54321/oauth/callback"       │
│  }                                                               │
│                                                                  │
│  ⚠️ 注意：这次发送的是 code_verifier（原始值）！                  │
│                                                                  │
│  AWS SSO 服务器验证：                                            │
│  1. 验证 clientId 和 clientSecret                               │
│  2. 验证 code 是否有效且未过期                                   │
│  3. 验证 PKCE：                                                  │
│     ┌─────────────────────────────────────────────────┐         │
│     │ saved_challenge = "E9Melhoa2Owv..."             │         │
│     │ computed_challenge = SHA256(code_verifier)      │         │
│     │                                                  │         │
│     │ if saved_challenge == computed_challenge:       │         │
│     │     ✅ 验证通过，颁发 Token                       │         │
│     │ else:                                            │         │
│     │     ❌ 验证失败，拒绝请求                         │         │
│     └─────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────┘
                          ↓

步骤 10：返回 Token
┌──────────────────────────────────────────────────────────────────┐
│  AWS SSO → Kiro Account Manager                                 │
│                                                                  │
│  {                                                               │
│    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",    │
│    "refreshToken": "tGzv3JOkF0XG5Qx2TlKWIA",                    │
│    "idToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",        │
│    "tokenType": "Bearer",                                        │
│    "expiresIn": 3600,                                            │
│    "awsSsoAppSessionId": "session-123..."                       │
│  }                                                               │
│                                                                  │
│  Kiro Account Manager 保存：                                     │
│  • accessToken: 用于调用 API                                     │
│  • refreshToken: 用于刷新 Token                                  │
│  • clientId + clientSecret: 用于后续刷新                         │
│  • region: 用于后续刷新                                          │
│  • startUrl: Enterprise 需要保存                                │
└──────────────────────────────────────────────────────────────────┘

✅ 授权完成！


---

## PKCE 机制

### 什么是 PKCE？

**PKCE** = Proof Key for Code Exchange（授权码交换的证明密钥）

### 核心概念

#### 1. code_verifier（验证码）
```
• 随机生成的 32 字节字符串
• Base64 URL 编码
• 客户端保密，不发送给服务器（步骤 5）
• 只在交换 Token 时发送（步骤 9）
```

#### 2. code_challenge（挑战码）
```
• code_verifier 的 SHA256 哈希值
• Base64 URL 编码
• 在授权请求时发送给服务器（步骤 5）
• 服务器保存，用于后续验证
```

#### 3. code_challenge_method
```
• 哈希算法：S256（SHA256）
• 也支持 plain（不推荐，不安全）
```

### PKCE 验证流程

```
客户端                          服务器
  │                              │
  │ 1. 生成 code_verifier         │
  │    "dBjftJeZ..."              │
  │                              │
  │ 2. 计算 code_challenge        │
  │    SHA256(code_verifier)     │
  │    = "E9Melhoa2Owv..."        │
  │                              │
  │ 3. 发送 code_challenge ────→  │ 保存 code_challenge
  │                              │
  │ 4. 用户授权                   │
  │                              │
  │ 5. 接收 code ←──────────────  │ 生成 code
  │                              │
  │ 6. 发送 code + code_verifier →│
  │                              │
  │                              │ 7. 验证 PKCE：
  │                              │    SHA256(code_verifier)
  │                              │    == saved_challenge?
  │                              │
  │ 8. 接收 Token ←──────────────  │ ✅ 验证通过，颁发 Token
```

### 为什么需要 PKCE？

**传统 OAuth 2.0 的问题**：
```
攻击者可以拦截授权码（code）
    ↓
攻击者用拦截的 code 交换 Token
    ↓
攻击者获得用户的 access_token
```

**PKCE 如何防御**：
```
1. 攻击者拦截了 code
2. 但攻击者没有 code_verifier（客户端保密）
3. 攻击者无法通过服务器的 PKCE 验证
4. 服务器拒绝颁发 Token
```

### PKCE 安全性

| 参数 | 何时生成 | 何时发送 | 谁持有 |
|------|---------|---------|--------|
| **code_verifier** | 授权前 | Token 交换时 | 客户端保密 |
| **code_challenge** | 授权前 | 授权请求时 | 服务器保存 |
| **state** | 授权前 | 授权请求时 | 客户端验证 |
| **code** | 用户授权后 | Token 交换时 | 服务器生成 |

---

## 代码实现

### 生成 PKCE 参数

```rust
// src-tauri/src/auth_social.rs

/// 生成 PKCE code_verifier（32 字节，base64url）
pub fn generate_code_verifier_social() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    base64_url_encode(&bytes)
}

/// 生成 PKCE code_challenge（SHA256 哈希，base64url）
pub fn generate_code_challenge_social(verifier: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let result = hasher.finalize();
    base64_url_encode(&result)
}

fn base64_url_encode(data: &[u8]) -> String {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
    URL_SAFE_NO_PAD.encode(data)
}
```

### 注册客户端

```rust
// src-tauri/src/aws_sso_client.rs

pub async fn register_client(
    &self,
    start_url: &str,
    redirect_uri: &str,
    has_user_provided_input: bool,
) -> Result<ClientRegistration, String> {
    let body = json!({
        "clientName": "Kiro Account Manager",
        "clientType": "public",
        "scopes": GRANT_SCOPES,
        "grantTypes": ["authorization_code", "refresh_token"],
        "redirectUris": [redirect_uri],
        "issuerUrl": start_url,
        "hasUserProvidedInput": has_user_provided_input,  // Enterprise 需要 true
    });

    let response = self.client
        .post(format!("{}/client", self.base_url))
        .json(&body)
        .send()
        .await?;

    let client_reg: ClientRegistration = response.json().await?;
    Ok(client_reg)
}
```


### 构建授权 URL

```rust
// src-tauri/src/providers/idc.rs

let authorize_url = format!(
    "{}?response_type=code&client_id={}&redirect_uri={}&scopes={}&state={}&code_challenge={}&code_challenge_method=S256",
    sso_client.get_authorize_url(),
    client_reg.client_id,
    urlencoding::encode(&redirect_uri),
    urlencoding::encode(&scopes),
    &state,
    &code_challenge
);
```

### 本地服务器接收回调

```rust
// src-tauri/src/providers/idc.rs

std::thread::spawn(move || {
    loop {
        if let Ok(Some(request)) = server_clone.try_recv() {
            let url = request.url().to_string();
            
            if url.starts_with("/oauth/callback") {
                // 解析 URL 参数
                let params: HashMap<_, _> = parse_query_params(&url);

                // 验证 state
                if params.get("state") != Some(&state_clone) {
                    return Err("State 不匹配".to_string());
                }

                // 获取 code
                if let Some(code) = params.get("code") {
                    // 返回成功页面
                    let response = Response::from_string(
                        "<html><body><h1>授权成功</h1><p>您可以关闭此窗口</p></body></html>"
                    );
                    request.respond(response);
                    
                    // 发送 code 给主线程
                    tx.send(Ok(code.to_string()));
                    break;
                }
            }
        }
        std::thread::sleep(Duration::from_millis(100));
    }
});
```

### 交换 Token

```rust
// src-tauri/src/aws_sso_client.rs

pub async fn create_token(
    &self,
    client_id: &str,
    client_secret: &str,
    code: &str,
    code_verifier: &str,
    redirect_uri: &str,
) -> Result<TokenResponse, String> {
    let body = json!({
        "clientId": client_id,
        "clientSecret": client_secret,
        "grantType": "authorization_code",
        "code": code,
        "codeVerifier": code_verifier,  // ← 发送原始值
        "redirectUri": redirect_uri
    });

    let response = self.client
        .post(format!("{}/token", self.base_url))
        .json(&body)
        .send()
        .await?;

    let token_resp: TokenResponse = response.json().await?;
    Ok(token_resp)
}
```

---

## 安全性分析

### 1. PKCE 防止授权码拦截

**攻击场景**：
```
攻击者拦截 HTTP 回调：
http://127.0.0.1:54321/oauth/callback?code=SplxlOBeZQQYbYS6WxSbIA
```

**防御机制**：
```
1. 攻击者只有 code，没有 code_verifier
2. 攻击者尝试交换 Token：
   POST /token
   {
     "code": "SplxlOBeZQQYbYS6WxSbIA",
     "codeVerifier": "猜测的值"  // ❌ 错误
   }
3. 服务器验证：
   SHA256("猜测的值") != saved_challenge
4. 服务器拒绝请求
```

### 2. State 防止 CSRF 攻击

**攻击场景**：
```
攻击者构造恶意链接：
http://127.0.0.1:54321/oauth/callback?code=恶意code&state=伪造state
```

**防御机制**：
```
1. 客户端生成随机 state
2. 客户端保存 state
3. 回调时验证：
   if returned_state != saved_state {
       return Err("State 不匹配");
   }
4. 攻击者无法猜测正确的 state
```

### 3. 本地服务器端口随机

**安全考虑**：
```
• 端口随机分配（0 → 系统分配）
• 避免端口冲突
• 避免端口被预测
```

### 4. 超时机制

**防御机制**：
```
• 10 分钟超时（600 秒）
• 防止服务器长时间占用端口
• 防止用户忘记授权导致资源泄漏
```

### 5. clientSecret 保护

**安全措施**：
```
• clientSecret 存储在本地
• 不通过网络传输（除了 Token 交换）
• 用于刷新 Token 时验证身份
```

---

## BuilderId vs Enterprise

### 相同点

- ✅ 都使用 Authorization Code Flow + PKCE
- ✅ 都需要注册客户端
- ✅ 都需要本地 HTTP 服务器
- ✅ 都使用相同的 PKCE 机制

### 不同点

| 特性 | BuilderId | Enterprise |
|------|-----------|------------|
| **Start URL** | `https://view.awsapps.com/start` | 用户提供 |
| **Region** | `us-east-1`（固定） | 用户提供 |
| **hasUserProvidedInput** | `false` | `true` |
| **保存 startUrl** | ❌ 不保存 | ✅ 保存 |
| **授权页面** | AWS Builder ID | 企业 SSO |

### 为什么 Enterprise 需要 hasUserProvidedInput=true？

```
• Enterprise 使用企业自己的 SSO
• 需要用户提供 startUrl
• AWS SSO 需要知道这是用户主动提供的 URL
• 用于友好的错误提示（如果 URL 错误）
```

---

## 常见问题

### Q1: 为什么不直接使用 Device Code Flow？

**A**: Device Code Flow 适用于无浏览器设备，流程如下：
```
1. 设备显示验证码
2. 用户在另一台设备上输入验证码
3. 设备轮询服务器获取 Token
```

但 Kiro Account Manager 是桌面应用，可以：
- ✅ 打开浏览器
- ✅ 启动本地服务器
- ✅ 接收回调

所以使用 Authorization Code Flow + PKCE 更合适。

### Q2: 为什么需要 clientSecret？

**A**: 虽然是 public client，但 AWS SSO 仍然颁发 clientSecret：
```
• 用于刷新 Token 时验证身份
• 增加安全性
• 防止未授权的刷新请求
```

### Q3: code_verifier 会泄漏吗？

**A**: 不会，因为：
```
• code_verifier 只在客户端生成
• 只在 Token 交换时通过 HTTPS 发送
• 不会出现在 URL 中
• 不会被浏览器历史记录
```

### Q4: 本地服务器安全吗？

**A**: 相对安全：
```
✅ 只监听 127.0.0.1（本地回环）
✅ 端口随机分配
✅ 只接收一次回调就关闭
✅ 验证 state 防止 CSRF
❌ 但本地恶意软件可以拦截
```

---

## 相关文档

- [PKCE 机制详解](./pkce-mechanism.md)
- [OAuth 2.0 规范](https://oauth.net/2/)
- [RFC 7636 - PKCE](https://tools.ietf.org/html/rfc7636)
- [AWS SSO API 文档](../api-reference/aws-sso-api.md)

---

## 更新记录

- 2026-02-02: 创建文档，详细说明设备授权流程

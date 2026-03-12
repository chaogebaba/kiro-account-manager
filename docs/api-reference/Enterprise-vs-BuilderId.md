# Enterprise vs BuilderId 完整对比

## 版本信息
- Kiro IDE 版本: v0.8.140
- 分析日期: 2026-01-23

---

## 核心区别总结

| 特性 | BuilderId | Enterprise |
|------|-----------|------------|
| **用途** | 个人开发者账号 | 企业 IAM Identity Center 账号 |
| **Start URL** | 固定 `https://view.awsapps.com/start` | 用户提供（如 `https://d-90661d346f.awsapps.com/start`） |
| **Region** | 默认 `us-east-1`（可选其他） | 默认 `us-east-1`（支持 16 个 region） |
| **认证流程** | Authorization Code Flow + PKCE | Authorization Code Flow + PKCE（完全相同） |
| **Token 格式** | 完全相同 | 完全相同 |
| **clientIdHash** | SHA1(JSON.stringify({ startUrl })) | SHA1(JSON.stringify({ startUrl }))（相同算法） |
| **错误处理** | 标准错误 | 额外检查 "invalid start url provided" |
| **UI 输入** | 无需额外输入 | 需要输入 Start URL 和 Region |

---

## 1. Start URL 区别

### BuilderId
```javascript
// 固定值，无需用户输入
const BUILDER_ID_START_URL = "https://view.awsapps.com/start"
```

### Enterprise
```javascript
// 用户提供，格式示例：
// https://d-90661d346f.awsapps.com/start
// https://mycompany.awsapps.com/start
```

**为什么 Enterprise 需要用户输入？**
- 每个企业有独立的 IAM Identity Center 实例
- Start URL 是企业特定的，无法预设
- 格式：`https://d-{directory-id}.awsapps.com/start` 或自定义域名

---

## 2. Region 支持

### BuilderId
- 默认：`us-east-1`
- 可选：所有 AWS region（但通常不需要改）
- 原因：BuilderId 是全球统一服务，region 主要影响 API 延迟

### Enterprise
- 默认：`us-east-1`
- **支持 16 个 region**（Kiro IDE 登录页提供选择）
- 原因：企业 IAM Identity Center 按 region 部署，必须匹配企业配置的 region

**支持的 16 个 region**：
```javascript
const awsRegions = [
  'us-east-1',      // US East (N. Virginia)
  'us-east-2',      // US East (Ohio)
  'us-west-1',      // US West (N. California)
  'us-west-2',      // US West (Oregon)
  'ap-south-1',     // Asia Pacific (Mumbai)
  'ap-northeast-1', // Asia Pacific (Tokyo)
  'ap-northeast-2', // Asia Pacific (Seoul)
  'ap-southeast-1', // Asia Pacific (Singapore)
  'ap-southeast-2', // Asia Pacific (Sydney)
  'ca-central-1',   // Canada (Central)
  'eu-central-1',   // Europe (Frankfurt)
  'eu-west-1',      // Europe (Ireland)
  'eu-west-2',      // Europe (London)
  'eu-west-3',      // Europe (Paris)
  'eu-north-1',     // Europe (Stockholm)
  'sa-east-1',      // South America (São Paulo)
]
```

---

## 3. 认证流程（完全相同）

### 流程步骤

```
1. 注册客户端 (registerClient)
   ├─ BuilderId: 使用固定 Start URL
   └─ Enterprise: 使用用户提供的 Start URL

2. 生成 PKCE (code_verifier + code_challenge)
   ├─ 完全相同的算法
   └─ S256 (SHA256)

3. 构建授权 URL
   ├─ 相同的参数：response_type, client_id, redirect_uri, scopes, state, code_challenge
   └─ 相同的 scopes: "codewhisperer:completions", "codewhisperer:analysis"

4. 打开浏览器授权
   ├─ 完全相同的流程
   └─ 用户在浏览器中登录

5. 接收授权码 (code)
   ├─ 完全相同的回调处理
   └─ 验证 state 参数

6. 用授权码换 Token (createToken)
   ├─ 完全相同的 API 调用
   └─ 返回相同格式的 Token

7. 计算 clientIdHash
   ├─ 相同的算法：SHA1(JSON.stringify({ startUrl }))
   └─ BuilderId 和 Enterprise 只是 startUrl 不同
```

### Kiro IDE 源码（行 139343）

```javascript
// 唯一的区别：hasUserProvidedInput 参数
const clientRegistration = await this.registerClient(
  startUrl, 
  region, 
  options2.provider === "Enterprise"  // ← 只有 Enterprise 为 true
)
```

---

## 4. hasUserProvidedInput 参数的作用

### 定义位置（行 139297）

```javascript
async registerClient(startUrl, region, hasUserProvidedInput = false) {
  // ...
  const clientRegistrationResp = await ssoClient.registerClient(
    {
      clientName: "AWS Toolkit for VS Code",
      clientType: "public",
      scopes: GRANT_SCOPES,
      redirectUris: ["http://127.0.0.1/oauth/callback"],
      issuerUrl: startUrl
    },
    hasUserProvidedInput  // ← 传递给底层 API
  )
}
```

### 错误处理逻辑（行 138415-138418）

```javascript
function translateError(error3, hasUserProvidedInput) {
  // ...
  if (error3 instanceof InvalidRequestException) {
    // 只有 Enterprise (hasUserProvidedInput=true) 才检查这个错误
    if (hasUserProvidedInput && 
        "error_description" in error3 && 
        typeof error3.error_description === "string" && 
        error3.error_description.toLowerCase().indexOf("invalid start url provided") > -1) {
      return new InvalidStartUrlError()  // ← 友好的错误提示
    } else {
      return new UnexpectedIssueError("SSOOIDC client: Unexpected InvalidRequestException")
    }
  }
}
```

### 作用总结

**hasUserProvidedInput 的唯一作用**：
- ✅ 当 Enterprise 用户输入错误的 Start URL 时，显示友好的错误提示
- ✅ 告诉用户 "Start URL 无效"，而不是 "未知错误"
- ❌ 不影响认证流程本身
- ❌ 不影响 Token 格式
- ❌ 不影响 clientIdHash 计算

**为什么 BuilderId 不需要？**
- BuilderId 的 Start URL 是固定的，不会出错
- 只有用户输入的 Start URL 才可能出错

---

## 5. Token 格式（完全相同）

### Token 结构

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "ey...",
  "expiresAt": "2026/01/23 15:30:00",
  "provider": "BuilderId" | "Enterprise",
  "authMethod": "IdC",
  "idToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": 28800,
  "region": "us-east-1",
  "clientId": "...",
  "clientSecret": "...",
  "clientIdHash": "...",  // ← SHA1(JSON.stringify({ startUrl }))
  "ssoSessionId": "..."
}
```

### clientIdHash 计算（完全相同）

```javascript
// BuilderId
const startUrl = "https://view.awsapps.com/start"
const clientIdHash = SHA1(JSON.stringify({ startUrl }))
// 结果: "a8b7c6d5e4f3g2h1i0j9k8l7m6n5o4p3q2r1s0t9"

// Enterprise
const startUrl = "https://d-90661d346f.awsapps.com/start"
const clientIdHash = SHA1(JSON.stringify({ startUrl }))
// 结果: "x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0"
```

**关键点**：
- 算法完全相同：SHA1
- 输入格式完全相同：`JSON.stringify({ startUrl })`
- 只是 startUrl 的值不同

---

## 6. 刷新 Token（完全相同）

### 刷新逻辑

```rust
// BuilderId 和 Enterprise 使用相同的刷新逻辑
async fn refresh_token(&self, refresh_token: &str, metadata: RefreshMetadata) -> Result<AuthResult, String> {
    let client_id = metadata.client_id.ok_or("Client ID is required")?;
    let client_secret = metadata.client_secret.ok_or("Client secret is required")?;
    let region = metadata.region.as_deref().unwrap_or(&self.region);

    let sso_client = AWSSSOClient::new(region);
    let token_response = sso_client.refresh_token(&client_id, &client_secret, refresh_token).await?;
    
    // 计算 clientIdHash（使用存储的 start_url）
    let client_id_hash = metadata.client_id_hash.unwrap_or_else(|| 
        Self::compute_client_id_hash(self.get_start_url())
    );
    
    // 返回新的 Token
    Ok(AuthResult { ... })
}
```

**无区别**：
- 相同的 API 调用
- 相同的参数
- 相同的返回格式

---

## 7. 配额获取（完全相同）

### API 调用

```rust
// BuilderId 和 Enterprise 使用相同的 API
let usage = kiro_portal_client.get_usage(&access_token).await?;
```

**无区别**：
- 相同的 API 端点
- 相同的请求格式
- 相同的响应格式

---

## 8. UI 显示区别

### Login.jsx

```jsx
// BuilderId: 直接登录
<button onClick={() => handleLogin('BuilderId')}>
  Builder ID
</button>

// Enterprise: 弹窗输入 Start URL 和 Region
<button onClick={() => handleLogin('Enterprise')}>
  IAM Identity Center
</button>

{showEnterpriseModal && (
  <div>
    <input 
      placeholder="https://d-1234567890.awsapps.com/start"
      value={enterpriseStartUrl}
      onChange={(e) => setEnterpriseStartUrl(e.target.value)}
    />
    <select value={enterpriseRegion} onChange={(e) => setEnterpriseRegion(e.target.value)}>
      {awsRegions.map(region => <option key={region.value}>{region.label}</option>)}
    </select>
  </div>
)}
```

### AddAccountModal.jsx

```jsx
// BuilderId: 只需要 Refresh Token、Client ID、Client Secret
<select value={idcProvider} onChange={(e) => setIdcProvider(e.target.value)}>
  <option value="BuilderId">BuilderId (个人开发者)</option>
  <option value="Enterprise">Enterprise (企业账号)</option>
</select>

// Enterprise: 额外需要 Start URL
{idcProvider === 'Enterprise' && (
  <div>
    <label>Start URL <span className="text-red-500">*</span></label>
    <input 
      placeholder="https://mycompany.awsapps.com/start"
      value={startUrl}
      onChange={(e) => setStartUrl(e.target.value)}
    />
  </div>
)}
```

---

## 9. 我们的实现检查

### ✅ 已正确实现

1. **IdcProvider 统一处理**
   - ✅ BuilderId 和 Enterprise 使用相同的 `IdcProvider`
   - ✅ 通过 `start_url` 参数区分

2. **Start URL 处理**
   - ✅ BuilderId: 使用固定常量 `BUILDER_ID_START_URL`
   - ✅ Enterprise: 使用用户提供的 `start_url`

3. **clientIdHash 计算**
   - ✅ 使用 SHA1 算法
   - ✅ 输入格式：`JSON.stringify({ startUrl })`
   - ✅ 接受 `start_url` 参数

4. **Region 处理**
   - ✅ 默认值：`us-east-1`
   - ✅ 支持用户自定义

5. **UI 输入**
   - ✅ Login.jsx: Enterprise 弹窗输入 Start URL 和 Region
   - ✅ AddAccountModal.jsx: Enterprise 显示 Start URL 输入框

6. **错误处理**
   - ✅ 使用 Rust 的 Result 类型
   - ✅ 友好的错误提示

### ✅ 已完全实现

1. **hasUserProvidedInput 参数**
   - ✅ 已实现：`register_client(start_url, &redirect_uri, provider == "Enterprise")`
   - ✅ 错误处理：检测 "invalid start url provided" 并返回友好提示
   - ✅ 与 Kiro IDE 完全一致（参考 extension.js 行 138415-138416）

2. **Region 选择**
   - ✅ Login.jsx 支持 16 个 region
   - ✅ AddAccountModal.jsx 支持 16 个 region
   - ✅ 与 Kiro IDE 完全一致

3. **IdcProvider 统一处理**
   - ✅ BuilderId 和 Enterprise 使用相同的 `IdcProvider`
   - ✅ 通过 `start_url` 参数区分

4. **Start URL 处理**
   - ✅ BuilderId: 使用固定常量 `BUILDER_ID_START_URL`
   - ✅ Enterprise: 使用用户提供的 `start_url`

5. **clientIdHash 计算**
   - ✅ 使用 SHA1 算法
   - ✅ 输入格式：`JSON.stringify({ startUrl })`
   - ✅ 接受 `start_url` 参数

6. **Region 处理**
   - ✅ 默认值：`us-east-1`
   - ✅ 支持用户自定义

7. **UI 输入**
   - ✅ Login.jsx: Enterprise 弹窗输入 Start URL 和 Region
   - ✅ AddAccountModal.jsx: Enterprise 显示 Start URL 输入框

8. **错误处理**
   - ✅ 使用 Rust 的 Result 类型
   - ✅ 友好的错误提示（特别是 Start URL 无效）
   - ✅ 与 Kiro IDE 错误处理逻辑一致

---

## 10. 总结

### 核心结论

**Enterprise 和 BuilderId 的唯一实质区别**：
1. **Start URL**: BuilderId 固定，Enterprise 用户提供
2. **Region 选择**: Enterprise 更常需要选择（因为企业部署在不同 region）
3. **错误提示**: Enterprise 需要更友好的 Start URL 错误提示

**其他方面完全相同**：
- 认证流程（Authorization Code Flow + PKCE）
- Token 格式
- clientIdHash 计算方法
- 刷新逻辑
- 配额获取
- 数据存储

### 设计理念

Kiro IDE 的设计非常优雅：
- ✅ 统一的认证流程（IdC Provider）
- ✅ 通过配置参数区分（Start URL、Region）
- ✅ 最小化代码重复
- ✅ 清晰的错误处理

我们的实现完全遵循了这个设计理念！

---

## 相关文件

- `src-tauri/src/providers/idc.rs` - IdC Provider 实现
- `src/components/features/Login.jsx` - 登录页面
- `src/components/features/AccountManager/AddAccountModal.jsx` - 添加账号弹窗
- `docs/templates/BuilderId Token Cache.md` - BuilderId Token 格式
- `docs/templates/Enterprise Token Cache.md` - Enterprise Token 格式
- `docs/templates/Token Format Comparison.md` - Token 格式对比

---

## 更新记录

- 2026-01-23: 创建文档，完整分析 Enterprise vs BuilderId

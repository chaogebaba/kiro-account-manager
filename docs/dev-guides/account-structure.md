# Account 结构体字段统一分析

## 第一步：列出每种账号类型需要的字段

### 1. Google 账号（Social Login）

```json
{
  "id": "uuid",
  "email": "user@gmail.com",
  "label": "Google 账号",
  "status": "active",
  "addedAt": "2026/01/26 16:00:00",
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresAt": "2026-01-26T16:00:00Z",
  "provider": "Google",
  "userId": "123456",
  "authMethod": "social",
  "region": "us-east-1",
  "profileArn": "arn:aws:codewhisperer:us-east-1:...",
  "usageData": {},
  "machineId": "uuid"
}
```

**需要的字段**：
- id
- email
- label
- status
- addedAt
- accessToken
- refreshToken
- expiresAt
- provider
- userId
- authMethod
- region
- profileArn
- usageData
- machineId

---

### 2. GitHub 账号（Social Login）

```json
{
  "id": "uuid",
  "email": "user@github.com",
  "label": "GitHub 账号",
  "status": "active",
  "addedAt": "2026/01/26 16:00:00",
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresAt": "2026-01-26T16:00:00Z",
  "provider": "GitHub",
  "userId": "654321",
  "authMethod": "social",
  "region": "us-east-1",
  "profileArn": "arn:aws:codewhisperer:us-east-1:...",
  "usageData": {},
  "machineId": "uuid"
}
```

**需要的字段**：
- id
- email
- label
- status
- addedAt
- accessToken
- refreshToken
- expiresAt
- provider
- userId
- authMethod
- region
- profileArn
- usageData
- machineId

---

### 3. BuilderId 账号（IdC）

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "label": "BuilderId 账号",
  "status": "active",
  "addedAt": "2026/01/26 16:00:00",
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresAt": "2026-01-26T16:00:00Z",
  "provider": "BuilderId",
  "userId": "789012",
  "authMethod": "IdC",
  "clientId": "arn:aws:sso::...",
  "clientSecret": "...",
  "region": "us-east-1",
  "usageData": {},
  "machineId": "uuid"
}
```

**需要的字段**：
- id
- email
- label
- status
- addedAt
- accessToken
- refreshToken
- expiresAt
- provider
- userId
- authMethod
- clientId
- clientSecret
- region
- usageData
- machineId

---

### 4. Enterprise 账号（IdC）

```json
{
  "id": "uuid",
  "email": null,
  "label": "Enterprise 账号",
  "status": "active",
  "addedAt": "2026/01/26 16:00:00",
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresAt": "2026-01-26T16:00:00Z",
  "provider": "Enterprise",
  "userId": "345678",
  "authMethod": "IdC",
  "clientId": "arn:aws:sso::...",
  "clientSecret": "...",
  "region": "us-east-1",
  "startUrl": "https://d-1234567890.awsapps.com/start",
  "usageData": {},
  "machineId": "uuid"
}
```

**需要的字段**：
- id
- email (null)
- label
- status
- addedAt
- accessToken
- refreshToken
- expiresAt
- provider
- userId
- authMethod
- clientId
- clientSecret
- region
- startUrl
- usageData
- machineId

---

### 5. kiro-cli Social Login

```json
{
  "id": "uuid",
  "email": "user@gmail.com",
  "label": "从 kiro-cli 导入",
  "status": "active",
  "addedAt": "2026/01/26 16:00:00",
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresAt": "2026-01-26T16:00:00Z",
  "provider": "Google",
  "userId": "123456",
  "authMethod": "social",
  "region": "us-east-1",
  "profileArn": "arn:aws:codewhisperer:us-east-1:...",
  "usageData": {},
  "machineId": "uuid"
}
```

**需要的字段**：
- id
- email
- label
- status
- addedAt
- accessToken
- refreshToken
- expiresAt
- provider
- userId
- authMethod
- region
- profileArn
- usageData
- machineId

---

### 6. kiro-cli AWS SSO OIDC

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "label": "从 kiro-cli 导入",
  "status": "active",
  "addedAt": "2026/01/26 16:00:00",
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresAt": "2026-01-26T16:00:00Z",
  "provider": "BuilderId",
  "userId": "789012",
  "authMethod": "IdC",
  "clientId": "arn:aws:sso::...",
  "clientSecret": "...",
  "region": "us-east-1",
  "usageData": {},
  "machineId": "uuid"
}
```

**需要的字段**：
- id
- email
- label
- status
- addedAt
- accessToken
- refreshToken
- expiresAt
- provider
- userId
- authMethod
- clientId
- clientSecret
- region
- usageData
- machineId

---

## 第二步：分析共同字段

### 所有账号类型都需要的字段（必填字段）

```json
{
  "id": "string",
  "label": "string",
  "status": "string",
  "addedAt": "string",
  "accessToken": "string",
  "refreshToken": "string",
  "provider": "string",
  "userId": "string",
  "authMethod": "string",
  "region": "string",
  "usageData": "object",
  "machineId": "string"
}
```

**共同字段列表**：
1. `id` - 账号唯一标识
2. `label` - 账号备注
3. `status` - 账号状态
4. `addedAt` - 添加时间
5. `accessToken` - 访问令牌
6. `refreshToken` - 刷新令牌
7. `provider` - 提供商
8. `userId` - 用户 ID
9. `authMethod` - 认证方式
10. `region` - AWS 区域
11. `usageData` - 配额数据
12. `machineId` - 机器码

---

### 部分账号类型需要的字段（可选字段）

#### email（除 Enterprise 外都需要）

**需要的账号类型**：
- Google ✅
- GitHub ✅
- BuilderId ✅
- Enterprise ❌ (null)
- kiro-cli Social ✅
- kiro-cli OIDC ✅

**结论**：`email` 应该是 `Option<String>`，Enterprise 为 `null`

---

#### expiresAt（所有类型都有，但可能为空）

**需要的账号类型**：
- Google ✅
- GitHub ✅
- BuilderId ✅
- Enterprise ✅
- kiro-cli Social ✅
- kiro-cli OIDC ✅

**结论**：`expiresAt` 应该是 `Option<String>`，虽然大部分都有，但可能为空

---

#### profileArn（仅 Social Login 需要）

**需要的账号类型**：
- Google ✅
- GitHub ✅
- BuilderId ❌
- Enterprise ❌
- kiro-cli Social ✅
- kiro-cli OIDC ❌

**结论**：`profileArn` 应该是 `Option<String>`，仅 Social Login 使用

---

#### clientId + clientSecret（仅 IdC 需要）

**需要的账号类型**：
- Google ❌
- GitHub ❌
- BuilderId ✅
- Enterprise ✅
- kiro-cli Social ❌
- kiro-cli OIDC ✅

**结论**：`clientId` 和 `clientSecret` 应该是 `Option<String>`，仅 IdC 使用

---

#### startUrl（仅 Enterprise 需要）

**需要的账号类型**：
- Google ❌
- GitHub ❌
- BuilderId ❌
- Enterprise ✅
- kiro-cli Social ❌
- kiro-cli OIDC ❌

**结论**：`startUrl` 应该是 `Option<String>`，仅 Enterprise 使用

---

## 第三步：最终字段定义

### 必填字段（所有账号类型都需要）

```rust
pub struct Account {
    pub id: String,                    // UUID
    pub label: String,                 // 账号备注
    pub status: String,                // active/banned
    pub added_at: String,              // 添加时间
    pub access_token: Option<String>,  // 访问令牌（虽然都需要，但用 Option 兼容导入）
    pub refresh_token: Option<String>, // 刷新令牌（虽然都需要，但用 Option 兼容导入）
    pub provider: Option<String>,      // Google/GitHub/BuilderId/Enterprise
    pub user_id: Option<String>,       // 用户 ID
    pub auth_method: Option<String>,   // social/IdC
    pub region: Option<String>,        // AWS 区域（默认 us-east-1）
    pub usage_data: Option<serde_json::Value>, // 配额数据
    pub machine_id: Option<String>,    // 机器码
}
```

### 可选字段（部分账号类型需要）

```rust
pub struct Account {
    // ... 必填字段 ...
    
    // 部分账号需要
    pub email: Option<String>,         // 邮箱（Enterprise 为 null）
    pub expires_at: Option<String>,    // 过期时间
    
    // Social Login 专用
    pub profile_arn: Option<String>,   // Profile ARN
    
    // IdC 专用
    pub client_id: Option<String>,     // 客户端 ID
    pub client_secret: Option<String>, // 客户端密钥
    
    // Enterprise 专用
    pub start_url: Option<String>,     // Start URL
}
```

### 其他字段（功能性字段）

```rust
pub struct Account {
    // ... 必填字段 + 可选字段 ...
    
    // 功能性字段
    pub password: Option<String>,      // 账号密码（可选）
    pub group_id: Option<String>,      // 所属分组
    pub tag_links: Vec<AccountTagLink>, // 标签关联
    pub client_id_hash: Option<String>, // 客户端 ID 哈希
    pub sso_session_id: Option<String>, // SSO 会话 ID
    pub id_token: Option<String>,      // ID 令牌
}
```

---

## 第四步：字段统一建议

### 当前结构体已经很合理

当前的 `Account` 结构体设计已经很好地支持了所有账号类型：

1. ✅ 所有共同字段都已定义
2. ✅ 使用 `Option<T>` 处理可选字段
3. ✅ 字段命名清晰（camelCase）
4. ✅ 有专门的构造函数（`new()`, `new_enterprise()`）
5. ✅ 有辅助方法（`is_enterprise()`, `get_display_id()`）

### 无需调整的原因

1. **字段完整**：已经包含所有需要的字段
2. **类型正确**：`Option<T>` 正确处理了可选字段
3. **扩展性好**：新增字段不影响现有功能
4. **兼容性好**：支持旧版本数据的自动修复

### kiro-cli 导入只需要做字段映射

从 kiro-cli 导入时，只需要：

1. **读取数据库** → 获取 Token 和 Device Registration
2. **字段映射** → 将 kiro-cli 的字段映射到 Account 结构体
3. **调用 API** → 获取 email、userId、provider
4. **创建账号** → 使用现有的 Account 结构体

**字段映射示例**：

```rust
// kiro-cli Social Login
{
  "access_token": "...",      → accessToken
  "refresh_token": "...",     → refreshToken
  "profile_arn": "...",       → profileArn
  "region": "...",            → region
  "expires_at": "..."         → expiresAt
}

// kiro-cli AWS SSO OIDC
{
  "access_token": "...",      → accessToken
  "refresh_token": "...",     → refreshToken
  "region": "...",            → region
  "expires_at": "..."         → expiresAt
}
+ Device Registration {
  "client_id": "...",         → clientId
  "client_secret": "...",     → clientSecret
  "region": "..."             → region
}
```

---

## 结论

**当前 Account 结构体无需调整**，已经完美支持所有账号类型。

---

## 最终结构体定义

### Rust 结构体（src-tauri/src/account.rs）

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    // ============================================================
    // 基础信息（所有账号必需）
    // ============================================================
    pub id: String,                    // UUID，账号唯一标识
    pub label: String,                 // 账号备注
    pub status: String,                // 账号状态：active/banned
    pub added_at: String,              // 添加时间：%Y/%m/%d %H:%M:%S
    
    // ============================================================
    // 认证信息（所有账号必需）
    // ============================================================
    pub access_token: Option<String>,  // 访问令牌
    pub refresh_token: Option<String>, // 刷新令牌
    pub expires_at: Option<String>,    // 过期时间（ISO 8601）
    pub provider: Option<String>,      // 提供商：Google/GitHub/BuilderId/Enterprise
    pub user_id: Option<String>,       // 用户 ID
    pub auth_method: Option<String>,   // 认证方式：social/IdC
    pub region: Option<String>,        // AWS 区域（默认 us-east-1）
    
    // ============================================================
    // 账号标识（部分账号需要）
    // ============================================================
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,         // 邮箱（Enterprise 为 null）
    
    #[serde(default)]
    pub password: Option<String>,      // 账号密码（可选）
    
    // ============================================================
    // Social Login 专用字段
    // ============================================================
    #[serde(default)]
    pub profile_arn: Option<String>,   // Profile ARN
    
    // ============================================================
    // IdC 专用字段（AWS SSO OIDC）
    // ============================================================
    pub client_id: Option<String>,     // 客户端 ID（Device Registration）
    pub client_secret: Option<String>, // 客户端密钥（Device Registration）
    pub client_id_hash: Option<String>, // 客户端 ID 哈希值
    pub sso_session_id: Option<String>, // SSO 会话 ID
    pub id_token: Option<String>,      // ID 令牌
    
    #[serde(default)]
    pub start_url: Option<String>,     // Start URL（Enterprise 专用）
    
    // ============================================================
    // 配额和使用数据
    // ============================================================
    pub usage_data: Option<serde_json::Value>, // 原始配额 API 响应
    
    // ============================================================
    // 分组和标签
    // ============================================================
    #[serde(default)]
    pub group_id: Option<String>,      // 所属分组 ID
    
    #[serde(default, deserialize_with = "deserialize_tag_links")]
    pub tag_links: Vec<AccountTagLink>, // 标签关联列表
    
    // ============================================================
    // 机器码
    // ============================================================
   de(default)]
    pub machine_id: Option<String>,    // 绑定的机器码
}
```

### JSON 格式（存储格式）

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "password": null,
  "label": "账号备注",
  "status": "active",
  "addedAt": "2026/01/26 16:00:00",
  "accessToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHkiOiJ...",
  "expiresAt": "2026-01-26T16:00:00Z",
  "provider": "Google",
  "userId": "123456",
  "authMethod": "social",
  "clientId": null,
  "clientSecret": null,
  "region": "us-eas",
  "clientIdHash": null,
  "ssoSessionId": null,
  "idToken": null,
  "startUrl": null,
  "profileArn": "arn:aws:codewhisperer:us-east-1:...",
  "usageData": {},
  "groupId": null,
  "tagLinks": [],
  "machineId": "550e8400-e29b-41d4-a716-446655440001"
}
```

### 字段说明

#### 必填字段（所有账号类型）

- `id` - 账号唯一标识（UUID）
- `label` - 账号备注
- `status` - 账号状态（active/banned）
- `addedAt` - 添加时间

#### 认证字段（所有账号类型）

- `accessToken` - 访问令牌
- `refreshToken` - 刷新令牌
- `provider` - 提供商（Google/GitHub/BuilderId/Enterprise）
- `userId` - 用户 ID
- `authMethod` - 认证方式（social/IdC）
- `region` - AWS 区域

#### 可选字段（部分账号类型）

- `email` - 邮箱（Enterprise 为 null）
- `expiresAt` - 过期时间
- `password` - 账号密码

#### Social Login 专用

- `profileArn` - Profile ARN

#### IdC 专用

- `clientId` - 客户端 ID
- `clientSecret` - 客户端密钥
- `clientIdHash` - 客户端 ID 哈希
- `ssoSessionId` - SSO 会话 ID
- `idToken` - ID 令牌
- `startUrl` - Start URL（Enterprise 专用）

#### 其他字段

- `usageData` - 配额数据
- `groupId` - 分组 ID
- `tagLinks` - 标签关联
- `machineId` - 机器码

---

## kiro-cli 导入实现

kiro-cli 导入功能只需要：
1. 读取 SQLite 数据库
2析 JSON 数据
3. 映射字段到 Account 结构体
4. 调用 API 获取额外信息（email、userId、provider）

---

## 1. 桌面授权登录（Desktop OAuth）. 解t-1 #[ser

### 1.1 Google 账号（Social Login）

**来源**：用户在应用内通过浏览器授权登录

**原始响应**（来自 Kiro Auth API）：
```json
{
  "accessToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHkiOiJ...",
  "expiresAt": "2026-01-26T16:00:00Z",
  "profileArn": "arn:aws:codewhisperer:us-east-1:123456789012:profile/abc123",
  "region": "us-east-1"
}
```

**存储格式**（Account 结构体）：
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@gmail.com",
  "password": null,
  "label": "Google 账号",
  "status": "active",
  "addedAt": "2026/01/26 16:00:00",
  "accessToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHkiOiJ...",
  "expiresAt": "2026-01-26T16:00:00Z",
  "provider": "Google",
  "userId": "123456",
  "authMethod": "social",
  "clientId": null,
  "clientSecret": null,
  "region": "us-east-1",
  "clientIdHash": null,
  "ssoSessionId": null,
  "idToken": null,
  "startUrl": null,
  "profileArn": "arn:aws:codewhisperer:us-east-1:123456789012:profile/abc123",
  "usageData": { /* 配额 API 响应 */ },
  "groupId": null,
  "tagLinks": [],
  "machineId": "550e8400-e29b-41d4-a716-446655440001"
}
```

### 1.2 GitHub 账号（Social Login）

**原始响应**（来自 Kiro Auth API）：
```json
{
  "accessToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHkiOiJ...",
  "expiresAt": "2026-01-26T16:00:00Z",
  "profileArn": "arn:aws:codewhisperer:us-east-1:123456789012:profile/def456",
  "region": "us-east-1"
}
```

**存储格式**（Account 结构体）：
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "email": "user@github.com",
  "password": null,
  "label": "GitHub 账号",
  "status": "active",
  "addedAt": "2026/01/26 16:00:00",
  "accessToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHkiOiJ...",
  "expiresAt": "2026-01-26T16:00:00Z",
  "provider": "GitHub",
  "userId": "654321",
  "authMethod": "social",
  "clientId": null,
  "clientSecret": null,
  "region": "us-east-1",
  "clientIdHash": null,
  "ssoSessionId": null,
  "idToken": null,
  "startUrl": null,
  "profileArn": "arn:aws:codewhisperer:us-east-1:123456789012:profile/def456",
  "usageData": { /* 配额 API 响应 */ },
  "groupId": null,
  "tagLinks": [],
  "machineId": "550e8400-e29b-41d4-a716-446655440003"
}
```

### 1.3 BuilderId 账号（IdC）

**原始响应**（来自 AWS SSO OIDC API）：
```json
{
  "accessToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHkiOiJ...",
  "expiresAt": "2026-01-26T16:00:00Z",
  "clientId": "arn:aws:sso::123456789012:application/ssoins-1234567890abcdef/apl-1234567890abcdef",
  "clientSecret": "1234567890abcdef1234567890abcdef1234567890abcdef",
  "region": "us-east-1"
}
```

**存储格式**（Account 结构体）：
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440004",
  "email": "user@example.com",
  "password": null,
  "label": "BuilderId 账号",
  "status": "active",
  "addedAt": "2026/01/26 16:00:00",
  "accessToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHkiOiJ...",
  "expiresAt": "2026-01-26T16:00:00Z",
  "provider": "BuilderId",
  "userId": "789012",
  "authMethod": "IdC",
  "clientId": "arn:aws:sso::123456789012:application/ssoins-1234567890abcdef/apl-1234567890abcdef",
  "clientSecret": "1234567890abcdef1234567890abcdef1234567890abcdef",
  "region": "us-east-1",
  "clientIdHash": null,
  "ssoSessionId": null,
  "idToken": null,
  "startUrl": null,
  "profileArn": null,
  "usageData": { /* 配额 API 响应 */ },
  "groupId": null,
  "tagLinks": [],
  "machineId": "550e8400-e29b-41d4-a716-446655440005"
}
```

### 1.4 Enterprise 账号（IdC）

**原始响应**（来自 AWS SSO OIDC API）：
```json
{
  "accessToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHkiOiJ...",
  "expiresAt": "2026-01-26T16:00:00Z",
  "clientId": "arn:aws:sso::123456789012:application/ssoins-1234567890abcdef/apl-1234567890abcdef",
  "clientSecret": "1234567890abcdef1234567890abcdef1234567890abcdef",
  "region": "us-east-1",
  "startUrl": "https://d-1234567890.awsapps.com/start"
}
```

**存储格式**（Account 结构体）：
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440006",
  "email": null,
  "password": null,
  "label": "Enterprise 账号",
  "status": "active",
  "addedAt": "2026/01/26 16:00:00",
  "accessToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHkiOiJ...",
  "expiresAt": "2026-01-26T16:00:00Z",
  "provider": "Enterprise",
  "userId": "345678",
  "authMethod": "IdC",
  "clientId": "arn:aws:sso::123456789012:application/ssoins-1234567890abcdef/apl-1234567890abcdef",
  "clientSecret": "1234567890abcdef1234567890abcdef1234567890abcdef",
  "region": "us-east-1",
  "clientIdHash": null,
  "ssoSessionId": null,
  "idToken": null,
  "startUrl": "https://d-1234567890.awsapps.com/start",
  "profileArn": null,
  "usageData": { /* 配额 API 响应 */ },
  "groupId": null,
  "tagLinks": [],
  "machineId": "550e8400-e29b-41d4-a716-446655440007"
}
```

---

## 2. 从 Kiro IDE 导入

### 2.1 Google 账号（Social Login）

**来源文件**：`~/.kiro/auth/kiro-auth-token.json`

**原始格式**：
```json
{
  "accessToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHkiOiJ...",
  "expiresAt": "2026-01-26T16:00:00.000Z",
  "profileArn": "arn:aws:codewhisperer:us-east-1:123456789012:profile/abc123",
  "region": "us-east-1"
}
```

**存储格式**（Account 结构体）：
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440008",
  "email": "user@gmail.com",
  "password": null,
  "label": "从 Kiro 导入",
  "status": "active",
  "addedAt": "2026/01/26 16:00:00",
  "accessToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHkiOiJ...",
  "expiresAt": "2026-01-26T16:00:00.000Z",
  "provider": "Google",
  "userId": "123456",
  "authMethod": "social",
  "clientId": null,
  "clientSecret": null,
  "region": "us-east-1",
  "clientIdHash": null,
  "ssoSessionId": null,
  "idToken": null,
  "startUrl": null,
  "profileArn": "arn:aws:codewhisperer:us-east-1:123456789012:profile/abc123",
  "usageData": { /* 配额 API 响应 */ },
  "groupId": null,
  "tagLinks": [],
  "machineId": "550e8400-e29b-41d4-a716-446655440009"
}
```

### 2.2 BuilderId 账号（IdC）

**来源文件**：`~/.kiro/auth/kiro-auth-token.json`

**原始格式**：
```json
{
  "accessToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHkiOiJ...",
  "expiresAt": "2026-01-26T16:00:00.000Z",
  "clientId": "arn:aws:sso::123456789012:application/ssoins-1234567890abcdef/apl-1234567890abcdef",
  "clientSecret": "1234567890abcdef1234567890abcdef1234567890abcdef",
  "region": "us-east-1"
}
```

**存储格式**（Account 结构体）：
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440010",
  "email": "user@example.com",
  "password": null,
  "label": "从 Kiro 导入",
  "status": "active",
  "addedAt": "2026/01/26 16:00:00",
  "accessToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHkiOiJ...",
  "expiresAt": "2026-01-26T16:00:00.000Z",
  "provider": "BuilderId",
  "userId": "789012",
  "authMethod": "IdC",
  "clientId": "arn:aws:sso::123456789012:application/ssoins-1234567890abcdef/apl-1234567890abcdef",
  "clientSecret": "1234567890abcdef1234567890abcdef1234567890abcdef",
  "region": "us-east-1",
  "clientIdHash": null,
  "ssoSessionId": null,
  "idToken": null,
  "startUrl": null,
  "profileArn": null,
  "usageData": { /* 配额 API 响应 */ },
  "groupId": null,
  "tagLinks": [],
  "machineId": "550e8400-e29b-41d4-a716-446655440011"
}
```

### 2.3 Enterprise 账号（IdC）

**来源文件**：`~/.kiro/auth/kiro-auth-token.json`

**原始格式**：
```json
{
  "accessToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHkiOiJ...",
  "expiresAt": "2026-01-26T16:00:00.000Z",
  "clientId": "arn:aws:sso::123456789012:application/ssoins-1234567890abcdef/apl-1234567890abcdef",
  "clientSecret": "1234567890abcdef1234567890abcdef1234567890abcdef",
  "region": "us-east-1",
  "startUrl": "https://d-1234567890.awsapps.com/start"
}
```

**存储格式**（Account 结构体）：
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440012",
  "email": null,
  "password": null,
  "label": "从 Kiro 导入",
  "status": "active",
  "addedAt": "2026/01/26 16:00:00",
  "accessToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHkiOiJ...",
  "expiresAt": "2026-01-26T16:00:00.000Z",
  "provider": "Enterprise",
  "userId": "345678",
  "authMethod": "IdC",
  "clientId": "arn:aws:sso::123456789012:application/ssoins-1234567890abcdef/apl-1234567890abcdef",
  "clientSecret": "1234567890abcdef1234567890abcdef1234567890abcdef",
  "region": "us-east-1",
  "clientIdHash": null,
  "ssoSessionId": null,
  "idToken": null,
  "startUrl": "https://d-1234567890.awsapps.com/start",
  "profileArn": null,
  "usageData": { /* 配额 API 响应 */ },
  "groupId": null,
  "tagLinks": [],
  "machineId": "550e8400-e29b-41d4-a716-446655440013"
}
```

---

## 3. 从 kiro-cli 导入

### 3.1 Social Login Token

**来源**：SQLite 数据库 `~/.local/share/kiro-cli/data.sqlite3`

**数据库键名**：`kirocli:social:token`

**原始格式**（存储在数据库的 value 字段）：
```json
{
  "access_token": "eyJraWQiOiJ...",
  "refresh_token": "eyJjdHkiOiJ...",
  "profile_arn": "arn:aws:codewhisperer:us-east-1:123456789012:profile/abc123",
  "region": "us-east-1",
  "expires_at": "2026-01-26T16:00:00Z"
}
```

**存储格式**（Account 结构体）：
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440014",
  "email": "user@gmail.com",
  "password": null,
  "label": "从 kiro-cli 导入",
  "status": "active",
  "addedAt": "2026/01/26 16:00:00",
  "accessToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHkiOiJ...",
  "expiresAt": "2026-01-26T16:00:00Z",
  "provider": "Google",
  "userId": "123456",
  "authMethod": "social",
  "clientId": null,
  "clientSecret": null,
  "region": "us-east-1",
  "clientIdHash": null,
  "ssoSessionId": null,
  "idToken": null,
  "startUrl": null,
  "profileArn": "arn:aws:codewhisperer:us-east-1:123456789012:profile/abc123",
  "usageData": { /* 配额 API 响应 */ },
  "groupId": null,
  "tagLinks": [],
  "machineId": "550e8400-e29b-41d4-a716-446655440015"
}
```

### 3.2 AWS SSO OIDC Token

**来源**：SQLite 数据库 `~/.local/share/kiro-cli/data.sqlite3`

**数据库键名**：`kirocli:odic:token` 或 `codewhisperer:odic:token`

**原始格式**（存储在数据库的 value 字段）：
```json
{
  "access_token": "eyJraWQiOiJ...",
  "refresh_token": "eyJjdHkiOiJ...",
  "region": "us-east-1",
  "expires_at": "2026-01-26T16:00:00Z",
  "scopes": ["codewhisperer:completions", "codewhisperer:analysis"]
}
```

**Device Registration**（单独的键）：

**数据库键名**：`kirocli:odic:device-registration` 或 `codewhisperer:odic:device-registration`

**原始格式**：
```json
{
  "client_id": "arn:aws:sso::123456789012:application/ssoins-1234567890abcdef/apl-1234567890abcdef",
  "client_secret": "1234567890abcdef1234567890abcdef1234567890abcdef",
  "region": "us-east-1"
}
```

**存储格式**（Account 结构体，合并 Token + Device Registration）：
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440016",
  "email": "user@example.com",
  "password": null,
  "label": "从 kiro-cli 导入",
  "status": "active",
  "addedAt": "2026/01/26 16:00:00",
  "accessToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHkiOiJ...",
  "expiresAt": "2026-01-26T16:00:00Z",
  "provider": "BuilderId",
  "userId": "789012",
  "authMethod": "IdC",
  "clientId": "arn:aws:sso::123456789012:application/ssoins-1234567890abcdef/apl-1234567890abcdef",
  "clientSecret": "1234567890abcdef1234567890abcdef1234567890abcdef",
  "region": "us-east-1",
  "clientIdHash": null,
  "ssoSessionId": null,
  "idToken": null,
  "startUrl": null,
  "profileArn": null,
  "usageData": { /* 配额 API 响应 */ },
  "groupId": null,
  "tagLinks": [],
  "machineId": "550e8400-e29b-41d4-a716-446655440017"
}
```

---

## 不同来源的字段映射

### 1. 桌面授权登录（Desktop OAuth）

**来源**：用户在应用内通过浏览器授权登录

**字段映射**：
- Social Login → 完整字段（通过 Provider 实现）
- IdC → 完整字段（通过 Provider 实现）

### 2. JSON 导入

**来源**：用户导入 JSON 文件

**字段映射**：
- 直接反序列化为 `Account` 结构体
- 自动修复 `auth_method`（如果为 null）：
  - 有 `client_id` + `client_secret` → `"IdC"`
  - 否则 → `"social"`

### 3. 从 Kiro IDE 导入

**来源**：读取 Kiro IDE 的 `kiro-auth-token.json`

**字段映射**：
- Social Login：
  - `access_token` → `accessToken`
  - `refresh_token` → `refreshToken`
  - `expires_at` → `expiresAt`
  - `profile_arn` → `profileArn`
  - `region` → `region`
- IdC：
  - `access_token` → `accessToken`
  - `refresh_token` → `refreshToken`
  - `expires_at` → `expiresAt`
  - `client_id` → `clientId`
  - `client_secret` → `clientSecret`
  - `region` → `region`
  - `start_url` → `startUrl`（Enterprise）

### 4. 从 kiro-cli 导入

**来源**：读取 kiro-cli 的 SQLite 数据库（`~/.local/share/kiro-cli/data.sqlite3`）

**数据库键名**（按优先级）：
1. `kirocli:social:token` - Social Login
2. `kirocli:odic:token` - AWS SSO OIDC
3. `codewhisperer:odic:token` - 旧版 AWS SSO OIDC
4. `kirocli:odic:device-registration` - Device Registration（IdC 专用）
5. `codewhisperer:odic:device-registration` - 旧版 Device Registration

**字段映射**：

#### Social Login Token
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "profile_arn": "arn:aws:codewhisperer:us-east-1:...",
  "region": "us-east-1",
  "expires_at": "2026-01-26T16:00:00Z"
}
```
→ 映射为：
- `auth_method = "social"`
- `access_token` → `access_token`
- `refresh_token` → `refresh_token`
- `profile_arn` → `profile_arn`
- `region` → `region`
- `expires_at` → `expires_at`
- `provider` → 通过 API 判断（Google/GitHub）
- `email` → 通过 API 获取
- `user_id` → 通过 API 获取

#### AWS SSO OIDC Token
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "region": "us-east-1",
  "expires_at": "2026-01-26T16:00:00Z",
  "scopes": ["codewhisperer:completions", "codewhisperer:analysis"]
}
```
→ 映射为：
- `auth_method = "IdC"`
- `access_token` → `access_token`
- `refresh_token` → `refresh_token`
- `region` → `region`
- `expires_at` → `expires_at`
- `provider = "BuilderId"`（默认，因为 kiro-cli 主要用于 BuilderId）
- `client_id` → 从 Device Registration 读取
- `client_secret` → 从 Device Registration 读取
- `email` → 通过 API 获取
- `user_id` → 通过 API 获取

#### Device Registration
```json
{
  "client_id": "arn:aws:sso::...",
  "client_secret": "...",
  "region": "us-east-1"
}
```
→ 映射为：
- `client_id` → `client_id`
- `client_secret` → `client_secret`
- `region` → `region`

---

## 字段验证规则

### 必填字段验证

**所有账号**：
- `id` - 必须是有效的 UUID
- `label` - 不能为空
- `status` - 必须是 `"active"` 或 `"banned"`
- `added_at` - 必须是有效的日期时间字符串

**Social Login**：
- `auth_method = "social"`
- `access_token` - 不能为空
- `refresh_token` - 不能为空
- `profile_arn` - 不能为空
- `email` - 不能为空（通过 API 获取）

**IdC (BuilderId)**：
- `auth_method = "IdC"`
- `provider = "BuilderId"`
- `access_token` - 不能为空
- `refresh_token` - 不能为空
- `client_id` - 不能为空
- `client_secret` - 不能为空
- `email` - 不能为空（通过 API 获取）

**IdC (Enterprise)**：
- `auth_method = "IdC"`
- `provider = "Enterprise"`
- `access_token` - 不能为空
- `refresh_token` - 不能为空
- `client_id` - 不能为空
- `client_secret` - 不能为空
- `start_url` - 不能为空
- `email = None`（Enterprise 没有 email）
- `user_id` - 不能为空（通过 API 获取）

### 去重规则

**去重键**：
- 优先使用 `id`
- 如果 `id` 不同，使用 `email` + `user_id` + `auth_method` + `provider` 组合

**去重逻辑**：
```rust
let exists = accounts.iter().any(|a| {
    // 优先用 ID 去重
    if a.id == account.id {
        return true;
    }
    
    // 使用 email + user_id + auth_method + provider 组合去重
    let email_match = a.email == account.email;
    let user_id_match = a.user_id == account.user_id;
    let auth_method_match = a.auth_method == account.auth_method;
    let provider_match = a.provider == account.provider;
    
    email_match && user_id_match && auth_method_match && provider_match
});
```

---

## 显示规则

### 账号标识显示

**规则**：
- Enterprise 账号 → 显示 `user_id`
- 其他账号 → 显示 `email`

**实现**：
```rust
pub fn get_display_id(&self) -> String {
    if self.is_enterprise() {
        self.user_id.clone().unwrap_or_else(|| "Unknown".to_string())
    } else {
        self.email.clone().unwrap_or_else(|| "Unknown".to_string())
    }
}
```

**前端实现**：
```javascript
export function getAccountDisplayName(account) {
  return account.email || account.userId || account.user_id || 'Unknown'
}
```

### 提供商显示

| Provider | 显示名称 |
|----------|----------|
| `Google` | Google |
| `GitHub` | GitHub |
| `BuilderId` | AWS Builder ID |
| `Enterprise` | AWS IAM Identity Center |

---

## 数据迁移

### 旧版本兼容

**v1.7.3 及之前**：
- `auth_method` 可能为 `null`
- 导入时自动修复：
  - 有 `client_id` + `client_secret` → `"IdC"`
  - 否则 → `"social"`

**v1.7.4 及之后**：
- `email` 改为 `Option<String>`（支持 Enterprise）
- 新增 `start_url` 字段（Enterprise 专用）
- 新增 `get_display_id()` 方法
- 新增 `new_enterprise()` 构造函数

### 数据修复

**修复 auth_method**：
```rust
if account.auth_method.is_none() {
    if account.client_id.is_some() && account.client_secret.is_some() {
        account.auth_method = Some("IdC".to_string());
    } else {
        account.auth_method = Some("social".to_string());
    }
}
```

**修复 machine_id**：
```rust
if account.machine_id.is_none() {
    account.machine_id = Some(uuid::Uuid::new_v4().to_string().to_lowercase());
}
```

---

## 相关文件

- `src-tauri/src/account.rs` - Account 结构体定义
- `src-tauri/src/providers/base.rs` - AuthProvider trait
- `src-tauri/src/providers/social.rs` - Social Login 实现
- `src-tauri/src/providers/idc.rs` - IdC 实现
- `src/utils/accountStats.js` - 前端账号工具函数

---

## 更新记录

- 2026-01-26: 创建文档，定义字段规范
- 2026-01-26: 添加 kiro-cli 导入的字段映射规则

# Access Token 使用场景分析

> 基于 Kiro IDE v0.8.140 源码分析

## 概述

Access Token 是 OAuth 2.0 流程中的短期凭证（通常 1 小时有效），用于访问受保护的 API 资源。

**关键限制**：
- ❌ 无法用 access token 换取 refresh token（单向关系）
- ❌ 无法用 access token 逆向获取 refresh token
- ✅ 只能用 refresh token 刷新 access token

---

## Access Token 使用场景

### 1. AWS SSO 相关操作

**场景**：获取 AWS 角色凭证、列出账号、登出

**API 端点**：
- `GetRoleCredentials` - 获取角色凭证
- `ListAccountRoles` - 列出账号角色
- `ListAccounts` - 列出账号
- `Logout` - 登出

**源码位置**：行 132372-132396

**使用方式**：
```javascript
// 获取角色凭证
const credentials = await sso.send(new GetRoleCredentialsCommand({
  accountId: ssoAccountId,
  roleName: ssoRoleName,
  accessToken: token.accessToken
}))
```

**说明**：这些是 AWS SSO OIDC 的标准 API，用于 BuilderId 和 Enterprise 认证。

---

### 2. 删除账号

**场景**：删除 Kiro 账号（仅 BuilderId）

**API 端点**：`DELETE /account`

**源码位置**：行 138802-138809

**使用方式**：
```javascript
// 删除账号
await authServiceClient.deleteAccount(accessToken)

// 实现
async deleteAccount(accessToken) {
  const response = await this.client.delete(this.deleteAccountUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": USER_AGENT
    }
  })
}
```

**限制**：
- ✅ 仅支持 BuilderId 账号
- ❌ Enterprise 账号不支持删除

---

### 3. MCP OAuth 认证

**场景**：MCP 服务器的 OAuth 认证

**源码位置**：行 162523-162527, 162760-162764

**使用方式**：
```javascript
// 获取 tokens
const tokens = await this._authProvider.tokens()

// 添加到请求头
if (tokens) {
  headers["Authorization"] = `Bearer ${tokens.access_token}`
}
```

**说明**：用于 MCP 服务器需要 OAuth 认证的场景。

---

### 4. 第三方 API 认证

#### 4.1 HuggingFace

**场景**：访问 HuggingFace 模型

**源码位置**：行 281009-281011

**使用方式**：
```javascript
const token = process.env?.HF_TOKEN ?? process.env?.HF_ACCESS_TOKEN
if (token) {
  headers.set("Authorization", `Bearer ${token}`)
}
```

**说明**：使用环境变量中的 HuggingFace token。

#### 4.2 GitHub Apps

**场景**：GitHub App 安装和授权

**源码位置**：行 421644-421696

**API 端点**：
- `createInstallationAccessToken` - 创建安装访问令牌
- `revokeInstallationAccessToken` - 撤销安装访问令牌
- `scopeToken` - 限定作用域令牌

---

### 5. Kiro 认证服务

**场景**：Kiro 桌面认证

**端点**：`https://prod.us-east-1.auth.desktop.kiro.dev`

**源码位置**：行 138671

**说明**：Kiro 自己的认证服务，用于桌面应用授权。

---

### 6. CodeWhisperer API

**场景**：AWS CodeWhisperer 代码补全

**使用方式**：
```javascript
// 使用 access token 调用 CodeWhisperer API
const response = await codewhispererClient.generateRecommendations({
  // ...
}, {
  headers: {
    Authorization: `Bearer ${accessToken}`
  }
})
```

**说明**：用于 AI 代码补全功能。

---

### 7. 列出可用配置文件

**场景**：获取用户的可用配置文件

**源码位置**：行 139475-139478

**使用方式**：
```javascript
const { data: profiles, error } = await vscode.commands.executeCommand(
  "kiro.profiles.listAvailableProfiles",
  { accessToken: token.accessToken }
)
```

**说明**：用于获取用户的配置文件列表。

---

## 你的 Access Token 能做什么？

根据你提供的 access token，你可以：

### ✅ 可以做的事情

1. **查询配额**（已测试成功）
   ```python
   # GetUserUsageAndLimits
   response = requests.post(
       "https://prod.us-east-1.auth.desktop.kiro.dev/api/v1/GetUserUsageAndLimits",
       headers={"Authorization": f"Bearer {access_token}"}
   )
   ```

2. **查询用户信息**（已测试成功）
   ```python
   # GetUserInfo
   response = requests.post(
       "https://prod.us-east-1.auth.desktop.kiro.dev/api/v1/GetUserInfo",
       headers={"Authorization": f"Bearer {access_token}"}
   )
   ```

3. **删除账号**（如果是 BuilderId）
   ```python
   # DELETE /account
   response = requests.delete(
       "https://prod.us-east-1.auth.desktop.kiro.dev/api/v1/account",
       headers={"Authorization": f"Bearer {access_token}"}
   )
   ```

4. **列出可用配置文件**
   ```python
   # ListAvailableProfiles
   response = requests.post(
       "https://prod.us-east-1.auth.desktop.kiro.dev/api/v1/ListAvailableProfiles",
       headers={"Authorization": f"Bearer {access_token}"}
   )
   ```

### ❌ 不能做的事情

1. **获取 refresh token** - 没有接口支持
2. **刷新 access token** - 需要 refresh token
3. **长期使用** - access token 通常 1 小时后过期
4. **获取订阅计划** - 需要额外权限（401 未授权）

---

## 时效性

**Access Token 有效期**：通常 1 小时（3600 秒）

**过期后**：
- ❌ 无法继续使用
- ❌ 无法刷新（需要 refresh token）
- ✅ 只能重新走 OAuth 流程获取新 token

---

## 安全建议

1. **不要分享 access token** - 任何人拿到都可以访问你的账号
2. **不要存储在代码中** - 使用环境变量或配置文件
3. **及时使用** - access token 有效期短，尽快使用
4. **监控使用情况** - 定期检查配额使用情况

---

## 总结

**你的情况**：
- 只有 access token，没有 refresh token
- 可以临时使用（1 小时内）查询配额和用户信息
- 无法长期使用，无法刷新

**建议**：
1. 如果只是临时查询配额，直接使用 access token
2. 如果需要长期使用，必须找到完整的 token 文件（包含 refresh_token）
3. 如果找不到，重新走 OAuth 流程获取新的 token

---

## 相关文档

- `scripts/test_access_token.py` - Access Token 测试脚本
- `docs/api/KiroWebPortalService/1.ExchangeToken.md` - ExchangeToken API 文档
- `docs/api/KiroWebPortalService/3.GetUserInfo.md` - GetUserInfo API 文档
- `docs/api/KiroWebPortalService/4.GetUserUsageAndLimits.md` - GetUserUsageAndLimits API 文档

---

## 更新记录

- 2026-01-31: 创建文档，总结所有 access token 使用场景

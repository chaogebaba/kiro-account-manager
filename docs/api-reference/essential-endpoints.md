# 必需的 API 端点

## 核心功能（已实现）

### 1. Token 刷新 ✅
- **URL**: `https://oidc.{region}.amazonaws.com/token`
- **方法**: POST
- **用途**: 刷新 Enterprise/BuilderId 账号的 Access Token
- **实现**: `src-tauri/src/aws_sso_client.rs`
- **状态**: ✅ 已完成

### 2. 获取配额 ✅
- **URL**: `https://codewhisperer.{region}.amazonaws.com`
- **方法**: POST (AWS SigV4 签名)
- **用途**: 查询账号配额使用情况
- **实现**: `src-tauri/src/kiro_portal_client.rs`
- **状态**: ✅ 已完成

## 其他端点（暂不需要）

### 3. 列出 Profiles ⏸️
- **URL**: `https://q.{region}.amazonaws.com/ListAvailableProfiles`
- **用途**: 获取用户可用的 CodeWhisperer Profiles
- **优先级**: 低（当前不需要）

### 4. 列出模型 ⏸️
- **URL**: `https://q.{region}.amazonaws.com/ListAvailableModels`
- **用途**: 获取可用的 AI 模型列表
- **优先级**: 低（当前不需要）

### 5. 获取 Profile 详情 ⏸️
- **URL**: `https://q.{region}.amazonaws.com/GetProfile`
- **用途**: 获取 Profile 的详细信息
- **优先级**: 低（当前不需要）

### 6. MCP 相关 ⏸️
- **URL**: `https://q.{region}.amazonaws.com/mcp`
- **用途**: MCP 服务器相关操作
- **优先级**: 低（当前不需要）

## 总结

**当前项目只需要 2 个端点**：
1. ✅ Token 刷新 - 已实现
2. ✅ 获取配额 - 已实现

**其他端点**：
- 都是 Kiro IDE 内部使用的
- 对账号管理器来说不是必需的
- 暂时不需要实现

## 为什么不需要其他端点？

1. **ListAvailableProfiles** - 我们不需要切换 Profile，只需要刷新 Token
2. **ListAvailableModels** - 我们不需要选择模型，只需要管理账号
3. **GetProfile** - 我们不需要 Profile 详情，只需要配额信息
4. **MCP** - 这是 Kiro IDE 的功能，与账号管理无关

## 结论

**专注核心功能**：
- ✅ Token 刷新（让账号保持登录）
- ✅ 配额查询（显示使用情况）
- ❌ 其他功能（不需要）

**保持简单**：
- 不要实现用不到的功能
- 不要增加不必要的复杂度
- 专注于账号管理的核心需求

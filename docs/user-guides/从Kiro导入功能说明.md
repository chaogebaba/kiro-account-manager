# 从 Kiro 导入功能说明

## 功能概述

自动检测并导入 Kiro IDE 中已登录的账号，无需手动输入 Token。

## 使用方式

1. 打开"导入账号"弹窗
2. 切换到"从 Kiro 导入" Tab
3. 自动检测 Kiro IDE 中的账号
4. 点击"导入"按钮批量导入

## 实现原理

### 读取缓存文件

从 Kiro IDE 的缓存目录读取账号信息：

```
~/.aws/sso/cache/kiro-auth-token.json
```

### 支持的账号类型

#### 1. Social 账号（Google/GitHub）

**缓存格式**：
```json
{
  "accessToken": "aoa...",
  "refreshToken": "aor...",
  "profileArn": "arn:aws:codewhisperer:...",
  "expiresAt": "2025-12-05T15:00:00.000Z",
  "authMethod": "social",
  "provider": "Google"
}
```

**特征**：
- 有 `profileArn` 字段
- `authMethod` 为 `"social"`
- `provider` 为 `"Google"` 或 `"Github"`

#### 2. IdC 账号（BuilderId/Enterprise）

**缓存格式**：
```json
{
  "accessToken": "aoa...",
  "refreshToken": "aor...",
  "expiresAt": "2026-01-06T04:43:48.983971200+00:00",
  "authMethod": "IdC",
  "clientIdHash": "a1b2c3d4e5f6...",
  "provider": "BuilderId",
  "region": "us-east-1"
}
```

**特征**：
- 有 `clientIdHash` 和 `region` 字段
- `authMethod` 为 `"IdC"`
- `provider` 为 `"BuilderId"` 或 `"Enterprise"`

**额外读取客户端凭证**：
```
~/.aws/sso/cache/{clientIdHash}.json
```

```json
{
  "clientId": "xxx",
  "clientSecret": "xxx",
  "expiresAt": "2025-03-01T00:00:00.000Z"
}
```

## 技术实现

### 后端命令

**命令名称**：`read_kiro_accounts`

**返回数据**：
```rust
pub struct KiroAccountInfo {
    pub email: String,
    pub provider: String,
    pub auth_method: String,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub expires_at: Option<String>,
    // Social 专用
    pub profile_arn: Option<String>,
    // IdC 专用
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    pub client_id_hash: Option<String>,
    pub region: Option<String>,
}
```

**实现位置**：`src-tauri/src/kiro.rs`

### 前端组件

**组件**：`ImportAccountModal.jsx`

**Tab 布局**：
- Tab 1: JSON 导入
- Tab 2: 从 Kiro 导入

**自动检测**：
- 切换到"从 Kiro 导入" Tab 时自动调用 `read_kiro_accounts`
- 显示检测到的账号列表
- 支持重新检测

**导入流程**：
1. 读取 Kiro IDE 缓存文件
2. 根据 `authMethod` 调用对应的添加命令：
   - Social → `add_account_by_social`
   - IdC → `add_account_by_idc`
3. 显示导入结果（成功/失败）

## 注意事项

### 前置条件

- 需要先在 Kiro IDE 中登录账号
- 缓存文件必须存在且格式正确

### 错误处理

- **未找到缓存文件**：提示"未找到 Kiro IDE 账号，请先在 Kiro IDE 中登录"
- **读取失败**：显示具体错误信息，提供"重新检测"按钮
- **导入失败**：显示失败的账号和错误原因

### 数据安全

- 只读取本地缓存文件，不上传任何数据
- Token 信息仅在本地处理
- 导入后的账号数据存储在本地 JSON 文件

## 相关文件

### 后端
- `src-tauri/src/kiro.rs` - Kiro IDE 集成（`read_kiro_accounts` 命令）
- `src-tauri/src/commands/account_cmd.rs` - 账号添加命令
- `src-tauri/src/main.rs` - 命令注册

### 前端
- `src/components/features/AccountManager/ImportAccountModal.jsx` - 导入弹窗（3-Tab 布局）

### 文档
- `docs/templates/Social Token Cache.md` - Social 账号缓存格式
- `docs/templates/SSO Token Cache.md` - IdC 账号缓存格式

## 更新记录

- 2026-01-22：新增"从 Kiro 导入"功能，支持自动检测并导入 Kiro IDE 账号

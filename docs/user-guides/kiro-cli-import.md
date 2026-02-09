# Kiro CLI 数据库导入功能设计

## 概述

支持从 kiro-cli 的 SQLite 数据库导入账号，方便用户迁移已有的 kiro-cli 账号到 Kiro Account Manager。

## 数据库信息

### 数据库位置

**默认路径**：
- Linux/macOS: `~/.local/share/kiro-cli/data.sqlite3`
- Windows: `%USERPROFILE%\.local\share\kiro-cli\data.sqlite3`

**备用路径**（amazon-q-developer-cli）：
- `~/.local/share/amazon-q/data.sqlite3`

### 表结构

**表名**：`auth_kv`

**字段**：
- `key` (TEXT) - 键名
- `value` (TEXT) - JSON 格式的值

### Token 键（按优先级）

1. `kirocli:social:token` - 社交登录（Google、GitHub、Microsoft 等）
2. `kirocli:odic:token` - AWS SSO OIDC（kiro-cli 企业账号）
3. `codewhisperer:odic:token` - 旧版 AWS SSO OIDC

### Device Registration 键（仅 AWS SSO OIDC）

1. `kirocli:odic:device-registration` - 客户端 ID 和密钥
2. `codewhisperer:odic:device-registration` - 旧版格式

### Token 数据格式

**Social Login Token**：
```json
{
  "access_token": "eyJraWQiOiJ...",
  "refresh_token": "eyJjdHkiOiJ...",
  "profile_arn": "arn:aws:codewhisperer:us-east-1:...",
  "region": "us-east-1",
  "expires_at": "2026-01-26T16:00:00Z"
}
```

**AWS SSO OIDC Token**：
```json
{
  "access_token": "eyJraWQiOiJ...",
  "refresh_token": "eyJjdHkiOiJ...",
  "region": "us-east-1",
  "expires_at": "2026-01-26T16:00:00Z",
  "scopes": ["codewhisperer:completions", "codewhisperer:analysis"]
}
```

**Device Registration**：
```json
{
  "client_id": "arn:aws:sso::...",
  "client_secret": "...",
  "region": "us-east-1"
}
```

## 实现方案

### 后端（Rust）

#### 1. 新增模块：`src-tauri/src/kiro_cli_db.rs`

**职责**：
- 读取 SQLite 数据库
- 解析 Token 数据
- 转换为 Account 结构

**核心函数**：
```rust
pub fn read_kiro_cli_accounts(db_path: &str) -> Result<Vec<KiroCliAccount>, String>
```

**数据结构**：
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct KiroCliAccount {
    pub access_token: String,
    pub refresh_token: String,
    pub profile_arn: Option<String>,
    pub region: String,
    pub expires_at: Option<String>,
    pub scopes: Option<Vec<String>>,
    pub auth_type: String, // "social" 或 "oidc"
    pub token_key: String, // 记录来源键名
}
```

#### 2. 新增命令：`src-tauri/src/commands/kiro_cli_cmd.rs`

**命令**：
```rust
#[tauri::command]
pub fn import_from_kiro_cli(
    db_path: String,
    state: State<AppState>
) -> Result<Vec<Account>, String>
```

**流程**：
1. 调用 `read_kiro_cli_accounts()` 读取数据库
2. 遍历每个账号，调用 Kiro API 获取配额信息
3. 转换为 Account 结构
4. 检查去重（根据 user_id）
5. 返回账号列表

#### 3. 注册命令

在 `src-tauri/src/main.rs` 中注册：
```rust
.invoke_handler(tauri::generate_handler![
    // ... 现有命令
    commands::kiro_cli_cmd::import_from_kiro_cli,
])
```

### 前端（React）

#### 1. 修改 ImportAccountModal.jsx

**新增 Tab**：
```jsx
<Tabs.List>
  <Tabs.Tab value="json">JSON 导入</Tabs.Tab>
  <Tabs.Tab value="kiro">从 Kiro 导入</Tabs.Tab>
  <Tabs.Tab value="kiro-cli">从 Kiro CLI 导入</Tabs.Tab> {/* 新增 */}
</Tabs.List>
```

**新增 Panel**：
```jsx
<Tabs.Panel value="kiro-cli">
  <Stack gap="md">
    <Text size="sm" className={colors.textMuted}>
      从 kiro-cli 的 SQLite 数据库导入账号
    </Text>
    
    {/* 数据库路径输入 */}
    <TextInput
      label="数据库路径"
      placeholder="~/.local/share/kiro-cli/data.sqlite3"
      value={kiroCliDbPath}
      onChange={(e) => setKiroCliDbPath(e.target.value)}
    />
    
    {/* 浏览按钮 */}
    <Button onClick={handleBrowseKiroCliDb}>
      浏览文件
    </Button>
    
    {/* 导入按钮 */}
    <Button onClick={handleImportFromKiroCli}>
      导入账号
    </Button>
  </Stack>
</Tabs.Panel>
```

#### 2. 实现导入逻辑

```javascript
const handleImportFromKiroCli = async () => {
  try {
    setImporting(true)
    
    // 调用 Rust 命令
    const accounts = await invoke('import_from_kiro_cli', {
      dbPath: kiroCliDbPath
    })
    
    // 显示结果
    toast.success(`成功导入 ${accounts.length} 个账号`)
    
    // 刷新账号列表
    await refreshAccounts()
    
    // 关闭弹窗
    onClose()
  } catch (error) {
    toast.error(`导入失败：${error}`)
  } finally {
    setImporting(false)
  }
}
```

## 实现细节

### 1. 数据库读取策略

**优先级顺序**：
1. 尝试读取 `kirocli:social:token`（社交登录）
2. 尝试读取 `kirocli:odic:token`（AWS SSO OIDC）
3. 尝试读取 `codewhisperer:odic:token`（旧版）

**去重逻辑**：
- 如果多个键都存在，只导入第一个找到的
- 避免重复导入同一个账号

### 2. 认证类型判断

**判断依据**：
- 如果 Token 数据包含 `profile_arn` → Social Login
- 如果 Token 数据包含 `scopes` → AWS SSO OIDC
- 如果找到 Device Registration → AWS SSO OIDC

**Provider 映射**：
- Social Login → 需要进一步判断（Google/GitHub/Microsoft）
- AWS SSO OIDC → BuilderId 或 Enterprise（根据 start_url）

### 3. 配额获取

**流程**：
1. 使用 `access_token` 调用 Kiro Portal API
2. 获取 `usage_data`（包含配额信息）
3. 提取 `email` 或 `userId`
4. 判断订阅类型（Free/Pro/Pro+）

**错误处理**：
- 如果 Token 过期 → 尝试刷新
- 如果刷新失败 → 跳过该账号，继续导入其他账号
- 如果 API 调用失败 → 记录错误，继续导入

### 4. 账号去重

**去重键**：
- `user_id` 或 `email`（优先 `user_id`）

**去重策略**：
- 如果已存在相同 `user_id` 的账号 → 跳过导入
- 提示用户："已存在 X 个账号，跳过导入"

## 用户体验

### 1. 默认路径

**自动检测**：
- 打开弹窗时，自动检测默认路径是否存在
- 如果存在，自动填充到输入框
- 如果不存在，显示提示："未找到 kiro-cli 数据库"

### 2. 文件浏览

**文件选择器**：
- 使用 Tauri 的 `dialog::open` API
- 过滤器：`*.sqlite3`、`*.db`
- 默认目录：`~/.local/share/kiro-cli/`

### 3. 导入进度

**进度提示**：
- 显示"正在导入..."加载状态
- 显示导入进度："已导入 X/Y 个账号"
- 显示跳过的账号："跳过 Z 个已存在的账号"

### 4. 错误提示

**常见错误**：
- 数据库文件不存在
- 数据库格式错误
- Token 已过期
- 网络错误

**错误处理**：
- 显示友好的错误信息
- 提供解决建议
- 允许重试

## 测试计划

### 1. 单元测试

**Rust 测试**：
- 测试 SQLite 读取
- 测试 JSON 解析
- 测试数据转换

**测试用例**：
```rust
#[test]
fn test_read_social_token() {
    // 测试读取社交登录 Token
}

#[test]
fn test_read_oidc_token() {
    // 测试读取 AWS SSO OIDC Token
}

#[test]
fn test_parse_expires_at() {
    // 测试解析过期时间
}
```

### 2. 集成测试

**测试场景**：
1. 导入社交登录账号（Google/GitHub）
2. 导入 AWS SSO OIDC 账号（BuilderId/Enterprise）
3. 导入混合账号（多种类型）
4. 导入已存在的账号（去重）
5. 导入 Token 过期的账号（刷新）

### 3. 边界测试

**边界情况**：
- 空数据库
- 损坏的数据库
- 缺少必要字段的 Token
- 超长的 Token 字符串
- 特殊字符的路径

## 安全考虑

### 1. 数据库访问

**权限检查**：
- 检查文件是否可读
- 检查文件大小（防止读取超大文件）
- 使用只读模式打开数据库

### 2. Token 处理

**安全措施**：
- Token 不记录到日志
- Token 不显示在 UI（只显示前 8 位）
- Token 存储加密（使用现有的加密机制）

### 3. 错误信息

**信息脱敏**：
- 错误信息不包含完整 Token
- 错误信息不包含敏感路径
- 错误信息不包含用户邮箱

## 兼容性

### 1. kiro-cli 版本

**支持版本**：
- kiro-cli v1.0+
- amazon-q-developer-cli v1.0+

**数据库格式**：
- SQLite 3.x
- 向后兼容旧版键名

### 2. 操作系统

**支持平台**：
- Windows 10/11
- macOS 10.15+
- Linux（Ubuntu 20.04+）

**路径处理**：
- 使用 `dirs` crate 获取用户目录
- 使用 `Path::expand_user()` 展开 `~`
- 跨平台路径分隔符

## 未来扩展

### 1. 自动同步

**功能**：
- 监听 kiro-cli 数据库变化
- 自动导入新账号
- 自动更新 Token

### 2. 双向同步

**功能**：
- 将 Kiro Account Manager 的账号导出到 kiro-cli
- 保持两边账号一致

### 3. 批量操作

**功能**：
- 批量导入多个数据库
- 批量刷新 Token
- 批量删除账号

## 参考资料

- [kiro-gateway 源码](https://github.com/hj01857655/kiro-gateway) - Go + Gin 实现
- [kiro-gateway (Python 版本)](https://github.com/jwadow/kiro-gateway) - 原始 Python 实现
- [rusqlite 文档](https://docs.rs/rusqlite/)
- [Tauri Dialog API](https://tauri.app/v1/api/js/dialog/)

## 更新记录

- 2026-01-26: 创建文档，设计功能方案

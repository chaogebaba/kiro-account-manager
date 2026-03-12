# 账号保存与更新机制

本文档详细说明账号数据如何保存到文件、如何更新到文件，以及相关的数据一致性保证。

---

## 目录

1. [文件存储位置](#文件存储位置)
2. [AccountStore 结构](#accountstore-结构)
3. [保存机制](#保存机制)
4. [更新机制](#更新机制)
5. [去重机制](#去重机制)
6. [数据一致性保证](#数据一致性保证)
7. [常见场景](#常见场景)

---

## 文件存储位置

### 存储路径

**Windows**:
```
%APPDATA%\.kiro-account-manager\accounts.json
```
实际路径示例：
```
C:\Users\YourName\AppData\Roaming\.kiro-account-manager\accounts.json
```

**macOS**:
```
~/Library/Application Support/.kiro-account-manager/accounts.json
```

**Linux**:
```
~/.local/share/.kiro-account-manager/accounts.json
```

### 路径获取代码

```rust
fn get_storage_path() -> PathBuf {
    let data_dir = dirs::data_dir().unwrap_or_else(|| {
        let home = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home)
    });
    data_dir.join(".kiro-account-manager").join("accounts.json")
}
```

**说明**：
- 使用 `dirs` crate 获取系统数据目录
- 跨平台兼容（Windows/macOS/Linux）
- 如果获取失败，回退到当前目录

---

## AccountStore 结构

### 定义

```rust
pub struct AccountStore {
    pub accounts: Vec<Account>,  // 账号列表（内存中）
    file_path: PathBuf,          // 文件路径
}
```

### 初始化

```rust
impl AccountStore {
    pub fn new() -> Self {
        let file_path = Self::get_storage_path();
        let accounts = Self::load_from_file(&file_path);
        Self { accounts, file_path }
    }
}
```

**流程**：
1. 获取存储路径
2. 从文件加载账号列表
3. 创建 AccountStore 实例

### 加载文件

```rust
fn load_from_file(path: &PathBuf) -> Vec<Account> {
    if let Ok(content) = std::fs::read_to_string(path) {
        match serde_json::from_str::<Vec<Account>>(&content) {
            Ok(accounts) => {
                eprintln!("[AccountStore] 成功加载 {} 个账号", accounts.len());
                accounts
            }
            Err(e) => {
                eprintln!("[AccountStore] JSON 反序列化失败: {}", e);
                Vec::new()
            }
        }
    } else {
        eprintln!("[AccountStore] 无法读取文件: {:?}", path);
        Vec::new()
    }
}
```

**容错处理**：
- 文件不存在 → 返回空列表
- JSON 格式错误 → 返回空列表
- 打印错误日志，不中断程序

---

## 保存机制

### 核心方法

```rust
pub fn save_to_file(&self) -> bool {
    // 1. 确保目录存在
    if let Some(parent) = self.file_path.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            eprintln!("[AccountStore] 创建目录失败: {}", e);
            return false;
        }
    }
    
    // 2. 序列化为 JSON（格式化输出）
    match serde_json::to_string_pretty(&self.accounts) {
        Ok(json) => {
            // 3. 写入文件
            if let Err(e) = std::fs::write(&self.file_path, json) {
                eprintln!("[AccountStore] 写入文件失败: {}", e);
                return false;
            }
            true
        }
        Err(e) => {
            eprintln!("[AccountStore] 序列化失败: {}", e);
            false
        }
    }
}
```

### 保存时机

| 操作 | 触发命令 | 说明 |
|------|----------|------|
| 添加账号 | `add_account_by_social` | 新账号插入到列表开头 |
| 添加账号 | `add_account_by_builderid` | 新账号插入到列表开头 |
| 添加账号 | `add_account_by_enterprise` | 新账号插入到列表开头 |
| 更新账号 | `update_account` | 修改 label、token、machineId 等 |
| 同步账号 | `sync_account` | 刷新 token、更新配额 |
| 刷新 Token | `refresh_account_token` | 只刷新 token，不获取配额 |
| 删除账号 | `delete_account` | 从列表中移除 |
| 批量删除 | `delete_accounts` | 从列表中移除多个 |
| 导入账号 | `import_accounts` | 批量添加账号 |

### 保存流程图

```
修改账号数据（内存）
    ↓
调用 store.save_to_file()
    ↓
确保目录存在
    ↓
序列化为 JSON
    ↓
写入文件
    ↓
返回成功/失败
```

---

## 更新机制

### 1. 新增账号

**场景**：用户导入新账号或在线登录

**流程**：
```rust
// 1. 创建新账号
let mut account = Account::new(email, label);
account.access_token = Some(access_token);
account.refresh_token = Some(refresh_token);
// ... 填充其他字段

// 2. 检查是否已存在
let mut store = state.store.lock().unwrap();
let existing_idx = find_existing_account_idx(&store.accounts, ...);

if existing_idx.is_none() {
    // 3. 插入到列表开头
    store.accounts.insert(0, account.clone());
    
    // 4. 保存到文件
    store.save_to_file();
}
```

**关键点**：
- 新账号插入到列表**开头**（`insert(0, ...)`）
- 最新添加的账号显示在最前面
- 保存前先检查去重

### 2. 更新已存在账号

**场景**：账号已存在，更新 token 或配额

**流程**：
```rust
// 1. 查找已存在的账号
let mut store = state.store.lock().unwrap();
let existing_idx = find_existing_account_idx(&store.accounts, ...);

if let Some(idx) = existing_idx {
    // 2. 更新字段
    let existing = &mut store.accounts[idx];
    existing.access_token = Some(new_access_token);
    existing.refresh_token = Some(new_refresh_token);
    existing.usage_data = Some(usage_data);
    existing.status = calc_status(is_banned);
    
    // 3. 保存到文件
    store.save_to_file();
}
```

**关键点**：
- 直接修改列表中的账号
- 不改变账号在列表中的位置
- 保留原有的 `id`、`added_at` 等字段

### 3. 同步账号（刷新 + 获取配额）

**命令**：`sync_account`

**流程**：
```rust
pub async fn sync_account(state: State<'_, AppState>, id: String) -> Result<Account, String> {
    // 1. 获取账号
    let account = {
        let store = state.store.lock().unwrap();
        store.accounts.iter().find(|a| a.id == id).cloned()
    }.ok_or("Account not found")?;
    
    // 2. 尝试用现有 token 获取配额
    let mut usage_result = get_usage_by_provider(provider, access_token).await;
    
    // 3. 如果是认证错误，刷新 token 后重试
    if usage_result.is_auth_error {
        let refreshed = refresh_token_by_provider(&account).await?;
        usage_result = get_usage_by_provider(provider, &refreshed.access_token).await;
    }
    
    // 4. 更新账号数据
    let mut store = state.store.lock().unwrap();
    if let Some(a) = store.accounts.iter_mut().find(|a| a.id == id) {
        // 更新 token
        a.access_token = Some(refreshed.access_token);
        a.refresh_token = Some(refreshed.refresh_token);
        a.expires_at = Some(calc_expires_at(refreshed.expires_in));
        
        // 更新配额
        a.usage_data = Some(usage_result.usage_data);
        a.status = calc_status(usage_result.is_banned);
        
        // 从 usage_data 中提取并更新 email 和 user_id
        if let Some(user_info) = usage_result.usage_data.get("userInfo") {
            if let Some(email) = user_info.get("email").and_then(|v| v.as_str()) {
                a.email = Some(email.to_string());
            }
            if let Some(user_id) = user_info.get("userId").and_then(|v| v.as_str()) {
                a.user_id = Some(user_id.to_string());
            }
        }
    }
    
    // 5. 保存到文件
    store.save_to_file();
    
    Ok(account)
}
```

**关键点**：
- 先尝试用现有 token，失败才刷新
- 同时更新 token 和配额
- 从配额数据中提取 email 和 user_id

### 4. 只刷新 Token（不获取配额）

**命令**：`refresh_account_token`

**流程**：
```rust
pub async fn refresh_account_token(state: State<'_, AppState>, id: String) -> Result<Account, String> {
    // 1. 获取账号
    let account = { ... };
    
    // 2. 检查 token 是否还有 5 分钟以上有效期
    if let Some(expires_at) = &account.expires_at {
        if let Ok(exp) = chrono::NaiveDateTime::parse_from_str(expires_at, "%Y/%m/%d %H:%M:%S") {
            let now = chrono::Local::now().naive_local();
            let remaining = exp.signed_duration_since(now);
            if remaining.num_minutes() >= 5 {
                return Ok(account);  // 跳过刷新
            }
        }
    }
    
    // 3. 刷新 token
    let refresh_result = refresh_token_by_provider(&account).await?;
    
    // 4. 更新账号数据
    let mut store = state.store.lock().unwrap();
    if let Some(a) = store.accounts.iter_mut().find(|a| a.id == id) {
        a.access_token = Some(refresh_result.access_token);
        a.refresh_token = Some(refresh_result.refresh_token);
        a.expires_at = Some(calc_expires_at(refresh_result.expires_in));
        
        // 5. 保存到文件
        store.save_to_file();
        return Ok(a.clone());
    }
    
    Err("Account not found after update".to_string())
}
```

**关键点**：
- 只刷新 token，不获取配额（快速）
- 如果 token 还有 5 分钟以上有效期，跳过刷新
- 用于启动时批量刷新

### 5. 删除账号

**命令**：`delete_account` / `delete_accounts`

**流程**：
```rust
pub fn delete(&mut self, id: &str) -> bool {
    let len_before = self.accounts.len();
    self.accounts.retain(|a| a.id != id);
    let deleted = self.accounts.len() < len_before;
    if deleted {
        let _ = self.save_to_file();
    }
    deleted
}

pub fn delete_many(&mut self, ids: &[String]) -> usize {
    let len_before = self.accounts.len();
    self.accounts.retain(|a| !ids.contains(&a.id));
    let deleted = len_before - self.accounts.len();
    if deleted > 0 {
        let _ = self.save_to_file();
    }
    deleted
}
```

**关键点**：
- 使用 `retain` 过滤掉要删除的账号
- 只有真正删除了才保存文件
- 返回删除的数量

---

## 去重机制

### 去重规则

**4 字段精确匹配**：
- `email` - 邮箱
- `user_id` - 用户 ID
- `auth_method` - 认证方式（social/IdC）
- `provider` - 提供商（Google/Github/BuilderId/Enterprise）

**只有 4 个字段都相同才认为是重复账号**

### 实现代码

```rust
pub fn find_existing_account_idx(
    accounts: &[Account],
    email: &Option<String>,
    provider: &str,
    _refresh_token: &str,
    user_id: &Option<String>,
) -> Option<usize> {
    // 推断 auth_method
    let auth_method = if provider == "BuilderId" || provider == "Enterprise" {
        "IdC"
    } else {
        "social"
    };
    
    // 使用 4 字段组合精确匹配
    accounts.iter().position(|a| {
        let email_match = a.email == *email;
        let user_id_match = a.user_id == *user_id;
        let auth_method_match = a.auth_method.as_deref() == Some(auth_method);
        let provider_match = a.provider.as_deref() == Some(provider);
        
        // 4 个字段都相同才认为是重复
        email_match && user_id_match && auth_method_match && provider_match
    })
}
```

### 去重场景

| 场景 | 结果 | 说明 |
|------|------|------|
| 相同 email + 相同 provider + 相同 auth_method + 相同 user_id | 重复 | 更新已存在账号 |
| 相同 email + 不同 provider | 不重复 | 同一邮箱的不同登录方式 |
| 相同 email + 相同 provider + 不同 auth_method | 不重复 | 理论上不会出现 |
| 不同 email + 相同 user_id | 不重复 | 不同账号 |

### 示例

**场景 1：重复账号**
```json
// 已存在
{
  "email": "user@gmail.com",
  "userId": "d-123.abc",
  "provider": "Google",
  "authMethod": "social"
}

// 新导入（重复）
{
  "email": "user@gmail.com",
  "userId": "d-123.abc",
  "provider": "Google",
  "authMethod": "social"
}

// 结果：更新已存在账号的 token 和配额
```

**场景 2：不重复账号**
```json
// 已存在
{
  "email": "user@gmail.com",
  "userId": "d-123.abc",
  "provider": "Google",
  "authMethod": "social"
}

// 新导入（不重复，provider 不同）
{
  "email": "user@gmail.com",
  "userId": "d-456.def",
  "provider": "Github",
  "authMethod": "social"
}

// 结果：添加为新账号
```

---

## 数据一致性保证

### 1. 原子性保证

**修改 + 保存是原子操作**：

```rust
// ✅ 正确：修改后立即保存
let mut store = state.store.lock().unwrap();
store.accounts[idx].access_token = Some(new_token);
store.save_to_file();  // 立即持久化
drop(store);  // 释放锁

// ❌ 错误：修改后不保存
let mut store = state.store.lock().unwrap();
store.accounts[idx].access_token = Some(new_token);
drop(store);  // 释放锁
// 程序崩溃，数据丢失
```

### 2. 锁机制

**使用 Mutex 保证线程安全**：

```rust
pub struct AppState {
    pub store: Arc<Mutex<AccountStore>>,
}

// 获取锁
let mut store = state.store.lock().unwrap();

// 修改数据
store.accounts[idx].access_token = Some(new_token);

// 保存文件
store.save_to_file();

// 释放锁（自动）
drop(store);
```

**关键点**：
- 使用 `Arc<Mutex<>>` 包装 AccountStore
- 修改数据前先获取锁
- 修改完成后立即保存
- 保存后释放锁

### 3. 自动修复

**导入时自动修复缺失字段**：

```rust
// 修复 authMethod
if account.auth_method.is_none() {
    if account.client_id.is_some() && account.client_secret.is_some() {
        account.auth_method = Some("IdC".to_string());
    } else {
        account.auth_method = Some("social".to_string());
    }
}

// 修复 provider
if account.provider.is_none() && account.auth_method.as_deref() == Some("IdC") {
    if let Some(ref start_url) = account.start_url {
        if start_url.contains("awsapps.com") {
            account.provider = Some("Enterprise".to_string());
        } else {
            account.provider = Some("BuilderId".to_string());
        }
    } else {
        account.provider = Some("BuilderId".to_string());
    }
}

// 修复 machineId
if account.machine_id.is_none() {
    account.machine_id = Some(uuid::Uuid::new_v4().to_string().to_lowercase());
}
```

### 4. 容错处理

**文件操作失败不中断程序**：

```rust
pub fn save_to_file(&self) -> bool {
    // 创建目录失败
    if let Err(e) = std::fs::create_dir_all(parent) {
        eprintln!("[AccountStore] 创建目录失败: {}", e);
        return false;  // 返回失败，不中断程序
    }
    
    // 序列化失败
    match serde_json::to_string_pretty(&self.accounts) {
        Ok(json) => { ... }
        Err(e) => {
            eprintln!("[AccountStore] 序列化失败: {}", e);
            return false;  // 返回失败，不中断程序
        }
    }
    
    // 写入文件失败
    if let Err(e) = std::fs::write(&self.file_path, json) {
        eprintln!("[AccountStore] 写入文件失败: {}", e);
        return false;  // 返回失败，不中断程序
    }
    
    true
}
```

---

## 常见场景

### 场景 1：用户导入新账号

```
用户粘贴 JSON → 前端解析 → 调用 add_account_by_social
    ↓
刷新 Token → 获取配额 → 提取 email/userId
    ↓
检查去重（4 字段匹配）
    ↓
【不存在】创建新账号 → 插入到列表开头 → 保存到文件
【已存在】更新 token 和配额 → 保存到文件
```

### 场景 2：用户刷新账号配额

```
用户点击刷新按钮 → 调用 sync_account
    ↓
尝试用现有 token 获取配额
    ↓
【成功】更新配额 → 保存到文件
【401】刷新 token → 重新获取配额 → 更新 token 和配额 → 保存到文件
【封禁】标记 status = "banned" → 保存到文件
```

### 场景 3：启动时批量刷新 Token

```
应用启动 → 遍历所有账号 → 调用 refresh_account_token
    ↓
检查 token 有效期
    ↓
【>5分钟】跳过刷新
【<5分钟】刷新 token → 更新 token → 保存到文件
```

### 场景 4：用户删除账号

```
用户选中账号 → 点击删除 → 调用 delete_account
    ↓
从列表中移除账号 → 保存到文件
```

### 场景 5：用户导出账号

```
用户点击导出 → 调用 export_accounts(ids: Option<Vec<String>>)
    ↓
【ids = None 或空列表】导出全部账号
【ids = Some(非空列表)】导出选中的账号
    ↓
自动修复 provider 和 authMethod（如果为 null）
    ↓
序列化为 JSON → 返回给前端 → 前端下载文件
```

**导出逻辑**：
- 不选中任何账号 → `ids = None` → 导出全部
- 选中部分账号 → `ids = Some([id1, id2, ...])` → 导出选中的

---

## 相关文档

- `docs/dev-guides/account-structure.md` - Account 结构体详细说明
- `docs/dev-guides/account-switch-fields.md` - 切换账号字段需求
- `docs/planning/批量导入功能规划.md` - 批量导入功能规划
- `src-tauri/src/account.rs` - Account 结构体源码
- `src-tauri/src/commands/account_cmd.rs` - 账号命令实现

---

## 更新记录

- 2026-01-27: 创建文档，详细说明账号保存和更新机制

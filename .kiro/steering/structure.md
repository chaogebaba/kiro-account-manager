# 项目结构

```
├── src/                      # React 前端
│   ├── main.jsx              # 应用入口
│   ├── App.jsx               # 根组件，路由管理
│   ├── index.css             # 全局样式（Tailwind）
│   ├── api/                  # API 工具
│   │   └── webOAuth.js       # Web OAuth 辅助函数
│   ├── components/           # React 组件
│   │   ├── AccountManager/   # 账号管理功能
│   │   │   ├── index.jsx     # 主容器
│   │   │   ├── hooks/        # 自定义 hooks
│   │   │   └── *.jsx         # 子组件
│   │   ├── KiroConfig/       # Kiro 配置管理
│   │   │   ├── index.jsx     # 配置主页
│   │   │   ├── MCPPanel.jsx  # MCP 面板
│   │   │   └── PowersPanel.jsx # Powers 面板
│   │   ├── MCPManager/       # MCP 服务器管理
│   │   │   ├── index.jsx     # MCP 管理主页
│   │   │   ├── MCPServerCard.jsx # 服务器卡片
│   │   │   ├── AddMCPModal.jsx   # 添加弹窗
│   │   │   ├── EditMCPModal.jsx  # 编辑弹窗
│   │   │   └── MCPTemplates.js   # MCP 模板
│   │   ├── PowersManager/    # Powers 管理
│   │   │   └── index.jsx     # Powers 列表
│   │   ├── Home.jsx          # 首页
│   │   ├── Login.jsx         # 登录页
│   │   ├── Settings.jsx      # 设置页
│   │   ├── Sidebar.jsx       # 侧边栏导航
│   │   ├── About.jsx         # 关于页
│   │   ├── UpdateChecker.jsx # 更新检查
│   │   └── WebOAuthLogin.jsx # Web OAuth 登录
│   ├── contexts/             # React Context
│   │   ├── ThemeContext.jsx  # 主题管理
│   │   └── DialogContext.jsx # 弹窗管理
│   └── utils/                # 工具函数
│       └── accountStats.js   # 账号统计工具
│
├── src-tauri/                # Rust 后端
│   ├── src/
│   │   ├── main.rs           # Tauri 入口，命令注册
│   │   ├── commands/         # Tauri 命令处理
│   │   │   ├── mod.rs        # 模块导出
│   │   │   ├── account_cmd.rs    # 账号增删改查
│   │   │   ├── auth_cmd.rs       # 认证命令
│   │   │   ├── settings_cmd.rs   # 设置命令
│   │   │   ├── web_oauth_cmd.rs  # Web OAuth 命令
│   │   │   ├── mcp_cmd.rs        # MCP 管理命令
│   │   │   └── powers_cmd.rs     # Powers 管理命令
│   │   ├── providers/        # 认证提供者实现
│   │   │   ├── mod.rs        # 模块导出
│   │   │   ├── base.rs       # 基础 trait
│   │   │   ├── factory.rs    # 提供者工厂
│   │   │   ├── social.rs     # Google/GitHub OAuth
│   │   │   ├── idc.rs        # AWS IAM Identity Center
│   │   │   ├── web_oauth.rs  # Web OAuth 流程
│   │   │   └── web.rs        # Web 认证
│   │   ├── account.rs        # 账号模型和存储
│   │   ├── auth.rs           # 认证工具
│   │   ├── auth_social.rs    # 社交登录认证
│   │   ├── state.rs          # 应用状态管理
│   │   ├── kiro.rs           # Kiro IDE 集成
│   │   ├── mcp.rs            # MCP 配置管理
│   │   ├── powers.rs         # Powers 管理
│   │   ├── process.rs        # 进程管理
│   │   ├── browser.rs        # 浏览器操作
│   │   ├── kiro_auth_client.rs       # Kiro 认证客户端
│   │   ├── codewhisperer_client.rs   # CodeWhisperer 客户端
│   │   ├── aws_sso_client.rs         # AWS SSO 客户端
│   │   └── oauth_callback_server.rs  # OAuth 回调服务器
│   ├── tauri.conf.json       # Tauri 配置
│   └── Cargo.toml            # Rust 依赖
│
├── docs/                     # API 文档
└── scripts/                  # 构建/工具脚本
```

## 关键模式

### 前后端通信
使用 `invoke()` 调用 Rust 命令：
```javascript
import { invoke } from '@tauri-apps/api/core'
const accounts = await invoke('get_accounts')
```

### Tauri 命令
命令定义在 `src-tauri/src/commands/`，在 `main.rs` 中注册：
```rust
#[tauri::command]
pub fn get_accounts(state: State<AppState>) -> Vec<Account> {
    state.store.lock().unwrap().get_all()
}
```

### 组件组织
- 功能组件放在独立文件夹（如 `AccountManager/`）
- 自定义 hooks 放在 `hooks/` 子文件夹
- 共享 Context 放在 `src/contexts/`

### 状态管理
- React Context 管理 UI 状态（主题、弹窗）
- Tauri AppState（Mutex 包装）管理后端状态
- 本地文件持久化存储

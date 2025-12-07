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
│   │   ├── Home.jsx          # 首页
│   │   ├── Login.jsx         # 登录页
│   │   ├── Settings.jsx      # 设置页
│   │   ├── Sidebar.jsx       # 侧边栏导航
│   │   └── ...
│   ├── contexts/             # React Context
│   │   ├── ThemeContext.jsx  # 主题管理
│   │   └── DialogContext.jsx # 弹窗管理
│   └── utils/                # 工具函数
│
├── src-tauri/                # Rust 后端
│   ├── src/
│   │   ├── main.rs           # Tauri 入口，命令注册
│   │   ├── commands/         # Tauri 命令处理
│   │   │   ├── mod.rs        # 模块导出
│   │   │   ├── account_cmd.rs    # 账号增删改查
│   │   │   ├── auth_cmd.rs       # 认证命令
│   │   │   ├── settings_cmd.rs   # 设置命令
│   │   │   └── web_oauth_cmd.rs  # Web OAuth 命令
│   │   ├── providers/        # 认证提供者实现
│   │   │   ├── social.rs     # Google/GitHub OAuth
│   │   │   ├── idc.rs        # AWS IAM Identity Center
│   │   │   └── web_oauth.rs  # Web OAuth 流程
│   │   ├── account.rs        # 账号模型和存储
│   │   ├── auth.rs           # 认证工具
│   │   ├── state.rs          # 应用状态管理
│   │   ├── kiro.rs           # Kiro IDE 集成
│   │   └── ...
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

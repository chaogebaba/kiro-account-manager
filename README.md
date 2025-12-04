# Kiro Token Manager

> 智能管理 Kiro 访问令牌，一键切换，配额监控

## 开发环境

### 前置要求

- Node.js 18+
- Rust 1.70+
- pnpm / npm / yarn

### 安装依赖

```bash
# 前端依赖
pnpm install

# Rust 依赖会在首次构建时自动安装
```

### 开发运行

```bash
pnpm tauri dev
```

### 构建发布

```bash
pnpm tauri build
```

## 项目结构

```
├── src/                    # React 前端
│   ├── components/         # 组件
│   ├── contexts/           # Context (主题等)
│   └── main.jsx           # 入口
├── src-tauri/             # Tauri/Rust 后端
│   ├── src/
│   │   ├── main.rs        # 主入口
│   │   ├── auth.rs        # 认证逻辑
│   │   └── token.rs       # Token 管理
│   └── tauri.conf.json    # Tauri 配置
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

## 技术栈

- **前端**: React 18 + Vite + TailwindCSS + Lucide Icons
- **后端**: Tauri 1.x + Rust
- **存储**: 本地 JSON 文件

## 功能

- [x] Google/GitHub OAuth 登录
- [x] 多账号管理
- [x] 配额监控 (主配额/试用/奖励)
- [x] 一键切换账号
- [x] 主题切换 (浅色/深色/紫色/绿色)
- [x] 数据导出
- [ ] 自动刷新 Token
- [ ] 配额用尽提醒

## 注意事项

⚠️ 此仓库为私有开发仓库，请勿泄露源代码。

公开仓库: https://github.com/hj01857655/kiro-token-manager

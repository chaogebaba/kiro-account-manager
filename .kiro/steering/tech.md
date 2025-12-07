# 技术栈

## 前端
- React 18 + JSX（非 TypeScript）
- Vite 5 打包
- TailwindCSS 3 样式
- Lucide React 图标
- Tauri API v2 通信（`@tauri-apps/api/core`）

## 后端（Rust）
- Tauri 2.x 框架
- Tokio 异步运行时
- Reqwest HTTP 请求
- Serde 序列化
- Rusqlite 本地存储
- Chrono 日期时间处理

## Tauri 插件
- `tauri-plugin-shell` - Shell 命令执行
- `tauri-plugin-process` - 进程管理
- `tauri-plugin-updater` - 自动更新
- `tauri-plugin-opener` - 打开 URL/文件

## 常用命令

```bash
# 安装依赖
npm install

# 开发模式（启动 Vite + Tauri 开发服务器）
npm run tauri dev

# 构建生产版本
npm run tauri build

# 仅前端开发
npm run dev

# 仅前端构建
npm run build
```

## 配置文件
- `vite.config.js` - Vite 配置（端口 1420）
- `tailwind.config.js` - TailwindCSS 配置
- `src-tauri/tauri.conf.json` - Tauri 应用配置
- `src-tauri/Cargo.toml` - Rust 依赖

## 平台支持
- Windows 10/11 (64位) - 需要 WebView2
- macOS 10.15+（Intel/Apple Silicon）

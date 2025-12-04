# Kiro Token Manager

> 智能管理 Kiro 访问令牌，一键切换，配额监控

## 下载

[![Release](https://img.shields.io/github/v/release/hj01857655/kiro-token-manager?style=flat-square)](https://github.com/hj01857655/kiro-token-manager/releases/latest)

| 平台 | 下载 |
|------|------|
| Windows | [MSI 安装包](https://github.com/hj01857655/kiro-token-manager/releases/latest) |
| macOS | [DMG 安装包](https://github.com/hj01857655/kiro-token-manager/releases/latest) |

## 功能

- ✅ Google/GitHub OAuth 登录
- ✅ 多账号管理与切换
- ✅ 配额实时监控 (主配额/试用/奖励)
- ✅ 一键切换 Kiro IDE 账号
- ✅ 一键重置机器 ID
- ✅ Kiro IDE 代理/模型设置
- ✅ 主题切换 (浅色/深色/紫色/绿色)
- ✅ 数据导出

## 截图

![主界面](screenshots/main.png)

<!-- 截图放在 screenshots/ 目录下 -->

## 系统要求

- **Windows**: Windows 10/11 (64-bit)，需要 WebView2 (Win11 已内置)
- **macOS**: macOS 10.15+ (Intel/Apple Silicon)

## 技术栈

- **前端**: React 18 + Vite + TailwindCSS
- **后端**: Tauri 1.x + Rust
- **存储**: 本地 JSON 文件

## 开发

```bash
# 安装依赖
npm install

# 开发运行
npm run tauri dev

# 构建
npm run tauri build
```

## License

MIT

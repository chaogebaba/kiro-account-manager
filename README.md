# Kiro Account Manager

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-blue" alt="Platform">
  <img src="https://img.shields.io/github/v/release/hj01857655/kiro-account-manager?label=Version&color=green" alt="Version">
  <img src="https://img.shields.io/badge/QQ群-1020204332-12B7F5?logo=tencentqq" alt="QQ群">
</p>

<p align="center">
  <b>智能管理 Kiro 访问令牌，一键切换，配额监控</b>
</p>

---

## ✨ 功能特性

### 账号管理
- 🔐 **多账号管理** - 支持 Google、GitHub、BuilderId 等多种登录方式
- 🎴 **卡片网格布局** - 直观展示账号状态、配额、订阅类型
- 📊 **配额监控** - 实时查看账号配额使用情况（主配额/试用/奖励）
- 🔄 **一键切换** - 快速切换 Kiro IDE 账号，可选自动重置机器 ID
- 📦 **批量操作** - 批量刷新、批量删除、批量导入导出
- ⏰ **Token 自动刷新** - 定时刷新过期 Token，保持账号有效

### IDE 集成
- ⚙️ **IDE 设置** - 代理/模型设置同步
- 🔑 **机器 ID 管理** - 重置 Kiro IDE 机器 ID
- 🛡️ **系统机器码** - 备份/恢复/重置 Windows MachineGuid（需管理员权限）

### 配置管理
- 🔌 **MCP 服务器管理** - 查看、添加、编辑、启用/禁用 MCP 配置
- ⚡ **Powers 管理** - 查看、安装、卸载 Powers

### 界面特性
- 🎨 **主题切换** - 支持浅色、深色、紫色、绿色主题
- 🔄 **自动更新** - 检查并下载新版本
- 🔒 **本地存储** - 所有数据本地存储，隐私安全

## 📸 截图

| 首页 | 账号管理 |
|:---:|:---:|
| ![首页](screenshots/首页.png) | ![账号管理](screenshots/账号管理.png) |

| 登录 | 设置 |
|:---:|:---:|
| ![登录页](screenshots/登录页.png) | ![设置](screenshots/设置.png) |

| 关于 |
|:---:|
| ![关于](screenshots/关于.png) |

## 📥 下载

[![Release](https://img.shields.io/github/v/release/hj01857655/kiro-account-manager?style=flat-square)](https://github.com/hj01857655/kiro-account-manager/releases/latest)

👉 **[点击这里下载最新版本](https://github.com/hj01857655/kiro-account-manager/releases/latest)**

| 平台 | 文件类型 | 说明 |
|------|----------|------|
| Windows | `.msi` | 推荐，双击安装 |
| Windows | `.exe` | NSIS 安装程序 |
| macOS | `.dmg` | 拖入 Applications |

## 💻 系统要求

- **Windows**: Windows 10/11 (64-bit)，需要 WebView2 (Win11 已内置)
- **macOS**: macOS 10.15+ (Intel/Apple Silicon 通用)

## 🛠️ 技术栈

- **前端**: React 18 + Vite 5 + TailwindCSS 3 + Lingui (i18n)
- **后端**: Tauri 2.x + Rust + Tokio
- **图标**: Lucide React
- **存储**: JSON 文件本地存储

## 📁 数据存储

| 数据 | 路径 |
|------|------|
| 账号数据 | `%APPDATA%\.kiro-account-manager\accounts.json` |
| 应用设置 | `%APPDATA%\.kiro-account-manager\settings.json` |
| MCP 配置 | `~/.kiro/settings/mcp.json` |
| Powers 注册表 | `~/.kiro/powers/registry.json` |

## 💬 交流反馈

- 💡 问题反馈、功能建议、使用交流
- 🐛 [提交 Issue](https://github.com/hj01857655/kiro-account-manager/issues)
- 💬 QQ 群：[Kiro Account Manager 交流群 (1020204332)](https://qm.qq.com/q/Vh7mUrNpa8)

<p align="center">
  <a href="https://qm.qq.com/q/Vh7mUrNpa8">
    <img src="https://img.shields.io/badge/QQ群-1020204332-12B7F5?style=for-the-badge&logo=tencentqq&logoColor=white" alt="QQ群">
  </a>
</p>

## ⚠️ 免责声明

本软件仅供学习交流使用，请勿用于商业用途。使用本软件所产生的任何后果由用户自行承担。

---

<p align="center">Made with ❤️ by hj01857655</p>

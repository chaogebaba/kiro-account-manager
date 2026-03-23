# 第三方 Kiro 相关项目

> 本文档收集了 GitHub 上与 Kiro IDE 相关的第三方开源项目。

## 📊 项目分类

### 🔐 账号管理工具

#### 1. WhiteBite/kiro-manager-wb
- **语言**：Python
- **描述**：Kiro 账号管理工具，支持自动注册和 Token 管理
- **链接**：https://github.com/WhiteBite/kiro-manager-wb
- **特点**：
  - 支持 WebView OAuth 认证
  - 集成 KiroWebPortalService 客户端
  - 提供 CBOR 格式支持

#### 2. chaogei/Kiro-account-manager
- **语言**：TypeScript (Electron)
- **描述**：基于 Electron 的 Kiro 账号管理器
- **链接**：https://github.com/chaogei/Kiro-account-manager
- **特点**：
  - Electron 桌面应用
  - 多账号管理
  - 集成 KiroWebPortalService

#### 3. leonaii/Kiro-Cloud-Auth
- **语言**：TypeScript (Electron)
- **描述**：Kiro 账号管理云端工具，支持 Electron 桌面客户端和 Web 版本，提供 OpenAI 兼容 API 接口
- **链接**：https://github.com/leonaii/Kiro-Cloud-Auth
- **特点**：
  - 多账号管理
  - OpenAI 兼容 API
  - 云端同步

---

### 🤖 自动注册工具

#### 4. keggin-CHN/kiro-auto-register
- **语言**：Python
- **描述**：Kiro 注册机，自动获取 refresh token 等
- **链接**：https://github.com/keggin-CHN/kiro-auto-register
- **特点**：
  - 自动注册
  - OAuth 认证
  - Token 获取

#### 5. Pluviobyte/Kiro-auto-register
- **语言**：TypeScript (Electron)
- **描述**：Kiro 自动注册，支持邮件验证码获取和多平台账号管理
- **链接**：https://github.com/Pluviobyte/Kiro-auto-register
- **特点**：
  - 邮件验证码自动获取
  - 多平台账号管理
  - Electron 桌面应用

---

### 🌐 API 代理/转换工具

#### 6. aliom-v/KiroGate
- **语言**：Python
- **描述**：OpenAI & Anthropic 兼容的 Kiro IDE API 代理网关，支持 Claude Code CLI
- **链接**：https://github.com/aliom-v/KiroGate
- **特点**：
  - OpenAI API 兼容
  - Anthropic API 兼容
  - 支持 Claude Code CLI
  - 集成 KiroWebPortalService

#### 7. justlovemaki/AIClient-2-API
- **语言**：TypeScript
- **描述**：AI 客户端转 API 兼容代理
- **链接**：https://github.com/justlovemaki/AIClient-2-API
- **特点**：
  - API 兼容层
  - 客户端转换

#### 8. Lavender3533/kiro2Api
- **语言**：TypeScript
- **描述**：Kiro 转 API 工具
- **链接**：https://github.com/Lavender3533/kiro2Api
- **特点**：
  - Kiro 转标准 API
  - TypeScript 实现

#### 9. dangweilinshinidie/kiro-reverse-api
- **语言**：TypeScript
- **描述**：Kiro 逆向 API
- **链接**：https://github.com/dangweilinshinidie/kiro-reverse-api
- **特点**：
  - 逆向工程
  - API 实现

---

### 🛠️ 综合工具

#### 10. PumpkinTTL/kiro-automation-toolkit
- **语言**：Python
- **描述**：Kiro 自动化工具包
- **链接**：https://github.com/PumpkinTTL/kiro-automation-toolkit
- **特点**：
  - 自动化工具集
  - Python 实现

#### 11. zhongruan0522/AntiHub-ALL
- **语言**：TypeScript
- **描述**：综合性平台
- **链接**：https://github.com/zhongruan0522/AntiHub-ALL
- **特点**：
  - 多功能集成
  - 综合性工具

---

### 📝 教程/文档

#### 12. Rupert-WLLP-Bai/Rupert-WLLP-Bai.github.io
- **语言**：HTML
- **描述**：个人博客，包含 Kiro 注册机教程
- **链接**：https://github.com/Rupert-WLLP-Bai/Rupert-WLLP-Bai.github.io
- **特点**：
  - Kiro 注册机教程
  - 技术博客

---

### 🔄 Fork/变体项目

#### 13. ggjjc786-boop/254868876846
- **语言**：Rust + React (Tauri)
- **描述**：Kiro Account Manager 的变体
- **链接**：https://github.com/ggjjc786-boop/254868876846
- **特点**：
  - Tauri 框架
  - Web OAuth 支持

#### 14. ggjjc786-boop/flyciro
- **语言**：Rust + React (Tauri)
- **描述**：Kiro Account Manager 的另一个变体
- **链接**：https://github.com/ggjjc786-boop/flyciro
- **特点**：
  - Tauri 框架
  - 多语言支持（中文、英文、俄文）

---

## 📈 项目统计

- **总项目数**：14 个
- **主要语言**：
  - Python: 4 个
  - TypeScript: 7 个
  - Rust: 2 个
  - HTML: 1 个
- **主要框架**：
  - Electron: 3 个
  - Tauri: 2 个
  - 纯 Python: 4 个
- **创建时间**：大多数项目创建于 2025年12月 - 2026年1月

---

## 🔍 技术栈分析

### 常用技术

1. **KiroWebPortalService API**
   - 几乎所有项目都使用此 API
   - 用于 Token 交换、刷新、配额查询

2. **OAuth 认证**
   - Google OAuth
   - GitHub OAuth
   - AWS IAM Identity Center (BuilderId/Enterprise)

3. **桌面框架**
   - Electron（TypeScript 项目）
   - Tauri（Rust 项目）

4. **API 兼容层**
   - OpenAI API 格式
   - Anthropic API 格式

---

## 📊 搜索结果汇总

### 最新搜索（2026-01-25）

**搜索关键词**：`KiroWebPortalService`

**第三方公开仓库（10个）**：

1. **aliom-v/KiroGate** (Python)
   - https://github.com/aliom-v/KiroGate

2. **WhiteBite/kiro-manager-wb** (Python)
   - https://github.com/WhiteBite/kiro-manager-wb

3. **keggin-CHN/kiro-auto-register** (Python)
   - https://github.com/keggin-CHN/kiro-auto-register

4. **chaogei/Kiro-account-manager** (TypeScript)
   - https://github.com/chaogei/Kiro-account-manager

5. **leonaii/Kiro-Cloud-Auth** (TypeScript)
   - https://github.com/leonaii/Kiro-Cloud-Auth

6. **Pluviobyte/Kiro-auto-register** (TypeScript)
   - https://github.com/Pluviobyte/Kiro-auto-register

7. **ggjjc786-boop/254868876846** (Rust)
   - https://github.com/ggjjc786-boop/254868876846

8. **ggjjc786-boop/flyciro** (Rust)
   - https://github.com/ggjjc786-boop/flyciro

**说明**：
- 以上均为社区贡献的第三方开源项目
- 不包含 hj01857655 的官方项目

---

## ⚠️ 免责声明

本文档仅收集公开的第三方项目信息，不代表本项目对这些项目的认可或推荐。使用这些第三方项目时，请遵守相关法律法规和服务条款。

---

## 📝 贡献

如果你发现了其他相关的第三方项目，欢迎提交 PR 或 Issue 补充。

---

**最后更新**：2026-01-25
**搜索关键词**：KiroWebPortalService
**第三方项目数**：10 个公开仓库（不含官方项目）

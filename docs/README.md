# Kiro Account Manager 文档

本目录包含 Kiro Account Manager 项目的所有文档。

## 📁 目录结构

### 📘 api-reference/ - API 参考文档
Kiro IDE 和相关服务的 API 接口文档。

- `Kiro API.md` - Kiro IDE 完整 API 文档
- `CodeWhispererRuntimeService API.md` - CodeWhisperer Runtime 服务 API
- `api-endpoints.md` - API 端点列表
- `essential-endpoints.md` - 核心端点说明
- `get-usage.md` - 配额查询 API
- `enterprise-response-format.md` - 企业版响应格式
- `Enterprise-vs-BuilderId.md` - Enterprise 与 BuilderId 对比
- `Kiro Desktop Auth Provider.md` - 桌面认证提供者
- `jwt-payload-decoded.json` - JWT Token 解析示例

### 📗 user-guides/ - 用户指南
面向最终用户的使用教程和说明。

- `使用教程.md` - 应用使用教程
- `从Kiro导入功能说明.md` - 从 Kiro IDE 导入账号
- `手动修改Token教程.md` - 手动修改 Token 方法
- `系统机器码说明.md` - 系统机器码管理
- `Windows安装包说明.md` - Windows 安装说明
- `封禁检测逻辑.md` - 账号封禁检测机制

### 📙 planning/ - 规划文档
功能规划、方案对比和实现总结。

- `MCP管理功能规划.md` - MCP 服务器管理功能规划
- `批量导入功能规划.md` - 批量导入功能设计
- `机器ID替换方案对比.md` - 机器 ID 替换方案分析
- `kirogate-implementation-summary.md` - Kiro Gateway 实现总结

### 📕 dev-guides/ - 开发指南
面向开发者的规范、指南和教程。

- `开发规范文档.md` - 项目开发规范
- `COMMIT_GUIDE.md` - Git 提交规范
- `dialog-modal-best-practices.md` - 弹窗设计最佳实践
- `hooks-guide.md` - Hooks 使用指南
- `Kiro配置文件说明.md` - Kiro IDE 配置文件说明
- `openskills-tutorial.md` - OpenSkills 教程
- `register-script-rules.md` - 注册脚本规则
- `release.md` - 发布流程
- `release.yml` - 发布配置

### 🔧 api/ - API 详细文档
按服务分类的详细 API 文档。

- `AuthDesktopService/` - 桌面认证服务 API
- `CodeWhispererRuntimeService/` - CodeWhisperer Runtime API
- `KiroWebPortalService/` - Kiro Web Portal API

### 🧪 kiro-source-analysis/ - Kiro IDE 源码分析
Kiro IDE 源码的分析文档。

- `README.md` - 源码分析说明
- `embedding-model.md` - 嵌入模型分析
- `machine-id.md` - 机器 ID 实现分析
- `social-auth-provider.md` - 社交登录提供者分析
- `sso-oidc-client.md` - SSO OIDC 客户端分析
- `xhr-sync-worker.md` - XHR 同步 Worker 分析

### 📦 templates/ - Token 模板
各种认证方式的 Token 格式示例。

- `BuilderId/` - BuilderId Token 示例
- `Enterprise/` - Enterprise Token 示例
- `social/` - 社交登录 Token 示例
- `Token Format Comparison.md` - Token 格式对比

### 🗑️ dist/ - 已废弃
从 Kiro IDE 提取的源码文件（仅供参考，不再维护）。

---

## 📝 文档编写规范

1. **中文优先**：所有文档使用中文编写
2. **Markdown 格式**：使用标准 Markdown 语法
3. **代码示例**：提供完整的代码示例和注释
4. **版本标注**：涉及特定版本的功能需标注版本号
5. **更新日期**：文档底部注明最后更新日期

## 🔗 相关链接

- [项目 README](../README.md)
- [开发规范](.kiro/steering/project-info.md)
- [UI 设计规范](.kiro/steering/ui-design.md)
- [第三方项目](third-party-projects.md) - GitHub 上的相关开源项目

---

**最后更新**：2026-01-25

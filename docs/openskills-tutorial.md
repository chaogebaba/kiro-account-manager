# OpenSkills 在 Kiro 中使用教程

## 简介

OpenSkills 是将 Anthropic 的 skills 系统带到各种 AI 编码代理的工具，让 Kiro 能够按需加载专业技能指令。

## 安装步骤

### 1. 安装 openskills CLI

```bash
npm i -g openskills
```

### 2. 安装技能（Windows 需手动）

由于 Windows 路径 bug，需要手动安装：

```powershell
# 克隆技能仓库
git clone https://github.com/anthropics/skills.git "$env:USERPROFILE\.claude\skills-temp"

# 创建目录并复制
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\skills"
Copy-Item -Recurse -Force "$env:USERPROFILE\.claude\skills-temp\skills\*" "$env:USERPROFILE\.claude\skills\"

# 清理临时文件
Remove-Item -Recurse -Force "$env:USERPROFILE\.claude\skills-temp"
```

macOS/Linux 可以直接用命令：
```bash
openskills install anthropics/skills --global -y
```

### 3. 创建 AGENTS.md 并同步

**重要：必须先创建 AGENTS.md 文件，sync 才能工作！**

```powershell
# 在项目根目录创建 AGENTS.md
echo "# Agent Instructions" > AGENTS.md

# 同步技能列表到 AGENTS.md
openskills sync -y
```

### 4. 全局生效（推荐）

把 AGENTS.md 复制到 Kiro 全局 steering 目录，所有项目都能用：

```powershell
Copy-Item "AGENTS.md" "$env:USERPROFILE\.kiro\steering\AGENTS.md"
```

macOS/Linux：
```bash
cp AGENTS.md ~/.kiro/steering/AGENTS.md
```

这样就不需要每个项目都创建 AGENTS.md 了。

## 验证安装

```bash
# 查看已安装技能
openskills list

# 测试读取技能
openskills read xlsx
```

## 可用技能列表

- `algorithmic-art` - 用 p5.js 创建生成艺术
- `brand-guidelines` - Anthropic 品牌风格指南
- `canvas-design` - 创建海报、视觉设计
- `doc-coauthoring` - 协作撰写文档
- `docx` - Word 文档操作
- `frontend-design` - 高质量前端界面设计
- `internal-comms` - 内部沟通文档
- `mcp-builder` - 构建 MCP 服务器
- `pdf` - PDF 处理
- `pptx` - PPT 演示文稿
- `skill-creator` - 创建自定义技能
- `slack-gif-creator` - Slack GIF 动画
- `theme-factory` - 主题样式工具包
- `web-artifacts-builder` - 复杂 Web 组件
- `webapp-testing` - Playwright 测试
- `xlsx` - Excel 电子表格

## 使用方式

当你让 Kiro 执行匹配技能描述的任务时，Kiro 会自动调用：

```bash
openskills read <skill-name>
```

加载详细指令后按指令完成任务。

## 相关链接

- OpenSkills 仓库：https://github.com/numman-ali/openskills
- Anthropic Skills 仓库：https://github.com/anthropics/skills
- Windows bug issue：https://github.com/numman-ali/openskills/issues/34

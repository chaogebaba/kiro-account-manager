# Kiro IDE 配置文件说明

Kiro IDE 的用户配置存放在 `~/.kiro/` 目录下（Windows: `C:\Users\<用户名>\.kiro\`）。

## 目录结构

```
~/.kiro/
├── extensions/           # 已安装的扩展
├── powers/
│   └── registry.json     # Powers 注册表
├── skills/               # Skills（技能）
│   └── <skill-name>/
│       └── SKILL.md      # Skill 指令文件
├── agents/               # 自定义 Agents（v0.9.2+）
│   └── <agent-id>.md     # Agent 定义文件
├── steering/             # Steering 规则（全局）
│   └── *.md              # Markdown 格式的指导文件
└── settings/
    └── mcp.json          # MCP 服务器配置
```

---

## 1. MCP 配置 (`settings/mcp.json`)

> 路径说明：用户级为 `~/.kiro/settings/mcp.json`，项目级为 `<project>/.kiro/settings/mcp.json`。

MCP (Model Context Protocol) 服务器配置，用于扩展 AI 的能力。

### 配置结构

```json
{
  "mcpServers": {
    "<服务器名称>": {
      "command": "uvx",           // 启动命令
      "args": ["<包名>"],          // 命令参数
      "env": {},                   // 环境变量
      "disabled": false,           // 是否禁用
      "autoApprove": []            // 自动批准的工具列表
    }
  }
}
```

### 示例配置

```json
{
  "mcpServers": {
    "fetch": {
      "command": "uvx",
      "args": ["mcp-server-fetch"],
      "env": {},
      "disabled": false,
      "autoApprove": []
    },
    "acetool": {
      "command": "uvx",
      "args": ["acetool"],
      "autoApprove": ["search_context"]
    }
  }
}
```

### 常用 MCP 服务器

| 服务器 | 包名 | 功能 |
|--------|------|------|
| fetch | mcp-server-fetch | 网页内容抓取 |
| acetool | acetool | 代码语义搜索 |
| aws-docs | awslabs.aws-documentation-mcp-server@latest | AWS 文档查询 |

### 配置说明

- `command`: 通常使用 `uvx`（需要安装 uv Python 包管理器）
- `args`: MCP 服务器的包名
- `autoApprove`: 列出的工具会自动执行，无需用户确认
- `disabled`: 设为 `true` 可临时禁用服务器

---

## 2. Skills（技能）(`skills/`)

Skills 是可复用的指令集/能力模块，类似插件或工具包，按需激活动态加载到 AI 上下文。

### 目录结构

```
~/.kiro/skills/               # 用户级 Skills（全局）
├── code-review/
│   └── SKILL.md              # 代码审查规则
├── react-best-practices/
│   └── SKILL.md              # React 开发规范
└── security-check/
    └── SKILL.md              # 安全检查清单

.kiro/skills/                 # 工作区级 Skills（项目特定）
└── project-specific-skill/
    └── SKILL.md
```

### SKILL.md 格式

每个 skill 必须包含一个 `SKILL.md` 文件，内容为 Markdown 格式的完整指令：

```markdown
# Code Review Skill

当需要代码审查时，请遵循以下规则：

## 检查项
1. 代码风格是否符合规范
2. 是否存在安全漏洞
3. 性能是否可以优化
4. 是否有重复代码

## 输出格式
- 问题列表
- 改进建议
- 代码示例
```

### 激活方式

Skills 通过 `discloseContext` 工具按需激活：

```
用户："帮我审查这段代码"
AI：检测到需要代码审查
AI：调用 discloseContext("code-review")
Kiro：加载 code-review/SKILL.md
AI：根据 skill 指令执行审查
```

### 导入方式

- 从本地文件夹导入（必须包含 SKILL.md）
- 从 GitHub URL 导入（指向包含 SKILL.md 的文件夹）

---

## 3. 自定义 Agents（Custom Agents）(`agents/`)

**版本要求**：v0.9.2+（v0.8.206 叫 "sub-agent"，v0.9.2 改名为 "custom agent"）

自定义 Agents 允许你创建专门的 AI 助手，用于特定任务。每个 agent 是一个独立的 Markdown 文件，包含 YAML frontmatter 配置和 Markdown 指令。

### 目录结构

```
~/.kiro/agents/               # 用户级 Agents（全局）
├── code-reviewer.md          # 代码审查 agent
├── test-generator.md         # 测试生成 agent
└── doc-writer.md             # 文档编写 agent

.kiro/agents/                 # 工作区级 Agents（项目特定）
└── project-agent.md          # 项目特定 agent
```

### Agent 文件格式

文件名即为 agent ID（如 `code-reviewer.md` 的 ID 是 `code-reviewer`）。

**文件结构**：
```markdown
---
id: code-reviewer
description: 专门用于代码审查的 agent
tools:
  - read
  - write
model: claude-sonnet-4
---

# Code Reviewer Agent

你是一个专业的代码审查助手。

## 审查标准
1. 代码风格
2. 安全问题
3. 性能优化
4. 最佳实践

## 输出格式
- 问题列表
- 改进建议
- 优先级排序
```

### YAML Frontmatter 字段

| 字段 | 必需 | 说明 | 示例 |
|------|------|------|------|
| `id` | ✅ | Agent 唯一标识 | `code-reviewer` |
| `description` | ✅ | Agent 描述 | `专门用于代码审查的 agent` |
| `tools` | ✅ | 允许使用的工具标签 | `["read", "write"]` |
| `model` | ❌ | 使用的模型 | `claude-sonnet-4` |

### 工具标签说明

使用标签而非具体工具名，更稳定：

| 标签 | 包含的工具 |
|------|-----------|
| `read` | readFile、readCode、listDirectory、grepSearch 等 |
| `write` | fsWrite、strReplace、editCode、deleteFile 等 |
| `shell` | executePwsh、controlPwshProcess 等 |
| `web` | remote_web_search、webFetch 等 |
| `spec` | Spec 相关工具 |
| `@mcp` | 所有 MCP 工具 |
| `@powers` | 所有 Powers 工具 |
| `@builtin` | 所有内置工具 |

**示例**：
```yaml
tools:
  - read      # 允许读取文件
  - write     # 允许写入文件
  - @mcp      # 允许使用所有 MCP 工具
```

### 内置 Custom Agents

Kiro IDE 内置了以下 agents：

| Agent ID | 描述 |
|----------|------|
| `context-gatherer` | 探索代码库，识别相关文件 |
| `general-task-execution` | 通用任务执行器 |
| `custom-agent-creator` | 创建新 custom agent 的专用 agent（v0.9.2 引入，v0.10.32 可用） |
| `spec-task-execution` | Spec 任务执行器 |
| `feature-design-first-workflow` | 功能设计优先工作流 |
| `feature-requirements-first-workflow` | 需求优先工作流 |
| `bugfix-workflow` | Bugfix 工作流（`bugfix.md -> design.md -> tasks.md`） |

### 调用方式

通过 `invokeSubAgent` 工具调用：

```javascript
invokeSubAgent({
  name: "code-reviewer",
  prompt: "审查这段代码：...",
  explanation: "需要专业的代码审查"
})
```

### 创建新 Agent

**方法 1：使用 custom-agent-creator**
```
用户："创建一个代码审查 agent"
AI：调用 invokeSubAgent("custom-agent-creator", "创建代码审查 agent")
custom-agent-creator：询问用户需求
用户：提供审查标准和输出格式
custom-agent-creator：生成 .kiro/agents/code-reviewer.md
```

**方法 2：手动创建**
1. 在 `.kiro/agents/` 或 `~/.kiro/agents/` 创建 `.md` 文件
2. 添加 YAML frontmatter 配置
3. 编写 Markdown 指令
4. Kiro 自动发现并注册

### AGENTS.md 文件

**位置**：项目根目录（不是 `.kiro/agents/` 目录）

**作用**：
- 作为 steering 文档使用
- 描述项目中可用的 agents
- 提供 agents 使用指南

**与 custom agents 的区别**：
- `AGENTS.md`：文档，描述 agents
- `.kiro/agents/*.md`：实际的 agent 定义文件

**示例**：
```markdown
# Project Agents

## Code Reviewer Agent
- 专注于代码审查
- 检查代码风格和最佳实践

## Documentation Agent
- 生成和维护文档
- 确保文档与代码同步
```

---

## 4. Steering 规则 (`steering/`)

Steering 文件用于给 AI 提供项目上下文和规范。

### 包含模式

**1. 始终包含**（默认）
```yaml
---
inclusion: always
---

# 我的规则

这个规则会在每次对话时自动加载。
```

**2. 自动激活**（v0.9.2+ 新增）
```yaml
---
inclusion: auto
---

# 我的自动激活规则

这个规则只在通过 discloseContext 工具激活时加载，节省 token。
```

**3. 文件匹配**
```yaml
---
inclusion: fileMatch
fileMatchPattern: '**/*.py'
---

# Python 开发规范

当读取 Python 文件时自动加载。
```

**4. 手动引用**
```yaml
---
inclusion: manual
---

# 手动引用规则

通过 `#规则名` 手动引用时加载。
```

### 包含模式对比

| 模式 | 触发时机 | 使用场景 |
|------|----------|----------|
| `always` | 每次对话都加载 | 全局规则，始终生效 |
| `auto` | 通过 discloseContext 按需激活 | 按需加载，节省 token |
| `fileMatch` | 匹配的文件被读取时加载 | 特定文件类型的规则 |
| `manual` | 手动引用（`#` 语法） | 用户主动引用 |

---

## 5. 版本变化（v0.9.2 → v0.10.32）

### v0.9.2（引入）
- Skills / Custom Agents / Powers registry-v2 架构上线
- Steering 新增 `inclusion: auto`

### v0.10.x（增强，当前对齐 v0.10.32）
- Spec 工作流增强：
  - Feature 支持 `requirements-first` / `design-first`
  - Bugfix 支持独立 workflow（`bugfix.md -> design.md -> tasks.md`）
- 导航与执行能力：
  - `kiro.spec.navigateToRequirements` / `kiro.spec.navigateToDesign` / `kiro.spec.navigateToTasks` / `kiro.spec.navigateToBugfix`
  - `kiro.spec.runAllTasks`
- Supervised hunk 级审查：`supervisedDiff.discussHunk`
- Hook 扩展到任务阶段：Pre/Post Task Execution（Hooks 文件仍位于 `<project>/.kiro/hooks/*.kiro.hook`）
- MCP 增强：Prompts / Resource Templates / Elicitation

---

## 6. Powers 注册表 (`powers/registry.json`)

Powers 是 Kiro 的扩展能力包，包含文档、工作流指南和 MCP 服务器。

### 配置结构

```json
{
  "version": "1.0.0",
  "powers": {
    "<power名称>": {
      "name": "power名称",
      "displayName": "显示名称",
      "description": "功能描述",
      "author": "作者",
      "keywords": [],
      "iconUrl": "图标URL",
      "repositoryUrl": "仓库地址",
      "installed": false
    }
  },
  "kiroRecommendedRepo": {
    "url": "官方注册表URL",
    "lastFetch": "最后更新时间",
    "powerCount": 15
  }
}
```

### 官方可用 Powers

| Power | 描述 |
|-------|------|
| postman | API 测试和集合管理 |
| figma | 设计稿转代码 |
| netlify-deployment | 部署 Web 应用到 Netlify |
| supabase-hosted | Supabase 后端服务（托管） |
| supabase-local | Supabase 本地开发 |
| strands | 使用 Strands SDK 构建 AI Agent |
| aws-agentcore | Amazon Bedrock AgentCore |
| neon | Neon Serverless Postgres |
| cloud-architect | AWS CDK 基础设施 |
| datadog | Datadog 可观测性 |
| dynatrace | Dynatrace 可观测性 |
| aurora-dsql | AWS Aurora DSQL 分布式数据库 |
| saas-builder | SaaS 应用构建 |
| stripe | Stripe 支付集成 |
| terraform | Terraform 基础设施即代码 |

### 安装 Power

在 Kiro IDE 中使用命令面板搜索 "Powers" 或通过侧边栏的 Powers 面板安装。

**注意**：Powers registry-v2 于 v0.9.2 引入，在 v0.10.32 仍为当前主架构。

---

## 7. 工作区配置 (`.kiro/`)

每个项目可以有自己的 `.kiro/` 目录：

```
项目根目录/
├── AGENTS.md             # 自定义 Agents 配置（工作区级）
└── .kiro/
    ├── hooks/            # 项目级 Hooks
    │   └── *.kiro.hook   # Hook JSON 文件
    ├── skills/           # 工作区级 Skills
    │   └── <skill-name>/
    │       └── SKILL.md
    ├── agents/           # 工作区级 Custom Agents
    │   └── <agent-id>.md
    ├── settings/
    │   └── mcp.json      # 工作区级 MCP 配置（覆盖全局）
    └── steering/         # Steering 规则
        └── *.md          # Markdown 格式的指导文件
```

### Hooks（源码总结）

Hooks 文件位于：`<project>/.kiro/hooks/*.kiro.hook`。

触发类型（`when.type`）：

- `userTriggered`
- `fileEdited`
- `promptSubmit`
- `agentStop`

动作类型（`then.type`）：

- `askAgent`（需 `prompt`）
- `runShellCommand`（需 `command`）

行为语义：

- 保存：以写入为主，不做 save-time Hook Schema 阻断
- 读取：JSON 解析后做结构校验（`HookSchema.safeParse`），无效文件在读取阶段报 invalid-data

---

## 8. 应用数据目录 (`%APPDATA%\Kiro`)

Kiro IDE 的运行时数据：

| 目录/文件 | 用途 |
|-----------|------|
| User/settings.json | 用户设置 |
| machineid | 机器标识 |
| logs/ | 日志文件 |
| Cache/ | 缓存数据 |
| Backups/ | 备份 |
| Local Storage/ | 本地存储 |
| workspaceStorage/ | 工作区存储 |

---

## 配置优先级

MCP 配置合并优先级（后者覆盖前者）：

1. 用户全局配置 (`~/.kiro/settings/mcp.json`)
2. 工作区配置 (`.kiro/settings/mcp.json`)（同名服务器覆盖用户级）
3. Powers 注入配置（`powers.mcpServers`）
4. 多根工作区中，每个工作区读取自己的 `.kiro/settings/mcp.json`（不共享同一文件）

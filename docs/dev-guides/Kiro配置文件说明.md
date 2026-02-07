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
├── agents/               # 自定义 Agents
│   └── AGENTS.md         # Agents 配置文件
├── steering/             # Steering 规则（全局）
│   └── *.md              # Markdown 格式的指导文件
└── settings/
    └── mcp.json          # MCP 服务器配置
```

---

## 1. MCP 配置 (`settings/mcp.json`)

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
~/.kiro/skills/
├── code-review/
│   └── SKILL.md          # 代码审查规则
├── react-best-practices/
│   └── SKILL.md          # React 开发规范
└── security-check/
    └── SKILL.md          # 安全检查清单
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

## 3. 自定义 Agents (`agents/AGENTS.md`)

自定义 Agents 允许你创建专门的 AI 助手，用于特定任务。

### 文件位置

- 用户级：`~/.kiro/agents/AGENTS.md`
- 工作区级：`.kiro/agents/AGENTS.md`（项目根目录）

### 配置格式

```markdown
# My Custom Agents

## Code Reviewer Agent

**Name**: code-reviewer
**Description**: 专门用于代码审查的 AI 助手
**System Prompt**: 你是一个专业的代码审查专家...

## Documentation Writer Agent

**Name**: doc-writer
**Description**: 自动生成项目文档
**System Prompt**: 你是一个技术文档撰写专家...
```

### 使用方式

在 Kiro IDE 中通过命令面板或侧边栏选择自定义 agent，它会使用你定义的 system prompt 和配置。

---

## 4. Powers 注册表 (`powers/registry.json`)

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

**注意**：v0.9.2 版本对 Powers 系统进行了重构，提升了稳定性和性能。

---

## 5. 工作区配置 (`.kiro/`)

每个项目可以有自己的 `.kiro/` 目录：

```
项目根目录/.kiro/
├── hooks/                # Agent Hooks
│   └── *.kiro.hook       # Hook 配置文件
├── skills/               # 工作区级 Skills
│   └── <skill-name>/
│       └── SKILL.md
├── agents/               # 工作区级 Agents
│   └── AGENTS.md
├── settings/
│   └── mcp.json          # 工作区级 MCP 配置（覆盖全局）
└── steering/             # Steering 规则
    └── *.md              # Markdown 格式的指导文件
```

### Steering 文件

Steering 文件用于给 AI 提供项目上下文和规范：

#### 包含模式

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

#### 包含模式对比

| 模式 | 触发时机 | 使用场景 |
|------|----------|----------|
| `always` | 每次对话都加载 | 全局规则，始终生效 |
| `auto` | 通过 discloseContext 激活 | 按需加载，节省 token |
| `fileMatch` | 匹配的文件被读取时加载 | 特定文件类型的规则 |
| `manual` | 手动引用（`#` 语法） | 用户主动引用 |

### Hooks

Agent Hooks 可以在特定事件触发时自动执行：

- 发送消息时
- Agent 执行完成时
- 新会话创建时
- 保存文件时

---

## 4. 应用数据目录 (`%APPDATA%\Kiro`)

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
2. 工作区配置 (`.kiro/settings/mcp.json`)
3. 多根工作区中，后面的工作区覆盖前面的

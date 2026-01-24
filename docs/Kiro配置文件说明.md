# Kiro IDE 配置文件说明

Kiro IDE 的用户配置存放在 `~/.kiro/` 目录下（Windows: `C:\Users\<用户名>\.kiro\`）。

## 目录结构

```
~/.kiro/
├── extensions/           # 已安装的扩展
├── powers/
│   └── registry.json     # Powers 注册表
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

## 2. Powers 注册表 (`powers/registry.json`)

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

---

## 3. 工作区配置 (`.kiro/`)

每个项目可以有自己的 `.kiro/` 目录：

```
项目根目录/.kiro/
├── hooks/                # Agent Hooks
│   └── *.kiro.hook       # Hook 配置文件
├── settings/
│   └── mcp.json          # 工作区级 MCP 配置（覆盖全局）
└── steering/             # Steering 规则
    └── *.md              # Markdown 格式的指导文件
```

### Steering 文件

Steering 文件用于给 AI 提供项目上下文和规范：

- **始终包含**（默认）：每次对话都会加载
- **条件包含**：当读取匹配的文件时加载
  ```yaml
  ---
  inclusion: fileMatch
  fileMatchPattern: '**/*.py'
  ---
  ```
- **手动包含**：通过 `#` 引用
  ```yaml
  ---
  inclusion: manual
  ---
  ```

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

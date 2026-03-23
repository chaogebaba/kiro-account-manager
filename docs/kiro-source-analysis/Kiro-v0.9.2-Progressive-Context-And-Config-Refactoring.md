# Kiro IDE v0.9.2 渐进式上下文与配置体系重构总览

> 基于 Kiro IDE v0.9.2 `dist/extension.js` 源码分析，对比 v0.8.206
> 分析日期：2026-02-11

## 1. 重构全景

v0.9.2 是一次架构级别的重构，将 `.kiro/` 目录下的配置体系从"各自独立"统一到"渐进式上下文"架构。主要涉及四大模块的新增或重构：

| 模块 | v0.8.206 状态 | v0.9.2 状态 | 变更性质 |
|---|---|---|---|
| **Skills** | 不存在 | 全新引入 | 🆕 新增 |
| **Steering** | 3 种 inclusion 模式 | 4 种 inclusion 模式 + 合并管理 | 🔄 重构 |
| **Custom Agents** | 内置 sub-agents（硬编码） | 用户自定义 agents + 内置 agents | 🔄 重构 |
| **Hooks** | 基础实现 | 重构命令系统 | 🔄 重构 |
| **Spec** | 4 个工具 | 工具重构 + 意图检测 + 任务状态管理 | 🔄 重构 |
| **Powers** | 单一 registry.json | registry-v2 架构 + 多注册表 + 自动安装 + POWER.md | 🔄 重构 |
| **MCP** | MCPManagerSingleton 无并发控制 | 新增并发信号量 + autoApprove 通配符 + 适配 registry-v2 | 🔧 增强 |

它们在 `.kiro/` 目录下的布局：

```
~/.kiro/                           # 全局（用户级）
├── skills/                        # 🆕 v0.9.2 新增
│   └── <skill-name>/SKILL.md
├── steering/                      # 🔄 v0.9.2 新增 inclusion:auto
│   └── *.md
├── agents/                        # 🔄 v0.9.2 从内置改为用户自定义
│   └── <agent-id>.md
├── powers/                        # 🔄 v0.9.2 registry-v2 重构
│   ├── installed/                 # 🆕 v0.9.2 新增
│   │   └── <power-name>/
│   │       ├── POWER.md
│   │       ├── mcp.json
│   │       └── steering/*.md
│   ├── installed.json             # 🆕 v0.9.2 替代 registry.json 中的安装记录
│   ├── registries/                # 🆕 v0.9.2 多注册表目录
│   ├── registry.json              # v0.8.206 遗留（迁移后备份为 .v1.backup）
│   └── clones/                    # 🆕 v0.9.2 Git 仓库克隆缓存
├── config.json                    # 原有
├── token.json                     # 原有
└── mcp.json                       # 原有

<workspace>/.kiro/                 # 工作区级
├── skills/                        # 🆕
├── steering/                      # 🔄
├── agents/                        # 🔄
└── hooks/                         # 🔄
```

## 2. Skills 系统（v0.9.2 新增）

> 详细源码分析见 `Skills-And-DiscloseContext-Analysis-v0.9.2.md`

### 核心设计

Skills 是**可复用的 LLM 指令包**，按需加载到对话上下文。

```
SKILL.md (frontmatter: name + description)
  → ProgressiveContextLoader 扫描
  → ProgressiveContextRegistry 注册
  → ToolDiscloseContext 暴露给 LLM
  → LLM 调用 discloseContext(name)
  → 正文内容注入上下文
```

### 关键约束

- **目录结构必须**：`skills/<name>/SKILL.md`（不能是扁平的 .md 文件）
- **frontmatter 必填**：`name` + `description`（schema 标 optional 但代码强制校验）
- **不受信任的工作区**只加载全局 skills

### 源码位置

| 组件 | 行号 |
|---|---|
| `SkillFrontMatterSchema` | 853078 |
| `ProgressiveContextRegistry` | 858802 |
| `ProgressiveContextLoader` | 874056 |
| `ToolDiscloseContext` | 867500 |
| `import-skills.ts` | 873366 |
| `delete-skill.ts` | 873785 |

## 3. Steering 重构（v0.9.2）

### Schema 变更

```javascript
// v0.8.206: 3 种模式
inclusion: z.enum(["always", "fileMatch", "manual"])
// 无 name、description 字段

// v0.9.2: 4 种模式 + name/description
inclusion: z.enum(["always", "fileMatch", "manual", "auto"])
name: z.string().optional()
description: z.string().optional()
```

### inclusion 模式对比

| 模式 | v0.8.206 | v0.9.2 | 触发方式 |
|---|---|---|---|
| `always` | ✅ | ✅ | 每次对话自动加载 |
| `fileMatch` | ✅ | ✅ | 匹配文件被读入时加载 |
| `manual` | ✅ | ✅ | 用户通过 `#` 引用 |
| `auto` | ❌ | ✅ 🆕 | LLM 调用 `discloseContext` 按需激活 |

### 与 Skills 的合并管理

v0.9.2 中 `inclusion: auto` 的 steering 文件与 skills 共享：
- 同一个注册表（`ProgressiveContextRegistry`）
- 同一个扫描器（`ProgressiveContextLoader`）
- 同一个 LLM 工具（`discloseContext`）
- 同一个 UI 树形视图（`SteeringTreeView`）

但文件系统存储仍然分离：
- Skills → `.kiro/skills/<name>/SKILL.md`
- Steering → `.kiro/steering/*.md`

详细的合并机制分析见 `Skills-And-DiscloseContext-Analysis-v0.9.2.md` 末尾的「v0.9.2 Skills 与 Steering 合并管理——深度分析」章节。

## 4. Custom Agents 重构（v0.9.2）

> 详细分析见 `Custom-Agents-Deep-Dive-v0.9.2.md`

### 术语变更

- v0.8.206: **sub-agent**（内置，硬编码）
- v0.9.2: **custom agent**（用户可自定义 + 内置）

### 存储位置

```
~/.kiro/agents/<agent-id>.md       # 全局
<workspace>/.kiro/agents/<agent-id>.md  # 工作区
AGENTS.md                          # 项目根目录（steering 文档，非 agent 定义）
```

### Agent 文件格式

```markdown
---
name: "my-agent"
description: "描述"
tools: ["read", "write"]       # 工具标签
model: "claude-sonnet-4"       # 可选
includeMcpJson: false          # 可选
includePowers: false           # 可选
---

（Agent 的系统提示词 / 指令）
```

### v0.9.2 新增的 Agent Schema 字段（行 874402-874423）

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string（必填） | Agent 标识名 |
| `description` | string | 描述 |
| `tools` | string \| string[] | 工具列表或 `"*"` 全部 |
| `model` | string | 模型覆盖 |
| `includeMcpJson` | boolean | 是否自动包含 MCP 工具（默认 false） |
| `includePowers` | boolean | 是否包含 Powers 工具（默认 false） |

### 与 Skills 的区别

| 维度 | Skills | Custom Agents |
|---|---|---|
| 用途 | 指令/知识包，注入到当前对话 | 独立子代理，有自己的工具和模型 |
| 激活方式 | `discloseContext` 工具 | `invokeSubAgent` 工具 |
| 执行方式 | 内容合并到主对话上下文 | 独立执行环境，返回结果 |
| 工具权限 | 无（只是文本） | 可配置工具标签 |
| 模型 | 使用主对话模型 | 可覆盖为不同模型 |

## 5. Hooks 重构（v0.9.2）

### 命令变更

| 命令 ID | v0.8.206 | v0.9.2 |
|---|---|---|
| `kiroAgent.hooks.updateTitle` | ❌ | ✅ 🆕 |
| `kiroAgent.hooks.setLoading` | ✅ | ❌ 移除 |
| 其余 Hooks 命令（7 个） | ✅ | ✅ 保留 |

### CreateHook 工具合并

v0.8.206 中 `CreateHook` 是单独函数，v0.9.2 将其合并到主工具列表中，统一管理。

## 6. Spec 模式重构（v0.9.2）

### 工具变更

| 工具 | v0.8.206 | v0.9.2 |
|---|---|---|
| `GetUserInputTool` | ✅ | 🔄 重构为新实现 |
| `UpdateTaskStatusTool` | ✅ | 🔄 重构为 `UpdateTaskStatus` |
| `UpdatePBTStatusTool` | ✅ | 🔄 重构为 `UpdatePBTStatus` |
| `ToolPrework` | ✅ | 🔄 重构为 `Prework` |

### 新增核心类

| 类 | 说明 |
|---|---|
| `SpecDocumentManager` | Spec 文档生命周期管理 |
| `IntentDetectionService` | 用户意图自动检测 |
| `PruningService` | 上下文剪枝（减少 token） |
| `ImplicitRules` | 隐式规则推断 |
| `SpecGenerationDefinition` | Spec 生成定义 |

### 与 Skills 的协作

Spec 模式可以在执行过程中触发 `discloseContext`，按需加载与当前任务相关的 Skills 或 auto-steering 文件。这是 v0.9.2 渐进式上下文架构的一个典型应用场景。

## 7. Powers 重构（v0.9.2）

### v0.8.206 架构（registry-v1）

v0.8.206 使用单一的 `PowerRegistryManager` 类管理所有 Powers：

```
~/.kiro/powers/
├── registry.json          # 单一注册表文件（powers + repoSources）
└── installed/
    └── <power-name>/      # 安装的 Power 目录
```

**核心类**：`PowerRegistryManager`（行 835345）
- 10 秒内存缓存（`cacheTTL = 10000`）
- `loadRegistry()` / `saveRegistry()` — 原子写入（先写 .tmp 再 rename）
- `getPower()` / `listPowers()` / `installPower()` / `uninstallPower()`
- `PowerRegistrySchema` — 包含 `powers`（字典）和 `repoSources`（字典）

**限制**：
- 单一 registry.json 管理所有数据
- 无多注册表支持
- 无自动安装机制
- 无 V1→V2 迁移
- Power 安装无白名单文件过滤

### v0.9.2 架构（registry-v2）

v0.9.2 对 Powers 进行了**完全重写**，引入 registry-v2 架构：

```
~/.kiro/powers/
├── installed.json             # 🆕 安装记录（版本 1.0.0）
├── registries/                # 🆕 多注册表目录
│   └── <registry-id>.json
├── installed/
│   └── <power-name>/
│       ├── POWER.md           # 🆕 Power 文档 + frontmatter
│       ├── mcp.json           # MCP 服务器配置
│       └── steering/          # 🆕 Power 专属 steering 文件
│           └── *.md
├── clones/                    # 🆕 Git 仓库克隆缓存
│   └── <power-name>/
└── registry.json.v1.backup    # V1 备份（迁移后生成）
```

### 核心类和组件

| 组件 | 行号 | 说明 |
|---|---|---|
| `PowerDefinitionSchema` | 844802 | Power 定义 schema（含 MCP 服务器、元数据、安装信息） |
| `PowerFrontmatterSchema` | 844903 | POWER.md frontmatter schema |
| `PowerDefinitionV2Schema` | 845299 | V2 Power 定义（含 source 判别联合类型） |
| `InstalledPowersFileSchema` | 845322 | installed.json 文件 schema |
| `InstalledPowersManager` | 845281 | 安装状态管理器（5 秒缓存） |
| `RegistryResolver` | 845845 | 多注册表解析器 |
| `initializePowersRegistry()` | 847387 | V2 初始化入口 |
| `installPowerFromRepository()` | 846626 | Power 安装（白名单过滤） |
| `processAllAutoInstalls()` | 846905 | 自动安装处理 |
| `validatePowerDirectory()` | 850839 | Power 目录完整性校验 |

### Schema 变更

**installed.json 结构**：
```javascript
InstalledPowersFileSchema = {
  version: "1.0.0",
  installedPowers: [{ name, registryId, autoInstalled? }],
  dismissedAutoInstalls?: [{ name, registryId }]   // 🆕 防止重复自动安装
}
```

**多注册表类型**（判别联合）：
```javascript
UserRegistrySchema = discriminatedUnion("type", [
  LocalRegistrySchema,   // { name, type: "local", powers: [...] }
  RepoRegistrySchema     // { name, type: "repo", repoUrl, pathInRepo }
]);
```

**Power 来源类型**（判别联合）：
```javascript
PowerSourceSchema = discriminatedUnion("type", [
  LocalSourceSchema,     // { type: "local", path }
  RepoSourceSchema       // { type: "repo", repositoryCloneUrl, pathInRepo, repositoryBranch? }
]);
```

**注册表 ID 体系**：
- `kiro-recommended` — Kiro 官方推荐注册表（通过 CloudFront CDN 缓存）
- `user-added` — 用户手动添加的 Power
- 自定义 ID — 用户配置的本地/远程注册表

### POWER.md 格式

```markdown
---
name: my-power
description: Power 描述
author: Author Name
license: MIT
keywords: [keyword1, keyword2]
displayName: My Power
---

## Overview

Power 文档内容...

## Available MCP Servers

...

## Tool Usage

...

## Configuration

...
```

**推荐章节**：`## Overview`、`## Available MCP Servers`、`## Tool Usage`、`## Configuration`

### 安装流程与安全机制

**白名单文件过滤**（行 846627、851123）：
```javascript
ALLOWED_FILES = ["POWER.md", "mcp.json"];
ALLOWED_DIRS = ["steering"];
ALLOWED_EXTENSIONS = [".md"];  // steering 目录内只允许 .md
```

**安全检测**：
- 路径穿越检测（`../` 攻击）
- 符号链接逃逸检测
- 文件类型黑名单（二进制可执行文件、脚本、凭据、归档文件）
- 安全文件权限设置（`SECURE_FILE: 0o600`、`PUBLIC_FILE: 0o644`）
- 隐藏文件检测

**文件权限常量**（行 844915-844924）：
```javascript
FILE_PERMISSIONS = {
  SECURE_FILE: 384,   // 0o600 - 仅所有者读写
  SECURE_DIR: 448,    // 0o700 - 仅所有者读写执行
  PUBLIC_DIR: 493,    // 0o755 - 所有者全权限，其他人读执行
  PUBLIC_FILE: 420    // 0o644 - 所有者读写，其他人只读
}
```

### V1→V2 迁移

**初始化流程**（行 847387-847411）：
```
启动 → initializePowersRegistry()
  ↓
检查是否需要迁移（checkMigrationNeeded）
  ├─ installed.json 已存在 → 无需迁移
  ├─ registry.json.v1.backup 已存在 → 已迁移过
  ├─ registry.json 不存在 → 无需迁移
  └─ 仅 registry.json 存在 → 执行迁移
  ↓
runMigration()
  → 读取 registry.json → 转换为 installed.json 格式
  → 备份为 registry.json.v1.backup
  ↓
processAllAutoInstalls()
  → 遍历所有注册表 → 找到 autoInstall: true 的 Power
  → 检查是否已安装 / 是否被用户 dismissed
  → 自动安装未安装且未 dismissed 的 Power
  ↓
registryWatcher.start()
  → 监听注册表文件变更 → 自动重新加载
```

### API 变更对比

| API | v0.8.206 | v0.9.2 |
|---|---|---|
| `list-powers` | 基础列表 | 支持 filter（byInstallationStatus、byKeywords、bySource、excludeUserAdded） |
| `install-power` | 从 registry.json 安装 | `install-power-from-repository`，从注册表解析源 → 克隆/复制 → 白名单过滤 |
| `uninstall-power` | 基础卸载 | 增加 dismissed auto-install 记录 + 克隆目录清理 |
| `update-power` | ❌ 不存在 | ✅ 🆕 支持本地和远程更新（fetch → 卸载 → 重新安装） |
| `configure-power` | ❌ 不存在 | ✅ 🆕 更新 Power 的 MCP 服务器配置 |
| `get-power-details` | ❌ 不存在 | ✅ 🆕 返回 metadata + documentation + mcpServers + steeringFiles |
| `add-custom-power` | ❌ 不存在 | ✅ 🆕 从文件夹添加自定义 Power |

### 错误类型

| 错误类型 | v0.8.206 | v0.9.2 |
|---|---|---|
| `PowerNotFoundError` | ✅ | ✅ |
| `PowerValidationError` | ✅ | ✅ |
| `PowerRegistryLoadError` | ✅ | ✅ |
| `PowerRegistrySaveError` | ✅ | ✅ |
| `PowerRegistryDataError` | ❌ | ✅ 🆕 |

### 源码位置

| 模块 | 行号 |
|---|---|
| `registry-v2/schema.ts` | 844786 |
| `utils/paths.ts` | 844926 |
| `registry-v2/types.ts` | 845286 |
| `registry-v2/installed-powers-manager.ts` | 845281 |
| `registry-v2/registry-resolver.ts` | 845844 |
| `registry-v2/auto-install-powers.ts` | 845810 |
| `registry-v2/registry-watcher.ts` | 845804 |
| `registry-v2/init.ts` | 847385 |
| `registry-v2/api/install-power.ts` | 846626 |
| `registry-v2/api/uninstall-power.ts` | 851061 |
| `api/list-powers.ts` | 851309 |
| `api/update-power.ts` | 851634 |
| `api/configure-power.ts` | 851717 |
| `repos/installer.ts` | 851121 |
| `validation` | 850789-851008 |

## 8. MCP 增强（v0.9.2）

> MCP 模块在 v0.9.2 中**不是架构级重构**，核心架构（`MCPManagerSingleton` → `MCPConnection` → `syncResourcesAndTools`）保持不变，但有多项渐进增强。

### 变更对比

| 变更点 | v0.8.206 | v0.9.2 | 说明 |
|---|---|---|---|
| **并发连接控制** | 无限制 | `Sema(4)` 信号量 | 新增 `async-sema` 依赖，`MCP_MAX_CONCURRENT_CONNECTIONS = 4`，防止同时连接过多 MCP 服务器耗尽资源 |
| **连接超时** | `MCP_CONNECTION_TIMEOUT = 300000`（5 分钟 `setTimeout` 硬超时） | **移除硬超时** | 改由 semaphore 排队 + AbortController 控制，避免超时误杀慢连接 |
| **autoApprove 通配符** | 仅支持具名工具 `autoApprove.includes(toolName)` | 新增 `"*"` 通配符 | `autoApprove: ["*"]` 可免确认所有工具调用 |
| **工具数量警告** | 立即弹出 `showWarningMessage` | 等待 `allConnectionsSettled` 再判断 + "Show MCP Servers" 按钮 | 避免连接未全部建立时误报，且提供跳转入口 |
| **Power 服务器解析** | `getInstalledPowersSync()` → `power.mcpServers`（数组字段） | `installedPowersManager.getInstalledPowersSync()` + `getMcpServerNamesSync()` 从 `mcp.json` 读取 | 适配 Powers registry-v2 架构 |
| **类语法** | `__publicField7()` 兼容写法 | 原生 ES class fields（`static instance;`） | 编译目标升级 |

### 未变更部分

以下在两版中**完全一致**：

- `MCPOptionsSchema`（command / args / env / cwd / url / headers / disabled / autoApprove / disabledTools）
- `MCPJsonConfigSchema`（mcpServers + powers.mcpServers）
- MCP utility commands（13 个命令：showLogs / debugServer / retryConnection / reconnectServer / authenticateConnection / enableServer / disableServer / enableAllServerTools / disableAllServerTools / enableTool / disableTool / testTool / enable / resetDangerousEnvConsent）
- `MCPTreeDataProvider` 树形视图结构（powerGroup / powerServer / server / tool 四种节点类型）
- `CredentialStorageManager` OAuth 凭据管理
- `MCPAuthProvider` OAuth 认证流程
- `OAuthRedirectServer` 本地回调服务器
- `loadMcpConfig()` / `loadIndividualMcpConfig()` / `loadPowersMcpConfig()` 配置加载链

### 源码位置

| 组件 | v0.9.2 行号 | v0.8.206 行号 |
|---|---|---|
| `mcp-manager` 模块入口 | 206075 | 155179 |
| `MCPOptionsSchema` | 206099 | 155205 |
| `MCPManagerSingleton` | 207061 | 156164 |
| `MCP_MAX_CONCURRENT_CONNECTIONS` | 207060 | ❌ 不存在 |
| `MCP_CONNECTION_TIMEOUT` | ❌ 已移除 | 156162 |
| `mcp-availability.ts` | 867817 | 861208 |
| `mcp-tree-data-provider.ts` | 872436 | 860803 |
| `mcp-utility-commands.ts` | 872849 | 861235 |
| `mcp/index.ts` | 872947 | 861330 |

## 9. 统一架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        LLM 对话上下文                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ always   │  │ fileMatch│  │  auto    │  │     Skills       │ │
│  │ steering │  │ steering │  │ steering │  │  (SKILL.md)      │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬──────────┘ │
│       │              │             │                │            │
│    自动加载       文件匹配时     ┌───┴────────────────┘            │
│                   加载        │                                 │
│                            discloseContext                       │
│                            (LLM 按需调用)                        │
└─────────────────────────────────────────────────────────────────┘
                                    │
                   ┌────────────────┼────────────────┐
                   ▼                ▼                ▼
          ProgressiveContext  SteeringDocuments  Custom Agents
          Registry (单例)     Controller         (invokeSubAgent)
                   ▲                                 │
                   │                                 │
          ProgressiveContext                   独立执行环境
          Loader (扫描+监听)                  (自有工具/模型)
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
  ~/.kiro/    .kiro/skills/  .kiro/steering/
  skills/     (workspace)    (workspace)
  (global)

┌─────────────────────────────────────────────────────────────────┐
│                    Powers 系统（registry-v2）                      │
│                                                                 │
│  RegistryResolver ←── kiro-recommended (CloudFront CDN)         │
│       │           ←── user-added (用户手动添加)                   │
│       │           ←── 自定义注册表 (local/repo)                   │
│       ▼                                                         │
│  InstalledPowersManager ── installed.json                       │
│       │                                                         │
│       ├── install  → 白名单过滤 → POWER.md + mcp.json + steering│
│       ├── update   → fetch/copy → 卸载 → 重新安装               │
│       ├── uninstall→ 清理文件 + dismissed 记录                   │
│       └── auto-install → 启动时自动安装 (可 dismiss)             │
│                                                                 │
│  ~/.kiro/powers/installed/<name>/                               │
│       ├── POWER.md        (文档 + frontmatter)                  │
│       ├── mcp.json        (MCP 服务器配置)                      │
│       └── steering/*.md   (Power 专属 steering)                 │
└─────────────────────────────────────────────────────────────────┘
```

## 10. v0.9.2 重构的设计理念

### 10.1 渐进式上下文加载（Progressive Context）

**核心思想**：不再一次性加载所有指令，而是让 LLM 自行判断需要哪些上下文并按需获取。

**对比**：
```
v0.8.206: 启动时加载 → 全部 always + fileMatch steering → 大量 token 消耗
v0.9.2:   启动时加载 → 少量 always steering
          对话中按需 → discloseContext 加载 skills/auto-steering → 按需消耗
```

### 10.2 统一抽象、分类展示

Skills 和 auto-steering 在底层共享注册表、扫描器、LLM 工具，但在用户界面和 LLM 工具描述中仍然分类展示，保持语义清晰。

### 10.3 配置即代码

所有配置（steering、skills、agents、hooks）都是 **Markdown + YAML frontmatter** 格式，可以：
- 纳入版本控制（Git）
- 跨项目复用（全局 vs 工作区）
- 通过 GitHub 分享和导入

### 10.4 安全隔离

- 不受信任的工作区只加载全局配置
- Custom agents 通过工具标签控制权限（而非直接暴露所有工具）
- Skills 只是文本注入，不具备执行能力
- Powers 安装采用白名单文件过滤 + 路径穿越检测 + 符号链接逃逸检测

## 11. 关联文档索引

| 文档 | 内容 |
|---|---|
| `Skills-And-DiscloseContext-Analysis-v0.9.2.md` | Skills + DiscloseContext + Custom Agents 详细源码分析 + 合并管理深度对比 |
| `Custom-Agents-Deep-Dive-v0.9.2.md` | Custom Agents 系统架构、工具标签、AGENTS.md |
| `Kiro-v0.9.2-Final-Summary.md` | v0.9.2 全量变更总结（28 个分析维度） |
| `GenerateAssistantResponse-Version-Comparison.md` | API 层面的版本对比 |
| `Custom-Model-Provider-Analysis-v0.9.2.md` | 自定义模型提供者分析 |

## 12. 对 Kiro Account Manager 的影响

基于 v0.9.2 的重构，Account Manager 需要支持管理以下新增/变更的配置：

| 功能 | 优先级 | 说明 |
|---|---|---|
| Skills 浏览/删除 | P1 | `~/.kiro/skills/` 目录管理 |
| Skills 导入（本地） | P1 | 复制文件夹到 skills 目录 |
| Skills 导入（GitHub） | P2 | sparse-checkout + 复制 |
| Steering auto 模式支持 | P1 | 更新 SteeringPanel，支持 `inclusion: auto` |
| Custom Agents 浏览/编辑/删除 | P1 | `~/.kiro/agents/` 目录管理 |
| Custom Agents 创建向导 | P2 | 基于模板生成 agent 文件 |
| Hooks 管理 | P2 | 与已有 hooks 命令集成 |
| Powers 注册表浏览 | P1 | `~/.kiro/powers/` 目录结构 + installed.json 管理 |
| Powers 安装/卸载/更新 | P1 | 对接 registry-v2 API |
| Powers 多注册表管理 | P2 | 支持添加/移除自定义注册表 |

---

*更新记录：*
- 2026-02-11：创建文档，整合 skills/steering/custom agents/hooks/spec 五大模块的 v0.9.2 重构分析
- 2026-02-11：新增 Powers 重构分析（registry-v1→v2 完整对比），更新架构图，文档扩展为六大模块
- 2026-02-11：新增 MCP 增强分析（并发控制、autoApprove 通配符、超时机制变更），文档扩展为七大模块

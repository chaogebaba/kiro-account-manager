# Kiro IDE Skills、DiscloseContext 和自定义 Agents 功能分析

## 版本信息
- Kiro IDE 版本：v0.9.2
- 分析日期：2026-02-07
- 源码文件：dist/extension.js

## 功能概述

Kiro IDE v0.9.2 引入了三大新功能：
1. **Skills 系统**：可复用的指令集/能力模块
2. **DiscloseContext 工具**：按需激活 skills 和 auto steering
3. **自定义 Agents**：用户可创建专用的子代理（v0.8.206 叫 "sub-agent"，v0.9.2 改名为 "custom agent"）

这些功能实现了渐进式上下文加载机制，节省 token 并提升灵活性。

## 核心概念

### 1. Skills（技能）

**定义**：
- 可复用的指令集/能力模块
- 类似插件或工具包
- 按需激活，动态加载到 AI 上下文

**存储位置**：
- 用户级：`~/.kiro/skills/`
- 工作区级：`.kiro/skills/`（项目特定）

**文件结构**：
```
~/.kiro/skills/
├── my-skill/
│   ├── SKILL.md          # 必需文件，包含 skill 的完整指令
│   └── [其他文件]         # 可选的辅助文件
└── another-skill/
    └── SKILL.md
```

**SKILL.md 格式**：
- Markdown 格式
- 包含 skill 的完整指令和说明
- 被激活时加载到 AI 上下文

**导入方式**：
- 从本地文件夹导入（必须包含 SKILL.md）
- 从 GitHub URL 导入（指向包含 SKILL.md 的文件夹）

---

### 2. DiscloseContext 工具

**功能**：
- 激活 skills 或 auto inclusion steering 文件
- 动态加载指令到 AI 上下文
- 按需加载，节省 token

**工具配置**：
```javascript
{
  id: "discloseContext",
  name: "disclose_context",
  description: "Activate skills or auto inclusion steering files to load their full instructions into context.",
  schema: {
    name: string  // skill 或 steering 文件的名称
  }
}
```

**使用流程**：
1. AI 检测到需要某个 skill
2. 调用 `discloseContext` 工具，传入 skill 名称
3. Kiro 加载对应的 SKILL.md 内容到上下文
4. AI 获得完整指令，继续执行任务

**可激活的内容**：
- Skills（`~/.kiro/skills/` 或 `.kiro/skills/`）
- Auto inclusion steering 文件（`inclusion: auto`）

---

### 3. 自定义 Agents（Custom Agents）

**定义**：
- 用户自定义的子代理（Sub-agent）
- 专门用于特定任务的 AI 助手
- 可配置工具权限和系统提示词

**术语变更**：
- **v0.8.206**：叫 "sub-agent"
- **v0.9.2**：改名为 "custom agent"

**存储位置**：
- 用户级：`~/.kiro/agents/`
- 工作区级：`.kiro/agents/`（项目特定）

**文件格式**：
- Markdown 文件（`.md`）
- 文件名即为 agent ID（如 `code-reviewer.md`）
- 包含 YAML frontmatter 配置 + Markdown 指令

**文件结构示例**：
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

**YAML Frontmatter 字段**：
- `id`：agent 唯一标识（必需）
- `description`：agent 描述（必需）
- `tools`：允许使用的工具标签（必需）
  - 内置标签：`read`、`write`、`shell`、`web`、`spec`
  - MCP 工具：`@mcp`
  - Powers：`@powers`
  - 内置工具：`@builtin`
- `model`：使用的模型（可选）

**工具标签说明**：
- 使用标签而非具体工具名，更稳定
- 例如：`tools: ["read", "write"]` 而非 `["readFile", "fsWrite"]`
- 避免工具名称变更导致配置失效

**调用方式**：
```javascript
// 通过 invokeSubAgent 工具调用
invokeSubAgent({
  name: "code-reviewer",
  prompt: "审查这段代码：...",
  explanation: "需要专业的代码审查"
})
```

**内置 Custom Agents**：
- `context-gatherer`：探索代码库，识别相关文件
- `general-task-execution`：通用任务执行器
- `custom-agent-creator`：创建新 custom agent 的专用 agent（v0.9.2 新增）
- `spec-task-execution`：Spec 任务执行器
- `feature-design-first-workflow`：功能设计优先工作流
- `feature-requirements-first-workflow`：需求优先工作流

**custom-agent-creator 的作用**：
- 专门用于帮助用户创建新的 custom agent
- 引导用户定义 agent 的目的、工具、提示词
- 自动生成符合规范的 agent 文件
- 位置：`src/extension/custom-agent-loader/builtin-agents/custom-agent-creator.ts`

---

### 4. AGENTS.md 文件

**位置**：
- 项目根目录（不是 `.kiro/agents/` 目录）
- 文件名：`AGENTS.md`

**作用**：
- 作为 steering 文档使用
- 描述项目中可用的 agents
- 提供 agents 使用指南

**与 custom agents 的区别**：
- `AGENTS.md`：文档，描述 agents
- `.kiro/agents/*.md`：实际的 agent 定义文件

---

### 5. Steering 的新模式

**新增 `inclusion: auto` 模式**：

**五种 inclusion 模式对比**：

| 模式 | 触发时机 | 使用场景 |
|------|----------|----------|
| `always` | 每次对话都加载 | 全局规则，始终生效 |
| `auto` | 通过 discloseContext 激活 | 按需加载，节省 token |
| `fileMatch` | 匹配的文件被读取时加载 | 特定文件类型的规则 |
| `manual` | 手动引用（`#` 语法） | 用户主动引用 |
| （无 frontmatter） | 默认为 `always` | 兼容旧版本 |

**auto 模式示例**：
```markdown
---
inclusion: auto
---

# 我的自动加载规则

这个规则只在被 discloseContext 激活时加载。
```

---

## 架构设计理念

### 渐进式上下文加载

**传统方式**（所有指令一次性加载）：
```
基础上下文 + 所有 Steering + 所有 Skills = 巨大的上下文（浪费 token）
```

**新方式**（按需加载）：
```
基础上下文（小）
    ↓ 需要时
激活 Skill A（中）
    ↓ 需要时
激活 Auto Steering B（大）
```

**优势**：
- ✅ 节省 token 消耗
- ✅ 更快的响应速度
- ✅ 更灵活的指令管理
- ✅ 支持大量 skills 而不影响性能

---

## 源码关键位置

### Skills 目录定义
**位置**：行 858756
```javascript
var SKILLS_DIRECTORY = "skills";

function getGlobalSkillsDirectory() {
  const homeDir = os22.homedir();
  return vscode177.Uri.joinPath(
    vscode177.Uri.file(homeDir), 
    ".kiro", 
    SKILLS_DIRECTORY
  );
}
```

### SKILL.md 文件名
**位置**：行 873372
```javascript
var SKILL_MD_FILENAME = "SKILL.md";
```

### DiscloseContext 工具配置
**位置**：行 627542-627546
```javascript
DISCLOSE_CONTEXT_CONFIG = {
  id: "discloseContext",
  description: "",  // 动态生成
  schema: external_exports.object({
    name: external_exports.string().describe("...")
  })
};
```

### Custom Agent Creator 定义
**位置**：行 865962-865966
```javascript
var CUSTOM_AGENT_CREATOR_DEFINITION = {
  id: "custom-agent-creator",
  description: "Specialized agent for creating and configuring new custom agents",
  tools: ["read", "write"],
  prompt: CUSTOM_AGENT_CREATOR_PROMPT
};
```

### 内置 Custom Agents 列表
**位置**：行 866241-866247
```javascript
var builtinSubagents = /* @__PURE__ */ new Set([
  "context-gatherer",
  "general-task-execution",
  "custom-agent-creator",  // v0.9.2 新增
  "spec-task-execution",
  "feature-design-first-workflow",
  "feature-requirements-first-workflow",
  // ...
]);
```

### AGENTS.md 文件名定义
**位置**：行 853071
```javascript
var AGENTS_MD_FILENAME = "AGENTS.md";
```

### AGENTS.md 查找逻辑
**位置**：行 858840-858854
```javascript
/**
 * Finds AGENTS.md files in the direct workspace directory only
 * @param workspaceUri The workspace to search in
 * @returns Array of URIs for AGENTS.md files
 */
async findAgentsMdFiles(workspaceUri) {
  try {
    const agentsMdUri = vscode179.Uri.joinPath(workspaceUri, AGENTS_MD_FILENAME);
    try {
      await vscode179.workspace.fs.stat(agentsMdUri);
      logger7.debug(`[SteeringController] Found AGENTS.md file in ${workspaceUri.fsPath}`);
      return [agentsMdUri];
    } catch {
      logger7.debug(`[SteeringController] No AGENTS.md file found in ${workspaceUri.fsPath}`);
      return [];
    }
  } catch (error11) {
    // ...
  }
}
```

### Custom Agents 目录监控
**位置**：行 874608-874610
```javascript
/**
 * Load prompts from user-level directory (~/.kiro/agents/)
 * Public method for testing purposes
 */
```

**位置**：行 874766-874769
```javascript
/**
 * Set up file watching for user-level prompts
 * Monitors ~/.kiro/agents/ for file changes
 */
```

**位置**：行 874841-874843
```javascript
/**
 * Set up file watching for workspace-level prompts
 * Monitors <workspace>/.kiro/agents/ for file changes
 */
```

### 可用项目列表生成
**位置**：行 867510-867520
```javascript
if (items.length === 0) {
  return `**Available Items:** None

No skills or auto inclusion steering files are currently available. 
Skills can be added to ~/.kiro/skills/ (user-level) or .kiro/skills/ (workspace-level). 
Steering files with \`inclusion: auto\` can be added to ~/.kiro/steering/ or .kiro/steering/.`;
}

const skills = items.filter(isSkillDocument);
const steering = items.filter((item) => !isSkillDocument(item));
```

---

## 实际应用场景

### 场景 1：代码审查 Skill

**SKILL.md 内容**：
```markdown
# Code Review Skill

当需要代码审查时，请遵循以下规则：
1. 检查代码风格
2. 检查安全问题
3. 检查性能问题
4. 提供改进建议
```

**使用流程**：
```
用户："帮我审查这段代码"
AI：检测到需要代码审查
AI：调用 discloseContext("code-review")
Kiro：加载 code-review/SKILL.md
AI：根据 skill 指令执行审查
```

### 场景 2：特定框架的开发规范

**SKILL.md 内容**：
```markdown
# React Best Practices

开发 React 组件时：
- 使用函数组件和 Hooks
- 遵循单一职责原则
- 使用 PropTypes 或 TypeScript
- ...
```

**使用流程**：
```
用户："创建一个 React 组件"
AI：检测到 React 开发任务
AI：调用 discloseContext("react-best-practices")
Kiro：加载 React 规范
AI：按照规范生成代码
```

### 场景 3：创建自定义 Agent

**使用流程**：
```
用户："创建一个代码审查 agent"
AI：调用 invokeSubAgent("custom-agent-creator", "创建代码审查 agent")
custom-agent-creator：询问用户需求
用户：提供审查标准和输出格式
custom-agent-creator：生成 .kiro/agents/code-reviewer.md
AI：新 agent 创建完成，可以使用了
```

**生成的 agent 文件**：
```markdown
---
id: code-reviewer
description: 专门用于代码审查的 agent
tools:
  - read
  - write
---

# Code Reviewer Agent

你是一个专业的代码审查助手...
```

### 场景 4：使用自定义 Agent

**使用流程**：
```
用户："用 code-reviewer 审查这段代码"
AI：调用 invokeSubAgent("code-reviewer", "审查代码：...")
code-reviewer agent：执行审查
code-reviewer agent：返回审查结果
AI：展示审查结果给用户
```

---

## 对 Kiro Account Manager 的影响

### 需要添加的功能

#### 1. Skills 管理页面

**功能需求**：
- 浏览用户级和工作区级 skills
- 查看 SKILL.md 内容
- 导入 skill（本地文件夹）
- 删除 skill
- （可选）从 GitHub 导入

**UI 设计**：
```
Kiro 配置
├── MCP 服务
├── Steering 规则
├── Skills 管理  ← 新增
│   ├── 用户级 Skills (~/.kiro/skills/)
│   │   ├── skill-1
│   │   └── skill-2
│   └── 工作区级 Skills (.kiro/skills/)
│       └── project-skill
└── Custom Agents  ← 新增
    ├── 用户级 Agents (~/.kiro/agents/)
    │   ├── code-reviewer
    │   └── test-generator
    └── 工作区级 Agents (.kiro/agents/)
        └── project-agent
```

#### 2. Custom Agents 管理页面

**功能需求**：
- 浏览用户级和工作区级 custom agents
- 查看 agent 配置和提示词
- 编辑 agent 文件
- 删除 agent
- 创建新 agent（调用 custom-agent-creator）

**UI 设计**：
- 列表显示所有 agents
- 点击查看详情（YAML frontmatter + Markdown 内容）
- 编辑器支持 YAML 和 Markdown 语法高亮
- 创建按钮：引导用户使用 custom-agent-creator

#### 3. Steering 管理更新

**需要支持**：
- `inclusion: auto` 模式的识别
- 在 UI 中显示 auto 类型的 steering
- 创建 auto 类型的 steering 文件

**UI 更新**：
```
包含模式：
○ 始终包含 (always)
○ 自动激活 (auto)      ← 新增
○ 文件匹配 (fileMatch)
○ 手动引用 (manual)
```

---

## 实现方案

### 阶段 1：基础支持（必须）

**1.1 更新 Steering 管理**
- ✅ 支持 `inclusion: auto` 模式
- ✅ 更新 SteeringPanel.jsx
- ✅ 更新翻译文件

**1.2 文档更新**
- ✅ 更新 `Kiro配置文件说明.md`
- ✅ 说明 auto 模式的用途
- ✅ 说明 custom agents 的概念

### 阶段 2：Skills 管理（推荐）

**2.1 创建 Skills 管理页面**
- 新建 `SkillsPanel.jsx`
- 集成到 KiroConfig 的 Tab 中

**2.2 实现核心功能**
- 浏览 skills（用户级 + 工作区级）
- 查看 SKILL.md 内容
- 删除 skill

**2.3 Rust 后端支持**
- 添加 `steering_cmd.rs` 中的 skills 相关命令
- `get_skills()` - 获取 skills 列表
- `get_skill_content()` - 读取 SKILL.md
- `delete_skill()` - 删除 skill

### 阶段 3：Custom Agents 管理（推荐）

**3.1 创建 Custom Agents 管理页面**
- 新建 `AgentsPanel.jsx`
- 集成到 KiroConfig 的 Tab 中

**3.2 实现核心功能**
- 浏览 custom agents（用户级 + 工作区级）
- 查看 agent 配置和提示词
- 编辑 agent 文件
- 删除 agent

**3.3 Rust 后端支持**
- 添加 `agents_cmd.rs` 命令模块
- `get_agents()` - 获取 agents 列表
- `get_agent_content()` - 读取 agent 文件
- `save_agent()` - 保存 agent 文件
- `delete_agent()` - 删除 agent

### 阶段 4：高级功能（可选）

**4.1 Skills 导入功能**
- 从本地文件夹导入
- 从 GitHub 导入（需要网络请求）

**4.2 Agent 创建向导**
- 集成 custom-agent-creator
- 引导式创建流程
- 模板选择

**4.3 编辑器增强**
- YAML frontmatter 语法高亮
- Markdown 预览
- 工具标签自动补全

**4.4 模板功能**
- 内置 skill 模板
- 内置 agent 模板
- 快速创建常用配置

---

## 技术实现细节

### Rust 后端命令

#### Skills 管理
```rust
// src-tauri/src/commands/steering_cmd.rs

#[tauri::command]
pub fn get_skills() -> Result<Vec<SkillInfo>, String> {
    // 读取 ~/.kiro/skills/ 和 .kiro/skills/
    // 返回 skill 列表
}

#[tauri::command]
pub fn get_skill_content(skill_name: String) -> Result<String, String> {
    // 读取 SKILL.md 内容
}

#[tauri::command]
pub fn delete_skill(skill_name: String, scope: String) -> Result<(), String> {
    // 删除 skill 文件夹
}
```

#### Custom Agents 管理
```rust
// src-tauri/src/commands/agents_cmd.rs

#[derive(Serialize, Deserialize)]
pub struct AgentInfo {
    pub id: String,
    pub description: String,
    pub tools: Vec<String>,
    pub model: Option<String>,
    pub scope: String,  // "user" 或 "workspace"
}

#[tauri::command]
pub fn get_agents() -> Result<Vec<AgentInfo>, String> {
    // 读取 ~/.kiro/agents/ 和 .kiro/agents/
    // 解析 YAML frontmatter
    // 返回 agent 列表
}

#[tauri::command]
pub fn get_agent_content(agent_id: String, scope: String) -> Result<String, String> {
    // 读取 agent 文件完整内容
}

#[tauri::command]
pub fn save_agent(agent_id: String, content: String, scope: String) -> Result<(), String> {
    // 保存 agent 文件
    // 验证 YAML frontmatter 格式
}

#[tauri::command]
pub fn delete_agent(agent_id: String, scope: String) -> Result<(), String> {
    // 删除 agent 文件
}
```

### React 前端组件

#### Skills 管理
```jsx
// src/components/features/KiroConfig/SkillsPanel.jsx

function SkillsPanel() {
  const [skills, setSkills] = useState([])
  const [selectedSkill, setSelectedSkill] = useState(null)
  
  // 加载 skills 列表
  // 显示 skill 内容
  // 删除 skill
}
```

#### Custom Agents 管理
```jsx
// src/components/features/KiroConfig/AgentsPanel.jsx

function AgentsPanel() {
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  
  // 加载 agents 列表
  // 显示 agent 详情
  // 编辑 agent
  // 删除 agent
  // 创建新 agent（调用 custom-agent-creator）
}
```

---

## 注意事项

### 1. 文件路径处理
- 用户级 Skills：`~/.kiro/skills/`
- 工作区级 Skills：`.kiro/skills/`（相对于工作区根目录）
- 用户级 Agents：`~/.kiro/agents/`
- 工作区级 Agents：`.kiro/agents/`（相对于工作区根目录）
- AGENTS.md：项目根目录（不是 `.kiro/agents/` 目录）
- 需要处理多工作区情况

### 2. 文件格式验证
- Skills：检查是否存在 SKILL.md
- Agents：验证 YAML frontmatter 格式
  - 必需字段：`id`、`description`、`tools`
  - 可选字段：`model`
  - 工具标签验证：只允许 `read`、`write`、`shell`、`web`、`spec`、`@mcp`、`@powers`、`@builtin`

### 3. 权限问题
- 删除操作需要确认
- 避免误删重要 skills 或 agents
- 编辑 agent 时备份原文件

### 4. 性能考虑
- Skills/Agents 列表可能很多
- 需要分页或虚拟滚动
- SKILL.md 和 agent 文件内容可能很大，需要优化显示
- 文件监控避免频繁刷新

### 5. 术语一致性
- v0.8.206：叫 "sub-agent"
- v0.9.2：改名为 "custom agent"
- 文档和 UI 统一使用 "Custom Agent"
- 避免混淆 "sub-agent"（旧术语）和 "custom agent"（新术语）

### 6. AGENTS.md 的特殊性
- 位置：项目根目录（不是 `.kiro/agents/`）
- 作用：作为 steering 文档，描述项目的 agents
- 不是 agent 定义文件，只是文档

---

## 相关文档

- `Kiro配置文件说明.md` - Kiro IDE 配置文件说明
- `source-code-analysis.md` - 源码分析方法论

---

## 更新记录

- 2026-02-07：基于 v0.9.2 创建文档，分析 Skills、DiscloseContext 和自定义 Agents 功能
- 2026-02-07：通过对比 v0.8.206 和 v0.9.2 源码，确认术语变更（sub-agent → custom agent）

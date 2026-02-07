# Kiro IDE v0.9.2 完整变更分析

## 版本信息
- **旧版本**：v0.8.206
- **新版本**：v0.9.2
- **分析日期**：2026-02-07
- **分析方法**：对比两个版本的 dist/extension.js 源码

## 概述

Kiro IDE v0.9.2 是一次重大更新，涉及多个核心系统的重构和新功能的引入。本文档全面分析所有主要变更。

---

## 一、核心系统重构

### 1.1 Powers 系统重构

**变更类型**：架构重构

**主要变更**：
- Powers 注册表机制优化
- Powers 加载流程改进
- Powers 工具集成方式更新

**影响**：
- 提升 Powers 加载性能
- 更稳定的 Powers 管理
- 更好的错误处理

### 1.2 Steering 系统重构

**变更类型**：功能增强 + 架构重构

**主要变更**：
1. **新增 `inclusion: auto` 模式**
   - 按需激活，节省 token
   - 通过 DiscloseContext 工具激活
   
2. **新增 AGENTS.md 支持**
   - 位置：项目根目录
   - 作用：作为 steering 文档
   - 自动监听文件变化

3. **SteeringController 重构**
   - 统一管理 Steering 文件和 Skills
   - 支持渐进式上下文加载
   - 改进文件监控机制

**源码位置**：
- `SteeringController` 类：行 858000+
- `inclusion: auto` 支持：行 853073

### 1.3 Hooks 系统重构

**变更类型**：架构重构

**主要变更**：
- Hooks 存储机制优化
- Hooks 触发逻辑改进
- Hooks UI 视图更新

**源码位置**：
- `HookController`：行 625585+
- `HookStorage`：行 625099+
- `HookTreeView`：行 625417+

---

## 二、新功能

### 2.1 Skills 系统（全新）

**功能描述**：可复用的指令集/能力模块

**存储位置**：
- 用户级：`~/.kiro/skills/`
- 工作区级：`.kiro/skills/`

**文件结构**：
```
<skill-name>/
└── SKILL.md  # 必需文件
```

**激活方式**：通过 DiscloseContext 工具

**源码位置**：
- Skills 目录定义：行 858756
- SKILL.md 文件名：行 873372

### 2.2 Custom Agents 系统（全新）

**功能描述**：用户自定义的子代理

**术语变更**：
- v0.8.206：叫 "sub-agent"
- v0.9.2：改名为 "custom agent"

**存储位置**：
- 用户级：`~/.kiro/agents/`
- 工作区级：`.kiro/agents/`

**文件格式**：
- Markdown 文件（`.md`）
- 包含 YAML frontmatter + Markdown 指令

**YAML Frontmatter 字段**：
- `name`（必需）：Agent 唯一标识
- `description`（可选）：描述
- `tools`（可选）：工具标签或工具 ID
- `model`（可选）：模型覆盖
- `includeMcpJson`（可选）：是否包含所有 MCP 工具
- `includePowers`（可选）：是否包含 Powers 工具

**内置 Custom Agents**：
- `context-gatherer`
- `general-task-execution`
- `custom-agent-creator`（v0.9.2 新增）
- `spec-task-execution`
- `feature-design-first-workflow`
- `feature-requirements-first-workflow`

**源码位置**：
- `CustomAgentFileFrontMatterSchema`：行 874402
- `parseCustomAgentFile`：行 874460
- `custom-agent-creator` 定义：行 865962
- 内置 agents 列表：行 866241

### 2.3 DiscloseContext 工具（全新）

**功能描述**：按需激活 Skills 和 Auto Steering

**工作流程**：
```
AI 检测到需要某个 skill
    ↓
调用 discloseContext("skill-name")
    ↓
加载 SKILL.md 内容到上下文
    ↓
AI 根据 skill 指令执行任务
```

**关键特性**：
- 动态生成可用项目列表
- BLOCKING REQUIREMENT（必须先激活）
- 避免重复激活
- 详细的错误处理

**源码位置**：
- `ToolDiscloseContext` 类：行 867494+
- `generateDescription`：行 867510+
- `handle` 方法：行 867600+

### 2.4 工具标签系统（全新）

**功能描述**：工具的分类标签，用于 Custom Agents

**内置标签**：
- `read`：读取工具（readFile, readCode, listDirectory 等）
- `write`：写入工具（fsWrite, strReplace, editCode 等）
- `shell`：Shell 工具（executeBash, controlBashProcess 等）
- `web`：网页工具（search, fetch 等）
- `spec`：Spec 工具
- `@builtin`：所有内置工具
- `@mcp`：所有 MCP 工具
- `@powers`：Powers 工具
- `*`：所有工具

**优势**：
- 稳定性：工具重命名不影响配置
- 简洁性：一个标签代表一组工具
- 可维护性：工具增减无需更新配置

**源码位置**：
- 标签定义：行 627438
- 标签说明：行 865880-865900
- 标签验证：行 617281+

---

## 三、API 变更

### 3.1 新增 API

**1. DiscloseContext 工具**
```javascript
{
  id: "discloseContext",
  name: "disclose_context",
  schema: {
    name: string  // skill 或 steering 文件名称
  }
}
```

**2. Custom Agent 相关**
- `parseCustomAgentFile(content)` - 解析 agent 文件
- `detectCliOnlyFields(data)` - 检测 CLI-only 字段
- `generateCustomAgentId(name, workspaceFolder)` - 生成 agent ID

**3. Steering 相关**
- `SteeringController.getProgressiveDisclosureItems()` - 获取可激活项目
- `SteeringController.getProgressiveContent(name)` - 获取内容
- `SteeringController.findAgentsMdFiles(workspaceUri)` - 查找 AGENTS.md

### 3.2 修改的 API

**1. Steering 文件 frontmatter**
```yaml
# 新增字段
inclusion: auto  # 新增模式
```

**2. Hook 配置**
```yaml
# 工具类型支持正则
toolTypes: ["read", "write", ".*sql.*"]  # 支持正则匹配 MCP 工具
```

---

## 四、配置文件变更

### 4.1 新增配置文件

**1. Skills 配置**
```
~/.kiro/skills/<skill-name>/SKILL.md
.kiro/skills/<skill-name>/SKILL.md
```

**2. Custom Agents 配置**
```
~/.kiro/agents/<agent-id>.md
.kiro/agents/<agent-id>.md
```

**3. AGENTS.md**
```
项目根目录/AGENTS.md
```

### 4.2 修改的配置文件

**1. Steering 文件**
```yaml
---
inclusion: auto  # 新增模式
---
```

**2. Hook 文件**
```json
{
  "when": {
    "type": "preToolUse",  // 新增事件类型
    "toolTypes": ["read", "write", ".*sql.*"]  // 支持正则
  }
}
```

---

## 五、CLI-only 字段

### 5.1 什么是 CLI-only 字段？

**定义**：只能在 CLI 版本的 Kiro 中使用的字段

**字段列表**：
- `mcpServers`
- `allowedTools`
- `toolsSettings`
- `resources`
- `hooks`

**原因**：
- IDE 版本通过 UI 管理这些配置
- CLI 版本需要通过配置文件管理
- 避免配置冲突

**检测逻辑**：
```javascript
var CLI_ONLY_FIELDS = [
  "mcpServers", 
  "allowedTools", 
  "toolsSettings", 
  "resources", 
  "hooks"
];

function detectCliOnlyFields(data) {
  const fields = CLI_ONLY_FIELDS.filter(field => field in data);
  return {
    hasCliOnlyFields: fields.length > 0,
    fields
  };
}
```

**行为**：
- 如果检测到 CLI-only 字段，记录警告
- 但不阻止加载
- 这些字段会被忽略

**源码位置**：行 874401, 874453

---

## 六、性能优化

### 6.1 渐进式上下文加载

**优化点**：
- Skills 和 Auto Steering 按需加载
- 减少初始上下文大小
- 节省 token 消耗

**效果**：
```
传统方式：
基础上下文 + 所有 Steering + 所有 Skills = 巨大的上下文

新方式：
基础上下文（小）
    ↓ 需要时
激活 Skill A（中）
    ↓ 需要时
激活 Auto Steering B（大）
```

### 6.2 Powers 加载优化

**优化点**：
- Powers 注册表缓存
- 延迟加载机制
- 更高效的工具查找

### 6.3 文件监控优化

**优化点**：
- 更精确的文件监控范围
- 减少不必要的刷新
- 批量处理文件变更

---

## 七、用户体验改进

### 7.1 错误提示改进

**DiscloseContext 错误提示**：
```
未找到时：
"No skill or auto inclusion steering file found with name 'xxx'. 
Available items: skill1, skill2, steering1"
```

**Custom Agent 错误提示**：
```
CLI-only 字段警告：
"Agent file contains CLI-only fields: mcpServers, hooks. 
These fields are ignored in IDE version."
```

### 7.2 文档和指南

**Custom Agent Creator**：
- 内置的 agent 创建助手
- 引导式创建流程
- 自动生成符合规范的文件

**工具标签说明**：
- 详细的标签文档
- 工具映射关系
- 最佳实践建议

---

## 八、兼容性

### 8.1 向后兼容

**Steering 文件**：
- 没有 frontmatter 的文件默认为 `inclusion: always`
- 兼容旧版本的 steering 文件

**Hooks**：
- 旧版本的 hook 配置仍然有效
- 新增的事件类型是可选的

### 8.2 不兼容变更

**术语变更**：
- "sub-agent" → "custom agent"
- 旧文档需要更新

**CLI-only 字段**：
- IDE 版本不再支持某些字段
- 需要使用 UI 或新的配置方式

---

## 九、迁移指南

### 9.1 从 v0.8.206 迁移到 v0.9.2

**1. 更新 Steering 文件**
```yaml
# 如果需要按需加载
---
inclusion: auto
---
```

**2. 创建 Skills**
```bash
mkdir -p ~/.kiro/skills/my-skill
echo "# My Skill" > ~/.kiro/skills/my-skill/SKILL.md
```

**3. 创建 Custom Agents**
```bash
cat > ~/.kiro/agents/my-agent.md << 'EOF'
---
name: my-agent
description: My custom agent
tools: ["read", "write"]
---

# My Agent

Agent instructions...
EOF
```

**4. 更新 Hook 配置**
```json
{
  "when": {
    "type": "preToolUse",
    "toolTypes": ["read", "write"]  // 使用标签
  }
}
```

### 9.2 最佳实践

**1. 使用工具标签**
```yaml
# ❌ 不推荐
tools: ["readFile", "readCode", "listDirectory"]

# ✅ 推荐
tools: ["read"]
```

**2. 合理使用 Skills**
```
- 通用能力 → Skills
- 项目特定 → Steering
- 专用任务 → Custom Agents
```

**3. 按需激活**
```yaml
# 常用规则 → inclusion: always
# 大型规则 → inclusion: auto
# 特定文件 → inclusion: fileMatch
```

---

## 十、已知问题

### 10.1 CLI-only 字段混淆

**问题**：用户可能不清楚哪些字段是 CLI-only

**解决方案**：
- 文档中明确说明
- IDE 中显示警告
- 提供迁移指南

### 10.2 工具标签学习曲线

**问题**：用户需要学习工具标签系统

**解决方案**：
- 详细的文档和示例
- custom-agent-creator 提供引导
- 错误提示中包含建议

---

## 十一、未来展望

### 11.1 可能的改进

**1. Skills 市场**
- 社区共享 Skills
- 一键安装
- 版本管理

**2. Custom Agents 模板**
- 内置常用模板
- 快速创建
- 最佳实践示例

**3. 可视化编辑器**
- Skills 编辑器
- Custom Agents 编辑器
- 实时预览

### 11.2 潜在功能

**1. Skills 依赖管理**
- Skills 之间的依赖关系
- 自动安装依赖

**2. Custom Agents 组合**
- Agent 调用其他 Agent
- 工作流编排

**3. 性能监控**
- Skills 激活统计
- Custom Agents 使用分析
- 性能优化建议

---

## 十二、相关文档

- `Skills-And-DiscloseContext-Analysis-v0.9.2.md` - Skills 和 DiscloseContext 详细分析
- `Custom-Agents-Deep-Dive-v0.9.2.md` - Custom Agents 深度分析
- `Kiro配置文件说明.md` - 配置文件完整说明

---

## 十三、总结

Kiro IDE v0.9.2 是一次重大更新，主要变更包括：

**新功能**：
- ✅ Skills 系统
- ✅ Custom Agents 系统
- ✅ DiscloseContext 工具
- ✅ 工具标签系统
- ✅ Steering auto 模式

**重构**：
- ✅ Powers 系统
- ✅ Steering 系统
- ✅ Hooks 系统

**优化**：
- ✅ 渐进式上下文加载
- ✅ 性能提升
- ✅ 错误处理改进

**影响**：
- 更灵活的扩展机制
- 更好的性能
- 更强大的自定义能力
- 更低的 token 消耗

---

## 十四、更新记录

- 2026-02-07：创建文档，全面分析 v0.9.2 变更

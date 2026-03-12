# Kiro IDE Custom Agents 深度分析

## 版本信息
- Kiro IDE 版本：v0.9.2
- 分析日期：2026-02-07
- 源码文件：dist/extension.js
- 分析方法：对比 v0.8.206 和 v0.9.2 源码

## 概述

本文档深入分析 Kiro IDE v0.9.2 的 Custom Agents 实现机制，包括：
- YAML Frontmatter Schema 完整定义
- 工具标签到具体工具的映射关系
- Custom Agent 加载和解析流程
- DiscloseContext 工具的实现细节
- CLI-only 字段和限制

---

## 一、YAML Frontmatter Schema

### 1.1 CustomAgentFileFrontMatterSchema

**源码位置**：行 874402-874424

```javascript
var CustomAgentFileFrontMatterSchema = external_exports.object({
  /** Required: base name for the custom agent ID */
  name: external_exports.string().min(1, "Name must not be empty"),
  
  /** Optional: human-readable description (defaults to empty string) */
  description: external_exports.string().optional(),
  
  /** Optional: comma-separated tool IDs, array of tool IDs, or "*" for all tools. 
      If omitted, agent has no tools */
  tools: external_exports.union([
    external_exports.string(), 
    external_exports.array(external_exports.string())
  ]).optional(),
  
  /** Optional: model override */
  model: external_exports.string().optional(),
  
  /**
   * Whether to automatically include MCP tools in the agent's available tools.
   * When true, all MCP tools are included.
   * When false (default), MCP tools are only included if explicitly matched by `tools` patterns.
   */
  includeMcpJson: external_exports.boolean().optional().default(false),
  
  /**
   * Whether to automatically include Powers tools in the agent's available tools.
   * When true, the kiroPowers tool is included.
   * When false (default), Powers tools are only included if explicitly matched by `tools` patterns.
   */
  includePowers: external_exports.boolean().optional().default(false)
});
```

### 1.2 字段详解

| 字段 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `name` | string | ✅ | - | Agent 唯一标识，最少 1 个字符 |
| `description` | string | ❌ | `""` | 人类可读的描述 |
| `tools` | string \| string[] | ❌ | `undefined` | 工具标签、工具 ID 或 `"*"`（所有工具） |
| `model` | string | ❌ | `undefined` | 模型覆盖（如 `claude-sonnet-4`） |
| `includeMcpJson` | boolean | ❌ | `false` | 是否自动包含所有 MCP 工具 |
| `includePowers` | boolean | ❌ | `false` | 是否自动包含 kiroPowers 工具 |

### 1.3 tools 字段的三种格式

**格式 1：字符串（逗号分隔）**
```yaml
tools: "read, write, shell"
```

**格式 2：数组**
```yaml
tools:
  - read
  - write
  - shell
```

**格式 3：通配符**
```yaml
tools: "*"  # 所有工具
```

### 1.4 includeMcpJson 和 includePowers 的作用

**问题**：为什么需要这两个字段？

**答案**：MCP 工具和 Powers 工具是动态加载的，不属于内置工具标签。

**场景 1：不使用 includeMcpJson**
```yaml
tools: ["read", "write"]  # 只有读写工具，没有 MCP 工具
```

**场景 2：使用 includeMcpJson**
```yaml
tools: ["read", "write"]
includeMcpJson: true  # 自动添加所有 MCP 工具
```

**场景 3：使用 @mcp 标签**
```yaml
tools: ["read", "write", "@mcp"]  # 显式包含 MCP 工具
```

**最佳实践**：
- 使用 `@mcp` 标签更明确
- `includeMcpJson: true` 适合需要所有 MCP 工具的场景
- `includePowers: true` 适合需要 Powers 功能的场景

---

## 二、工具标签系统

### 2.1 内置工具标签

**源码位置**：行 627438 + 865880-865900

| 标签 | 描述 | 包含的工具 |
|------|------|-----------|
| `read` | 读取文件内容、搜索、诊断 | readFile, readMultipleFiles, readCode, listDirectory, fileSearch, grepSearch, getDiagnostics |
| `write` | 创建或修改文件 | fsWrite, fsAppend, strReplace, deleteFile, editCode |
| `shell` | 运行 shell/cmd 命令 | executeBash, controlBashProcess, listProcesses, getProcessOutput |
| `web` | 网页搜索和抓取 | mcp_brave_search_brave_web_search, mcp_fetch_fetch |
| `spec` | Spec 工作流工具 | updateTaskStatus, updatePBTStatus, getUserInput |
| `@builtin` | 所有内置工具（排除 hooks、mcp、powers） | 大部分核心 Kiro 工具 |
| `@mcp` | 所有 MCP 工具 | 动态加载的 MCP 服务器工具 |
| `@powers` | Powers 工具 | kiroPowers 工具 |
| `*` | 所有工具 | 包括内置、MCP、Powers 的所有工具 |

### 2.2 工具标签的优势

**为什么使用标签而非具体工具名？**

1. **稳定性**：工具重命名不影响 agent 定义
2. **简洁性**：一个标签代表一组工具
3. **可维护性**：工具增减不需要更新 agent 配置

**示例对比**：

❌ **不推荐**（使用具体工具名）：
```yaml
tools:
  - readFile
  - readMultipleFiles
  - readCode
  - listDirectory
  - fileSearch
  - grepSearch
  - getDiagnostics
```

✅ **推荐**（使用标签）：
```yaml
tools:
  - read
```

### 2.3 标签组合

可以组合多个标签：

```yaml
tools:
  - read      # 读取工具
  - write     # 写入工具
  - shell     # Shell 工具
  - @mcp      # 所有 MCP 工具
```

等价于：
```yaml
tools: ["read", "write", "shell", "@mcp"]
```

---

## 三、CLI-only 字段

### 3.1 什么是 CLI-only 字段？

**源码位置**：行 874401

```javascript
var CLI_ONLY_FIELDS = [
  "mcpServers", 
  "allowedTools", 
  "toolsSettings", 
  "resources", 
  "hooks"
];
```

**定义**：这些字段只能在 CLI 版本的 Kiro 中使用，IDE 版本不支持。

### 3.2 为什么有 CLI-only 字段？

**原因**：
- IDE 版本通过 UI 管理这些配置（MCP 面板、Hooks 面板等）
- CLI 版本需要通过配置文件管理
- 避免配置冲突和混乱

### 3.3 检测逻辑

**源码位置**：行 874453-874459

```javascript
function detectCliOnlyFields(data) {
  const fields = CLI_ONLY_FIELDS.filter((field) => field in data);
  return {
    hasCliOnlyFields: fields.length > 0,
    fields
  };
}
```

**行为**：
- 如果 agent 文件包含 CLI-only 字段，会记录警告
- 但不会阻止 agent 加载
- 这些字段会被忽略

**示例**：

❌ **错误**（IDE 版本中使用 CLI-only 字段）：
```yaml
---
name: my-agent
tools: ["read", "write"]
mcpServers:  # ❌ CLI-only 字段
  fetch:
    command: uvx
    args: ["mcp-server-fetch"]
---
```

✅ **正确**（使用 includeMcpJson）：
```yaml
---
name: my-agent
tools: ["read", "write"]
includeMcpJson: true  # ✅ IDE 支持
---
```

---

## 四、Custom Agent 解析流程

### 4.1 parseCustomAgentFile 函数

**源码位置**：行 874460-874490

```javascript
function parseCustomAgentFile(content) {
  // 1. 解析 YAML frontmatter
  const result = parseFrontMatter({
    schema: CustomAgentFileFrontMatterSchema,
    content
  });
  
  if (!result.frontMatter) {
    throw new Error("No front matter found");
  }
  
  // 2. 处理 tools 字段
  let tools;
  if (result.frontMatter.tools === undefined) {
    tools = undefined;  // 没有工具
  } else if (Array.isArray(result.frontMatter.tools)) {
    // 数组格式：过滤空字符串
    const trimmedTools = result.frontMatter.tools
      .map(t => t.trim())
      .filter(t => t.length > 0);
    tools = trimmedTools.length > 0 ? trimmedTools : undefined;
  } else {
    // 字符串格式：按逗号分隔
    const trimmedTools = result.frontMatter.tools
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    tools = trimmedTools.length > 0 ? trimmedTools : undefined;
  }
  
  // 3. 返回解析结果
  return {
    frontMatter: {
      ...result.frontMatter,
      tools
    },
    prompt: result.body  // Markdown 内容作为 prompt
  };
}
```

### 4.2 解析流程图

```
Agent 文件 (.md)
    ↓
parseFrontMatter()  ← 解析 YAML frontmatter
    ↓
验证 Schema  ← CustomAgentFileFrontMatterSchema
    ↓
处理 tools 字段  ← 字符串 → 数组，过滤空值
    ↓
检测 CLI-only 字段  ← detectCliOnlyFields()
    ↓
生成 Agent 定义
    ↓
注册到 Kiro IDE
```

### 4.3 tools 字段处理逻辑

**输入 1：字符串**
```yaml
tools: "read, write, , shell"  # 注意中间有空字符串
```

**处理**：
1. 按逗号分隔：`["read", " write", " ", " shell"]`
2. Trim 空格：`["read", "write", "", "shell"]`
3. 过滤空字符串：`["read", "write", "shell"]`

**输入 2：数组**
```yaml
tools:
  - read
  - ""
  - write
```

**处理**：
1. Trim 空格：`["read", "", "write"]`
2. 过滤空字符串：`["read", "write"]`

**输入 3：undefined**
```yaml
# 没有 tools 字段
```

**处理**：
- `tools = undefined`
- Agent 没有任何工具权限

---

## 五、DiscloseContext 工具实现

### 5.1 工具定义

**源码位置**：行 867500-867600

```javascript
class ToolDiscloseContext {
  constructor(steeringController) {
    this.steeringController = steeringController;
  }
  
  /**
   * 动态生成描述，列出所有可激活的项目
   */
  static generateDescription(controller) {
    const items = controller.getProgressiveDisclosureItems();
    
    // 没有可用项目
    if (items.length === 0) {
      return `Activate skills or auto inclusion steering files to load their full instructions into context.

**Available Items:** None

No skills or auto inclusion steering files are currently available. 
Skills can be added to ~/.kiro/skills/ (user-level) or .kiro/skills/ (workspace-level). 
Steering files with \`inclusion: auto\` can be added to ~/.kiro/steering/ or .kiro/steering/.`;
    }
    
    // 分类：Skills 和 Steering
    const skills = items.filter(isSkillDocument);
    const steering = items.filter(item => !isSkillDocument(item));
    
    let description = `Activate skills or auto inclusion steering files to load their full instructions into context.

When users ask you to perform tasks, check if any of the available skills or steering files match. 
Skills provide specialized capabilities and domain knowledge, while steering provide further instructions.

Important:
- When a skill matches the user's request, this is a BLOCKING REQUIREMENT: invoke the relevant Skill tool BEFORE generating any other response about the task
- NEVER mention a skill without actually calling this tool
- Do not invoke a skill that has already been activated.
- If you see a successful tool response for this tool with the skill name, this means it is active.

**Available Items** (use the exact name in bold as the \`name\` parameter):

`;
    
    // 列出 Skills
    if (skills.length > 0) {
      description += `**Skills:**\n`;
      for (const skill of skills) {
        description += `• name: "${skill.config.name}" - ${skill.config.description}\n`;
      }
      description += "\n";
    }
    
    // 列出 Steering Files
    if (steering.length > 0) {
      description += `**Steering Files:**\n`;
      for (const doc of steering) {
        const steeringName = doc.config?.name || doc.displayName;
        const steeringDescription = doc.config?.description || "No description";
        description += `• name: "${steeringName}" - ${steeringDescription}\n`;
      }
      description += "\n";
    }
    
    description += `Pass the exact name string (shown in quotes above) to the \`name\` parameter to activate a specific item and retrieve its full content.`;
    
    return description;
  }
  
  /**
   * 处理激活请求
   */
  async handle({ input, toolUse, state, actionId }) {
    const { name } = input;
    const startTime = Date.now();
    
    logger.info("[DiscloseContext] Activating:", { name });
    
    // 发送开始事件
    state.execution.emit({
      type: "AgentExecutionAction",
      executionId: state.execution.executionId,
      actionId,
      actionState: "Running",
      actionType: "discloseContext",
      input: { name },
      startTime
    });
    
    try {
      // 获取内容
      const result = await this.steeringController.getProgressiveContent(name);
      
      if (!result) {
        // 未找到
        const availableItems = this.steeringController.getProgressiveDisclosureItems();
        const availableNames = availableItems.map(item => item.displayName).join(", ");
        const errorMessage = availableNames 
          ? `No skill or auto inclusion steering file found with name "${name}". Available items: ${availableNames}`
          : `No skill or auto inclusion steering file found with name "${name}". No items are currently available.`;
        
        logger.warn("[DiscloseContext] Item not found:", { name, availableNames });
        
        // 发送错误事件
        state.execution.emit({
          type: "AgentExecutionAction",
          executionId: state.execution.executionId,
          actionId,
          actionState: "Error",
          actionType: "discloseContext",
          errorMessage,
          input: { name },
          startTime,
          endTime: Date.now()
        });
        
        return {
          state: newState,
          output: { content: errorMessage }
        };
      }
      
      // 成功激活
      logger.info("[DiscloseContext] Successfully activated:", { name });
      
      // 发送成功事件
      state.execution.emit({
        type: "AgentExecutionAction",
        executionId: state.execution.executionId,
        actionId,
        actionState: "Success",
        actionType: "discloseContext",
        output: { content: result },
        input: { name },
        startTime,
        endTime: Date.now()
      });
      
      return {
        state: newState,
        output: { content: result }
      };
    } catch (error) {
      // 处理错误
      logger.error("[DiscloseContext] Error:", error);
      // ...
    }
  }
}
```

### 5.2 DiscloseContext 工作流程

```
用户："帮我审查这段代码"
    ↓
AI 检测到需要代码审查
    ↓
AI 调用 discloseContext("code-review")
    ↓
DiscloseContext.handle()
    ↓
steeringController.getProgressiveContent("code-review")
    ↓
查找 ~/.kiro/skills/code-review/SKILL.md
    ↓
读取文件内容
    ↓
返回 SKILL.md 的完整内容
    ↓
AI 上下文中添加 skill 指令
    ↓
AI 根据 skill 指令执行审查
```

### 5.3 关键特性

**1. 动态描述生成**
- 每次调用时重新生成可用项目列表
- 包含 Skills 和 Auto Steering 文件
- 提供精确的名称和描述

**2. BLOCKING REQUIREMENT**
- 当检测到匹配的 skill 时，**必须**先激活
- 不能只提及 skill 而不调用
- 避免重复激活已激活的 skill

**3. 错误处理**
- 未找到时列出所有可用项目
- 提供清晰的错误信息
- 记录 metrics 用于分析

**4. 事件追踪**
- 发送开始、成功、错误事件
- 记录执行时间
- 便于调试和监控

---

## 六、实战示例

### 6.1 创建一个代码审查 Agent

**文件**：`.kiro/agents/code-reviewer.md`

```markdown
---
name: code-reviewer
description: 专业的代码审查助手，检查代码风格、安全问题和性能优化
tools:
  - read
  - write
model: claude-sonnet-4
includeMcpJson: false
includePowers: false
---

# Code Reviewer Agent

你是一个专业的代码审查专家。

## 审查标准

### 1. 代码风格
- 命名规范
- 缩进和格式
- 注释质量

### 2. 安全问题
- SQL 注入
- XSS 攻击
- 敏感信息泄露

### 3. 性能优化
- 算法复杂度
- 内存使用
- 数据库查询

### 4. 最佳实践
- SOLID 原则
- DRY 原则
- 错误处理

## 输出格式

### 问题列表
- 【严重】问题描述
- 【警告】问题描述
- 【建议】问题描述

### 改进建议
- 具体的代码示例
- 修改前后对比
- 优先级排序

## 审查流程

1. 读取代码文件
2. 逐行分析
3. 记录问题
4. 生成报告
5. 提供改进建议
```

### 6.2 使用 Agent

**方式 1：通过 invokeSubAgent**
```javascript
invokeSubAgent({
  name: "code-reviewer",
  prompt: "审查这段代码：\n```python\n...\n```",
  explanation: "需要专业的代码审查"
})
```

**方式 2：在 Kiro IDE 中选择**
- 打开命令面板
- 搜索 "Select Agent"
- 选择 "code-reviewer"
- 开始对话

### 6.3 创建一个需要 MCP 工具的 Agent

**文件**：`.kiro/agents/web-researcher.md`

```markdown
---
name: web-researcher
description: 网页研究助手，搜索和分析网页内容
tools:
  - read
  - write
  - @mcp  # 包含所有 MCP 工具（如 fetch、search）
model: claude-sonnet-4
---

# Web Researcher Agent

你是一个网页研究专家。

## 能力

- 使用 MCP fetch 工具抓取网页
- 使用 MCP search 工具搜索信息
- 分析和总结网页内容
- 提取关键信息

## 工作流程

1. 接收研究主题
2. 搜索相关网页
3. 抓取网页内容
4. 分析和总结
5. 生成研究报告
```

### 6.4 创建一个使用所有工具的 Agent

**文件**：`.kiro/agents/full-stack-dev.md`

```markdown
---
name: full-stack-dev
description: 全栈开发助手，拥有所有工具权限
tools: "*"  # 所有工具
model: claude-sonnet-4
---

# Full Stack Developer Agent

你是一个全栈开发专家，拥有完整的工具权限。

## 能力

- 读写文件
- 执行 Shell 命令
- 网页搜索和抓取
- 使用 MCP 工具
- 使用 Powers 功能

## 适用场景

- 复杂的全栈项目开发
- 需要多种工具协同的任务
- 端到端的功能实现
```

---

## 七、最佳实践

### 7.1 工具权限最小化

**原则**：只授予 agent 必需的工具权限

❌ **不推荐**：
```yaml
tools: "*"  # 所有工具，权限过大
```

✅ **推荐**：
```yaml
tools:
  - read   # 只需要读取
  - write  # 只需要写入
```

### 7.2 使用标签而非具体工具名

❌ **不推荐**：
```yaml
tools:
  - readFile
  - readCode
  - listDirectory
```

✅ **推荐**：
```yaml
tools:
  - read  # 包含所有读取工具
```

### 7.3 提供清晰的描述

❌ **不推荐**：
```yaml
description: "A code reviewer"
```

✅ **推荐**：
```yaml
description: "专业的代码审查助手，检查代码风格、安全问题和性能优化。适用于 Python、JavaScript、Rust 等语言。"
```

### 7.4 编写详细的 Prompt

**好的 Prompt 包含**：
- 角色定义
- 能力说明
- 工作流程
- 输出格式
- 示例

**示例**：
```markdown
# Agent Name

你是一个 [角色]。

## 能力
- 能力 1
- 能力 2

## 工作流程
1. 步骤 1
2. 步骤 2

## 输出格式
- 格式 1
- 格式 2

## 示例
输入：...
输出：...
```

### 7.5 测试 Agent

**测试清单**：
- [ ] Agent 能否正确加载？
- [ ] 工具权限是否正确？
- [ ] Prompt 是否清晰？
- [ ] 输出格式是否符合预期？
- [ ] 错误处理是否完善？

---

## 八、常见问题

### Q1: Agent 文件必须是 .md 格式吗？

**A**: 是的，必须是 Markdown 格式（`.md`）。

### Q2: 可以在 agent 中使用 CLI-only 字段吗？

**A**: 在 IDE 版本中不推荐。这些字段会被忽略，并记录警告。

### Q3: includeMcpJson 和 @mcp 标签有什么区别？

**A**: 
- `includeMcpJson: true`：自动包含所有 MCP 工具
- `tools: ["@mcp"]`：显式包含 MCP 工具（更推荐）

### Q4: 如何调试 Agent？

**A**: 
1. 查看 Kiro IDE 的输出面板
2. 搜索 `[CustomAgentLoader]` 日志
3. 检查 agent 文件的 YAML frontmatter 格式
4. 使用 `invokeSubAgent` 测试

### Q5: Agent 可以调用其他 Agent 吗？

**A**: 可以，通过 `invokeSubAgent` 工具。

---

## 九、相关文档

- `Skills-And-DiscloseContext-Analysis-v0.9.2.md` - Skills 和 DiscloseContext 概述
- `Kiro配置文件说明.md` - Kiro IDE 配置文件说明
- `source-code-analysis.md` - 源码分析方法论

---

## 十、更新记录

- 2026-02-07：创建文档，深度分析 Custom Agents 实现机制

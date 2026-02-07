# Kiro IDE Skills 和 DiscloseContext 功能分析

## 版本信息
- Kiro IDE 版本：v0.9.2
- 分析日期：2026-02-07
- 源码文件：dist/extension.js

## 功能概述

Kiro IDE 引入了 Skills 系统和 DiscloseContext 工具，实现了渐进式上下文加载机制。

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

### 3. Steering 的新模式

**新增 `inclusion: auto` 模式**：

**四种 inclusion 模式对比**：

| 模式 | 触发时机 | 使用场景 |
|------|----------|----------|
| `always` | 每次对话都加载 | 全局规则，始终生效 |
| `auto` | 通过 discloseContext 激活 | 按需加载，节省 token |
| `fileMatch` | 匹配的文件被读取时加载 | 特定文件类型的规则 |
| `manual` | 手动引用（`#` 语法） | 用户主动引用 |

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
└── Skills 管理  ← 新增
    ├── 用户级 Skills (~/.kiro/skills/)
    │   ├── skill-1
    │   └── skill-2
    └── 工作区级 Skills (.kiro/skills/)
        └── project-skill
```

#### 2. Steering 管理更新

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
- 支持 `inclusion: auto` 模式
- 更新 SteeringPanel.jsx
- 更新翻译文件

**1.2 文档更新**
- 更新 `Kiro配置文件说明.md`
- 说明 auto 模式的用途

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

### 阶段 3：高级功能（可选）

**3.1 导入功能**
- 从本地文件夹导入
- 从 GitHub 导入（需要网络请求）

**3.2 编辑功能**
- Skill 编辑器
- 实时预览

**3.3 模板功能**
- 内置 skill 模板
- 快速创建常用 skills

---

## 技术实现细节

### Rust 后端命令

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

### React 前端组件

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

---

## 注意事项

### 1. 文件路径处理
- 用户级：`~/.kiro/skills/`
- 工作区级：`.kiro/skills/`（相对于工作区根目录）
- 需要处理多工作区情况

### 2. SKILL.md 验证
- 导入时检查是否存在 SKILL.md
- 文件格式验证（Markdown）

### 3. 权限问题
- 删除操作需要确认
- 避免误删重要 skills

### 4. 性能考虑
- Skills 列表可能很多
- 需要分页或虚拟滚动
- SKILL.md 内容可能很大，需要优化显示

---

## 相关文档

- `Kiro配置文件说明.md` - Kiro IDE 配置文件说明
- `source-code-analysis.md` - 源码分析方法论

---

## 更新记录

- 2026-02-07：基于 v0.9.2 创建文档，分析 Skills 和 DiscloseContext 功能

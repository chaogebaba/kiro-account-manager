# Kiro IDE v0.9.2 工具对比分析

## 版本信息
- **旧版本**：v0.8.206（860,016 行）
- **新版本**：v0.9.2（886,661 行）
- **代码增量**：+26,645 行（+3.1%）
- **分析日期**：2026-02-07
- **分析方法**：逐行对比工具实例化代码

---

## 一、工具列表完整对比

### v0.8.206 工具列表（行 856693-856724）

```javascript
// 空工作区工具
new ToolExecuteBash()
new ToolFileSearch()
new ToolGrepSearch()
...getWebTools()  // WebFetch

// 完整工作区工具
new ToolExecuteBash()
new ToolControlProcess()
new ToolListProcesses()
new ToolGetProcessOutput()
new ToolListDirectory()
new ToolReadFile()
new ToolReadMultipleFiles()
new ToolFileSearch()
new ToolGrepSearch()
new ToolFsWrite()
new ToolFsAppend()
new ToolStrReplace()
new ToolKiroPowers()

// 条件工具
...hasActiveInstalledExtensions() ? [new ToolGetDiagnostics()] : []
...areAstToolsEnabled() ? [new ToolReadCode(), new ToolEditCode()] : []
...workspace.getAutonomyMode() === AutonomyMode.Autopilot ? [new ToolInvokeSubAgent()] : []

// Spec 模式工具
new GetUserInputTool()
new UpdateTaskStatusTool()
new UpdatePBTStatusTool()
new ToolPrework()

// MCP 工具
...mcpTools.map((tool) => new ToolMCPWrapper(tool))

// 内部工具
new ToolReportProgress()
new ToolSubagentResponse()

// Hook 工具
new ToolCreateHook()
```

### v0.9.2 工具列表（行 867901-867933）

```javascript
// 空工作区工具
new ToolExecuteBash()
new ToolFileSearch()
new ToolGrepSearch()
...getWebTools()  // WebFetch

// 完整工作区工具
new ToolExecuteBash()
new ToolControlProcess()
new ToolListProcesses()
new ToolGetProcessOutput()
new ToolListDirectory()
new ToolReadFile()
new ToolReadMultipleFiles()
new ToolFileSearch()
new ToolGrepSearch()
// ⭐ 删除了空行
new ToolFsWrite()
new ToolFsAppend()
new ToolStrReplace()
new ToolSemanticRename()        // ⭐ 新增
new ToolSmartRelocate()         // ⭐ 新增
new ToolKiroPowers()
new ToolCreateHook()            // ⭐ 移动到这里（原来在单独的函数）

// 条件工具
...hasActiveInstalledExtensions() ? [new ToolGetDiagnostics()] : []
new ToolReadCode()              // ⭐ 不再条件加载
new ToolEditCode()              // ⭐ 不再条件加载
new ToolDiscloseContext()       // ⭐ 新增
new ToolInvokeSubAgent(isSpecMode)  // ⭐ 不再条件加载，但接受参数

// MCP 工具
...mcpTools.map((tool) => new ToolMCPWrapper(tool))

// 内部工具
new ToolReportProgress()
new ToolSubagentResponse()
```

---

## 二、新增工具详解

### 2.1 ToolSemanticRename（语义重命名）

**源码位置**：行 867915

**功能**：
- 重命名代码符号（变量、函数、类等）
- 自动更新所有引用
- 跨文件重命名

**参数**：
```typescript
{
  path: string,        // 文件路径
  line: number,        // 行号（0-indexed）
  character: number,   // 字符位置（0-indexed）
  oldName: string,     // 当前名称
  newName: string      // 新名称
}
```

**对应工具名称**：`semanticRename`

### 2.2 ToolSmartRelocate（智能移动）

**源码位置**：行 867916

**功能**：
- 移动/重命名文件
- 自动更新 import 语句
- 跨文件引用更新

**参数**：
```typescript
{
  sourcePath: string,       // 源文件路径
  destinationPath: string   // 目标文件路径
}
```

**对应工具名称**：`smartRelocate`

### 2.3 ToolDiscloseContext（上下文披露）

**源码位置**：行 867923

**功能**：
- 按需激活 Skills
- 按需激活 Auto Steering 文件
- 渐进式上下文加载

**参数**：
```typescript
{
  name: string  // skill 或 steering 文件名称
}
```

**对应工具名称**：`discloseContext`

---

## 三、工具加载逻辑变更

### 3.1 ToolCreateHook 位置变更

**v0.8.206**：
```javascript
// 单独的函数返回
return [new ToolCreateHook()]
```
**源码位置**：行 856687

**v0.9.2**：
```javascript
// 合并到主工具列表
new ToolCreateHook()
```
**源码位置**：行 867918

**影响**：
- 简化工具注册逻辑
- CreateHook 始终可用（不再单独判断）

### 3.2 ToolReadCode 和 ToolEditCode 加载变更

**v0.8.206**：
```javascript
...areAstToolsEnabled() ? [new ToolReadCode(), new ToolEditCode()] : []
```
**源码位置**：行 856711

**v0.9.2**：
```javascript
new ToolReadCode()
new ToolEditCode()
```
**源码位置**：行 867921-867922

**影响**：
- **不再条件加载**，始终可用
- 移除了 `areAstToolsEnabled()` 检查
- 用户无需手动启用 AST 工具

### 3.3 ToolInvokeSubAgent 加载变更

**v0.8.206**：
```javascript
...workspace.getAutonomyMode() === AutonomyMode.Autopilot 
  ? [new ToolInvokeSubAgent()] 
  : []
```
**源码位置**：行 856712

**v0.9.2**：
```javascript
new ToolInvokeSubAgent(isSpecMode)
```
**源码位置**：行 867924

**影响**：
- **不再条件加载**，始终可用
- 接受 `isSpecMode` 参数
- 支持 Spec 模式和 Custom Agents

### 3.4 Spec 模式工具移除

**v0.8.206 有以下工具**：
```javascript
new GetUserInputTool()
new UpdateTaskStatusTool()
new UpdatePBTStatusTool()
new ToolPrework()
```
**源码位置**：行 856716

**v0.9.2**：
- ❌ **完全移除**

**影响**：
- Spec 模式重构
- 这些工具可能被整合到其他工具中
- 或者改用不同的实现方式

---

## 四、工具数量统计

### v0.8.206 工具数量

**基础工具**：13 个
- ExecuteBash, ControlProcess, ListProcesses, GetProcessOutput
- ListDirectory, ReadFile, ReadMultipleFiles, FileSearch, GrepSearch
- FsWrite, FsAppend, StrReplace, KiroPowers

**条件工具**：5 个
- GetDiagnostics（需要语言扩展）
- ReadCode, EditCode（需要启用 AST）
- InvokeSubAgent（需要 Autopilot 模式）
- CreateHook

**Spec 工具**：4 个
- GetUserInputTool, UpdateTaskStatusTool, UpdatePBTStatusTool, ToolPrework

**Web 工具**：1 个
- WebFetch

**MCP 工具**：动态加载

**内部工具**：2 个
- ReportProgress, SubagentResponse

**总计**：25+ 个（不含 MCP）

### v0.9.2 工具数量

**基础工具**：18 个
- ExecuteBash, ControlProcess, ListProcesses, GetProcessOutput
- ListDirectory, ReadFile, ReadMultipleFiles, FileSearch, GrepSearch
- FsWrite, FsAppend, StrReplace
- **SemanticRename**（新增）
- **SmartRelocate**（新增）
- KiroPowers, CreateHook
- **ReadCode**（不再条件加载）
- **EditCode**（不再条件加载）

**条件工具**：1 个
- GetDiagnostics（需要语言扩展）

**新增工具**：2 个
- **DiscloseContext**（新增）
- **InvokeSubAgent**（不再条件加载，接受参数）

**Web 工具**：1 个
- WebFetch

**MCP 工具**：动态加载

**内部工具**：2 个
- ReportProgress, SubagentResponse

**总计**：24 个（不含 MCP）

**变化**：
- ➕ 新增 3 个工具（SemanticRename, SmartRelocate, DiscloseContext）
- ➖ 移除 4 个 Spec 工具
- ✅ 3 个工具不再条件加载（ReadCode, EditCode, InvokeSubAgent）

---

## 五、关键发现

### 5.1 工具始终可用化

**趋势**：从"条件加载"到"始终可用"

**v0.8.206**：
- ReadCode, EditCode 需要 `areAstToolsEnabled()`
- InvokeSubAgent 需要 `AutonomyMode.Autopilot`

**v0.9.2**：
- ReadCode, EditCode 始终可用
- InvokeSubAgent 始终可用（但接受 isSpecMode 参数）

**原因**：
- 简化用户体验
- 减少配置复杂度
- 支持更多使用场景

### 5.2 Spec 模式重构

**v0.8.206**：
- 有专门的 Spec 工具（GetUserInputTool, UpdateTaskStatusTool 等）
- Spec 模式和普通模式工具分离

**v0.9.2**：
- 移除专门的 Spec 工具
- InvokeSubAgent 接受 `isSpecMode` 参数
- Spec 功能可能整合到其他工具中

**影响**：
- Spec 模式更加透明
- 减少工具数量
- 统一工具接口

### 5.3 语义化代码操作

**新增工具**：
- SemanticRename - 语义重命名
- SmartRelocate - 智能移动

**意义**：
- 更强大的代码重构能力
- 自动更新引用
- 减少手动修改

### 5.4 渐进式上下文加载

**新增工具**：
- DiscloseContext

**意义**：
- 按需加载 Skills 和 Steering
- 减少初始上下文大小
- 提升性能和响应速度

---

## 六、工具标签系统

### 6.1 工具标签定义

**源码位置**：需要进一步分析

**可能的标签**：
- `read` - 读取操作
- `write` - 写入操作
- `shell` - Shell 命令
- `web` - 网络请求
- `spec` - Spec 模式
- `@mcp` - MCP 工具

### 6.2 工具标签用途

**Custom Agents**：
```yaml
tools:
  - read
  - write
  - @mcp
```

**Hooks**：
```json
{
  "when": {
    "type": "preToolUse",
    "toolTypes": ["write", "shell"]
  }
}
```

---

## 七、迁移指南

### 7.1 从 v0.8.206 迁移到 v0.9.2

**1. 移除 AST 工具配置**：
- `areAstToolsEnabled()` 不再需要
- ReadCode 和 EditCode 始终可用

**2. 移除 Autopilot 模式检查**：
- InvokeSubAgent 始终可用
- 但需要传递 `isSpecMode` 参数

**3. 使用新工具**：
- 使用 `semanticRename` 替代手动重命名
- 使用 `smartRelocate` 替代手动移动文件
- 使用 `discloseContext` 按需加载 Skills

**4. Spec 模式适配**：
- 移除对 GetUserInputTool 等的依赖
- 使用 InvokeSubAgent 的 Spec 模式

### 7.2 新工具使用示例

**SemanticRename**：
```javascript
await invoke('semanticRename', {
  path: 'src/utils.ts',
  line: 10,
  character: 15,
  oldName: 'oldFunctionName',
  newName: 'newFunctionName'
})
```

**SmartRelocate**：
```javascript
await invoke('smartRelocate', {
  sourcePath: 'src/old/file.ts',
  destinationPath: 'src/new/file.ts'
})
```

**DiscloseContext**：
```javascript
await invoke('discloseContext', {
  name: 'my-skill'  // 或 'my-steering-file'
})
```

---

## 八、总结

### 8.1 主要变更

1. ✅ **新增 3 个工具**：SemanticRename, SmartRelocate, DiscloseContext
2. ✅ **3 个工具不再条件加载**：ReadCode, EditCode, InvokeSubAgent
3. ❌ **移除 4 个 Spec 工具**：GetUserInputTool, UpdateTaskStatusTool, UpdatePBTStatusTool, ToolPrework
4. ✅ **CreateHook 合并到主工具列表**

### 8.2 影响评估

**高影响**：
- DiscloseContext（全新功能）
- SemanticRename, SmartRelocate（全新功能）
- InvokeSubAgent 不再条件加载（行为变更）

**中影响**：
- ReadCode, EditCode 不再条件加载（简化配置）
- Spec 工具移除（需要适配）

**低影响**：
- CreateHook 位置变更（不影响功能）

### 8.3 升级建议

**必须了解**：
- 新增的 3 个工具的使用方法
- InvokeSubAgent 的参数变更
- Spec 模式的新实现方式

**推荐了解**：
- 工具标签系统
- 渐进式上下文加载
- 语义化代码操作

**可选了解**：
- 工具内部实现变更
- 工具注册逻辑优化

---

## 九、下一步分析

### 9.1 需要深入分析的内容

- [ ] 工具标签系统的完整定义
- [ ] Spec 模式的新实现方式
- [ ] InvokeSubAgent 的 isSpecMode 参数详解
- [ ] DiscloseContext 的完整实现
- [ ] SemanticRename 和 SmartRelocate 的实现细节

### 9.2 需要验证的功能

- [ ] ReadCode 和 EditCode 是否有功能变更
- [ ] InvokeSubAgent 在 Spec 模式下的行为
- [ ] 移除的 Spec 工具是否有替代方案
- [ ] 工具标签在 Custom Agents 中的使用

---

## 十、更新记录

- 2026-02-07：创建文档，完整对比 v0.8.206 和 v0.9.2 的工具列表


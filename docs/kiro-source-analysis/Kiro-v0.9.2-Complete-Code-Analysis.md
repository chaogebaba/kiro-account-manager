# Kiro IDE v0.9.2 完整代码分析

## 版本信息
- **旧版本**：v0.8.206（860,016 行，41.5 MB）
- **新版本**：v0.9.2（886,661 行，44.9 MB）
- **代码增量**：+26,645 行（+3.1%），+3.4 MB
- **分析日期**：2026-02-07
- **分析方法**：完整源码对比 + 关键类/函数提取

---

## 目录

1. [代码规模变化](#一代码规模变化)
2. [工具系统变更](#二工具系统变更)
3. [命令系统变更](#三命令系统变更)
4. [新增核心类](#四新增核心类)
5. [配置系统](#五配置系统)
6. [错误类型系统](#六错误类型系统)
7. [Spec 模式重构](#七spec-模式重构)
8. [Custom Agents 系统](#八custom-agents-系统)
9. [LangGraph 集成](#九langgraph-集成)
10. [存储系统](#十存储系统)

---

## 一、代码规模变化

### 1.1 文件大小对比

| 版本 | 行数 | 文件大小 | 增量 |
|------|------|----------|------|
| v0.8.206 | 860,016 | 41.5 MB | - |
| v0.9.2 | 886,661 | 44.9 MB | +26,645 行 (+3.1%) |

### 1.2 主要增量来源

**推测**：
- LangGraph 集成（~5,000 行）
- Custom Agents 系统（~3,000 行）
- Skills 和 DiscloseContext（~2,000 行）
- Spec 模式重构（~2,000 行）
- 新增工具（~1,000 行）
- 其他优化和 Bug 修复（~13,000 行）

---

## 二、工具系统变更

### 2.1 工具列表完整对比

**v0.8.206 工具**（25+ 个）：
- 基础工具：13 个
- 条件工具：5 个（GetDiagnostics, ReadCode, EditCode, InvokeSubAgent, CreateHook）
- Spec 工具：4 个（GetUserInputTool, UpdateTaskStatusTool, UpdatePBTStatusTool, ToolPrework）
- Web 工具：1 个（WebFetch）
- MCP 工具：动态加载
- 内部工具：2 个（ReportProgress, SubagentResponse）

**v0.9.2 工具**（24 个）：
- 基础工具：18 个（新增 SemanticRename, SmartRelocate, 移入 ReadCode, EditCode, CreateHook）
- 条件工具：1 个（GetDiagnostics）
- 新增工具：2 个（DiscloseContext, InvokeSubAgent 不再条件加载）
- Web 工具：1 个（WebFetch）
- MCP 工具：动态加载
- 内部工具：2 个（ReportProgress, SubagentResponse）

**关键变更**：
- ✅ 新增 3 个工具：SemanticRename, SmartRelocate, DiscloseContext
- ✅ 3 个工具不再条件加载：ReadCode, EditCode, InvokeSubAgent
- ❌ 移除 4 个 Spec 工具
- ✅ CreateHook 合并到主工具列表

### 2.2 新增工具详解

**1. ToolSemanticRename**（行 867915）
```typescript
{
  path: string,
  line: number,
  character: number,
  oldName: string,
  newName: string
}
```

**2. ToolSmartRelocate**（行 867916）
```typescript
{
  sourcePath: string,
  destinationPath: string
}
```

**3. ToolDiscloseContext**（行 867923）
```typescript
{
  name: string  // skill 或 steering 文件名称
}
```

---

## 三、命令系统变更

### 3.1 命令总数

- **v0.8.206**：36 个命令
- **v0.9.2**：35 个命令

### 3.2 命令列表

**核心命令**（两个版本都有）：
- `kiroAgent.context.pickProviderSubmenu`
- `kiroAgent.inlineChat.start`
- `KiroAgent.focus.logs`
- `kiroAgent.debug.openMetadata`
- `kiroAgent.debug.purgeMetadata`
- `kiroAgent.onboarding.checkSteps`
- `kiroAgent.onboarding.checkStep`
- `kiroAgent.onboarding.executeStep`
- `kiroAgent.processes.openProcessDetails`

**Hooks 命令**：
- `kiroAgent.hooks.updateUI`
- `kiroAgent.hooks.openUI`
- `kiroAgent.hooks.upgrade`
- `kiroAgent.hooks.createNew`
- `kiroAgent.hooks.updateTitle`（v0.9.2 新增）
- `kiroAgent.hooks.openHookFile`
- `kiroAgent.hooks.setLoading`（v0.8.206 独有）

**MCP 命令**：
- `kiroAgent.mcp.showLogs`
- `kiroAgent.mcp.debugServer`
- `kiroAgent.mcp.reconnectServer`
- `kiroAgent.mcp.authenticateConnection`
- `kiroAgent.mcp.enableServer`
- `kiroAgent.mcp.disableServer`
- `kiroAgent.mcp.enableAllServerTools`
- `kiroAgent.mcp.disableAllServerTools`
- `kiroAgent.mcp.enableTool`
- `kiroAgent.mcp.disableTool`
- `kiroAgent.mcp.testTool`
- `kiroAgent.mcp.enable`
- `kiroAgent.mcp.resetDangerousEnvConsent`
- `kiroAgent.views.mcpServerStatus.refresh`

**其他命令**：
- `cancelHook`
- `kiro.config.getWorkspaceState`
- `kiro.getCanEnableTelemetry`
- `kiro.powers.configure`
- `kiro.profiles.getProfile`
- `kiro.tools.refreshRemoteTools`
- `kiro.uri`（v0.8.206 独有）

### 3.3 命令变更

**新增命令**：
- `kiroAgent.hooks.updateTitle`

**移除命令**：
- `kiroAgent.hooks.setLoading`
- `kiro.uri`

---

## 四、新增核心类

### 4.1 存储系统类（行 816541+）

**错误类**：
```javascript
class IDEStorageError extends Error
class StorageNotInitializedError extends IDEStorageError
class JsonParseError extends IDEStorageError
class InvalidInputError extends IDEStorageError
class FileWriteError extends IDEStorageError
class DiskFullError extends FileWriteError
class PermissionDeniedError extends FileWriteError
```

**管理类**：
```javascript
class StorageManager  // 行 816672
```

### 4.2 Checkpoint 系统类（行 817051+）

**错误类**：
```javascript
class NotInitializedError extends Error
class InvalidCommitIdError extends Error
class ReadOnlyFileSystemError extends Error
class FileNotExistError extends Error
class MissingMetaIdError extends Error
class InteractionError extends Error
class MissingContextError extends InteractionError
class NoWorkspaceError extends Error
class UnsupportedOperationError extends Error
```

**核心类**：
```javascript
class CheckpointController  // 行 817205
class KiroDiffFileSystemProvider  // 行 817390
class MetaFileSystemProvider  // 行 817440
```

### 4.3 Experiments 系统类（行 817590+）

```javascript
class ExecutionDefinition  // 行 817590
class ExperimentsConfigProvider  // 行 817728
class ExperimentsService  // 行 817854
class ExperimentsTelemetry  // 行 817927
class ExperimentsStatusBar  // 行 817990
```

### 4.4 LangGraph 类（行 819528+）

**错误类**：
```javascript
class BaseLangGraphError extends Error
class GraphBubbleUp extends BaseLangGraphError
class GraphRecursionError extends BaseLangGraphError
class GraphValueError extends BaseLangGraphError
class GraphInterrupt extends BaseLangGraphError
class NodeInterrupt extends GraphInterrupt
class ParentCommand extends GraphInterrupt
class EmptyInputError extends BaseLangGraphError
class EmptyChannelError extends BaseLangGraphError
class InvalidUpdateError extends BaseLangGraphError
class UnreachableNodeError extends BaseLangGraphError
class InvalidNamespaceError extends BaseLangGraphError
class GraphValidationError extends Error
```

**核心类**：
```javascript
class BaseStore  // 行 820097
class AsyncBatchedStore extends BaseStore  // 行 820235
class BaseChannel  // 行 820370
class BinaryOperatorAggregate extends BaseChannel  // 行 820440
class LastValue extends BaseChannel  // 行 820508
class Send  // 行 820620
class Command  // 行 820655
class ManagedValue  // 行 820792
class ManagedValueMapping extends ManagedValue  // 行 820832
class NoopManagedValue extends ManagedValue  // 行 820911
class AnnotationRoot  // 行 820920
class RunnableCallable  // 行 821115
class ChannelWrite  // 行 821260
class ChannelRead  // 行 821365
class PregelNode  // 行 821413
class Call  // 行 822048
class IterableReadableStreamWithAbortSignal  // 行 822750
class IterableReadableWritableStream  // 行 822804
class PregelLoop  // 行 822882
class StreamMessagesHandler  // 行 823575
class PregelRunner  // 行 823870
class Channel  // 行 824126
class Pregel  // 行 824206
class EphemeralValue  // 行 825376
class Branch  // 行 825433
class Graph  // 行 825496
class CompiledGraph  // 行 825717
class NamedBarrierValue  // 行 826047
class StateGraph  // 行 826154
class CompiledStateGraph  // 行 826469
```

### 4.5 Spec 系统类（行 828981+）

```javascript
class SpecDocumentManager  // 行 828981
class UnexpectedResponseFormatError extends Error  // 行 829213
class IntentDetectionService  // 行 829232
class CustomAgentRegistry  // 行 829723
class PruningService  // 行 829776
class ImplicitRules  // 行 829930
class SpecGenerationDefinition  // 行 830150
```

### 4.6 Spec 工具类（行 830381+）

```javascript
class GetUserInputTool  // 行 830381
```

**错误类**：
```javascript
class TaskStatusValidationError extends Error  // 行 830556
class InvalidPBTStatusError extends TaskStatusValidationError  // 行 830564
class InvalidToolArgumentsError extends Error  // 行 830575
class TaskNotFoundError extends Error  // 行 830589
class TaskStatusUpdateError extends Error  // 行 830606
class TaskExecutionAttachmentError extends Error  // 行 830624
class InvalidTaskFormatError extends Error  // 行 830642
class RetrieveTaskError extends Error  // 行 830661
class InvalidRequirementFormatError extends Error  // 行 830676
class PBTTaskNotFoundError extends Error  // 行 830695
class NotAPBTTaskError extends Error  // 行 830712
```

**工具类**：
```javascript
class Prework  // 行 830964
class UpdatePBTStatus  // 行 831100
class UpdateTaskStatus  // 行 831231
```

### 4.7 Agent 执行类（行 834763+）

**错误类**：
```javascript
class AgentConfigurationError extends Error  // 行 834763
class InvalidExecutionStateError extends Error  // 行 834772
class UnknownExecutionError extends Error  // 行 834792
class NoQuestionsToYieldError extends Error  // 行 834807
```

**核心类**：
```javascript
class YieldSemaphore  // 行 834826
class AgentExecution  // 行 834918
```

---

## 五、配置系统

### 5.1 配置命名空间

**v0.9.2 配置项**：
- `kiroAgent` - Kiro Agent 主配置
- `kiroAgent.codeReferences` - 代码引用配置
- `codewhisperer.config` - CodeWhisperer 配置
- `telemetry` - 遥测配置
- `workbench` - 工作台配置

### 5.2 配置读取方式

```javascript
// 读取配置
vscode.workspace.getConfiguration("kiroAgent")
vscode.workspace.getConfiguration("codewhisperer.config")
vscode.workspace.getConfiguration("telemetry")
vscode.workspace.getConfiguration("workbench")

// 更新配置
await vscode.workspace.getConfiguration("kiroAgent").update(
  key,
  value,
  vscode.ConfigurationTarget.Global
)
```

---

## 六、错误类型系统

### 6.1 错误类型统计

**v0.9.2 新增错误类型**：~40 个

**分类**：
1. **存储错误**（7 个）：IDEStorageError, StorageNotInitializedError, JsonParseError, InvalidInputError, FileWriteError, DiskFullError, PermissionDeniedError
2. **Checkpoint 错误**（9 个）：NotInitializedError, InvalidCommitIdError, ReadOnlyFileSystemError, FileNotExistError, MissingMetaIdError, InteractionError, MissingContextError, NoWorkspaceError, UnsupportedOperationError
3. **LangGraph 错误**（12 个）：BaseLangGraphError, GraphBubbleUp, GraphRecursionError, GraphValueError, GraphInterrupt, NodeInterrupt, ParentCommand, EmptyInputError, EmptyChannelError, InvalidUpdateError, UnreachableNodeError, InvalidNamespaceError
4. **Spec 错误**（11 个）：TaskStatusValidationError, InvalidPBTStatusError, InvalidToolArgumentsError, TaskNotFoundError, TaskStatusUpdateError, TaskExecutionAttachmentError, InvalidTaskFormatError, RetrieveTaskError, InvalidRequirementFormatError, PBTTaskNotFoundError, NotAPBTTaskError
5. **Agent 错误**（4 个）：AgentConfigurationError, InvalidExecutionStateError, UnknownExecutionError, NoQuestionsToYieldError

### 6.2 错误继承关系

```
Error
├─ IDEStorageError
│  ├─ StorageNotInitializedError
│  ├─ JsonParseError
│  ├─ InvalidInputError
│  └─ FileWriteError
│     ├─ DiskFullError
│     └─ PermissionDeniedError
├─ BaseLangGraphError
│  ├─ GraphBubbleUp
│  ├─ GraphRecursionError
│  ├─ GraphValueError
│  ├─ GraphInterrupt
│  │  ├─ NodeInterrupt
│  │  └─ ParentCommand
│  ├─ EmptyInputError
│  ├─ EmptyChannelError
│  ├─ InvalidUpdateError
│  ├─ UnreachableNodeError
│  └─ InvalidNamespaceError
├─ TaskStatusValidationError
│  └─ InvalidPBTStatusError
├─ InteractionError
│  └─ MissingContextError
└─ ... (其他错误)
```

---

## 七、Spec 模式重构

### 7.1 Spec 工具变更

**v0.8.206 Spec 工具**（4 个）：
- `GetUserInputTool`
- `UpdateTaskStatusTool`
- `UpdatePBTStatusTool`
- `ToolPrework`

**v0.9.2 Spec 工具**（4 个，但实现不同）：
- `GetUserInputTool`（行 830381，保留但可能重构）
- `Prework`（行 830964，新实现）
- `UpdatePBTStatus`（行 831100，新实现）
- `UpdateTaskStatus`（行 831231，新实现）

### 7.2 Spec 系统新增类

**核心类**：
- `SpecDocumentManager`（行 828981）- Spec 文档管理
- `IntentDetectionService`（行 829232）- 意图检测
- `CustomAgentRegistry`（行 829723）- Custom Agent 注册表
- `PruningService`（行 829776）- 剪枝服务
- `ImplicitRules`（行 829930）- 隐式规则
- `SpecGenerationDefinition`（行 830150）- Spec 生成定义

### 7.3 Spec 错误类型

**新增 11 个错误类型**：
- `TaskStatusValidationError`
- `InvalidPBTStatusError`
- `InvalidToolArgumentsError`
- `TaskNotFoundError`
- `TaskStatusUpdateError`
- `TaskExecutionAttachmentError`
- `InvalidTaskFormatError`
- `RetrieveTaskError`
- `InvalidRequirementFormatError`
- `PBTTaskNotFoundError`
- `NotAPBTTaskError`

---

## 八、Custom Agents 系统

### 8.1 核心类

**CustomAgentRegistry**（行 829723）：
- 管理所有 Custom Agents
- 注册和查找 Agents
- Agent 配置验证

**AgentExecution**（行 834918）：
- Agent 执行管理
- 执行状态跟踪
- 错误处理

**YieldSemaphore**（行 834826）：
- 控制 Agent 执行流程
- 管理异步操作
- 信号量机制

### 8.2 错误类型

**AgentConfigurationError**（行 834763）：
- Agent 配置错误
- YAML frontmatter 验证失败
- 工具配置错误

**InvalidExecutionStateError**（行 834772）：
- 执行状态无效
- 状态转换错误

**UnknownExecutionError**（行 834792）：
- 未知执行错误
- 通用错误处理

**NoQuestionsToYieldError**（行 834807）：
- 没有问题可以 yield
- 执行流程错误

---

## 九、LangGraph 集成

### 9.1 LangGraph 是什么？

**LangGraph** 是 LangChain 的图执行引擎，用于构建复杂的 AI Agent 工作流。

**核心概念**：
- **Graph**：工作流图
- **Node**：图中的节点（执行单元）
- **Channel**：节点间的通信通道
- **State**：图的状态管理
- **Pregel**：图执行引擎

### 9.2 核心类（~30 个）

**图结构**：
- `Graph`（行 825496）- 基础图
- `StateGraph`（行 826154）- 状态图
- `CompiledGraph`（行 825717）- 编译后的图
- `CompiledStateGraph`（行 826469）- 编译后的状态图

**执行引擎**：
- `Pregel`（行 824206）- 图执行引擎
- `PregelLoop`（行 822882）- 执行循环
- `PregelRunner`（行 823870）- 执行器
- `PregelNode`（行 821413）- 执行节点

**通道系统**：
- `BaseChannel`（行 820370）- 基础通道
- `Channel`（行 824126）- 通道实现
- `ChannelWrite`（行 821260）- 写入通道
- `ChannelRead`（行 821365）- 读取通道
- `LastValue`（行 820508）- 最后值通道
- `BinaryOperatorAggregate`（行 820440）- 聚合通道

**状态管理**：
- `ManagedValue`（行 820792）- 托管值
- `ManagedValueMapping`（行 820832）- 托管值映射
- `NoopManagedValue`（行 820911）- 空操作托管值
- `EphemeralValue`（行 825376）- 临时值
- `NamedBarrierValue`（行 826047）- 命名屏障值

**流处理**：
- `StreamMessagesHandler`（行 823575）- 流消息处理
- `IterableReadableStreamWithAbortSignal`（行 822750）- 可中止流
- `IterableReadableWritableStream`（行 822804）- 可读写流

**其他**：
- `Send`（行 820620）- 发送命令
- `Command`（行 820655）- 命令
- `Call`（行 822048）- 调用
- `Branch`（行 825433）- 分支
- `RunnableCallable`（行 821115）- 可运行对象
- `AnnotationRoot`（行 820920）- 注解根
- `BaseStore`（行 820097）- 基础存储
- `AsyncBatchedStore`（行 820235）- 异步批量存储

### 9.3 LangGraph 用途

**推测用途**：
- Custom Agents 的执行引擎
- Spec 模式的工作流管理
- 复杂 Agent 任务的编排
- 多步骤任务的状态管理

---

## 十、存储系统

### 10.1 StorageManager（行 816672）

**功能**：
- 管理 IDE 存储
- JSON 数据持久化
- 错误处理

**错误类型**：
- `StorageNotInitializedError` - 存储未初始化
- `JsonParseError` - JSON 解析错误
- `InvalidInputError` - 无效输入
- `FileWriteError` - 文件写入错误
- `DiskFullError` - 磁盘已满
- `PermissionDeniedError` - 权限被拒绝

### 10.2 CheckpointController（行 817205）

**功能**：
- 管理代码检查点
- 回滚到之前状态
- 版本控制

**相关类**：
- `KiroDiffFileSystemProvider`（行 817390）- Diff 文件系统
- `MetaFileSystemProvider`（行 817440）- 元数据文件系统

**错误类型**：
- `NotInitializedError` - 未初始化
- `InvalidCommitIdError` - 无效提交 ID
- `ReadOnlyFileSystemError` - 只读文件系统
- `FileNotExistError` - 文件不存在
- `MissingMetaIdError` - 缺少元数据 ID
- `InteractionError` - 交互错误
- `MissingContextError` - 缺少上下文
- `NoWorkspaceError` - 没有工作区
- `UnsupportedOperationError` - 不支持的操作

---

## 十一、总结

### 11.1 主要变更统计

| 类别 | v0.8.206 | v0.9.2 | 变化 |
|------|----------|--------|------|
| 代码行数 | 860,016 | 886,661 | +26,645 (+3.1%) |
| 文件大小 | 41.5 MB | 44.9 MB | +3.4 MB (+8.2%) |
| 工具数量 | 25+ | 24 | -1（但功能更强） |
| 命令数量 | 36 | 35 | -1 |
| 新增类 | - | ~100+ | 大量新增 |
| 错误类型 | - | ~40+ | 大量新增 |

### 11.2 核心新增功能

1. **LangGraph 集成**（~30 个类）
   - 图执行引擎
   - 状态管理
   - 流处理

2. **Custom Agents 系统**（~5 个类）
   - Agent 注册表
   - Agent 执行管理
   - 配置验证

3. **Spec 模式重构**（~10 个类）
   - 文档管理
   - 意图检测
   - 任务状态管理

4. **存储系统**（~10 个类）
   - 存储管理
   - Checkpoint 控制
   - 文件系统提供者

5. **Experiments 系统**（~5 个类）
   - 实验配置
   - 实验服务
   - 遥测

6. **新增工具**（3 个）
   - SemanticRename
   - SmartRelocate
   - DiscloseContext

### 11.3 影响评估

**高影响**：
- LangGraph 集成（全新架构）
- Custom Agents 系统（全新功能）
- Spec 模式重构（重大变更）
- 新增 3 个工具（新功能）

**中影响**：
- 存储系统（改进）
- Checkpoint 系统（改进）
- 错误类型系统（增强）
- 工具加载逻辑（简化）

**低影响**：
- 命令系统（微调）
- 配置系统（微调）
- Experiments 系统（新增但可选）

### 11.4 技术栈变化

**新增依赖**：
- LangGraph（图执行引擎）
- 可能的 YAML 解析库（Custom Agents）
- 可能的 Markdown 解析库（Skills）

**架构变化**：
- 从简单的工具调用 → 图执行引擎
- 从内置 sub-agents → Custom Agents
- 从静态工具列表 → 动态工具加载

---

## 十二、下一步分析

### 12.1 需要深入分析的内容

- [ ] LangGraph 的完整工作流程
- [ ] Custom Agents 的执行机制
- [ ] Spec 模式的新实现细节
- [ ] 存储系统的完整 API
- [ ] Checkpoint 系统的使用方法
- [ ] Experiments 系统的配置方式

### 12.2 需要验证的功能

- [ ] LangGraph 在 Custom Agents 中的使用
- [ ] Spec 工具的新实现是否兼容
- [ ] 存储系统的性能影响
- [ ] Checkpoint 系统的稳定性
- [ ] 新增工具的完整功能

---

## 十三、更新记录

- 2026-02-07：创建文档，完整分析 v0.9.2 的所有主要变更


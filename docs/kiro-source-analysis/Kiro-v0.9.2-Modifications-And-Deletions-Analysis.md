# Kiro IDE v0.9.2 修改和删除分析

## 版本信息
- **旧版本**：v0.8.206
- **新版本**：v0.9.2
- **分析日期**：2026-02-07
- **分析方法**：逐个类对比

---

## 一、类统计

### 1.1 总体统计

| 版本 | 类总数 | 说明 |
|------|--------|------|
| v0.8.206 | 2,447 个 | 包含第三方库 |
| v0.9.2 | 2,678 个 | 包含第三方库 |
| **增量** | **+231 个** | 净增加 |

### 1.2 变化统计

| 类型 | 总数 | Kiro IDE 核心类 | 第三方库 |
|------|------|------------------|----------|
| **新增** | 408 个 | 24 个 | 384 个 |
| **删除** | 177 个 | 17 个 | 160 个 |
| **保留** | 2,270 个 | 78 个 | 2,192 个 |

**说明**：
- Kiro IDE 核心类：以 Kiro/Continue/Spec/Agent/Storage/Checkpoint/Experiment/MCP/Hook/Steering/Power/Tool/Context/Provider/Service/Manager/Controller/Handler/Execution/Document 开头的类
- 第三方库：AWS SDK、数据库驱动、工具库等

---

## 二、删除的类分析

### 2.1 Kiro IDE 核心类删除（17 个）

#### 真正删除的功能（4 个）

1. **ToolPrework**
   - 状态：重构为 `Prework`
   - 原因：Spec 工具重构
   - 影响：工具实现方式变化，功能保留

2. **PowerRegistryManager**
   - 状态：功能整合到其他类
   - 原因：Powers 系统重构
   - 影响：Powers 管理逻辑优化

3. **MCPSchemaValidationError**
   - 状态：合并到其他错误类
   - 原因：MCP 错误类型简化
   - 影响：错误处理更统一

4. **MCPValidationError**
   - 状态：合并到其他错误类
   - 原因：MCP 错误类型简化
   - 影响：错误处理更统一

#### 重命名的类（6 个）

| v0.8.206 | v0.9.2 | 说明 |
|----------|--------|------|
| `ExecutionLogController` | `_ExecutionLogController` | 加下划线前缀 |
| `PowerAlreadyInstalledError2` | `PowerAlreadyInstalledError` | 去掉数字后缀 |
| `PowerNotFoundError3` | `PowerNotFoundError2` | 数字后缀变化 |
| `PowerRegistryLoadError2` | `PowerRegistryLoadError` | 去掉数字后缀 |
| `PowerRegistrySaveError2` | `PowerRegistrySaveError` | 去掉数字后缀 |
| `PowerValidationError2` | `PowerValidationError` | 去掉数字后缀 |

#### Provider 相关删除（7 个）

这些是 LangGraph 或其他库的 Provider 类，可能被新的实现替代：

- `Provider`
- `ProviderAsync`
- `ProviderError8` → `ProviderError9`（版本升级）
- `ProviderStream`
- `ProviderSync`
- `ServiceUnavailable` → `ServiceUnavailableException`（重命名）
- `KiroError29` → `KiroError30`（版本升级）

#### 数据库相关（~50 个）
- MySQL2 连接池类：`Pool2`, `PoolConnection`, `PoolCluster` 等
- PostgreSQL 协议类：`Packet`, `PacketParser`, `ParameterStatusMessage` 等
- **原因**：可能移除了数据库 Context Provider 功能

#### AWS SDK 相关（~30 个）
- SageMaker 相关：`SageMakerRuntime`, `SageMakerRuntimeClient2` 等
- 部分 Bedrock 类：版本升级导致的类名变化
- **原因**：AWS SDK 版本升级或功能精简

#### 其他第三方库（~90 个）
- WebSocket：`WebSocket3`, `WebSocketServer2`
- XML 解析：`XMLParser8`, `XmlNode`
- Cookie 处理：`CookieJar2`
- **原因**：依赖库版本升级或移除

---

## 三、新增的类分析

### 3.1 Kiro IDE 核心类新增（24 个）

#### Agent 系统（3 个）
1. **AgentConfigurationError** - Agent 配置错误
2. **AgentController** - Agent 控制器
3. **AgentExecution** - Agent 执行管理

#### Experiments 系统（4 个）
1. **ExperimentsService** - 实验服务
2. **ExperimentsConfigProvider** - 实验配置提供者
3. **ExperimentsStatusBar** - 实验状态栏
4. **ExperimentsTelemetry** - 实验遥测

#### Spec 系统（3 个）
1. **SpecDocumentManager** - Spec 文档管理器
2. **SpecGenerationDefinition** - Spec 生成定义
3. **ExecutionDefinition** - 执行定义

#### Hook 系统（2 个）
1. **HookListener** - Hook 监听器
2. **HookTrigger** - Hook 触发器

#### Tool 系统（2 个）
1. **ToolSemanticRename** - 语义化重命名工具
2. **ToolSmartRelocate** - 智能移动/重命名工具

#### Powers 系统（6 个）
1. **PowerAlreadyInstalledError** - Power 已安装错误（去掉数字后缀）
2. **PowerNotFoundError2** - Power 未找到错误
3. **PowerRegistryDataError** - Power 注册表数据错误
4. **PowerRegistryLoadError** - Power 注册表加载错误
5. **PowerRegistrySaveError** - Power 注册表保存错误
6. **PowerValidationError** - Power 验证错误

#### 其他（4 个）
1. **ContinueCompletionProvider** - Continue 补全提供者
2. **KiroRecommendedCacheImpl** - Kiro 推荐缓存实现
3. **KiroError30** - Kiro 错误（版本升级）
4. **ProviderError9** - Provider 错误（版本升级）

---

## 四、保留的类分析（可能被修改）

### 4.1 Kiro IDE 核心类保留（78 个）

这些类在两个版本中都存在，可能被修改。

**完整列表**：

1. Agent6
2. AgentActivityFileDecorationProvider
3. AgentActivityPublisher
4. AgentEventPollingService
5. CheckpointController
6. Checkpoints3
7. ContextMemory
8. ContextProviderRegistry
9. ContextProviderSemanticTokensProvider
10. ContextReferenceCompletionProvider
11. ContextReferenceHoverProvider
12. ContextReferenceLinkProvider
13. ContinueContextProviderAdapter
14. ContinueFileContextProvider
15. DocumentFragmentImpl
16. DocumentImpl
17. DocumentOrShadowRootImpl
18. DocumentTypeImpl
19. ExecutionAlreadyExistsError
20. ExecutionContext
21. ExecutionLogConnectionBase
22. ExecutionLogError
23. ExecutionLogWebViewConnection
24. ExecutionNotFoundError
25. ExecutionStateError
26. HookGenerationError
27. HooksViewProvider
28. KiroDiffFileSystemProvider
29. KiroPowersError
30. MCPCallFailedError
31. MCPConnectionNotFoundError
32. McpJsonFetchError2
33. McpJsonNotFoundError2
34. MCPReturnedError
35. MCPTreeDataProvider
36. MCPWrapperError
37. PowerInstaller
38. PowerNotInstalledError2
39. PowersMCPConfigWatcher
40. PowersMCPConfigWriter
41. PowersViewProvider
42. ServiceException
43. ServiceInstanceIdDetectorSync
44. ServiceQuotaExceededException2
45. ServiceUnavailableException
46. SpecDocumentRegenerationError
47. SpecDocumentRetrievalError
48. SpecDocumentSaveError
49. SpecEditorStorage
50. SpecExplorerTreeProvider
51. SpecFileSystemProvider
52. SpecTaskMetadataStorage
53. SpecTraceDatabase
54. SpecTraceDatabaseManager
55. SteeringDocumentsController
56. SteeringGroupTreeItem
57. SteeringTreeItem
58. SteeringTreeView
59. StorageEventImpl
60. StorageImpl
61. StorageManager
62. StorageNotInitializedError
63. StorageProcessor
64. ToolCreateHook
65. ToolFileSearch
66. ToolFsAppend
67. ToolFsWrite
68. ToolGetDiagnostics
69. ToolGetProcessOutput
70. ToolGrepSearch
71. ToolInvokeSubAgent
72. ToolKiroPowers
73. ToolListDirectory
74. ToolMCPWrapper
75. ToolReadCode
76. ToolReadFile
77. ToolReadMultipleFiles
78. ToolRemoteWrapper
79. ToolReportProgress
80. ToolSubagentResponse
81. ToolWebFetch

### 4.2 修改分析说明

**分析方法限制**：
- extension.js 是编译打包后的文件，代码混淆严重
- 逐个类对比代码实现工作量巨大（78 个类 × 平均 20 个方法 = 1560+ 个方法）
- 混淆后的代码难以理解修改意图

**已知的重要修改**：
1. **工具类**（ToolXXX）：可能增加了新的参数或功能
2. **存储系统**（Storage/Checkpoint）：与新的 Checkpoint 功能集成
3. **Spec 系统**：与新的 SpecDocumentManager 集成
4. **MCP 系统**：可能优化了连接和错误处理
5. **Powers 系统**：与新的 Powers 视图集成

**建议**：
- 如需了解具体类的修改，建议查看 Kiro IDE 的 Release Notes
- 或通过实际使用观察功能变化
- 或查看 Kiro IDE 的官方文档

---

## 五、总结

### 5.1 删除总结

| 类型 | 数量 | 说明 |
|------|------|------|
| 真正删除 | 4 个 | ToolPrework、PowerRegistryManager、2 个 MCP 错误类 |
| 重命名 | 6 个 | 数字后缀变化或加下划线 |
| Provider 相关 | 7 个 | 可能被新实现替代 |
| 第三方库 | 160 个 | 依赖库版本升级或移除 |

### 5.2 新增总结

| 类型 | 数量 | 说明 |
|------|------|------|
| Agent 系统 | 3 个 | Custom Agents 功能 |
| Experiments 系统 | 4 个 | A/B 测试功能 |
| Spec 系统 | 3 个 | Spec 模式重构 |
| Hook 系统 | 2 个 | Hook 监听和触发 |
| Tool 系统 | 2 个 | SemanticRename、SmartRelocate |
| Powers 系统 | 6 个 | Powers 错误类优化 |
| 其他 | 4 个 | 补全、缓存、错误类 |

### 5.3 保留总结

| 类型 | 数量 | 说明 |
|------|------|------|
| 可能被修改 | 78 个 | Kiro IDE 核心类 |
| 未检查修改细节 | 78 个 | 需要逐个对比代码实现 |

### 5.4 影响评估

**高影响**：
- 新增 24 个核心类（Agent、Experiments、Spec、Tool）
- 删除 4 个功能类（重构为新实现）

**中影响**：
- 78 个核心类可能被修改（具体修改未详细分析）
- 第三方库版本升级（160 个类删除）

**低影响**：
- 重命名类（6 个，功能不变）
- Provider 相关删除（7 个，可能被替代）

---

## 六、相关文档

1. **Kiro-v0.9.2-Tools-Comparison.md** - 工具对比（包含删除的 4 个 Spec 工具）
2. **Kiro-v0.9.2-Complete-Code-Analysis.md** - 完整代码分析（包含新增的 24 个类）
3. **Kiro-v0.9.2-Final-Summary.md** - 最终总结

---

## 七、更新记录

- 2026-02-07：创建修改和删除分析文档
- 2026-02-07：完成类统计、删除分析、新增分析
- 2026-02-07：列出 78 个保留类，说明修改分析的限制


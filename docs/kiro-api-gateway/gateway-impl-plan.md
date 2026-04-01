# Kiro API 网关实现规划

> 本文档是研发视角下的“规划 -> 设计 -> 实现回填”演进记录。
> 前半部分描述当前落地状态与设计结论，后半部分保留首版计划草案，便于追踪方案是如何收敛到当前实现的。

## 实现架构图

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               Kiro API Gateway (Tauri)                                 │
│                                                                                        │
│  前端 (React)                                                                          │
│    GatewayPanel.jsx                                                                    │
│    invoke('start_gateway', { port, host, accessToken, region })                        │
│             │                                                                         │
│             ▼                                                                         │
│  命令层 (src-tauri/src/commands)                                                       │
│    gateway_cmd.rs                                                                      │
│    start_gateway(config)                                                               │
│      AppState.gateway = Some(GatewayHandle)                                            │
│             │                                                                         │
│             ▼                                                                         │
│  gateway.rs (axum)                                                                    │
│    mod.rs / router.rs                                                                 │
│    Router::new()                                                                      │
│      POST /v1/messages         → handle_anthropic                                      │
│      POST /v1/responses       → handle_openai_responses                                │
│      GET  /v1/models           → 固定列表                                              │
│      GET  /health              → 200 OK                                                │
│    tokio::spawn(axum::serve)                                                          │
│             │                                                                         │
│             ▼  用户发起请求: POST /v1/messages                                         │
│  converter.rs                                                                          │
│    AnthropicRequest → conversationState                                               │
│    messages / tool_use / tool_result / system 拼接                                    │
│             │                                                                         │
│             ▼                                                                         │
│  上游请求 (CodeWhisperer)                                                              │
│    single/group 账号刷新链 → Bearer <token>                                            │
│    generateAssistantResponse (chunked stream)                                         │
│             │                                                                         │
│             ├────────────────────────────────────────────────────────────────────────► │
│             │                                                                          │
│             │                                                                          │
│             │                                                                          │
│             │                                                                          │
│             │                                                                          │
│             │                                       ┌────────────────────────────────┐ │
│             │                                       │ Kiro 后端 (AWS CodeWhisperer)  │ │
│             │                                       │ q.{region}.amazonaws.com        │ │
│             │                                       └────────────────────────────────┘ │
│             │                                                                          │
│             │  ◄──────────────────────────────────────────────────────────────────────┤
│             │          chunked stream / errors                                         │
│             ▼                                                                         │
│  stream.rs                                                                             │
│    CW 事件流 → Anthropic SSE                                                           │
│    assistantResponseEvent → content_block_delta                                        │
│    toolUseEvent → tool_use + input_json_delta                                          │
│             │                                                                         │
│             ▼                                                                         │
│  响应返回客户端 (text/event-stream)                                                    │
│                                                                                        │
│  停止流程                                                                              │
│    invoke('stop_gateway') → CancellationToken::cancel() → JoinHandle abort             │
│    AppState.gateway = None                                                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 技术选型

- HTTP 框架：`axum 0.8`（与现有 tokio 无缝集成）
- token 来源：复用现有账号体系，通过 `refresh_token_by_provider()` 刷新 `single/group` 账号后获得上游 `access_token`
- 上游端点：`https://q.{region}.amazonaws.com/generateAssistantResponse`
- 流式传输：Anthropic SSE (`text/event-stream`) ← CodeWhisperer chunked stream
- 参考实现：`kkddytd/claude-api`（用于 OpenAI/Anthropic 兼容端点与 SSE 事件映射对照）
- 方向说明：入站是 Anthropic/OpenAI 请求归一化为 Kiro conversationState；出站是 Kiro / CodeWhisperer 响应事件再投影为 Anthropic/OpenAI 响应。像 `citationEvent` 这样的字段属于后者。

## 当前落地快照（2026-04-01）

### 已完成
- `src-tauri/src/gateway/mod.rs` 已存在，网关运行时、配置读写、自动启动、基础路由和本地 API Key 校验已接通。
- `src-tauri/src/gateway/proxy.rs` 已接入真实上游 `application/vnd.amazon.eventstream`，并向 Anthropic / OpenAI Responses 输出增量流。
- `src-tauri/src/gateway/converter.rs` / `stream.rs` / `thinking_parser.rs` 已完成请求归一化、事件解析、thinking 与工具调用主链路；内部已收敛为统一请求模型，不再把 Responses 语义表述成 chat-first。
- `GatewayConfig` 已扩展 `accountMode/accountId/groupId/strategy/threshold/localOnly`，并已接入账号存储与刷新链路。
- `GatewayConfig` 已补齐 `allowedIps`、`logLevel`，后端已执行 IP/CIDR 白名单校验，前端已支持编辑、保存与查看状态。
- 当前后端配置校验会始终要求客户端 API Key；`localOnly` 与 `allowedIps` 仅负责额外的网络访问限制。
- 已支持 `POST /mcp` 透传，并可打开应用日志目录；日志级别配置会在下次应用启动时生效。
- 已支持基础图片输入：Anthropic `image` base64 块，以及 `image_url`/Responses `input_image` 的 data URL / 远程 HTTP(S) 图片 URL，会被提取到 Kiro `images` 字段；远程抓取当前已限制私网/本机地址、有限重定向与单张图片大小。
- `GET /v1/models` 当前仍返回网关内置静态模型列表，尚未接入真实上游 `ListAvailableModels`。
- `src-tauri/src/commands/gateway_cmd.rs` 已提供 `start/stop/status/config` 命令并注册到 `main.rs`。
- `src/components/features/GatewayPage.jsx` 已可配置 host/port/region/API Key、账号来源模式、策略、阈值、本机限制、白名单、日志级别，并支持启动、停止、重启、保存、复制客户端配置、打开日志目录；OpenAI 配置文案已明确 `/v1/responses` 为主。
- `routes.jsx` 与侧边导航已添加网关入口。

### 已完成：`web_search`
- **`web_search` 特殊工具已补齐**：当前已支持 Anthropic 版本化 `web_search_*` 映射为 Kiro `web_search` MCP 工具，并由网关执行 `/mcp tools/call` 后把结果回灌给上游对话链路。公开文档已能证明 `web_search_20250305` / `web_search_20260209` 这类命名存在，但当前实现证明的是“按 `web_search_*` 模式兼容”，不是“Kiro 上游已经被抓到真实发出每个版本号”。
- **`tools/list -> web_search` 的运行时工具定义已坐实**：本机 `q-client.log` 已抓到 `InvokeMCPCommand` 的真实 `tools/list` 响应，确认远端工具名就是 `web_search`，输入 schema 只有 `query: string`，并明确限制“200 字符以内”；工具描述里还写死了返回结果字段至少包含 `title / url / snippet / publishedDate / isPublicDomain / id / domain`。
- **`tools/call` 的发包结构已被本地安装包源码坐实**：Kiro 安装包中的 `acp-remote-mcp-client-*.js` 明确显示远端 MCP 调用发送的是 `jsonrpc: "2.0" + method: "tools/call" + profileArn + params: { name, arguments }`；这与当前网关对 `/mcp tools/call` 的模拟方向一致。
- **`web_search` 的运行时执行样本已补齐**：`2026-03-22 15:14:59` 这轮日志里，`q-client.log` 已抓到真实 `InvokeMCPCommand`，其 `id` 为 `web_search_tooluse_HBDsi00WRBobYdARUrKeqd_1774163698353_756aa2ec`、`method` 为 `tools/call`、HTTP 200 成功；同轮 `Kiro Logs.log` 还能看到 `[Remote tool web_search] Calling tool`、`Fetched URLs` 与后续 `WebFetch` 命中 `docs.anthropic.com/en/docs/about-claude/models/all-models`、`anthropic.com/news/claude-opus-4-5`、`anthropic.com/claude/opus` 的抓取完成记录。这说明“本机运行时确实执行过 `tools/call(web_search)`”已从缺口变成实证。
- **`web_search` 的回包解析方式已被本地安装包源码坐实**：Kiro 安装包中的 `disclose-context-*.js` 明确把 `web_search` 结果解析为“从 `content[]` 中找 `type === "text"` 的项，再 `JSON.parse(text)`，然后读取 `results` 数组”；当前网关 `parse_web_search_mcp_result()` 采用的就是这一路径，不是臆造。
- **citation 取证入口已收敛**：若要继续验证 Kiro 原始 `citationEvent`，优先看本地 Kiro 源码里的 `Q Chat API -> debug.log / execution-log.json` 调试导出链，而不是普通 `q-client.log`。另外 GitHub 上游当前能直接搜到 `codeReferenceEvent.references` 与 `supplementaryWebLinksEvent.supplementaryWebLinks` 的业务消费代码，但这只能作为上游参考线索，不代表当前安装版 Kiro 已坐实消费；对当前安装版的结论仍应以本地安装包静态链和本机日志样本为准。`codeReferenceEvent.references -> code-references` 属于代码引用/license trace，不等于 citation。
- **本地安装包主循环的消费边界已进一步坐实**：`q-developer-converse` 的聊天主循环当前明确消费的是 `assistantResponseEvent / reasoningContentEvent / toolUseEvent / meteringEvent / codeReferenceEvent / contextUsageEvent`；同级没有看到 `citationEvent / supplementaryWebLinksEvent / followupPromptEvent / toolResultEvent` 的业务处理分支。聊天 webview 的 `session-view/main.js` 里这轮也未搜到 `citation` / `supplementaryWebLinks` 相关命中，因此现阶段不能把它们表述成“本地 IDE 已确认渲染”。
- **Execution Log 落盘链已打透**：`StorageManager` 会把 `workspaceId`、`folderKey`、`key` 都算成 `sha256(...).substring(0, 32)`；因此 `%APPDATA%\\Kiro\\User\\globalStorage\\kiro.kiroagent\\<workspaceHash>\\` 下的 32 位 hash 目录和文件名，都是源码规则生成的稳定路径。当前已坐实：
  - `KIRO::EXECUTION::SAVES` -> `414d1636299d2b9e4ce7e17fb11f63e9`
  - `KIRO::EXECUTION::METADATA` -> `f62de366d0006e17ea00a01f6624aabf`
- **Execution save 里的 `actionType: search` 不是远端 `web_search`**：当前机器真实样本里，这类动作的输入形态是 `{ why, query }`，对应本地代理搜索上下文/代码的审计记录，不能把它误当成 `tools/call(web_search)` 已抓到。
- **`web_search` 的取证结论需要更新**：截至 `2026-03-22 15:14:59` 这轮样本，本机已经抓到真实的 `tools/call(web_search)` 请求/响应与后续抓取链路；现在已可同时坐实“协议定义 + 客户端发包代码 + 客户端结果解析代码 + 本机运行时执行样本”。剩余缺口不再是 `web_search` 是否真实执行，而是 `citationEvent` 等搜索后续事件是否在当前样本中继续落盘。
- **`citationEvent` 的下一步取证方法已经固定**：先查安装包 `extension.js` 的协议定义、反序列化和 `debug.log / execution-log.json` 写盘代码，再查 `*Q Chat API.log` 是否已有真实样本，最后回到工作区 `.kiro/debug/` 搜 `debug.log` / `execution-log.json`。如果 `Q Chat API.log` 仍无命中，只能说明“当前样本未覆盖”，不能反推协议不存在。
- **文档表述需要按当前安装版 Kiro 收紧**：
  - `codeReferenceEvent` 已有明确消费链，不能再和 protocol-only 家族混写。
  - raw `toolResultEvent` 直接消费仍未坐实，但归一化后的 `tool_result / toolUseResponse` 消费链已坐实。
  - `citationEvent / supplementaryWebLinksEvent / followupPromptEvent` 目前只能写成“协议存在，当前消费链未证实”，不要直接写成“IDE 已确认渲染”。
- **聊天 webview 的当前边界也已坐实**：
  - `onSessionUpdate` 是透传，不是隐藏改名桥。
  - `inlineMessages` 来自 persisted unified messages 按 `executionId` 分组。
  - GUI 主链当前消费的是归一化后的 `assistant / tool_call / tool_result / steering_inclusion / sub_agent_*`，不是 raw `citation/followup/supplementary` 事件名。

### 已新增逆向结论：模型列表、模型缓存与会话体
- **`ListAvailableModels` 的消费字段已坐实**：Kiro 本地会把上游响应转换为 `models/defaultModel` 两层；每个模型至少依赖 `modelId`、`modelName`、`description`、`rateMultiplier`、`rateUnit`、`tokenLimits.maxInputTokens`。这意味着网关若自行维护模型列表，不能只保留 `id/name`。
- **模型缓存存在，但只是内存缓存**：`setAvailableModels()` 仅更新进程内 `availableModels`，随后触发 `kiro.updateModelsList` 刷新 webview；不存在复杂持久化模型缓存。
- **`InvalidModelError` 的恢复动作已坐实**：Kiro 会重新拉取可用模型、覆盖缓存，并把当前模型重置为 `defaultModel.id`。这对网关的“模型失效自动回退”策略很有参考价值。
- **`modelSelection` 存的是真实 `modelId`**：VS Code 配置与 session config 里保存/同步的都是 raw `modelId`；`qdev::modelId` 只是 Kiro 内部 runtime 的 provider 化标识，不能把它误当成外部 API 值。
- **`modelSelection -> active session` 的同步链已坐实**：`registerConfigSync()` 监听 `kiroAgent.modelSelection` 后会调用 `pushModelToSession()`，最终发送 `setSessionConfigOption({ configId: "model", value: modelId })`；active session 内部拿到的仍是 raw `modelId`。
- **`conversationState` 的真实重点已坐实**：不是简单 `messages[]`，而是 `conversationId + agentContinuationId + agentTaskType + currentMessage + history + chatTriggerType`；最后一条 user 消息还会承载 `userInputMessageContext.tools`。
- **对话接口的运行时真样本也已补齐**：`2026-03-22 15:13:13.181` 与 `15:13:16.211` 的 `q-client.log` 已抓到真实 `GenerateAssistantResponseCommand`，同一 `conversationId=4752bae7-249f-40c8-9087-e7681f99b1bb` 在 `5-Q Chat API.log` 里还能对上完整 `conversationState` 请求与最终回答落盘；这说明当前文档对上游对话接口的表述，已经不再只是安装包源码推断，而有本机运行时样本支撑。
- **模型下拉是 `configOptions` select，不只是 models API**：Kiro 新建 session、加载 session、会话内改模型时，都会向 webview 推送 `configOptions`；其中 model 项会消费 `defaultModel.id`、`description`、`rateMultiplier`、`rateUnit`。协议 schema 虽然定义了独立的 `models.availableModels/currentModelId`，但当前本地实现更依赖本地 `availableModels` 缓存与 `configOptions`。
- **请求头需要按端点分开模拟**：`generateAssistantResponse` 才有 `x-amzn-kiro-agent-mode`，且仅在内容采集关闭时才带 `x-amzn-codewhisperer-optout`；`ListAvailableModels` 与 `/mcp` 当前坐实的是 `authorization + x-amz-user-agent`，外加 `external_idp` 场景的 `TokenType: EXTERNAL_IDP`，不应把三类请求强行揉成一套 header 模板。
- **`/mcp` 的 `profileArn` 承载位已补证**：Kiro 本地 `InvokeMCPCommand` / `InvokeMCPStreamCommand` 不是把 `profileArn` 放进 JSON body，而是通过请求头 `x-amzn-kiro-profile-arn` 发送；网关若要继续逼近本地行为，MCP 上游请求应补这个 header。
- **流式事件协议层比当前业务消费层更宽**：`ChatResponseStream` 除了常见的 `assistantResponseEvent / reasoningContentEvent / toolUseEvent / codeReferenceEvent / meteringEvent` 外，还定义了 `toolResultEvent / metadataEvent / supplementaryWebLinksEvent / followupPromptEvent / contextUsageEvent / citationEvent / invalidStateEvent`；目前本地主对话链主循环 `extension.js:377716-377834` 已直接坐实的业务分支只有 `assistantResponseEvent / reasoningContentEvent / toolUseEvent / meteringEvent / codeReferenceEvent / contextUsageEvent`，其余事件仍需区分“协议存在”与“业务已消费”。
- **`InvokeMCPStream` 已找到真实业务使用**：规格分析链 `requirements-analyzer` 会通过 `/mcp/stream -> tools/call(spec_disambiguation)` 获取增量结果，逐条消费 `response.stream.message`。
- **`SendMessageStreaming` / `exportResultArchive` 目前仍主要停在协议层证据**：当前打包版 Kiro 源码已确认它们的 serializer / deserializer、事件流结构与路径，但尚未在业务层搜到明确的直接调用点；这一轮全文件搜索也没有发现新的 `new ...SendMessageCommand(...)` 或 `new ...ExportResultArchiveCommand(...)` 构造点，现阶段不应把它们表述成“当前主链真实在用”。
- **region 选择链已收敛**：Kiro 本地 runtime 不是机械使用单一配置值，而是按“显式 region > `profileArn.region` > 默认 region”选区；本项目当前对托管账号场景已统一为“最终 `profileArn.region` > 账号 region > 网关默认 region”，并已应用到对话链与 `/mcp` 代执行链。需要单独说明的是：当前网关对外的 `GET /v1/models` 仍返回静态模型列表，尚未把真实 `ListAvailableModels` 接进来，因此这里不能再写成“模型列表链也已完全收敛”。

### 当前优先级建议
1. 若要继续对齐 Kiro IDE 能力，当前主链路缺口已从基础 `web_search` 接入收敛到更高精度的 citations 还原、模型失效回退策略，以及更多搜索结果字段透传。
2. 若需要更强图片兼容，再补鉴权下载、尺寸限制、失败回退与更多输入格式。
3. 增加真实监听端口的运行时集成测试，覆盖 `/health`、`/v1/responses`、`/mcp` 等实际入口。

## `web_search` 专项规划

### 需求
- Anthropic `web_search_*` 需要作为特殊工具接入，而不是退化成普通 function tool。
- 公开版本号会变化，因此实现应匹配 `web_search_*`；当前至少以公开文档可见的 `20250305` 与 `20260209` 作为兼容样例，而不是把它们表述成已从 Kiro 上游抓到的实证版本。
- 调用结果需要能回到 Anthropic 历史消息里，允许 `server_tool_use` 与 `web_search_tool_result` 继续参与后续轮次。

### 方案选择
- 不选“仅转工具定义，不代执行”：那样外部客户端还要自己接 Anthropic server tool，语义不对。
- 采用“网关代执行”方案：首轮 Kiro 请求拿到 `web_search` tool call 后，网关自己走 `/mcp tools/call`，再把搜索结果回灌给第二轮 Kiro 请求。
- 域名约束不强依赖 Kiro 私有实现：若 Kiro 返回结构化 `results[].url`，由网关做结果侧过滤，避免把 Anthropic 配置语义直接丢掉。

### 实现拆解
1. `converter.rs`
   - 识别 `web_search_*`
   - 统一输入 schema 为 `{ query }`
   - 兼容历史里的 `server_tool_use` / `web_search_tool_result`
2. `proxy.rs`
   - 识别请求是否含 server-side `web_search`
   - 首轮请求 -> 截获 `web_search`
   - `/mcp tools/call`
   - tool result 回灌 -> 第二轮请求
3. 输出侧
   - Anthropic 非流式输出补 `server_tool_use` / `web_search_tool_result`
   - 流式场景先保证完成态 SSE 可用，再逐步增强 citations 细节

### 当前状态
- 主链路已落地。
- 回归测试已覆盖版本化归一化、MCP 结果解析、Anthropic server-tool 输出块组装。
- 与 Kiro 本体安装包源码对照后，当前实现对 `tools/call` 请求结构和 `web_search` 回包解析路径都已对齐。
- `web_search` 本身已补齐运行时执行实证；剩余缺口主要收敛为 `citationEvent` 等搜索后续事件是否在当前样本中继续落盘，而不是功能可用性或 `web_search` 是否真实执行。
- `execution save` 里的 `actionType: search` 仍不能当成远端 MCP `web_search` 调用证据；它只是本地搜索动作审计记录，这条边界继续成立。
- 当前文档也需要同步版本边界：
  - `docs/kiro-api-gateway` 早期部分分析基于上一个 IDE 版本。
  - 继续维护时，应优先按当前安装版 Kiro 的静态链结论回填，而不是沿用旧版“协议存在 = 已消费”的写法。

## 阶段验收清单（按当前代码回填）

### 阶段一：Rust 后端

- [x] 已有独立网关模块 `src-tauri/src/gateway/mod.rs`
- [x] 已有配置模型 `GatewayConfig` 与状态模型 `GatewayStatus`
- [x] 已有配置读写与自动启动
- [x] 已有基础路由与本地 API Key 校验
- [x] 已有 `start/stop/status/config` 命令
- [x] 已实现真实上游 chunked stream 到 Anthropic/OpenAI/Responses SSE 的事件级桥接
- [x] 已实现 `tool_use` / `tool_result` / `reasoning` 的主链路转换
- [x] 已实现细粒度错误码映射与统一脱敏
- [x] 已实现账号池选择、刷新失败回退与阈值优先策略
- [x] 已实现客户端 API Key + `localOnly` + IP/CIDR 白名单访问控制
- [x] 已实现 `POST /mcp` JSON-RPC 透传
- [x] 已实现基础图片输入提取并写入 Kiro `images`
- [x] 已实现 `web_search_*` 特殊工具语义映射与网关代执行

### 阶段二：前端

- [x] 已有网关页面与侧边栏入口
- [x] 已有 host/port/region/API Key 配置
- [x] 已有保存、启动、停止、刷新、复制客户端配置
- [x] 已展示运行状态、监听地址、请求计数、最近错误
- [x] 已实现重启、风险提示、账号来源模式与账号策略配置表单
- [x] 已实现启用开关、白名单编辑、日志级别与打开日志目录

### 阶段三：配置持久化

- [x] 已写入 app data 下 `gateway-config.json`
- [x] 已支持读取配置并自动启动
- [x] 已补齐 `accountMode`、`accountId`、`groupId`、`strategy`、`threshold`、`localOnly`

### 当前建议的最小闭环

1. 当前最小闭环已经达成：真实流式、主协议转换、账号策略、前端配置、构建验证均已完成。
2. 当前剩余能力缺口集中在搜索结果细节兼容增强，而不是主链路可用性。
3. 图片输入与 `/mcp` 已接通，后续是增强兼容性而不是补主链路。

### 参考项目取舍

这些参考项目不是一类东西，吸收顺序也不一样，当前实现按下面三块收敛：

1. 请求转换优先看 `hank9999/kiro.rs`
   - 价值在于最小请求转换，而不是完整网关外壳。
   - 重点对齐 `Anthropic messages -> generateAssistantResponse.conversationState` 的压缩方式。
   - 这里主要用于校准请求体形状、模型名回退和最基础的非流式响应。
2. 事件流与工具调用优先看 `jwadow/kiro-gateway` 与 `cniu6/kiro-gateway`
   - 这组参考最关键的是流解析，不是页面或按钮。
   - 重点是把上游事件流里的 `name`、`input`、`stop` 三段重组为完整 `tool_use`，并按顺序补齐 `tool_result`。
   - 同时要吸收它们对 JSON 截断、重复 tool call、括号格式回退等脏数据兜底。
3. 表层协议、客户端 API Key 与 SSE 状态机优先看 `kkddytd/claude-api`
   - 它不是用来学习 Kiro 上游请求体，而是用来学习网关入口协议。
   - 重点是客户端侧 `sk-` 风格 API Key、本地网关入口鉴权、Anthropic/OpenAI 双协议兼容，以及 SSE 事件状态机与重复事件保护。
   - 本项目也应保持双层凭证模型：客户端访问网关使用 API Key，网关转发 Kiro 上游使用本地 access token，两者不要混用。

次优先级参考：

- `petehsu/KiroProxy`、`dext7r/KiroGate` 更偏产品增强，适合后续再吸收多账号轮询、会话粘性、刷新防抖、IDC、图片输入、`web_search`、MCP 扩展等能力。
- `aiclientproxy/proxycast` 的补证价值在于说明 SSE 里 `messageMetadata` 与 `assistantResponseEvent` 可能同帧出现，这对流解析边界很有帮助。
- `justlovemaki/AIClient-2-API` 更偏客户端模拟与 OpenAI 出口，参考价值有，但不作为当前骨架来源。

---

## 历史计划草案（归档）

> 本节保留最初的阶段拆解，用于呈现需求规划与设计落地的原始思路。
> 这里的“新增 / 新建 / 暂不实现”均指首版计划时态，不代表当前代码状态；当前是否已落地以上文“当前落地快照”和“阶段验收清单”为准。

### 阶段一：Rust 后端原始计划

#### 1. Cargo.toml 新增依赖
- `axum = "0.8"`
- `tokio-stream`
- `futures-util`（流处理）

#### 2. 计划新增 `src-tauri/src/gateway/mod.rs`

核心模块，包含：
- `GatewayConfig`：首版草案只写了 `{ enabled, host, port, access_token, region }`；当前实现已扩展为 `accountMode/accountId/groupId/strategy/threshold/localOnly/allowedIps/logLevel` 等字段
- `GatewayHandle`：持有 axum server 的 abort handle
- `start_gateway(config, app_state)` → 启动 axum server，绑定端口，返回 handle
- `stop_gateway(handle)`

#### 3. 计划新增 `src-tauri/src/gateway/router.rs`

axum 路由：
- `POST /v1/messages` → Anthropic Messages API 入口
- `POST /v1/responses` → OpenAI Responses 主入口
- `GET /v1/models` → 返回固定模型列表
- `GET /health` → 健康检查

请求鉴权：当前实现固定要求 `access_token` / 客户端 API Key，支持 `Authorization: Bearer <token>` 与 `x-api-key`。

#### 4. 计划新增 `src-tauri/src/gateway/converter.rs`

统一请求模型 → CodeWhisperer conversationState 转换：
- Anthropic `POST /v1/messages` 先归一化为统一请求模型。
- OpenAI `POST /v1/responses` 作为主入口归一化为统一请求模型。
- OpenAI 仅保留 `POST /v1/responses` 归一化为统一模型。
- `messages` 最后一条 role=user → `currentMessage.userInputMessage`
- 其余 messages → `history[]`
- assistant messages → `assistantResponseMessage { content }`
- `tool_use` blocks → `toolUseEvent` 结构
- `tool_result` → `userInputMessageContext.toolResults[]`
- `tools[]` → `userInputMessageContext.tools[]`
- `system` → 拼入 `userInputMessage.content` 开头
- `max_tokens` / `temperature` → 忽略（CodeWhisperer 不支持）

#### 5. 计划新增 `src-tauri/src/gateway/stream.rs`

CodeWhisperer 事件流 → Anthropic SSE 转换：
- `assistantResponseEvent.content` → `content_block_delta` (text_delta)
- `toolUseEvent` → `content_block_start` (tool_use) + `content_block_delta` (input_json_delta)
- `reasoningContentEvent.text` → `content_block_delta` (thinking_delta)
- `messageMetadataEvent.conversationId` → 记录，可选写入响应 header
- 流结束 → `message_delta` (stop_reason=end_turn) + `message_stop`
- 错误映射：`AccessDeniedException` → 403，`ThrottlingException` → 429，`InvalidStateEvent` → 400

非流式模式：聚合全部 content 块，返回单个 Anthropic response JSON。

#### 6. AppState 扩展（`state.rs`）

加入 `pub gateway: Mutex<Option<GatewayHandle>>`。

#### 7. 新增 Tauri commands（`commands/gateway_cmd.rs`）

- `start_gateway(config: GatewayConfig)`
- `stop_gateway()`
- `get_gateway_status()` → `{ running, port, request_count, last_error }`
- `get_gateway_config()` / `save_gateway_config(config)`

#### 8. 认证注入

```
客户端请求 -> 网关
  Authorization: Bearer <api_key>（当前必填，也可改用 x-api-key）

网关 -> Kiro API
  single/group 账号池 + refresh_token_by_provider()
    → access_token -> Authorization: Bearer <token>
    → profile_arn（若刷新结果或账号资料中存在）
    → region 优先取最终 profile_arn 中的 ARN region
    → 无 ARN region 时退回账号 region
    → 再退回默认 us-east-1
```

---

### 阶段二：前端原始计划

#### 9. 计划新增 `src/components/features/GatewayPage.jsx`

风格与 Settings 页一致，使用 Mantine 组件 + `colors` token，布局/间距/排版全部用 Tailwind v4 utility class，不写额外 CSS，不做 i18n，直接中文。

布局分左右两栏：

**左栏（配置区）**
- 端口输入框（默认 8765）
- API Key 输入框（当前实现已改为必填，用于校验客户端请求，建议 `sk-` 格式）
- region 下拉（默认 us-east-1）
- 启动/停止按钮（运行中时红色停止，停止时绿色启动，异步操作期间 disabled + spinner）

**右栏（状态区）**
- 状态指示灯（绿点=运行中 / 红点=已停止）+ 端口 + 请求计数
- 最近 5 条错误日志列表（`font-mono text-xs`）
- 一键复制区块：展示 `ANTHROPIC_BASE_URL` 和 `ANTHROPIC_API_KEY` 两行配置，点击按钮写剪贴板

页面顶部一行说明：「本地代理仅转发至 Kiro API，不经过任何第三方服务器。」

#### 10. 注册路由与导航

- `routes.jsx` 添加 `/gateway`
- 侧边栏添加入口

---

### 阶段三：配置持久化原始计划

#### 11. 配置读写

- 存储路径：app data 目录下 `gateway-config.json`
- 应用启动时读取，`enabled: true` 则自动启动

---

### 原计划暂缓项


- `cachePoint` / `clientCacheConfig`
- citation 增量事件已按 SDK 结构输出：Responses 侧发 `response.output_text.annotation.added`，Anthropic 侧发 `citations_delta`；后续若继续增强，重点应转向更完整的 SSE item lifecycle 对齐，而不是继续缺省 citation。
- 更丰富的 `web_search` 结果字段映射（除 `results[].url/title/...` 之外的扩展字段）

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
│      POST /v1/chat/completions → handle_openai_compat                                  │
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
│    get_kiro_local_token() → Bearer <token>                                             │
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
- token 来源：复用 `get_kiro_local_token()` 读取 `~/.aws/sso/cache/kiro-auth-token.json`
- 上游端点：`https://q.us-east-1.amazonaws.com/generateAssistantResponse`
- 流式传输：Anthropic SSE (`text/event-stream`) ← CodeWhisperer chunked stream
- 参考实现：`kkddytd/claude-api`（用于 OpenAI/Anthropic 兼容端点与 SSE 事件映射对照）

## 当前落地快照（2026-03-20）

### 已完成
- `src-tauri/src/gateway/mod.rs` 已存在，网关运行时、配置读写、自动启动、基础路由和本地 API Key 校验已接通。
- `src-tauri/src/gateway/proxy.rs` 已接入真实上游 `application/vnd.amazon.eventstream`，并向 Anthropic / OpenAI 输出增量流；其中 OpenAI 兼容以 Responses SSE/JSON 为主，`chat.completions` 为兼容输出。
- `src-tauri/src/gateway/converter.rs` / `stream.rs` / `thinking_parser.rs` 已完成请求归一化、事件解析、thinking 与工具调用主链路；内部已收敛为统一请求模型，不再把 Responses 语义表述成 chat-first。
- `GatewayConfig` 已扩展 `accountMode/accountId/groupId/tagId/strategy/threshold/localOnly`，并已接入账号存储与刷新链路。
- `GatewayConfig` 已补齐 `allowedIps`、`logLevel`，后端已执行 IP/CIDR 白名单校验，前端已支持编辑、保存与查看状态。
- 已支持 `POST /mcp` 透传，并可打开应用日志目录；日志级别配置会在下次应用启动时生效。
- 已支持基础图片输入：Anthropic `image` base64 块与 `image_url`/Responses `input_image` 的 data URL 会被提取到 Kiro `images` 字段。
- `src-tauri/src/commands/gateway_cmd.rs` 已提供 `start/stop/status/config` 命令并注册到 `main.rs`。
- `src/components/features/GatewayPage.jsx` 已可配置 host/port/region/API Key、账号来源模式、策略、阈值、本机限制、白名单、日志级别，并支持启动、停止、重启、保存、复制客户端配置、打开日志目录；OpenAI 配置文案已明确 `/v1/responses` 为主。
- `routes.jsx` 与侧边导航已添加网关入口。

### 已完成：`web_search`
- **`web_search` 特殊工具已补齐**：当前已支持 Anthropic 版本化 `web_search_*`（包括公开文档中的 `web_search_20250305` / `web_search_20260209`）映射为 Kiro `web_search` MCP 工具，并由网关执行 `/mcp tools/call` 后把结果回灌给上游对话链路。

### 当前优先级建议
1. 若要继续对齐 Kiro IDE 能力，当前主链路缺口已从 `web_search` 收敛到结果展示细节增强，例如更完整的 citations 还原与更多搜索结果字段透传。
2. 若需要更强图片兼容，再补远程 URL 拉取与更多输入格式。
3. 持续清理 `gateway/models.rs` 的未使用结构，收敛编译警告。

## `web_search` 专项规划

### 需求
- Anthropic `web_search_*` 需要作为特殊工具接入，而不是退化成普通 function tool。
- 公开版本号会变化，因此实现应匹配 `web_search_*`，至少覆盖当前公开文档可见的 `20250305` 与 `20260209`。
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
- 后续增强点只剩结果细节兼容，不再是“能不能用”的问题。

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
- [x] 已实现 `localOnly` + IP/CIDR 白名单双层访问控制
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
- [x] 已补齐 `accountMode`、`accountId`、`groupId`、`tagId`、`strategy`、`threshold`、`localOnly`

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
- `GatewayConfig`：`{ enabled, host, port, access_token: Option<String>, region }`
- `GatewayHandle`：持有 axum server 的 abort handle
- `start_gateway(config, app_state)` → 启动 axum server，绑定端口，返回 handle
- `stop_gateway(handle)`

#### 3. 计划新增 `src-tauri/src/gateway/router.rs`

axum 路由：
- `POST /v1/messages` → Anthropic Messages API 兼容入口
- `POST /v1/responses` → OpenAI Responses 主入口
- `POST /v1/chat/completions` → OpenAI 兼容入口
- `GET /v1/models` → 返回固定模型列表
- `GET /health` → 健康检查

请求鉴权：若配置了 `access_token`，校验 `Authorization: Bearer <token>`。

#### 4. 计划新增 `src-tauri/src/gateway/converter.rs`

统一请求模型 → CodeWhisperer conversationState 转换：
- Anthropic `POST /v1/messages` 先归一化为统一请求模型。
- OpenAI `POST /v1/responses` 作为主入口归一化为统一请求模型。
- OpenAI `POST /v1/chat/completions` 作为兼容入口归一化为同一模型。
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
  Authorization: Bearer <api_key>（可选，本地网关校验）

网关 -> Kiro API
  get_kiro_local_token()
    → access_token -> Authorization: Bearer <token>
    → profile_arn（social）或从 ProfileStorage 获取
    → region（IdC）或默认 us-east-1
```

---

### 阶段二：前端原始计划

#### 9. 计划新增 `src/components/features/GatewayPage.jsx`

风格与 Settings 页一致，使用 Mantine 组件 + `colors` token，布局/间距/排版全部用 Tailwind v4 utility class，不写额外 CSS，不做 i18n，直接中文。

布局分左右两栏：

**左栏（配置区）**
- 端口输入框（默认 8765）
- API Key 输入框（可选，用于校验客户端请求，建议 `sk-` 格式；留空则不鉴权）
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
- 完整 citations 细粒度还原
- 更丰富的 `web_search` 结果字段映射（除 `results[].url/title/...` 之外的扩展字段）

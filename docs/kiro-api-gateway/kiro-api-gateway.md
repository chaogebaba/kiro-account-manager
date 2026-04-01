# Kiro API 网关集成清单

本文档是 `kiro-account-manager` 内 Kiro API 网关的研发总文档，按“需求规划 -> 设计依据 -> 实现回填”组织。
它的目标不是用户操作手册，而是给开发者、维护者和后续审阅者提供完整的方案演进链路。

## 架构流程图

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
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 目标与范围
- 提供 Claude/Anthropic API 兼容的本地代理能力，将请求转换为 Kiro API 调用。
- 当前仅提供 OpenAI Responses 入口，这只是网关对外协议壳；上游对话接口始终是 Kiro / CodeWhisperer。
- 方向必须区分为两段：入站是 Anthropic/OpenAI 请求归一化为 Kiro 请求，出站是 Kiro 响应再投影为 Anthropic/OpenAI 响应。
- 支持在应用内配置、启动、停止代理服务。
- 提供必要的安全与合规提示，避免误用与数据泄露。

## 文档定位
- 本文档服务于研发视角下的需求、设计、实现和验证闭环。
- 若要判断“当前代码已经做到什么”，优先看“当前实现状态”“需求对照表（代码现状）”“测试与验证”。
- 若要理解“为什么这样设计”，继续看后续的 Kiro IDE 证据、参考实现对照、协议映射与 `web_search` 章节。
- 若要追踪原始设计意图与首版计划，请结合 [gateway-impl-plan.md](./gateway-impl-plan.md) 一起阅读。

## 当前实现状态（2026-04-01）

> 说明：本节描述 `kiro-account-manager` 当前代码里已经落地的网关能力。下文其他章节包含目标态、需求项、逆向证据与参考方案，不能默认视为“已实现”。

### 已落地
- 已新增网关页面，并接入 `routes.jsx` 与侧边栏入口。
- 已新增 Tauri 命令：`start_gateway`、`stop_gateway`、`get_gateway_status`、`get_gateway_config`、`save_gateway_config`。
- 已支持本地配置持久化到 app data 下的 `gateway-config.json`，并在应用启动时按 `enabled` 自动拉起。
- 已提供基础端点：`GET /health`、`GET /v1/models`、`POST /v1/messages`、`POST /v1/responses`、`POST /v1/messages/count_tokens`、`POST /mcp`；OpenAI 仅保留 `/v1/responses`。
- 已支持真实上游 `application/vnd.amazon.eventstream` 请求，并将 Kiro chunked stream 增量转换为 Anthropic / OpenAI / Responses SSE。
- 已完成 `system`、`tools`、`tool_use`、`tool_result`、`reasoningContent` 的主链路转换，并补充了 Responses `input` -> 统一请求模型归一化。
- 已支持客户端 API Key 形式的入口鉴权，以及 `localOnly` + `allowedIps` 的访问限制。
- 已接入现有账号体系：`single/group`、`accountId/groupId`、`strategy`、`threshold`。
- 已支持基础图片输入：Anthropic `image` base64 块，以及 `image_url`/Responses `input_image` 的 data URL 与远程 HTTP(S) 图片 URL，会被提取到 Kiro `images` 字段。
- 已加入错误映射与脱敏，`401/403/429/5xx` 会按兼容格式返回，错误文本会裁剪敏感字段。
- 已提供状态展示、请求计数、客户端配置复制、重启按钮、风险提示、日志级别、打开日志目录和最近错误展示。

### 已确认边界
- **`web_search` 特殊工具已接入**：当前已支持 Anthropic 版本化 `web_search_*` 归一化为 Kiro `web_search` 工具，并由网关代执行 `/mcp tools/call` 后回灌为服务端搜索结果。公开文档已能确认 `web_search_20250305` / `web_search_20260209` 这类版本化命名真实存在；但截至目前，我们掌握的是“网关按 `web_search_*` 模式兼容”，不是“Kiro 上游已被实证会发出上述每个版本号”。
- **Responses / Anthropic citations 已按 SDK 结构输出**：OpenAI Responses 输出已补 `web_search_call`，非流式 `output_text.annotations` 与流式 `response.output_text.annotation.added` 都支持 Kiro 原始 `citationEvent` 的映射；其中仍保留 `target` / `citationText` / `citationLink`，且仅当上游 `target.range` 明确存在时才补 `start_index/end_index`，不会再把 `citationText` 硬塞到 `url_citation.title`。Anthropic 侧则按官方 `TextCitation` / `citations_delta` 结构输出：非流式 `content[].citations` 和流式 `content_block_delta.delta.citation` 现在都会把 Kiro 原始 citation 映射成 `char_location`。若上游只给 `target.location`，Anthropic 侧会用 `citationText` 长度补 `end_char_index`；Responses 侧仍不额外猜 `start_index/end_index`。运行时若要继续取证 citation 原始事件，优先看 Kiro 源码中的 `Q Chat API -> debug.log / execution-log.json` 导出链路，不要把普通 `q-client.log` 当成 citation 主样本。
- **图片输入已支持远程 HTTP(S) URL**：当前会按响应 `Content-Type` 或 URL 扩展名识别 `png/jpeg/gif/webp`；更复杂的鉴权下载、重定向策略与尺寸限制仍未增强。
- **客户端 API Key 当前是必填项**：当前配置校验会无条件要求 `accessToken` / 客户端 API Key 非空；`localOnly` 与 `allowedIps` 只是额外的网络访问限制，不再承担“留空即可关闭入口鉴权”的语义。
- **远程图片输入已加基础安全边界**：仅允许 `http/https`，会拒绝 `localhost`、loopback、私网/链路本地/文档保留地址，并限制有限次重定向与单张图片大小；更复杂的鉴权下载策略仍未增强。
- **`GET /v1/models` 当前仍是静态列表**：对外模型列表目前来自网关内置 `get_available_models()`，尚未对接真实上游 `ListAvailableModels`；因此 region/profileArn 选区收敛目前只覆盖对话链与 `/mcp` 代执行链。

### 阅读方式
- 若要判断“现在能不能用”，以本节“已落地 / 已确认边界”为准。
- 若要继续开发，以本文档后续需求项和 `gateway-impl-plan.md` 的阶段拆解为准。

## 需求对照表（代码现状）

| 需求项 | 当前状态 | 代码位置 / 说明 |
|---|---|---|
| 网关菜单入口 | 已完成 | `src/routes.jsx` 已注册 `gateway` 页面；`src/components/features/GatewayPage.jsx` 已存在 |
| 启动/停止/状态/配置命令 | 已完成 | `src-tauri/src/commands/gateway_cmd.rs`、`src-tauri/src/main.rs` |
| 配置持久化与自动启动 | 已完成 | `src-tauri/src/gateway/mod.rs` 中 `load_gateway_config` / `save_gateway_config` / `auto_start_if_enabled` |
| 基础端点 `/health` `/v1/models` `/v1/messages` `/v1/responses` `/mcp` | 已完成 | `src-tauri/src/gateway/mod.rs` 路由已注册；OpenAI 仅保留 `/v1/responses` |
| Claude/OpenAI 基础客户端配置复制 | 已完成 | `src/components/features/GatewayPage.jsx` 已生成并复制 `ANTHROPIC_*` / `OPENAI_*` 配置，并提示 OpenAI 主用 `/v1/responses` |
| 请求计数、最近错误展示 | 已完成 | `request_count` / `last_error` 已落地，前端已展示 |
| 真实 Kiro 上游流式桥接 | 已完成 | `src-tauri/src/gateway/proxy.rs` 已消费上游 event-stream 并逐事件输出 SSE |
| `system`、`tools`、`tool_use`、`tool_result`、`reasoningContent` 适配 | 已完成主链路 | `src-tauri/src/gateway/converter.rs` 与 `src-tauri/src/gateway/stream.rs` 已覆盖主协议转换 |
| 上游错误码与异常格式映射 | 已完成主链路 | `src-tauri/src/gateway/proxy.rs` 已按 `authentication/rate_limit/api_error` 输出 |
| 错误脱敏 | 已完成主链路 | `src-tauri/src/gateway/proxy.rs` 已裁剪 Bearer/token/API Key |
| 账号来源模式 `single/group` | 已完成 | `GatewayConfig` + `proxy.rs` 已接入 `single/group` |
| 账号池策略 `groupId/strategy/threshold` | 已完成 | `GatewayConfig` 与 `GatewayPage.jsx` 已暴露并生效 |
| 白名单/仅本机强约束 | 已完成 | 已支持 `localOnly` 强制仅本机，以及 `allowedIps` 的 IP/CIDR 白名单 |
| 图片输入 | 已完成增强版 | 已支持 Anthropic `image` base64 块，以及 data URL / 远程 HTTP(S) 形式的 `image_url` / `input_image` |
| `/mcp` 透传 | 已完成 | `src-tauri/src/gateway/proxy.rs` 已直连上游 `https://q.{region}.amazonaws.com/mcp` |
| 前端启用开关、日志级别、重启、打开日志目录、风险提示 | 已完成 | `GatewayPage.jsx` 已补齐开关、日志级别、打开日志目录、风险提示 |
| `web_search` 特殊工具 | 已完成 | 已支持 `web_search_*` 版本化匹配，映射为 Kiro `web_search` MCP 工具并由网关代执行 |

## 代码锚点（当前实现）

- 前端入口：`src/components/features/GatewayPage.jsx`
- 路由注册：`src/routes.jsx`
- 命令层：`src-tauri/src/commands/gateway_cmd.rs`
- 运行时与路由：`src-tauri/src/gateway/mod.rs`
- 协议代理：`src-tauri/src/gateway/proxy.rs`
- 请求转换：`src-tauri/src/gateway/converter.rs`
- 事件解析：`src-tauri/src/gateway/stream.rs`
- 自动启动注册：`src-tauri/src/main.rs`

## 架构层级关系

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
└────────────────────────────────────────────────────────────────────────────────────────┘
```

## 功能需求
- 提供“`Kiro API 网关`”菜单入口。
- 允许配置监听地址与端口。
- 支持配置 Kiro 账号来源与鉴权方式（现有账号体系）。
- 支持可选的访问控制（如访问令牌、白名单、仅本机）。
- 展示运行状态、最近错误、请求统计（可选）。
- 提供一键复制的客户端配置示例（如 Claude Code 环境变量/配置片段）。

## 前端（React + Mantine）
- 新增页面并注册到 `routes.jsx` 与侧边栏导航。
- 设置页或专用页面：
- 表单项：监听地址、端口、访问令牌、启用开关、日志级别。
- 状态区：运行中/已停止、端口占用提示、最近错误。
- 操作按钮：启动、停止、重启、打开日志目录（如有）。
- 主题：暗色模式下的对比度与 hover/selected 状态校验。

## 后端（Tauri Rust）
- 新增命令：
- 启动/停止代理服务。
- 读取/写入代理配置。
- 查询运行状态。
- 运行时：
- 选择 HTTP 服务框架（例如 `axum`/`warp`/`hyper`）。
- 定义 Claude/Anthropic 兼容接口路径与请求/响应适配。
- 使用已有 Kiro 登录态或 Token 缓存。
- 对外仅监听 `127.0.0.1` 默认值。

## 配置与持久化
- 在 `state.rs` 中保存代理配置与运行状态。
- 配置文件写入应用数据目录（`~/.kiro-account-manager/`）。
- 启动时读取配置并初始化 UI 状态。

## 安全与合规
- 默认仅本机访问，避免公网暴露。
- 明确提示用户不要分享访问令牌与日志。
- 代理日志需脱敏（Token、账号标识）。
- 在 UI 中展示免责声明与使用风险。

## 兼容性与客户端示例
- Claude/Anthropic 客户端：
- `base_url` 指向本地代理。
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` 应填写网关自己的客户端 API Key，不是 Kiro 上游 `access_token`。
- 当前入口鉴权支持 `Authorization: Bearer <gateway-api-key>` 与 `x-api-key`。
- OpenAI 侧当前主入口是 `POST /v1/responses`，不要再按 `chat/completions` 兼容层理解。
- 代理将 `model`、`messages`、`stream` 等字段转换到 Kiro API。
- 处理错误码与异常格式的映射。

## `web_search` 需求补充
- 需求目标：让 Anthropic Messages API 中的版本化 `web_search_*` 特殊工具在本地网关里可直接使用，而不是报“不支持特殊工具”。
- 兼容范围：至少兼容当前公开文档可见的 `web_search_20250305` 与 `web_search_20260209`，实现上按 `web_search_*` 版本化匹配，不再写死单个版本号。
- 语义要求：对 Anthropic 侧保持 server tool 语义，外部历史消息应允许出现 `server_tool_use` 与 `web_search_tool_result`，不能粗暴降级成普通 function tool。
- 约束透传：保留 `max_uses`、`allowed_domains`、`blocked_domains`、`user_location` 的配置语义；其中域名过滤当前由网关在结果侧执行，`user_location` 暂保留结构但不额外扩展 Kiro 私有能力。
- 安全边界：`web_search` 仍受现有网关鉴权、`localOnly` 与 IP 白名单限制；网关日志继续走脱敏链路。

## 上游接口路径（参考实现）
- `hank9999/kiro.rs` 中对话上游接口：`https://q.{region}.amazonaws.com/generateAssistantResponse`。
- `hank9999/kiro.rs` 中 MCP 上游接口：`https://q.{region}.amazonaws.com/mcp`。
- `{region}` 不是简单固定配置值；Kiro 本地 runtime 会先解析最终可用的 region，再拼到 `q.{region}.amazonaws.com`。

## Kiro IDE 源码证据（extension.js）
> 路径：`C:\Users\12925\AppData\Local\Programs\Kiro\resources\app\extensions\kiro.kiro-agent\dist\extension.js`

### 上游接口与端点
- `generateAssistantResponse` 走 `POST /generateAssistantResponse`。
- MCP 走 `POST /mcp`。
- 其他可见接口：
  - `POST /SendMessageStreaming`
  - `POST /exportResultArchive`
- 端点配置包含：
  - `https://q.us-east-1.amazonaws.com`
  - `https://q.eu-central-1.amazonaws.com`
  - 以及 Gov/ISO 等分区的 `q-fips`/`q.us-iso-*` 端点。

### 上游接口请求体与响应头（extension.js 真实序列化）
#### `/generateAssistantResponse`
- Request headers：
  - `content-type: application/json`
  - `accept: application/vnd.amazon.eventstream`
  - `authorization: Bearer <accessToken>`
  - `x-amz-user-agent`（来自 AWS SDK user-agent middleware；源值来自 `customUserAgent: KiroIDE <kiroVersion> <machineId>`）
  - `x-amzn-kiro-agent-mode: <agentMode>`（由 `addAgentModeHeadersMiddleware` 注入）
  - `x-amzn-codewhisperer-optout: true`（仅在内容采集关闭时，由 `addPrivacyHeadersMiddleware` 注入）
  - `TokenType: EXTERNAL_IDP`（仅 `authMethod == "external_idp"` 时，由 `addExternalIdpTokenTypeMiddleware` 注入）
- Request body：
  - `conversationState`
  - `profileArn`
- Response headers：
  - `x-amzn-codewhisperer-conversation-id`（会被映射到返回对象的 `conversationId`）
- Response stream：
  - `generateAssistantResponseResponse`（`ChatResponseStream`）

#### `/ListAvailableModels`
- Request method / query：
  - `GET /ListAvailableModels`
  - query 至少包含 `origin=AI_EDITOR`
  - 分页时追加 `nextToken`
  - 已登录 profile 场景追加 `profileArn`
- Request headers：
  - `authorization: Bearer <accessToken>`
  - `x-amz-user-agent`（同样来自 runtime client 的 `customUserAgent`）
  - `TokenType: EXTERNAL_IDP`（仅 `authMethod == "external_idp"`）
- 当前源码证据下，**没有**看到 `ListAvailableModels` 调用链显式追加：
  - `x-amzn-kiro-agent-mode`
  - `x-amzn-codewhisperer-optout`

#### `/SendMessageStreaming`
- Request body：
  - `conversationState`
  - `dryRun`
  - `profileArn`
  - `source`
- Response stream：
  - `sendMessageResponse`（`ChatResponseStream`）
- 当前本地 Kiro 打包源码里，已经能确认协议 serializer / deserializer 存在，但**暂未在业务层搜到明确的直接调用方**；现阶段更像是 SDK 暴露能力，而不是当前主 agent 对话链的核心入口。
- 更具体地说，这一轮对打包版 `extension.js` 的全文件搜索里：
  - 能稳定命中的只有 serializer / deserializer / SDK export：`extension.js:332171-332267`、`extension.js:333132-333199`
  - 但没有搜到新的 `new ...SendMessageCommand(...)` 业务构造点
  - 因此目前只能确认“协议与 SDK 能力存在”，不能确认“当前 Kiro 主链真实在用”

#### `/mcp`
- Request body（JSON-RPC 透传）：
  - `id`
  - `jsonrpc`
  - `method`
  - `params`
- Request headers（当前已坐实的公共部分）：
  - `authorization: Bearer <accessToken>`
  - `content-type: application/json`
  - `accept: application/json`
  - `x-amz-user-agent`（来自 streaming client 的 `customUserAgent`）
  - `x-amzn-kiro-profile-arn: <profileArn>`（`InvokeMCPCommand` / `InvokeMCPStreamCommand` 的协议 serializer 直接放到 header，不在 body）
  - `TokenType: EXTERNAL_IDP`（仅 `authMethod == "external_idp"`）
- 当前源码证据下，远程工具调用链 `InvokeMCPCommand` / `InvokeMCPStreamCommand` **没有直接坐实**会像 `generateAssistantResponse` 一样追加：
  - `x-amzn-kiro-agent-mode`
  - `x-amzn-codewhisperer-optout`
- `MCPMethod` 枚举：
  - `initialize`
  - `notifications/initialized`
  - `tools/call`
  - `tools/list`
- `InvokeMCPStreamCommand` 已找到真实业务调用方：
  - `requirements-analyzer` 会通过 `tools/call` 调 `spec_disambiguation`
  - 返回 `response.stream`，逐条消费 `message` 事件
- 这说明 `/mcp/stream` 不是纯协议壳，Kiro 本地至少在规格分析链里真实使用它。

#### `/exportResultArchive`
- Request body：
  - `exportContext`
  - `exportId`
  - `exportIntent`
  - `profileArn`
- `ExportIntent` 枚举：
  - `TASK_ASSIST`
  - `TRANSFORMATION`
  - `UNIT_TESTS`
- `ExportContext` 联合：
  - `transformationExportContext`
  - `unitTestGenerationExportContext`
- `ResultArchiveStream` 事件：
  - `binaryMetadataEvent`
  - `binaryPayloadEvent`
  - `internalServerException`
- 当前本地 Kiro 打包源码里，已经能确认协议 serializer / deserializer 与事件流形状，但**暂未在业务层搜到明确的直接调用方**。
- 更具体地说，这一轮全文件搜索只命中了：
  - serializer / deserializer：`extension.js:332086-332199`
  - SDK command 导出：`extension.js:333001-333024`
  - 枚举 / schema 定义：`extension.js:331913-331931`
- 但没有搜到新的 `new ...ExportResultArchiveCommand(...)` 业务构造点，所以它当前仍应归类为“协议层已坐实，业务层调用待继续取证”。
- `TransformationDownloadArtifactType` 枚举：
  - `ClientInstructions`
  - `GeneratedCode`
  - `Logs`
- Response stream：
  - `ResultArchiveStream`（`binaryMetadataEvent` / `binaryPayloadEvent` / `internalServerException`）
  - `binaryPayloadEvent.bytes` 为 base64

### 真实调用链
- 读取配置：`kiroAgent.configuration.getCodeWhispererConfig` 提供 `region` 与 `endpoint`。
- 构建 `CodeWhispererStreaming` / `CodeWhispererRuntimeClient` 客户端（AWS SDK）。
- 两类 client 的公共基线：
  - 都会带 `authorization: Bearer <token>`。
  - 都会带 `x-amz-user-agent`；其源值来自 `customUserAgent: KiroIDE <kiroVersion> <machineId>`。
  - 本机当前安装包 `C:\Users\12925\AppData\Local\Programs\Kiro\resources\app\product.json` 显示版本为 `0.11.34`，因此这一轮逆向时对应源字符串可视为 `KiroIDE 0.11.34 <machineId>`。
- 注入中间件：
  - `addExternalIdpTokenTypeMiddleware`：runtime client 和 streaming client 基线都会按需追加 `TokenType: EXTERNAL_IDP`。
  - `addPrivacyHeadersMiddleware`：不是全局基线，只在特定聊天调用方显式加到 streaming client 上。
  - `addAgentModeHeadersMiddleware`：同样不是全局基线，只在特定聊天调用方显式加到 streaming client 上。
- 调用 `generateAssistantResponse({ conversationState, profileArn })`。
- 读取流式事件中的 `assistantResponseEvent.content` 与 `assistantResponseEvent.modelId`，拼装最终输出，并处理 `codeReferenceEvent`。

### region / profileArn 选择链（Kiro 本地实证）
- `getCodeWhispererConfig(region)` 的 region 选择优先级是：
  - 显式传入的 region
  - `authProvider.getProfileArn()` 解析出的 ARN region
  - 默认 region
- `authProvider.getProfileArn()` 的优先级是：
  - 当前 token 内的 `profileArn`
  - `ProfileStorage` / 固定 profile 配置里的 ARN
- 这意味着 social 账号场景下，真正决定上游落区的往往是“当前 token 里的 `profileArn.region`”，不是本地静态配置。
- 网关当前实现已按同一思路收敛：
  - 对话链与 `/mcp` 代执行链都会先看最终 `profileArn`
  - 若 ARN 里能解析出受支持的 region，则优先使用
  - 否则退回账号 region，再退回网关默认 region
- 当前仍要区分一个尚未收敛的点：
  - 网关对外的 `GET /v1/models` 目前仍返回本地静态模型列表
  - 还没有把真实上游 `ListAvailableModels` 接进当前网关实现
- 这样可以避免：
  - token / profileArn 已刷新到 A 区
  - 但请求仍错误发往 B 区
  - 最终触发 `Invalid model`、401/403，或让对话链与 `/mcp` 代执行链落区不一致

### 流式事件处理（Kiro IDE 行为，按当前安装版 Kiro 复核）
- `assistantResponseEvent`：
  - 内容按块拼接（`stream: false` 时拼成完整文本）。
  - 每块内容会进行 HTML 实体反转义。
- `reasoningContentEvent`：
  - `text` / `signature` 被写入 `additional_kwargs`（如 `reasoningContent`、`reasoningSignature`）。
- `toolUseEvent`：
  - 转为 `tool_call_chunk`（`id=toolUseId`，`args=input`，`name` 可选）。
  - `stop` 字段会标记工具调用结束。
- `codeReferenceEvent`：
  - 已能坐实消费链：抽取 `references` 并调用 `kiroAgent.recordReferences`。
  - 该消费不只主对话链存在，也已在 helper branch 与 autocomplete 路径复现。
- `meteringEvent`：
  - 仅在 usage 开关开启时处理，用于统计。
- `contextUsageEvent`：
  - 当前主对话消费链会把 `contextUsagePercentage` 写入 `additional_kwargs.contextUsagePercentage`。
- 当前打包版 Kiro 主对话循环里，能直接看到的业务分支只有：
  - `assistantResponseEvent`
  - `reasoningContentEvent`
  - `toolUseEvent`
  - `meteringEvent`
  - `codeReferenceEvent`
  - `contextUsageEvent`
- 对应主循环位置：
  - `extension.js:377716-377834`
- 协议层还定义了更多 `ChatResponseStream` 事件：
  - `toolResultEvent`
  - `metadataEvent`
  - `supplementaryWebLinksEvent`
  - `followupPromptEvent`
  - `citationEvent`
  - `invalidStateEvent`
- 但到目前为止，Kiro 主对话业务链里直接坐实消费到的，除了 `assistantResponseEvent / reasoningContentEvent / toolUseEvent / codeReferenceEvent / meteringEvent` 外，新增只明确看到 `contextUsageEvent`；其余事件已在协议反序列化层存在，但业务层现成消费链证据仍不完整。
- 结合当前搜索结果，更准确的说法是：
  - raw `toolResultEvent / metadataEvent / supplementaryWebLinksEvent / followupPromptEvent / citationEvent / invalidStateEvent` 目前已确认存在于协议层
  - 但在当前打包版 Kiro 的主 agent 对话消费链里，尚未找到与 `assistantResponseEvent` / `toolUseEvent` 同等级的直接处理代码
  - 其中 `toolResultEvent` 需要单独区分：
    - raw stream event 直接消费仍未坐实
    - 但归一化后的 `tool_result` / `toolUseResponse` 消费链已坐实
  - `citationEvent / supplementaryWebLinksEvent / followupPromptEvent` 当前更适合被标注为“协议已定义，当前消费链未证实”，不要直接写成“IDE 已确认渲染”

### 客户端配置与鉴权
- `getCodeWhispererClientConfig()`：
  - 读取 `region` / `endpoint`（来自 `kiroAgent.configuration.getCodeWhispererConfig`）。
  - 读取 token：`authProvider.getToken()`。
  - 设置 `customUserAgent: "KiroIDE <version> <machineId>"`。
  - `maxAttempts: 1`，HTTP keep-alive 启用。
- `authProvider.getProfileArn()`：
  - 若 token 包含 `profileArn`，直接使用。
  - 否则从 `ProfileStorage` 读取 `profile.arn`。
- `getCodeWhispererConfig(region)`：
  - 显式传入 region 时直接使用该 region。
  - 否则会尝试从最终 `profileArn` 解析 region。
  - 若 ARN region 不可用，才回退默认 region。

#### Auth Token 结构（Kiro IDE）
- Social token：
  - `accessToken`
  - `refreshToken`
  - `profileArn`
  - `expiresAt`（ISO）
  - `authMethod: "social"`
  - `provider`
- IdC token：
  - `accessToken`
  - `refreshToken`
  - `expiresAt`（ISO）
  - `clientIdHash`
  - `authMethod: "IdC"`
  - `provider`
  - `region`

#### IdC 授权范围（scope）
- `completions`
- `analysis`
- `conversations`
- `transformations`
- `taskassist`
- 实际 scope 前缀来自配置 `codewhisperer.config.scopePrefix`（默认 `codewhisperer`）。

### conversationState 结构（完整）
- `conversationId`
- `chatTriggerType`（枚举：`MANUAL` / `INLINE_CHAT` / `DIAGNOSTIC`）
- `currentMessage`（`ChatMessage`）
- `history`（`ChatMessage[]`）
- `agentContinuationId`
- `agentTaskType`（枚举：`spectask` / `vibe`）
- `customizationArn`
- `workspaceId`

### `convertToGenerateAssistantMessages()` 组装结论（本地 Kiro 实证）
- `conversationState` 不是简单的 `messages[]` 透传，而是显式拆成：
  - `conversationId`
  - `agentContinuationId`
  - `agentTaskType`
  - `currentMessage`
  - `history`
  - `chatTriggerType: "MANUAL"`
- user 消息会映射为 `userInputMessage`：
  - `content` 只拼接文本块
  - `modelId`
  - `origin: "AI_EDITOR"`
  - `images`
  - `documents`
  - `userInputMessageContext`
- assistant 消息会映射为 `assistantResponseMessage`：
  - `content`
  - `toolUses`
  - `reasoningContent`
- 最后一条 user 消息会额外写入 `userInputMessageContext.tools`，历史里的 tool 结果会写入 `userInputMessageContext.toolResults`。
- `conversationId` 优先复用历史 `additional_kwargs.conversationId`，否则本地生成 `crypto.randomUUID()`。
- 实证位置：
  - `convertToGenerateAssistantMessages()`：`extension.js:377875-377941`
  - `se_ConversationState()`：`extension.js:332711-332721`
  - `se_UserInputMessage()`：`extension.js:332828-332839`
  - `se_UserInputMessageContext()`：`extension.js:332841-332853`
  - `se_AssistantResponseMessage()`：`extension.js:332687-332697`

### `ListAvailableModels` 响应结构（本地 Kiro 实证）
- Kiro 本地命令 `kiro.agentModels.getAvailableModels` 会循环调用上游 `ListAvailableModels`，直到 `nextToken` 为空。
- 原始上游返回，Kiro 至少实际消费这些字段：
  - `nextToken`
  - `models[]`
  - `defaultModel`
- 每个模型对象至少依赖：
  - `modelId`
  - `modelName`
  - `description`
  - `rateMultiplier`
  - `rateUnit`
  - `tokenLimits.maxInputTokens`
- 本地转换后的前端结构是：
  - `models: [{ id, name, description, rateMultiplier, rateUnit, maxInputTokens }]`
  - `defaultModel: { id, name, description, rateMultiplier, rateUnit, maxInputTokens }`
- 这说明如果网关要伪造或缓存模型列表，最少要满足上面这一层语义，不能只回 `id/name`。
- `ListAvailableModels` 的落区也不能只看静态配置；若账号当前 `profileArn` 已切到别的 region，模型列表请求也必须跟着走，否则会出现“模型列表来自一套 region、对话请求落到另一套 region”的偏差。
- 实证位置：
  - `transformOutput3()`：`extension.js:932280-932303`
  - `kiro.agentModels.getAvailableModels`：`extension.js:932307-932330`

### 模型缓存与选中模型链路（本地 Kiro 实证）
- Kiro 本地确实有模型缓存，但只是内存缓存，不是持久化缓存。
- 缓存初始值：
  - `availableModels = { models: [], defaultModel: { id: "", name: "" } }`
- 刷新链路：
  1. `initializeAvailableModelsCache()` 调 `kiro.agentModels.getAvailableModels`
  2. `setAvailableModels(availableModels)`
  3. 触发 `kiro.updateModelsList`
  4. `agentController.updateModel(M2())`
- `InvalidModelError` 时也会走这条链，并把选中模型重置成 `models.defaultModel.id`。
- 实证位置：
  - `model-cache.ts`：`extension.js:970353-970362`
  - 初始化缓存：`extension.js:990256-990268`
  - `InvalidModelError` 恢复：`extension.js:971094-971099`
  - webview 更新入口：`extension.js:824227-824229`

### `modelSelection` 与 `qdev::modelId` 的关系（本地 Kiro 实证）
- VS Code 配置 `kiroAgent.modelSelection` 存的是真实 `modelId`，不是 `qdev::modelId`。
- Kiro 同步到 session 时，发送的是：
  - `configId: "model"`
  - `value: modelId`
- 配置变更监听也直接围绕 raw `modelId` 展开：
  - `registerConfigSync()` 监听 `kiroAgent.modelSelection`，命中后调用 `pushModelToSession()`
  - `pushModelToSession()` 会执行 `setSessionConfigOption({ configId: "model", value: modelId })`
- 这说明 active session 内部拿到的也是原始 `modelId`，不是 `qdev::modelId`。
- `qdev::modelId` 只是本地内部的 provider 化标识，用于：
  - `getModelIdentifier()`
  - `getModelConfiguration()`
  - runtime 内部的模型客户端分派
- 这意味着本项目若要兼容 Kiro IDE 行为：
  - 前端保存当前模型值时，应以 raw `modelId` 为主
  - 若内部需要 provider 化标识，可以在运行时临时拼接，不要把它当作持久化值或外部 API 值
- 实证位置：
  - `getIdeModelId()` / `pushModelToSession()` / `registerConfigSync()`：`extension.js:946573-946614`
  - `setSessionConfigOption(model)`：`extension.js:952871-952873`
  - `getSelectedModelIdFromSettings()`：`extension.js:973099-973101`
  - `getModelIdentifier()` / `getModelConfiguration()`：`extension.js:973112-973137`
  - `formatModelIdentifier()`：`extension.js:973145-973146`

### 会话配置面板里的模型下拉（本地 Kiro 实证）
- Kiro 会把模型选项构造成一个 `configOptions` 里的 `select` 项，而不是只靠某个独立的 models API 响应对象。
- 模型配置项形状：
  - `type: "select"`
  - `id: "model"`
  - `name: "Model"`
  - `category: "model"`
  - `currentValue: 当前 modelId，若为空则回退 defaultModel.id，再回退 models[0].id`
  - `options: [{ value, name, description, _meta.kiro.rateMultiplier, _meta.kiro.rateUnit }]`
- 这说明 UI 下拉本身还会消费：
  - `defaultModel.id`
  - `rateMultiplier`
  - `rateUnit`
  - `description`
- Kiro 在新建 session、加载 session、会话中途修改配置时，都会重新返回 `configOptions` 给 webview。
- 实证位置：
  - 模型 select 构造：`extension.js:402821-402843`
  - `newSession()` 返回 `configOptions`：`extension.js:403274-403308`
  - `setSessionConfigOption()` 返回 `configOptions`：`extension.js:403416-403433`
  - `pushConfigOptions()` 推给 active session webview：`extension.js:939725-939730`

### `models` schema 与实际实现的区别（本地 Kiro 实证）
- ACP / session 协议 schema 里确实定义了：
  - `models.availableModels: zModelInfo[]`
  - `models.currentModelId: zModelId`
- 但本地 Kiro 当前实际返回新建/加载/恢复 session 时，更明确走的是：
  - `configOptions`
  - `modes`
- 也就是说，`models` 这个独立承载位在协议层存在，但当前本地实现里，模型选择 UI 更依赖本地 `availableModels` 缓存和 `configOptions` select 项，而不是单独依赖 session 响应里的 `models` 字段。
- 实证位置：
  - `zSessionModelState`：`extension.js:140085-140113`
  - `zSetSessionConfigOptionResponse.configOptions`：`extension.js:140158-140160`
  - `newSession()` 实际返回：`extension.js:403301-403308`
  - `loadSession()` / `setSessionConfigOption()` 实际返回：`extension.js:403396-403433`

### ContextTruncationScheme（枚举）
- `ANALYSIS`
- `GUMBY`

### ChatMessage 结构
- `userInputMessage` 或 `assistantResponseMessage` 二选一。

### UserInputMessage 结构
- `content`
- `origin`（常见：`AI_EDITOR`）
- `modelId`
- `userIntent`
- `images`（`ImageBlock[]`）
- `cachePoint`
- `clientCacheConfig`
- `userInputMessageContext`

### ImageBlock / ImageSource
- `ImageBlock.format`（`gif` / `jpeg` / `png` / `webp`）
- `ImageBlock.source.bytes`（base64）

### UserInputMessageContext 结构
- `tools`（`Tool[]`）
- `toolResults`（`ToolResult[]`）
- `editorState`
- `consoleState`
- `envState`
- `gitState`
- `shellState`
- `diagnostic`
- `additionalContext`
- `appStudioContext`
- `userSettings`

#### EditorState
- `document`（`TextDocument`）
- `cursorState`（`position` / `range`）
- `relevantDocuments`（`RelevantTextDocument[]`）
- `workspaceFolders`

#### TextDocument / RelevantTextDocument
- `relativeFilePath`
- `text`

#### CursorState（联合）
- `position`
- `range`
- 字段细节在 bundle 内未展开，疑似沿用 LSP `Position/Range` 结构（`line` / `character` / `start` / `end`）。
- 证据：ACP 客户端里存在 `endCursorPosition: { line, character }`，并使用 `{ start: { line, character }, end: { line, character } }` 作为 `range`。
- 推断：`line` / `character` 为 0-based（由 `split("\\n").length - 1` 写法可见）。

#### ConsoleState
- `consoleUrl`
- `taskName`

#### EnvState / EnvironmentVariable
- `currentWorkingDirectory`
- `environmentVariables`（`{ key, value }[]`）

#### GitState
- `status`

#### ShellState / ShellHistoryEntry
- `shellHistory`（`{ command, directory, stdout, stderr }[]`）

#### Diagnostic（联合）
- `textDocumentDiagnostic` 或 `runtimeDiagnostic`

#### TextDocumentDiagnostic
- `document`
- `source`
- `message`
- `code`
- `codeDescription`（`{ href }`）
- `relatedInformation`（`{ location, message }[]`）
- `data`

#### DiagnosticLocation / DiagnosticRelatedInformation
- `location.uri`
- `message`

#### CodeDescription
- `href`

#### RuntimeDiagnostic
- `source`
- `message`

#### DiagnosticSeverity（枚举）
- `ERROR`
- `HINT`
- `INFORMATION`
- `WARNING`

#### DiagnosticTag（枚举）
- `DEPRECATED`
- `UNNECESSARY`

#### SymbolType（枚举）
- `DECLARATION`
- `USAGE`

#### AppStudioState
- `namespace`
- `propertyName`
- `propertyValue`
- `propertyContext`

#### Origin（枚举，常见）
`AI_EDITOR` / `CHATBOT` / `CLI` / `CONSOLE` / `DOCUMENTATION` / `GITLAB` / `IDE` / `INLINE_CHAT` / `KIRO_CLI` / `MARKETING` / `MD` / `MD_CE` / `MD_IDE` / `MOBILE` / `OPENSEARCH_DASHBOARD` / `Q_DEV_BEXT` / `SAGE_MAKER` / `SERVICE_INTERNAL` / `SM_AI_STUDIO_IDE` / `UNIFIED_SEARCH` / `UNKNOWN`

#### ContentType（枚举）
- `CODE`
- `FILE`
- `PROMPT`
- `WORKSPACE`

### Tool 结构
- `toolSpecification`
  - `name`
  - `description`
  - `inputSchema`（`{ json: <schema> }`）
- `cachePoint`（可选）

### ToolUse / ToolResult
- `ToolUse`：`{ toolUseId, name, input }`
- `ToolResult`：
  - `toolUseId`
  - `status`
  - `content`（`ToolResultContentBlock[]`）
- `ToolResultContentBlock`：
  - `text` 或 `json`

### AssistantResponseMessage 结构
- `content`
- `toolUses`（`ToolUse[]`）
- `reasoningContent`
- `references`
- `supplementaryWebLinks`
- `followupPrompt`
- `messageId`
- `cachePoint`

### ReasoningContent
- `reasoningText` 或 `redactedContent`（base64）

### SupplementaryWebLink
- `url`
- `title`
- `snippet`

### FollowupPrompt
- `content: string`
- `userIntent?: UserIntent | string`

### ToolResultStatus
- `success`
- `error`

### UserIntent（枚举）
- `APPLY_COMMON_BEST_PRACTICES`
- `CITE_SOURCES`
- `CODE_GENERATION`
- `EXPLAIN_CODE_SELECTION`
- `EXPLAIN_LINE_BY_LINE`
- `GENERATE_CLOUDFORMATION_TEMPLATE`
- `GENERATE_UNIT_TESTS`
- `IMPROVE_CODE`
- `SHOW_EXAMPLES`
- `SUGGEST_ALTERNATE_IMPLEMENTATION`

### CachePointType（枚举）
- `default`

### CachePoint / ClientCacheConfig
- `cachePoint`：`{ type: CachePointType }`，`CachePointType` 枚举仅含 `"default"`。
- `clientCacheConfig`：`{ useClientCachingOnly: boolean }`。
- 来源：Smithy service model（`@amzn/codewhisperer-streaming`）。

### AdditionalContentEntry（userInputMessageContext.additionalContext）
- `name`
- `description`
- `innerContext`

### TokenUsage（metadataEvent.tokenUsage）
- `cacheReadInputTokens`
- `cacheWriteInputTokens`
- `uncachedInputTokens`
- `outputTokens`
- `totalTokens`
- `contextUsagePercentage`

### MeteringEvent
- `unit`
- `unitPlural`
- `usage`

### ReasoningContentEvent
- `text`
- `signature`
- `redactedContent`（base64）

### ImageFormat 枚举
- `gif`
- `jpeg`
- `png`
- `webp`

### 消息转换逻辑（关键方法）
- `_convertMessages(messages)`：
  - `messages` -> `history` + `currentMessage`。
  - user 消息映射为 `userInputMessage`，写入 `origin: AI_EDITOR` 和 `editorState`。
  - assistant 消息映射为 `assistantResponseMessage`（仅 `content`）。
  - `conversationId` 默认 `crypto.randomUUID()`。
  - `chatTriggerType` 固定 `MANUAL`。
- `convertToGenerateAssistantMessages(messages, tools, modelId)`：
  - user 消息：`userInputMessage` 包含 `content` / `origin` / `modelId` / `images`。
  - tool 结果消息：写入 `userInputMessageContext.toolResults`。
  - assistant 消息：`assistantResponseMessage` 包含 `content` + `toolUses` + `reasoningContent`。
  - 最后一条 user 消息会写入 `userInputMessageContext.tools`（来自 `tools`）。
  - `conversationId` 优先复用历史中的 `additional_kwargs.conversationId`，否则生成新 UUID。
  - 可携带 `agentContinuationId` 与 `agentTaskType`（从历史消息 `additional_kwargs` 提取）。

### 会话校验与修复（validator / sanitizer）
- 规则枚举（`ValidationRule`）：
  - `STARTS_WITH_USER_MESSAGE`
  - `ENDS_WITH_USER_MESSAGE`
  - `ALTERNATING_MESSAGES`
  - `TOOL_USES_AND_RESULTS`
  - `TOOL_RESULTS_AND_NO_USES`
  - `NON_EMPTY_USER_MESSAGE`
- 自动修复策略：
  - 开头不是 user → 前置 `HELLO_MESSAGE`（user: "Hello"）。
  - 结尾不是 user → 追加 `CONTINUE_MESSAGE`（user: "Continue"）。
  - 连续 user / 连续 assistant → 插入 `UNDERSTOOD_MESSAGE`（assistant: "understood"）或 `CONTINUE_MESSAGE` 保证交替。
  - assistant 有 `toolUses` 但后续缺 `toolResults` → 自动补 `FAILED_TOOL_USE_MESSAGE`（user message，`toolResults` status=`error`，内容 `"Tool execution failed"`）。
  - 清理空 user 消息（无 content 且无 toolResults）。
  - 允许重排 tool result 消息以匹配对应 `toolUseId`。

### 流式事件类型（ChatResponseStream）
- `assistantResponseEvent`
- `reasoningContentEvent`
- `codeReferenceEvent`
- `toolUseEvent`
- `toolResultEvent`
- `supplementaryWebLinksEvent`
- `followupPromptEvent`
- `messageMetadataEvent`
- `metadataEvent`
- `meteringEvent`
- `codeEvent`
- `intentsEvent`
- `interactionComponentsEvent`
- `dryRunSucceedEvent`
- `contextUsageEvent`
- `citationEvent`
- `invalidStateEvent`
- `error`

### MessageMetadataEvent
- 字段定义（来自 `@amzn/codewhisperer-streaming` SDK 官方类型）：
  - `conversationId?: string`（当前会话的唯一标识符）
- SDK 反序列化层对该事件执行 `_json` 透传，无额外字段映射。
- Kiro 源码中未见对该事件字段的进一步业务读取；`conversationId` 的可靠来源是 HTTP 响应头（见下方 Header 映射）。
- `conversationId` 的可靠来源是 HTTP 响应头：
  - `de_GenerateAssistantResponseCommand` 会把 `x-amzn-codewhisperer-conversation-id` 写入返回对象的 `conversationId`。
  - `qChatLogger` 记录的是 `l27.conversationId`（响应对象字段），而非明确来自 `messageMetadataEvent`。
- `q-client` 逻辑会在每条请求的 `additional_kwargs` 中携带：
  - `conversationId`
  - `continuationId`
  - `taskType`（`VIBE` / `SPEC_TASK`）

### 关键 Header 映射
- `x-amzn-codewhisperer-conversation-id` → `conversationId`
- `x-amzn-kiro-agent-mode` → `agentMode`

### 反序列化规则（SDK 实际实现）
- `_json` 透传（结构未知）：
  - `assistantResponseEvent`
  - `codeReferenceEvent`
  - `supplementaryWebLinksEvent`
  - `followupPromptEvent`
  - `codeEvent`
  - `intentsEvent`
  - `toolUseEvent`
- 明确 schema 的事件（来自 SDK 官方类型定义）：
  - `messageMetadataEvent` -> `{ conversationId? }`
  - `dryRunSucceedEvent` -> 空 interface，无字段
  - `invalidStateEvent` -> `{ reason: "INVALID_TASK_ASSIST_PLAN", message: string }`
  - `citationEvent` -> `{ target: { location: number } | { range: Span }, citationText?, citationLink }`
  - `reasoningContentEvent` -> `{ text, signature, redactedContent }`
  - `toolResultEvent` -> `{ toolResult }`
  - `interactionComponentsEvent` -> `{ interactionComponentEntries }`
  - `metadataEvent` -> `{ tokenUsage }`
  - `meteringEvent` -> `{ unit, unitPlural, usage }`
  - `contextUsageEvent` -> `{ contextUsagePercentage }`
- `error` -> `InternalServerException`

补充证据（Kiro 扩展源码）：
- `extension.js` 中 `de_MessageMetadataEvent_event` 仅执行 `parseJsonBody` 后 `_json` 透传，未提供字段映射或 schema。

### 归档流事件（ResultArchiveStream）
- `binaryMetadataEvent`
- `binaryPayloadEvent`
- `internalServerException`

### ContentChecksumType（枚举）
- `SHA_256`

### 事件字段线索（从 FilterSensitiveLog 与使用点提取）
- `assistantResponseEvent`: `content`, `modelId`。
- `reasoningContentEvent`: `text`, `signature`, `redactedContent`（base64）。
- `toolUseEvent`: `toolUseId`, `name`, `input`, `stop`。
- `toolResultEvent`: `toolResult`（结构见 `ToolResult`，`content` 支持 `text` / `json`）。
- `supplementaryWebLinksEvent`: `supplementaryWebLinks[]`。
- `metadataEvent`: `tokenUsage`（结构见 `TokenUsage`）。
- `meteringEvent`: `unit`, `unitPlural`, `usage`（double）。
- `interactionComponentsEvent`: `interactionComponentEntries[]`（见 InteractionComponent）。
- `contextUsageEvent`: `contextUsagePercentage`（float32）。
- `citationEvent`: `target`（`location` / `range`）、`citationText`、`citationLink`。
- `codeEvent`: `content`。
- `followupPromptEvent`: `followupPrompt`。
- `intentsEvent`: `intents?: Partial<Record<IntentType, Record<string, IntentDataType>>>`。`IntentType` 枚举值：`GLUE_SENSEI` / `RESOURCE_DATA` / `SUPPORT`。`IntentDataType` 是联合类型，当前只有 `StringMember`（`{ string: string }`）。
- `codeReferenceEvent`: `references[]`（`licenseName` / `repository` / `url` / `recommendationContentSpan{start,end}`）。citeturn3view0turn5view0
- `messageMetadataEvent`: 当前 AWS Toolkit CodeWhisperer Streaming SDK 仅定义 `conversationId?`。citeturn5view0
- `dryRunSucceedEvent`：空事件，无字段（SDK 官方类型定义为空 interface）。
- `invalidStateEvent`: `reason`（`InvalidStateReason`：`"INVALID_TASK_ASSIST_PLAN"`）、`message`。


### 已确认字段清单（来自 SDK 官方类型定义）
- `dryRunSucceedEvent`：空 interface，无任何字段。
- `invalidStateEvent`：`reason`（枚举值 `"INVALID_TASK_ASSIST_PLAN"`）、`message: string`。
- `citationEvent`：`target`（`{ location: number }` 或 `{ range: { start, end } }`）、`citationText?: string`、`citationLink: string`。
- `cachePoint`：`{ type: CachePointType }`，`CachePointType` 枚举仅含 `"default"`。
- `clientCacheConfig`：`{ useClientCachingOnly: boolean }`。

### AWS Toolkit CodeWhisperer Streaming SDK 补充定义（models_0.ts）
- `ChatResponseStream` 联合当前至少包含：`messageMetadataEvent` / `assistantResponseEvent` / `dryRunSucceedEvent` / `codeReferenceEvent` / `supplementaryWebLinksEvent` / `followupPromptEvent` / `codeEvent` / `intentsEvent` / `interactionComponentsEvent` / `toolUseEvent` / `citationEvent` / `invalidStateEvent` / `error`，并带 `$unknown` 兜底成员。
- `CursorState` 为 `position` 或 `range` 之一；`Position` 字段为 `line`/`character`（0-based），`Range` 为 `{ start, end }`。citeturn3view0
- `UserInputMessageContext` 仅包含 `editorState` / `diagnostic`（该 SDK 版本未包含 `tools`/`toolResults` 等扩展字段）。citeturn3view0
- GitHub 上游仓库当前可直接搜到 `codeReferenceEvent.references` 与 `supplementaryWebLinksEvent.supplementaryWebLinks` 的业务消费代码，但未搜到非生成代码中的 `citationEvent` 对应消费；因此 `citationEvent` 目前是“协议/反序列化层有硬证据，业务渲染链暂无直接源码实证”。

### 运行时取证线索（Kiro IDE 内置日志与调试导出）
- Kiro 源码里真正记录“完整事件流”的不是普通 `q-client.log`，而是 `Q Chat API` 这条调试链：
  - `qChatLogger.appendLine(JSON.stringify({ response: { ... events: h27 } }))`
  - `qChatLogger` 自带环形缓冲区，长度 500 行。
- `kiroAgent.debug.captureLog` 会把 `Q Request Logs` 拼进调试导出。
- `kiroAgent.createDebugLogZip` 会把调试导出落到当前工作区 `workspace/.kiro/debug/`：
  - `debug.log`
  - `execution-log.json`
- 这意味着：如果要继续验证 `citationEvent` 是否真实出现、字段形态是什么，主取证入口应是 `debug.log / execution-log.json`，不是普通 exthost 文件日志。

### Execution Log 真实落盘映射（本轮新增）
- `ExecutionLogController` 不是把执行记录塞进 `workspace-sessions`，而是走独立的 `StorageManager` 落盘。
- `StorageManager.initialize()` 会把 `workspaceId` 设为 `sha256(workspace.fsPath).substring(0, 32)`，并在 `context.globalStorageUri/<workspaceId>/` 下建目录。
- `StorageManager.hash()`、`buildPath()`、`buildFolderPath()` 说明：
  - `key` -> `sha256(key).substring(0, 32)` 作为文件名
  - `folderKey` -> `sha256(folderKey).substring(0, 32)` 作为目录名
- 因此当前机器上的这类路径：
  - `%APPDATA%\Kiro\User\globalStorage\kiro.kiroagent\bcc6908e3d8382789e844289ec147d8a\`
  - 不是随机串，而是工作区路径 hash
- `ExecutionLogController` 的两个关键常量：
  - `KIRO::EXECUTION::SAVES`
  - `KIRO::EXECUTION::METADATA`
- 结合源码与本机实盘可得出：
  - `KIRO::EXECUTION::METADATA` -> 根目录下无扩展名元数据文件（当前样本是 `f62de366d0006e17ea00a01f6624aabf`）
  - `KIRO::EXECUTION::SAVES` -> 根目录下固定 hash 子目录（当前样本是 `414d1636299d2b9e4ce7e17fb11f63e9`）
  - 子目录内每个无扩展名文件就是一个 execution save entity
- 本机真实样本已经证明 `extractLastExecutionLogDiskPaths()` 所说的“磁盘 execution 对象”就是这批文件，不是抽象接口。

> 已确认的本地源码链路

- `Q Chat API` 事件流写入：
  - `C:\Users\12925\AppData\Local\Programs\Kiro\resources\app\extensions\kiro.kiro-agent\dist\extension.js:377689`
  - `C:\Users\12925\AppData\Local\Programs\Kiro\resources\app\extensions\kiro.kiro-agent\dist\extension.js:377842`
  - `C:\Users\12925\AppData\Local\Programs\Kiro\resources\app\extensions\kiro.kiro-agent\dist\extension.js:931201`
  - `C:\Users\12925\AppData\Local\Programs\Kiro\resources\app\extensions\kiro.kiro-agent\dist\extension.js:931206`
- 调试导出写文件：
  - `C:\Users\12925\AppData\Local\Programs\Kiro\resources\app\extensions\kiro.kiro-agent\dist\extension.js:931328`
  - `C:\Users\12925\AppData\Local\Programs\Kiro\resources\app\extensions\kiro.kiro-agent\dist\extension.js:931470`
  - `C:\Users\12925\AppData\Local\Programs\Kiro\resources\app\extensions\kiro.kiro-agent\dist\extension.js:931521`
  - `C:\Users\12925\AppData\Local\Programs\Kiro\resources\app\extensions\kiro.kiro-agent\dist\extension.js:931526`

### 普通 exthost 文件日志（能证明什么，不能证明什么）
- `q-client.log` 仍然有价值，但主要用于证明：
  - `CodeWhispererStreamingClient` 请求结构
  - `GenerateAssistantResponseCommand` 调用存在
  - `InvokeMCPCommand -> tools/list -> web_search` 真实出现
- 对 `web_search` 来说，`q-client.log` 目前还能进一步证明：
  - 远端工具名就是 `web_search`
  - `inputSchema` 只有 `query: string`
  - query 长度限制是“200 字符以内”
  - 工具描述里声明的返回字段至少包含 `title / url / snippet / publishedDate / isPublicDomain / id / domain`
- `q-client.log` 不能替代 `Q Chat API` 调试链去证明 citation 事件，因为它主要记录请求/响应元信息，不是 `events: h27` 的主落盘位置。
- `Kiro Logs.log` 主要给会话时序、telemetry、agent 生命周期，不提供 citation 结构本体。
- `Kiro - MCP Logs.log`、`KiroLLMLogs.log` 在本机样本里长期为空，不能作为 citation 证据来源。
- `Q Chat API.log` 目前在本机真实样本里已直接落出：
  - `assistantResponseEvent`
  - `toolUseEvent`
  - `contextUsageEvent`
  - `meteringEvent`
- 但这轮全量 grep 仍未在现有 `Q Chat API.log` 样本中抓到：
  - `citationEvent`
  - `supplementaryWebLinksEvent`
  - `codeReferenceEvent`
  - `toolResultEvent`
- 这进一步说明：当前机器上已有的运行时日志样本，只能证明“这些事件在协议和主循环里存在/被支持到什么程度”，还不能证明“这些事件在本机会话里确实出现过”。
- `codeReferenceEvent` 与 citation 必须分开看：
  - `codeReferenceEvent.references` 会走 `kiroAgent.recordReferences`
  - 它写入的是 `code-references` Output Channel，属于代码引用/license trace，不是 `citationEvent`
- 本地安装包当前还能直接坐实一条更强的结论：
  - `q-developer-converse` 的聊天主循环只明确消费了 `assistantResponseEvent / reasoningContentEvent / toolUseEvent / meteringEvent / codeReferenceEvent / contextUsageEvent`
  - 同级分支里没有看到 `citationEvent` / `supplementaryWebLinksEvent` / `toolResultEvent` 的业务处理
  - webview 侧当前已坐实消费的是归一化后的 `assistant / tool_call / tool_result / steering_inclusion / sub_agent_*` 这组 payload，不是 raw stream event 名字
  - `onSessionUpdate` 当前是透传转发，不是隐藏改名桥；`inlineMessages` 也来自 persisted unified messages 按 `executionId` 分组，而不是从 raw `citation/followup/supplementary` 临时重写出来
  - 因此聊天 webview 这层目前仍没有 `citationEvent / supplementaryWebLinksEvent / followupPromptEvent` 的显式渲染链证据
  - 进一步扩大到整个安装目录 `resources\\app` 的 JS 搜索后，仍未发现这三个事件家族的侧支消费者；反过来 `codeReferenceEvent` 的 consumer/sink 还能继续稳定命中

### `citationEvent` 具体怎么找（本轮新增）
- 查找顺序应固定为三层：
  - 先查本地安装包 `extension.js`，确认 `citationEvent` 在协议定义与反序列化层真实存在
  - 再查 `Q Chat API.log`，确认当前机器已有会话样本里是否真的出现过该事件
  - 最后查工作区 `.kiro/debug/debug.log` 与 `.kiro/debug/execution-log.json`，这是当前最值得追的调试导出主证据
- 本轮已再次确认：
  - `extension.js` 中同时存在 `citationEvent -> visitor.citationEvent(...)`、`event["citationEvent"]` 反序列化，以及 `debug.log` / `execution-log.json` 写盘代码
  - 当前机器已有 `Q Chat API.log` 样本里，能直接抓到的是 `assistantResponseEvent / toolUseEvent / contextUsageEvent / meteringEvent`
  - 但仍未在这些现有样本里抓到真实 `citationEvent`
- 因此当前正确表述只能是：
  - `citationEvent` 在协议层和本地安装包源码中已坐实
  - 但本机现有运行时样本仍未覆盖到它，不能把“没抓到样本”误写成“事件不存在”
  - 同时也不能把它直接写成“当前 IDE 已确认消费/渲染”；截至当前安装版静态链复核，消费链仍未坐实
- 下轮若要继续补证，建议先主动触发一条高概率带外部来源的回答，再立刻搜索：
  - `rg -n "citationEvent" "%APPDATA%\\Kiro\\logs" -g "*Q Chat API.log"`
  - `rg -n "citationEvent" "<workspace>\\.kiro\\debug" -g "debug.log" -g "execution-log.json"`

### q-client.log（请求/响应结构）
> 路径：`C:\Users\12925\AppData\Roaming\Kiro\logs\*\window1\exthost\kiro.kiroAgent\q-client.log`

- 记录 `CodeWhispererStreamingClient` 的调用日志（`GenerateAssistantResponseCommand`）。
- `input` 内含：
  - `conversationState`（`conversationId`、`agentContinuationId`、`agentTaskType`、`chatTriggerType`、`currentMessage`、`history`）。
  - `currentMessage.userInputMessage`（`content`、`modelId`、`origin`、`userInputMessageContext`）。
  - `userInputMessageContext.tools`（`toolSpecification.name/description/inputSchema.json`）。
  - `userInputMessageContext.toolResults`（`toolUseId`、`content[]`、`status`）。
  - `history` 中 `assistantResponseMessage.toolUses`（`toolUseId`、`name`、`input`）。
  - `profileArn`。
- `output` 内含：
  - `conversationId`
  - `generateAssistantResponseResponse: "STREAMING_CONTENT"`
- `metadata` 内含：
  - `httpStatusCode`
  - `requestId`
  - `attempts`
  - `totalRetryDelay`
- `2026-03-22 15:13:13.181` 与 `15:13:16.211` 的真实样本已经证明：`GenerateAssistantResponseCommand` 会先以 `simple-task` 形态提交当前问题，再以正式模型（当前样本是 `claude-sonnet-4.5`）携带 `userInputMessageContext.tools` 发起同一轮对话请求；两次请求共享同一个 `conversationId=4752bae7-249f-40c8-9087-e7681f99b1bb`。
- 已抓到的 `InvokeMCPCommand -> tools/list` 实样还可补充出：
  - `method: "tools/list"`
  - `output.result.tools[0].name: "web_search"`
  - `output.result.tools[0].inputSchema.properties.query.description` 明确要求 `Must be 200 characters or less`
  - `output.result.tools[0].description` 明确列出 `title / url / snippet / publishedDate / isPublicDomain / id / domain`
- `2026-03-22 15:14:59.919` 的 `q-client.log` 已新增真实 `InvokeMCPCommand -> tools/call` 样本：`id` 为 `web_search_tooluse_HBDsi00WRBobYdARUrKeqd_1774163698353_756aa2ec`，HTTP 200 成功；同轮 `GenerateAssistantResponseCommand` 历史里还能对上 `toolUseId: "tooluse_HBDsi00WRBobYdARUrKeqd"` 与后续 `toolResults.status: "success"`。
- 结合 `Kiro Logs.log` 同轮 `[Remote tool web_search] Calling tool`、`Fetched URLs` 与 `WebFetch` 命中 `docs.anthropic.com/en/docs/about-claude/models/all-models`、`anthropic.com/news/claude-opus-4-5`、`anthropic.com/claude/opus` 的抓取完成记录，`web_search` 执行态现在已经达到运行时实证。
- 额外边界：`ExecutionLogController` 里的 `actionType: "search"` 不能直接等同于远端 MCP `web_search`。
  - 本机 execution save 样本中，`search` 动作的已知输入形态是 `{ why, query }`
  - 当前抓到的是本地代理做代码/内容搜索的动作记录
  - 不是 `tools/call(web_search)` 的远端 MCP 执行真包

### kiro.kiroAgent 其它日志（结论）
> 目录：`C:\Users\12925\AppData\Roaming\Kiro\logs\*\window1\exthost\kiro.kiroAgent\`

- `Kiro - MCP Logs.log`：文件为空（本机样本 4 份均为 0 字节）。
- `KiroLLMLogs.log`：文件为空（本机样本 4 份均为 0 字节）。
- `Kiro - Powers.log`：仅包含 Powers/Registry 初始化与自动安装日志。
- `Kiro Logs.log`：不能再只归类为初始化日志。`2026-03-22 15:14:58` 这轮样本里，它已经提供了 `[Remote tool web_search] Calling tool`、`Fetched URLs`、`[WebFetch] Fetch completed` 等运行时证据，可直接辅助确认搜索执行链与命中来源。
- `output_logging_*/4-Kiro - LLM PromptCompletion.log`：可补“原始问题文本”证据，例如当前样本已明文记录 `请搜索并总结 Anthropic 官方文档里对 Claude 4.5/4.6 的说明，并附来源`。
- `output_logging_*/5-Q Chat API.log`：可补“最终回答文本 + 来源链接”证据，当前样本已记录同一问题的完整回答与引用链接。
- `output_logging_*/5-Q Chat API.log` 还可直接补“对话接口请求体”证据：当前样本同时落出了 `conversationState.currentMessage.userInputMessage.content`、`agentContinuationId`、`agentTaskType`、`history`、`chatTriggerType`，因此它不仅能证明“答了什么”，还能补“当时是怎么向上游对话接口发请求的”。
- 结论：现在不应再写成“除 `q-client.log` 外都没有事件样本”。更准确的说法是：`q-client.log` 负责补 `InvokeMCPCommand/GenerateAssistantResponseCommand` 真包，`Kiro Logs.log` 负责补远端工具执行与抓取链路，`PromptCompletion/Q Chat API.log` 则补原始问题与最终回答落盘。

### GitHub 项目中的事件流与 Tool Use 线索（辅助验证）
- 这些参考项目不是同一层面的实现，不能混着抄；当前应分三类吸收：
  - `hank9999/kiro.rs` 负责校准最小请求转换，也就是 Anthropic `messages` 如何压成 Kiro 上游 `generateAssistantResponse` 所需的 `conversationState`。
  - `jwadow/kiro-gateway` 与 `cniu6/kiro-gateway` 负责校准事件流和工具调用重组，尤其是 `name` / `input` / `stop` 三段拼 `tool_use`、`tool_result` 顺序补齐、JSON 截断与重复 tool call 去重。
  - `kkddytd/claude-api` 负责校准网关表层协议，包括客户端 API Key、Anthropic/OpenAI 双协议兼容、SSE 状态机与重复事件保护。
- 当前优先级应明确为：请求转换学 `kiro.rs`，事件流与工具调用学 `jwadow/cniu6`，客户端 API Key 与 SSE 状态机学 `kkddytd/claude-api`。这样拼起来才是本项目最对路的实现骨架。
- `kkddytd/claude-api`（本次实现新增主参考）：
- 提供 Anthropic 与 OpenAI Responses 入口及 SSE 转换链路，可对照 `content_block_*`、`message_*` 事件拼装。
  - 工具调用场景采用分段增量输出思路，可作为 `tool_use` 与 `input_json_delta` 映射的实现参考。
  - 认证口径与本项目一致采用双层模型：客户端侧使用 API Key，网关上游访问 Kiro API 使用本地 access token。
- `jwadow/kiro-gateway` 的 `kiro/parsers.py` 实现 AWS Event Stream 解析与工具调用拼装：
  - 事件识别模式：`{"content":` / `{"name":` / `{"input":` / `{"stop":` / `{"followupPrompt":` / `{"usage":` / `{"contextUsagePercentage":`。
  - Tool Use 分段：`{"name":` 作为 tool_start，`{"input":` 作为 tool_input 续写参数，`{"stop":` 触发 tool_call 完成（`toolUseId` 映射 `id`）。
  - 文本回退：`parse_bracket_tool_calls` 可从 `[Called xxx with args: {...}]` 格式解析工具调用。
  - 去重逻辑：按 `id` 与 `name+arguments` 去重，优先保留非空参数。
  - 截断检测：内置 JSON 截断诊断，标记 `_truncation_detected` 并提示恢复策略。
- `petehsu/KiroProxy` README 标注“工具调用功能已全面支持”，并给出三协议工具调用矩阵与端点：
  - Anthropic：`POST /v1/messages` 与 `POST /v1/messages/count_tokens`。
  - OpenAI：仅保留 `POST /v1/responses`。
  - Gemini：`POST /v1/models/{model}:generateContent`。
  - 代理层包含“多账号轮询、会话粘性、自动刷新、封禁检测、流量统计”等运行机制，可作为账号管理联动的对照样例。
- 这类参考更适合放在第二阶段能力增强，不应反过来主导当前网关骨架设计。
- `cniu6/kiro-gateway`（jwadow/kiro-gateway 的二改）明确标注“修复 tools / cursor 接口 tools”，可作为 Cursor 工具调用兼容的现实案例。
- `dext7r/KiroGate`（aliom-v/KiroGate 的 fork）在 README 标注：
  - WebSearch 通过 Kiro MCP API 实现。
  - 支持 IDC (Builder ID) 认证、图片输入、Extended Thinking、Token 刷新防抖与 Admin 面板等。
- `justlovemaki/AIClient-2-API` 更偏客户端模拟和 OpenAI 兼容出口，可作为补充参考，但优先级低于前三类骨架参考。

### GitHub 线索补充（messageMetadata / SSE）
- `aiclientproxy/proxycast` 文档 `docs/aiprompts/converter.md` 中给出 CW SSE 示例：
  - `data: {"messageMetadata":{"..."},"assistantResponseEvent":{"content":"Hello"}}`
  - 该示例明确 **SSE 中可能出现 `messageMetadata` 与 `assistantResponseEvent` 同帧输出**，但未公开 `messageMetadata` 字段细节。citeturn5view0

### CitationTarget（枚举/联合）
- `location`
- `range`

### IntentType（枚举）
- `ARTIFACT`
- `DEEPLINKS`
- `GLUE_SENSEI`
- `RESOURCE_DATA`
- `SUPPORT`

### 代码引用记录（CodeReferenceEvent 处理）
- 当 `codeReferenceEvent.references` 非空且包含 `licenseName` 时，会调用 `kiroAgent.recordReferences`。
- 当前已坐实三条入口会复用同一个 sink：
  - `q-developer-converse` 主对话流
  - 另一条 helper generation branch
  - autocomplete / `GenerateCompletionsCommand`
- 记录字段：`generatedContent`、`licenseName`、`repository`、`url`。

### InteractionComponent（交互组件）
- `text`
- `alert`
- `infrastructureUpdate`
- `progress`
- `step`
- `taskDetails`
- `taskReference`
- `suggestions`
- `section`
- `resource`
- `resourceList`
- `action`

#### Action / WebLink / ModuleLink
- `Action`：
  - `webLink`
  - `moduleLink`
- `WebLink`：
  - `label`
  - `url`
- `ModuleLink`：
  - `cloudWatchTroubleshootingLink`
- `CloudWatchTroubleshootingLink`：
  - `label`
  - `investigationPayload`
  - `defaultText`

#### Alert
- `AlertType`：`ERROR` / `INFO` / `WARNING`
- `Alert`：
  - `content`（`AlertComponent[]`）
- `AlertComponent`：
  - `text`（`Text`）

#### InfrastructureUpdate
- `InfrastructureUpdate`：
  - `transition`
- `InfrastructureUpdateTransition`：
  - `currentState`
  - `nextState`

#### Step / Progress
- `StepState`：`FAILED` / `IN_PROGRESS` / `LOADING` / `PAUSED` / `PENDING` / `STOPPED` / `SUCCEEDED`
- `Step`：
  - `label`
  - `content`（`StepComponent[]`）
- `StepComponent`：
  - `text`（`Text`）
- `Progress`：
  - `content`（`ProgressComponent[]`）
- `ProgressComponent`：
  - `step`（`Step`）

#### Resource / ResourceList
- `Resource`：
  - `title`
  - `link`
  - `description`
  - `type`
  - `ARN`
  - `resourceJsonString`
- `ResourceList`：
  - `action`
  - `items`（`Resource[]`）

#### Section / Suggestions
- `Section`：
  - `title`
  - `content`（`SectionComponent[]`）
  - `action`
- `SectionComponent`：
  - `text`
  - `alert`
  - `resource`
  - `resourceList`
- `Suggestions`：
  - `items`（`Suggestion[]`）
- `Suggestion`：
  - `value`

#### TaskDetails / TaskAction
- `TaskOverview`：
  - `label`
  - `description`
- `TaskDetails`：
  - `overview`
  - `content`（`TaskComponent[]`）
  - `actions`（`TaskAction[]`）
- `TaskComponent`：
  - `text`
  - `infrastructureUpdate`
  - `alert`
  - `progress`
- `TaskActionNoteType`：`INFO` / `WARNING`
- `TaskActionNote`：
  - `content`
- `TaskActionConfirmation`：
  - `content`
- `TaskAction`：
  - `label`
  - `note`
  - `payload`
  - `confirmation`

### InvalidStateReason（枚举）
- `INVALID_TASK_ASSIST_PLAN`

### 上游异常类型与原因（CodeWhispererStreamingService）
> 说明：以下枚举与字段来自 Kiro 扩展内置的 `@aws/codewhisperer-streaming-client` 打包代码（`extension.js`）。

- `AccessDeniedException`（`$fault=client`）字段：
  - `message`
  - `reason`（枚举）
  - reason 值：
  - `FEATURE_NOT_SUPPORTED`
  - `TEMPORARILY_SUSPENDED`
  - `UNAUTHORIZED_CUSTOMIZATION_RESOURCE_ACCESS`
  - `UNAUTHORIZED_WORKSPACE_CONTEXT_FEATURE_ACCESS`
- `ConflictException`（`$fault=client`）字段：
  - `message`
  - `reason`（枚举）
  - reason 值：
  - `CUSTOMER_KMS_KEY_DISABLED`
  - `CUSTOMER_KMS_KEY_INVALID_KEY_POLICY`
  - `MISMATCHED_KMS_KEY`
- `InternalServerException`（`$fault=server`，`$retryable`）字段：
  - `message`
  - `reason`（枚举）
  - reason 值：
  - `MODEL_TEMPORARILY_UNAVAILABLE`
- `ThrottlingException`（`$fault=client`，`$retryable.throttling=true`）字段：
  - `message`
  - `reason`（枚举）
  - reason 值：
  - `DAILY_REQUEST_COUNT`
  - `INSUFFICIENT_MODEL_CAPACITY`
  - `MONTHLY_REQUEST_COUNT`
- `ValidationException`（`$fault=client`）字段：
  - `message`
  - `reason`（枚举）
  - reason 值：
  - `CONTENT_LENGTH_EXCEEDS_THRESHOLD`
  - `INVALID_CONVERSATION_ID`
  - `INVALID_KMS_GRANT`
  - `INVALID_MODEL_ID`
- `ServiceQuotaExceededException`（`$fault=client`）字段：
  - `message`
  - `reason`（枚举）
  - reason 值：
  - `CONVERSATION_LIMIT_EXCEEDED`
  - `MONTHLY_REQUEST_COUNT`
  - `OVERAGE_REQUEST_LIMIT_EXCEEDED`
- `ResourceNotFoundException`（`$fault=client`）字段：
  - `message`
- `ServiceUnavailableException`（`$fault=server`）字段：
  - `message`
- `DryRunOperationException` 字段：
  - `message`（当前 bundle 反序列化仅读取该字段）

### HTTP 响应码映射建议（网关侧）
> 上游返回 HTTP 状态码时优先透传；若只能拿到 `errorCode`，可按以下规则映射：
- `AccessDeniedException` → `403`
- `ConflictException` → `409`
- `ValidationException` → `400`
- `ResourceNotFoundException` → `404`
- `ThrottlingException` → `429`
- `ServiceQuotaExceededException` → `429`
- `ServiceUnavailableException` → `503`
- `InternalServerException` → `500`
- `DryRunOperationException` → `400`（或 `409`，取决于调用语义）

## 2api 实现原理（核心链路）
- 代理层：本地 HTTP 服务对外提供 Anthropic `POST /v1/messages`，以及 OpenAI `POST /v1/responses`。
- 鉴权层：使用 Kiro 账号获取 `access_token`，请求上游时携带 `Authorization` + Cookie。
- 上游调用层：请求发送到 `https://q.{region}.amazonaws.com/` 的对话接口（常见路径 `generateAssistantResponse`）。
- 协议适配层：将上游响应按客户端协议转换为 Anthropic / OpenAI Responses 结构；若 `stream: true` 则输出对应 SSE。

## 原理细化（请求到响应的全流程）
> 核心边界：Anthropic / OpenAI 只是本地网关的入口/出口协议；`citationEvent`、`toolUseEvent`、`assistantResponseEvent` 等原始字段都来自 Kiro 上游响应，而不是外部客户端协议自带字段。

### 1) 客户端请求进入本地代理
- 入口支持 Anthropic `POST /v1/messages`，以及 OpenAI `POST /v1/responses`。
- OpenAI 仅提供 `POST /v1/responses`。
- 关键字段按协议归一化：Anthropic `messages/system/tools`，Responses `input/instructions/tools/tool_choice`。
- 代理先做基础校验：JSON 解析、必填字段、`stream` 取值。

### 2) 账号与 Token 准备
- 当前网关从已有账号体系里挑选 `single/group` 账号，并通过 `refresh_token_by_provider()` 刷新出可用的 `access_token`。
- 若 access token 过期，先刷新再继续（失败则返回 Anthropic 标准错误）。
- 构建上游鉴权头：
- `Authorization: Bearer <access_token>`
- `User-Agent` / `x-amz-user-agent: KiroIDE <version> <machineId>`
- 对话链会补 `x-amzn-kiro-agent-mode`，内容采集关闭时才补 `x-amzn-codewhisperer-optout`
- `external_idp` 场景会补 `TokenType: EXTERNAL_IDP`
- `/mcp` 在存在 `profileArn` 时会补 `x-amzn-kiro-profile-arn`
- 当前网关代码没有额外追加 `Cookie: Idp=...; AccessToken=...`

### 3) 上游请求拼装
- 上游基础域名：`https://q.{region}.amazonaws.com`。
- 对话路径：`/generateAssistantResponse`。
- 按 Kiro 上游要求组装 payload（与 Anthropic 字段对齐后再转换）。
- 常见映射规则：
- Anthropic `model` -> Kiro 模型名（需映射表）。
- Anthropic `messages` -> Kiro 的消息数组。
- Anthropic `system` -> Kiro 的 system 或合并到首条 message。
- Anthropic `max_tokens` -> Kiro 的生成上限参数。
- Anthropic `stream` -> Kiro 流式参数。

### 4) 上游返回处理
- 上游返回后，网关先按 Kiro 语义解析/聚合事件流，再根据客户端入口协议序列化为 Anthropic / OpenAI Responses。
- 因此像 `citationEvent` 这样的字段，如果出现在 Anthropic / OpenAI 响应里，本质上也是“Kiro 字段经网关映射后的投影”，不是外部协议原生字段。
- 非流式：把上游 JSON 响应转换为 Anthropic `message` 响应。
- 流式：将上游流式 chunk 转换成 Anthropic SSE 事件。
- 常见 SSE 事件顺序：
- `message_start`
- `content_block_delta`
- `message_stop`
- 代理需要在流末尾输出 `[DONE]` 或对应的结束事件（按 Anthropic 规范）。

### 5) 错误映射
- 401/403 -> `authentication_error`。
- 429 -> `rate_limit_error`。
- 5xx -> `api_error`。
- 代理需将上游错误内容裁剪或脱敏后返回。

## 关键映射细节（建议以真实实现为准）
- 模型映射：Claude 模型名到 Kiro 模型标识的映射表。
- Tool 结构：Anthropic tools 转 Kiro 的函数/工具定义结构。
- Thinking 与高级字段：若上游支持则透传，否则忽略并提示。
- SSE chunk 合并策略：按 token/文本片段组装到 `content_block_delta`。

## `web_search` 设计与实现
### 设计目标
- 不把 Anthropic `web_search_*` 当作普通客户端 function tool 直接抛给调用方，而是在网关内完成 server tool 代理闭环。
- 双协议入口共用同一套内部模型：Anthropic `POST /v1/messages` 与 OpenAI `POST /v1/responses` 最终都走统一归一化，再决定是否进入 `web_search` 代执行分支。

### 设计决策
- 工具归一化：`web_search_*` 会被识别为特殊工具类型，但统一映射到底层 Kiro MCP 的 `web_search` 工具名。
- 执行方式：首轮请求先发 `generateAssistantResponse`；若 Kiro 返回 `web_search` tool call，则网关调用 `/mcp` 的 `tools/call` 执行搜索，再把结果回灌给后续对话轮次。
- 历史兼容：Anthropic 历史消息中的 `server_tool_use` / `web_search_tool_result` 会被归一化进统一消息模型，避免上下文断链。
- 结果过滤：Kiro 返回的搜索结果若包含 `results[].url`，网关按 `allowed_domains` / `blocked_domains` 做结果侧过滤；当前不伪造 Anthropic 更细粒度 citations。

### 本轮新增实证
- **运行时工具定义已坐实**：本机 `q-client.log` 里已经抓到 `InvokeMCPCommand -> tools/list -> web_search` 真包，说明远端 MCP 工具名就是 `web_search`，输入只有 `{ query }`，且 query 受 200 字符上限约束。
- **安装包里的 `tools/call` 发包结构已坐实**：Kiro 安装包 `acp-remote-mcp-client-*.js` 明确发送 `jsonrpc: "2.0"`、`method: "tools/call"`、`profileArn`、`params: { name, arguments }`。
- **运行时 `tools/call(web_search)` 真包已补齐**：`2026-03-22 15:14:59.919` 的 `q-client.log` 已抓到 `InvokeMCPCommand` 真包，`id` 为 `web_search_tooluse_HBDsi00WRBobYdARUrKeqd_1774163698353_756aa2ec`、`method` 为 `tools/call`、HTTP 200；同轮 `Kiro Logs.log` 记录了 `[Remote tool web_search] Calling tool`、`Fetched URLs`，并在数秒后完成对 `docs.anthropic.com/en/docs/about-claude/models/all-models`、`anthropic.com/news/claude-opus-4-5`、`anthropic.com/claude/opus` 的抓取。
- **安装包里的 `web_search` 回包解析已坐实**：Kiro 安装包 `disclose-context-*.js` 明确从 `result.content[]` 中挑 `type === "text"` 的项，`JSON.parse(text)` 后要求存在 `results` 数组；若没有 `text` 或 `results`，就按异常结构处理。
- **本地业务消费层的边界也更清楚了**：安装包 `q-developer-converse-*.js` 已直接消费 `codeReferenceEvent.references` 并调用 `recordReferences`；但同轮搜索仍未在本地业务代码里搜到 `citationEvent` 或 `supplementaryWebLinksEvent` 的直接消费分支。
- **Execution Log 的 `search` 动作已抓到真实样本，但不能误判为 `web_search`**：当前机器的 execution save 文件里，`actionType: "search"` 的落盘输入是 `{ why, query }`，用于本地代理搜索上下文/代码；它和远端 MCP 的 `tools/call(web_search)` 不是同一层东西。
- **Execution Log 落盘路径也已彻底打透**：`workspaceId`、`folderKey`、`key` 都是 `sha256(...).substring(0, 32)`；本机 `bcc6908e3d8382789e844289ec147d8a` 这类目录就是工作区 hash，`414d1636299d2b9e4ce7e17fb11f63e9` 对应 `KIRO::EXECUTION::SAVES`，`f62de366d0006e17ea00a01f6624aabf` 对应 `KIRO::EXECUTION::METADATA`。
- **问题与回答落盘链也已补齐**：同一轮 `4-Kiro - LLM PromptCompletion.log` 已明文记录原始问题“请搜索并总结 Anthropic 官方文档里对 Claude 4.5/4.6 的说明，并附来源”，`5-Q Chat API.log` 已记录最终回答与 Anthropic 官方来源链接。这说明当前日志链已经能把“提问 -> web_search 执行 -> 官方页面抓取 -> 最终回答”串起来。

### 实现链路
1. 请求归一化阶段识别 `web_search_*`，补齐统一 schema，并保留 `max_uses` 与域名过滤配置。
2. 首轮 Kiro 请求若无 `web_search` tool call，则按普通消息链路直接返回。
3. 若出现 `web_search` tool call，网关通过 `POST /mcp` 的 JSON-RPC `tools/call` 代执行。
4. 网关把 MCP 结果转成内部 `web_search_tool_result` 内容块，再作为下一轮用户侧 tool result 回灌给 Kiro。
5. 最终返回 Anthropic 响应时，额外组装 `server_tool_use` 与 `web_search_tool_result` 内容块，保持外部协议语义。

### 当前实现边界
- 已完成：版本化 `web_search_*` 识别、Kiro `web_search` MCP 代执行、Anthropic `server_tool_use` / `web_search_tool_result` 输出组装，以及 Kiro 原始 `citationEvent` 在 OpenAI Responses 非流式 `output_text.annotations` / 流式 `response.output_text.annotation.added`、Anthropic 非流式 `content[].citations` / 流式 `citations_delta` 的 SDK 结构输出。
- 已与 Kiro 本体安装包源码对齐：当前网关对 `tools/call` 的请求结构模拟，以及对 `web_search` 回包 `content[].text -> JSON.parse -> results[]` 的解析路径，都与本地 Kiro 安装包一致。
- 已与本地安装包主循环证据对齐：Kiro 聊天主循环目前明确消费的事件只有 `assistantResponseEvent / reasoningContentEvent / toolUseEvent / meteringEvent / codeReferenceEvent / contextUsageEvent`；因此网关把 `citationEvent` / `supplementaryWebLinksEvent` 映射给外部协议是“协议增强”，不能表述成“本地 IDE 已被 1:1 证实会渲染这些字段”。
- 仍有限制：Anthropic 当前采用的是“按 SDK 形态兼容”的 `char_location` 投影，不是已经由 Kiro 上游源码直接证明的原生 1:1 语义；其中当上游只给 `target.location` 时，会用 `citationText` 长度补 `end_char_index`。OpenAI Responses 侧则继续保持保守，只在 `target.range` 存在时公开 `start_index/end_index`。
- `web_search` 本身已达到运行时取证：截至 `2026-03-22 15:14:59` 的样本，本机已经抓到真实 `tools/call(web_search)` 请求/响应与后续抓取链。当前剩余缺口已经收敛为 `citationEvent` 等搜索后续事件是否在现有样本中出现，而不是 `web_search` 是否真的被执行。
- 同时也不能把 execution save 里的 `actionType: "search"` 当成这个缺口已经补齐；那只是本地搜索动作的审计记录，不是远端 `web_search` 的 MCP 调用证据。

## Anthropic 请求结构（参考 kiro.rs 类型定义）
### MessagesRequest 字段
- `model`: string。
- `max_tokens`: number。
- `messages`: array（每项是 `Message`）。
- `stream`: boolean。
- `system`: string 或 `SystemMessage[]`。
- `tools`: `Tool[]`。
- `tool_choice`: JSON 任意结构（代理侧通常透传）。
- `thinking`: `Thinking`。
- `output_config`: `OutputConfig`。
- `metadata`: `Metadata`（包含 `user_id`）。

### Message 结构
- `role`: string（`user` / `assistant`）。
- `content`: string 或 `ContentBlock[]`。

### SystemMessage 结构
- `text`: string。
- `system` 支持 string 或数组格式，数组元素为 `{ text }`。

### Thinking / OutputConfig
- `thinking.type`: `enabled` / `adaptive` 等。
- `thinking.budget_tokens`: number，内部会被裁到最大值。
- `output_config.effort`: string，默认 `high`。

### Metadata
- `user_id`: string（如 `user_xxx_account__session_<uuid>`），用于提取会话 ID。

## Tool Use 结构（参考 kiro.rs）
### 工具定义（tools）
- 普通工具：`{ name, description, input_schema }`。
- WebSearch 工具：`{ type: "web_search_*", name: "web_search", max_uses }`；当前公开官方文档可见版本包括 `web_search_20250305` 与 `web_search_20260209`。

### ContentBlock（响应/消息块字段）
`kiro.rs` 在 Anthropic 类型定义里，ContentBlock 包含以下字段（用于 `text` / `thinking` / `tool_use` / `tool_result` 等块类型）：
- `type`
- `text`
- `thinking`
- `id`
- `name`
- `input`
- `tool_use_id`
- `content`
- `is_error`
- `source`

### Tool Use / Tool Result 的配对原则
- `tool_use` 通常出现在 assistant 消息的 `ContentBlock[]` 中。
- `tool_result` 通常出现在 user 消息的 `ContentBlock[]` 中。
- 代理应过滤“孤立”的 `tool_result`，并移除未配对的 `tool_use`。

### Tool Use 相关的容错处理（参考实现）
- 对 `input_schema` 做规范化，修复 `required/properties` 为 `null` 的异常情况。
- 若历史消息引用了某工具但 `tools` 中缺失该工具，自动创建占位工具定义。

## 参考实现中的关键行为（kiro.rs）
- 模型映射规则：
- sonnet 4.6/4-6 → `claude-sonnet-4.6`
- 其他 sonnet → `claude-sonnet-4.5`
- opus 4.5/4-5 → `claude-opus-4.5`
- 其他 opus → `claude-opus-4.6`
- haiku → `claude-haiku-4.5`
- 末尾 assistant prefill 会被静默丢弃，确保最后一条是 user。
- `metadata.user_id` 可提取 `session_<uuid>` 作为 `conversationId`。

## 模型映射表（模板）
> 下面是占位模板，需按实际 Kiro 可用模型补齐或校正。

| Anthropic model | Kiro model id | 备注 |
|---|---|---|
| `claude-sonnet-4.5` | `claude-sonnet-4.5` | 默认推荐 |
| `claude-sonnet-4` | `claude-sonnet-4` |  |
| `claude-haiku-4.5` | `claude-haiku-4.5` |  |
| `claude-opus-4.5` | `claude-opus-4.5` |  |
| `claude-opus-4.6` | `claude-opus-4.6` |  |
| 其他 | `claude-sonnet-4.5` | 不识别时回退 |

## SSE 输出示例（Anthropic 格式模板）
> 以下为事件模板示例，字段以最终实现为准。

```text
event: message_start
data: {"type":"message_start","message":{"id":"msg_xxx","type":"message","role":"assistant","model":"claude-sonnet-4.5","content":[]}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}} 

event: message_stop
data: {"type":"message_stop"}
```

## 实现差异点（各项目主要区别）
- Token 获取与刷新策略（Kiro IDE 缓存 / OAuth / 刷新）。
- 请求字段映射（`system`、`tools`、`model`、`temperature`、`max_tokens` 等）。
- SSE 分段策略与事件类型（`message_start` / `content_block_delta` / `message_stop`）。
- 模型名映射规则（Claude 模型名 → Kiro 模型标识）。

## 账号管理接入方案（基于当前项目）
### 账号来源模式
- `single`：固定使用一个指定账号，适合强绑定调试与可复现问题排查。
- `group`：按 `groupId` 选择账号池，适合团队/分组统一调度。

### 账号选择策略
- 复用 `auto_switch::AccountSwitcher` 的三种策略：
- `round_robin`：轮询。
- `most_quota`：优先剩余额度最多（依赖 `usage_data`）。
- `random`：随机。
- `threshold`：当当前账号使用率达到阈值且仍有其它候选账号时，优先尝试切换。
- 过滤不可用账号：`status == "banned"` 的账号不参与选择。

### Token 刷新与降级
- 请求上游前优先使用已有 `access_token`。
- 上游返回 401/403 时触发刷新，调用现有 `refresh_token_by_provider`。
- 刷新失败则标记账号不可用并切换到下一个账号。

### 配额/用量数据
- 复用 `KiroPortalClient.get_user_usage_and_limits` 填充 `usage_data`。
- `most_quota` 直接从 `usage_data.usage.current/limit` 计算剩余额度。
- `usage_data` 不存在时降级到 `round_robin`。

### 网关配置建议
- 当前网关配置字段：
- `accountMode`（`single/group`）。
- `accountId`（single 模式）。
- `groupId`（group 模式）。
- `strategy`（round_robin/most_quota/random）。
- `threshold`（可选，控制切换阈值）。
- `accessToken` / 客户端 API Key（当前必填，支持 `Authorization` 或 `x-api-key`）。
- `localOnly` / `allowedIps`（入口访问限制）。
- `logLevel`（应用日志级别）。

## 参考项目（Kiro 2api）
- `hank9999/kiro.rs`：Rust 编写的 Anthropic `/v1/messages` 兼容代理，将 Anthropic 请求转换为 Kiro API 请求。
- `jwadow/kiro-gateway`（原 `kiro-openai-gateway`）：OpenAI/Anthropic 兼容的 Kiro API 网关，支持本地与 Docker 部署。
- `aliom-v/KiroGate`：OpenAI & Anthropic 兼容的 Kiro IDE API 代理网关（含 Deno/Python 版本）。
- `petehsu/KiroProxy`：Kiro IDE API 反向代理服务器，支持多账号、Token 刷新与多协议兼容。
- `justlovemaki/AIClient-2-API`：模拟 Kiro 客户端请求并提供 OpenAI 兼容接口的代理服务。

## GitHub 线索补充（仅列出可定位的目录）
- `zhongruan0522/AntiHub-ALL`：
  - 后端路径：`AntiHub-Backend/app/services/`
  - Kiro 相关服务文件：`kiro_service.py`、`kiro_anthropic_converter.py`
- `ghuntley/amazon-kiro.kiro-agent-source-code-analysis`：
  - 公开镜像结构与本地 Kiro 扩展一致（`dist/`、`packages/`、`extension-resources/` 等）。

## GitHub 实测线索（已检索的关键文件）
### jwadow/kiro-gateway
- 事件流解析与工具拼装集中在 `kiro/parsers.py`：
  - 识别模式：`{"content":` / `{"name":` / `{"input":` / `{"stop":` / `{"followupPrompt":` / `{"usage":` / `{"contextUsagePercentage":`。
  - `tool_start`/`tool_input`/`tool_stop` 三段拼接工具参数，`toolUseId` 作为 tool_call `id`。
  - `parse_bracket_tool_calls` 提供 `[Called xxx with args: {...}]` 回退解析。
  - `deduplicate_tool_calls` 去重规则：优先保留非空参数，按 `id` 与 `name+args` 去重。
  - 具备 JSON 截断诊断并打 `_truncation_detected` 标记，提示上游裁切。

### petehsu/KiroProxy
- README 标明：三协议工具调用、图片输入、web_search、账号轮询、会话粘性、自动刷新与封禁检测等特性，可作为账号管理与流控方案的对照样例。

### dext7r/KiroGate（aliom-v/KiroGate fork）
- README 标注新增：IDC (Builder ID) 认证、WebSearch 通过 MCP API、图片输入、Extended Thinking、Token 刷新防抖、Admin 面板等功能，可参考其对 Kiro/MCP 的接入方式。

## 测试与验证
- 前端：`npm run build`。
- 后端：`cargo test`。
- 手动验证：
- 端口占用时的错误提示。
- 启动/停止状态一致性。
- Claude 兼容客户端可正常请求与流式返回。
- OpenAI 客户端仅支持 `/v1/responses` 的行为一致性。
- 配置文件与日志目录是否同落在 `%APPDATA%\.kiro-account-manager`。

## 研发文档与发布
- 持续维护需求、设计、实现回填三段内容的一致性，避免“代码已更新、章节仍停留在计划时态”。
- 提供 Claude Code 等客户端的最小接入示例，但以研发验证为目的，不把本文档扩展成用户手册。
- 发布前同步版本号（`package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`）。

## packages/kiro-agent/dist 模块分析（2026-03-17）

> 路径：`C:\Users\12925\AppData\Local\Programs\Kiro\resources\app\extensions\kiro.kiro-agent\packages\kiro-agent\dist\`

### 模块依赖图（核心执行链）

```
q-client
  └─ 工厂单例，setQClientFactory() 注入实现，createQDeveloperConverse() 创建实例

q-developer-converse
  ├─ 依赖：shared-types, stream, telemetry
  ├─ _convertMessages(messages)：将 Anthropic messages 转为 conversationState
  │    user → userInputMessage（origin: AI_EDITOR, chatTriggerType: MANUAL）
  │    assistant → assistantResponseMessage（仅 content）
  │    conversationId 默认 crypto.randomUUID()
  └─ convertToGenerateAssistantMessages(messages, tools, modelId)：
       完整映射含 toolUses / toolResults / reasoningContent
       最后一条 user 消息写入 userInputMessageContext.tools
       优先复用历史 additional_kwargs.conversationId
       user content 仅拼接 text 块，image/document 会拆到 images/documents
       reasoningContent 仅在 reasoningModelId 与当前 modelId 一致时透传

chat-agent
  ├─ 依赖：shared-types, token-monitor, context-chat-message
  └─ 主对话 Agent，负责 Chat 会话生命周期管理

sub-agent
  ├─ 依赖：telemetry, shared-types, token-monitor, context-chat-message
  └─ 子任务 Agent，在 Autopilot/Supervised 模式下并发执行

token-monitor
  ├─ 依赖：stream, transformers, context-chat-message
  └─ 监控 Token 用量，触发 contextUsagePercentage 事件

orchestrator-prompt
  └─ 生成 Spec/Vibe 工作流决策提示词，含 Mermaid 流程图模板

spec-agent
  └─ 轻量 getter/setter：getLastUserMessage / mapChatMessagesToExecutionIds / mapExecutionIdsToMessages

session
  └─ 仅判断 session 类型是否为 ["vibe", "spec"]

intent-detection-service
  ├─ 依赖：telemetry, shared-types, stream
  └─ 检测用户意图（UserIntent 枚举），影响 chatTriggerType / userIntent 字段
```

### shared-types 关键枚举

- `AutonomyMode`：`Autopilot` / `Supervised`
- `TaskStatus`：`not_started` / `queued` / `in_progress` / `completed`
- `FileEdited`（事件类型之一）

### 对代理实现的影响

- `q-client` 是全局单例工厂，代理层只需在初始化时调用 `setQClientFactory()` 注入自定义实现，即可拦截所有 LLM 调用。
- `_convertMessages` 与 `convertToGenerateAssistantMessages` 是消息格式转换的两条路径：前者用于普通 Chat，后者用于含工具调用的 Agent 模式。
- `AutonomyMode` 决定 `x-amzn-kiro-agent-mode` header 的值（`Autopilot` / `Supervised`）。
- `token-monitor` 订阅 `contextUsageEvent`，可用于代理层的配额预警与账号切换触发。
- 模型值存储层面要区分两种语义：
  - IDE 配置与 session config 里存的是 raw `modelId`
  - Kiro 内部 runtime 才会临时拼成 `qdev::modelId`
- `ListAvailableModels` 的本地消费不是“拿到一串名字就结束”，而是依赖 `modelId/modelName/description/rateMultiplier/rateUnit/tokenLimits.maxInputTokens/defaultModel` 这组字段；网关若自行构造模型列表，至少要满足这一层语义。

## 第二批模块分析（2026-03-17）

### types-core
两个核心枚举：
- `AgentType`：`mocked-agent` / `chat-agent` / `spec-generation` / `sub-agent` / `hook-command`
- `ExecutionStatus`：`queued` / `running` / `failed` / `aborted` / `succeed` / `yielded`
- `AutonomyMode`：`Autopilot` / `Supervised`

### actions
提供四个判断函数：
- `isFileAction`：actionType 属于 create/append/write/replace/editCode/delete
- `isMoveAction`：actionType === move
- `isSemanticRenameAction`：actionType === semanticRename
- `isRemoteAction`：actionType 以 remote_ 开头

### autonomy-mode
纯代理模式（工厂注入），`getAutonomyMode()` 默认返回 `Supervised`，通过 `setAutonomyModeProvider()` 注入实现。

### telemetry
指标上报抽象层，`MetricReporter` 接口支持 histogram、count、wrapMetrics、wrapTrace 等装饰器模式。`NoopMetricReporter` 作为默认实现，工厂通过 `setMetricReporterFactory()` 注入。另有 `UsageReporter` 独立负责用量上报。

### transformers
消息规范化工具：将相邻同类型消息合并（consecutive message merging），支持 human/ai/system/developer/tool/function/generic/remove 全部角色类型。用于向 LLM 发送前的消息链整理。

### context-chat-message（核心数据结构）
`ContextChatMessage` 是整个 Agent 的消息载体，不可变对象，通过链式 `withXxx()` 方法构建：
- `withText()` / `withDocument()` / `withToolDefinition()` / `withToolUse()` / `withToolUseResponse()`
- `withReasoningContent()` 支持 extended thinking，携带 signature 和 modelId
- `withAgentInvoke()` 标记 sub-agent 调用
- `pruneDocsIfNecessary()` 自动裁剪文件上下文（MAX_FILE_COUNT=30，MAX_FILE_LENGTH_CHARS=300000）
- 内置 XML 序列化（`formatToolError`/`formatToolSuccess` 等），用于构建 prompt 中的 tool 历史
- `we()` 函数渲染 user-rule，注入 steering 规则到 system prompt
- `InvalidMessageRoleError` / `InvalidDocumentPathError` 是两个 session 级错误，携带 `userFacingSessionErrorMessage`

### session
极简模块：`isAgentSession(type)` 判断 session 类型是否为 `vibe` 或 `spec`。

### 依赖关系图（目前已确认）
```
chat-agent / sub-agent
  → token-monitor
  → context-chat-message
  → shared-types
  → stream
  → telemetry
  → q-developer-converse → q-client（工厂）
autonomyMode → types-core
actions（独立工具函数）
transformers → stream（消息类型）
```

## 第三批模块分析（2026-03-17）

### types-CkvOiUfs
Zod v4 扩展包，在 base 的 Zod 核心之上添加了 ISO 时间格式（ZodISODateTime/Date/Time/Duration）。整个 types 体系：base → string → types-core → types-CkvOiUfs。

### prompts（系统 Prompt 完整结构）
Kiro agent 的 system prompt 由 `buildBaseSystemPrompt(context)` 动态生成，包含以下块：
- `<identity>`：自我介绍为 Kiro，AI assistant & IDE，托管于 autonomous process，由 human 监督
- `<capabilities>`：文件系统读写、shell 命令、web 工具、context-gatherer subagent、代码测试调试等
- `<response_style>`：不用 markdown header（除非多步骤）、不加粗、极简总结、优先 actionable 信息、口语化、不重复
- `<coding_questions>`：技术语言、完整可运行示例、accessibility 合规
- `<rules>`：安全规则、PII 替换、拒绝恶意代码、不讨论 AWS 实现细节；关键工具规则：preferring `readCode` over `readFile`，允许 content pruning（skipPruning=false by default）
- `<key_kiro_features>`：autonomy modes（Autopilot/Supervised）、#File #Folder context、workspace rules
- 平台检测：Windows 用 PowerShell，macOS/Linux 用 bash，shell 类型通过 `terminal.getShellTypeInfo()` 获取
- 模型配置通过 `getModelConfig()` 注入，终端信息通过 `terminal.getShellTypeInfo()` 注入

### pruning-service（关键 LLM 二次调用）
`PruningService` 是一个静态类，用于在将文件内容注入 context 之前对其进行 LLM 驱动的裁剪：
- **模型**：`CLAUDE_HAIKU_4_5_20251001_V1_0`，通过 `qdev` provider 调用
- **触发条件**：token >= 1250（约5000字符），且 `filePruning` feature flag 开启
- **流程**：token 估算 → 构建带行号的 pruning prompt → LLM 返回 JSON line ranges → 提取指定行段 → 拼接（省略部分用 `⋮ [content omitted by pruning]` 标记）
- **内容类型**：code / shell_output / directory_listing / search_results / plain_text，每种类型有独立的 pruning guidelines
- **防回退保护**：若 pruned token >= original token，直接返回原始内容
- **指标上报**：PruningSuccess/Skipped/Failure/NegativeReduction/LowEffectiveness 等精细 telemetry

### 关键发现：Kiro 的双层 LLM 调用架构
```
用户请求
  └─► chat-agent / sub-agent（主 LLM：claude-sonnet-4.x）
        └─► tool 执行前：PruningService（辅助 LLM：claude-haiku-4.5）
              ├── 对 readFile 内容裁剪
              ├── 对 shell_output 裁剪
              └── 对 directory_listing 裁剪
```
这意味着实现完整代理能力需要两个 LLM 调用信道。

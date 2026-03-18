# Kiro API 网关实现规划

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
│      POST /v1/chat/completions → handle_openai                                         │
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

---

## 阶段一：Rust 后端

### 1. Cargo.toml 新增依赖
- `axum = "0.8"`
- `tokio-stream`
- `futures-util`（流处理）

### 2. 新建 `src-tauri/src/gateway/mod.rs`

核心模块，包含：
- `GatewayConfig`：`{ enabled, host, port, access_token: Option<String>, region }`
- `GatewayHandle`：持有 axum server 的 abort handle
- `start_gateway(config, app_state)` → 启动 axum server，绑定端口，返回 handle
- `stop_gateway(handle)`

### 3. 新建 `src-tauri/src/gateway/router.rs`

axum 路由：
- `POST /v1/messages` → Anthropic Messages API 兼容入口
- `GET /v1/models` → 返回固定模型列表
- `GET /health` → 健康检查

请求鉴权：若配置了 `access_token`，校验 `Authorization: Bearer <token>`。

### 4. 新建 `src-tauri/src/gateway/converter.rs`

AnthropicRequest → CodeWhisperer conversationState 转换：
- `messages` 最后一条 role=user → `currentMessage.userInputMessage`
- 其余 messages → `history[]`
- assistant messages → `assistantResponseMessage { content }`
- `tool_use` blocks → `toolUseEvent` 结构
- `tool_result` → `userInputMessageContext.toolResults[]`
- `tools[]` → `userInputMessageContext.tools[]`
- `system` → 拼入 `userInputMessage.content` 开头
- `max_tokens` / `temperature` → 忽略（CodeWhisperer 不支持）

### 5. 新建 `src-tauri/src/gateway/stream.rs`

CodeWhisperer 事件流 → Anthropic SSE 转换：
- `assistantResponseEvent.content` → `content_block_delta` (text_delta)
- `toolUseEvent` → `content_block_start` (tool_use) + `content_block_delta` (input_json_delta)
- `reasoningContentEvent.text` → `content_block_delta` (thinking_delta)
- `messageMetadataEvent.conversationId` → 记录，可选写入响应 header
- 流结束 → `message_delta` (stop_reason=end_turn) + `message_stop`
- 错误映射：`AccessDeniedException` → 403，`ThrottlingException` → 429，`InvalidStateEvent` → 400

非流式模式：聚合全部 content 块，返回单个 Anthropic response JSON。

### 6. AppState 扩展（`state.rs`）

加入 `pub gateway: Mutex<Option<GatewayHandle>>`。

### 7. 新增 Tauri commands（`commands/gateway_cmd.rs`）

- `start_gateway(config: GatewayConfig)`
- `stop_gateway()`
- `get_gateway_status()` → `{ running, port, request_count, last_error }`
- `get_gateway_config()` / `save_gateway_config(config)`

### 8. 认证注入

```
get_kiro_local_token()
  → access_token → Authorization: Bearer <token>
  → profile_arn（social）或从 ProfileStorage 获取
  → region（IdC）或默认 us-east-1
```

---

## 阶段二：前端

### 9. 新建 `src/components/features/GatewayPage.jsx`

风格与 Settings 页一致，使用 Mantine 组件 + `colors` token，布局/间距/排版全部用 Tailwind v4 utility class，不写额外 CSS，不做 i18n，直接中文。

布局分左右两栏：

**左栏（配置区）**
- 端口输入框（默认 8765）
- 访问令牌输入框（可选，用于校验客户端请求，留空则不鉴权）
- region 下拉（默认 us-east-1）
- 启动/停止按钮（运行中时红色停止，停止时绿色启动，异步操作期间 disabled + spinner）

**右栏（状态区）**
- 状态指示灯（绿点=运行中 / 红点=已停止）+ 端口 + 请求计数
- 最近 5 条错误日志列表（`font-mono text-xs`）
- 一键复制区块：展示 `ANTHROPIC_BASE_URL` 和 `ANTHROPIC_API_KEY` 两行配置，点击按钮写剪贴板

页面顶部一行说明：「本地代理仅转发至 Kiro API，不经过任何第三方服务器。」

### 10. 注册路由与导航

- `routes.jsx` 添加 `/gateway`
- 侧边栏添加入口

---

## 阶段三：配置持久化

### 11. 配置读写

- 存储路径：app data 目录下 `gateway-config.json`
- 应用启动时读取，`enabled: true` 则自动启动

---

## 暂不实现


- `cachePoint` / `clientCacheConfig`
- MCP 透传

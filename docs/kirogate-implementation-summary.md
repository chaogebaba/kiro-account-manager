# KiroGate 实现总结

## 项目概述

**位置**: `E:\VSCodeSpace\Kiro\kiro-gateway`

这是一个 Rust 实现的 Kiro API 网关，提供 OpenAI/Anthropic 兼容接口。

## 技术栈

- **语言**: Rust
- **Web 框架**: Axum
- **前端**: React + Vite
- **特性**: 多账号轮询、Token 自动刷新、流式响应

## 核心功能

### 1. API 兼容性
- ✅ OpenAI 格式：`/v1/chat/completions`
- ✅ Anthropic 格式：`/v1/messages`
- ✅ 流式响应支持
- ✅ 工具调用支持
- ✅ 图片支持
- ✅ Thinking block 支持

### 2. 账号管理
- 多账号轮询
- 自动 Token 刷新
- 限流跳过
- 过期标记
- 支持 IDC（企业）和 Social（个人）账号

### 3. 模型映射
```
gpt-4 / gpt-4o → claude-sonnet-4.5
gpt-3.5-turbo → claude-haiku-4.5
claude-3-5-sonnet → claude-sonnet-4.5
claude-3-opus → claude-opus-4.5
auto / kiro → auto
```

## 文件结构

```
kiro-gateway/
├── src/
│   ├── main.rs           # 入口
│   ├── account.rs        # 账号管理
│   ├── config.rs         # 配置
│   ├── converter.rs      # 格式转换
│   ├── error.rs          # 错误处理
│   ├── kiro_client.rs    # Kiro API 客户端
│   └── models.rs         # 数据模型
├── web/                  # Web 管理界面
├── data/                 # 数据目录
│   └── accounts.json     # 账号配置
└── docs/                 # 文档
```

## 与本项目的关系

### 相似之处
1. **都是 Rust + Axum** 实现
2. **都支持 Anthropic 格式** 的 `/v1/messages` 端点
3. **都实现了流式响应** 处理
4. **都支持多账号管理**

### 差异点
1. **kiro-gate**: 独立的 API 网关服务
2. **本项目**: Tauri 桌面应用，KiroGate 是内置功能模块

### 可参考的实现

#### 1. Thinking Block 支持
- kiro-gateway 已实现 Thinking block 解析
- 可参考其实现方式

#### 2. 工具调用处理
- 完整的工具调用流式响应
- 去重逻辑

#### 3. 账号轮询策略
- 限流检测
- 自动切换
- 冷却时间

## 环境变量

```bash
HOST=127.0.0.1          # 监听地址
PORT=8080               # 监听端口
API_KEY=xxx             # 访问密钥（可选）
ACCOUNTS_FILE=data/accounts.json  # 账号文件
RUST_LOG=kiro_gate=info # 日志级别
```

## 账号配置格式

### IDC 账号（企业）
```json
{
  "id": "my-account",
  "email": "user@example.com",
  "accessToken": "aoaAAAAA...",
  "refreshToken": "aorAAAAA...",
  "clientId": "CEiGMN1o...",
  "clientSecret": "eyJraWQi...",
  "region": "us-east-1",
  "status": "active"
}
```

### Social 账号（个人）
```json
{
  "id": "my-account",
  "email": "user@example.com",
  "accessToken": "aoaAAAAA...",
  "refreshToken": "aorAAAAA...",
  "status": "active"
}
```

## 使用方式

### 编译运行
```bash
cargo build --release
./target/release/kiro-gateway
```

### 调用示例
```bash
# OpenAI 格式
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}],"stream":true}'

# Anthropic 格式
curl http://localhost:8080/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}],"stream":true}'
```

## ✅ 已完成的移植工作（Kiro Account Manager）

### 1. Thinking Parser ✅
- **文件**: `src-tauri/src/kiro_gate/thinking_parser.rs`
- **功能**: 解析 `<thinking>...</thinking>` 标签，转换为 Anthropic Extended Thinking 格式
- **状态**: 已集成到 `server.rs` 的流式响应处理中
- **验证**: 与 Kiro IDE 源码对比，实现完全一致

### 2. WebSearch ✅
- **文件**: `src-tauri/src/kiro_gate/websearch.rs`
- **功能**: 拦截 Anthropic WebSearch 请求，调用 Kiro MCP API
- **状态**: 已集成到 `server.rs` 的请求处理中

### 3. signature_delta 支持 ✅
- **实现方式**: 透传机制（Kiro API 返回什么就转发什么）
- **说明**: Kiro API 目前不返回 signature 数据，如果未来支持，我们的代码无需修改

## 📋 kiro-gateway 项目状态

**项目位置**: `E:\VSCodeSpace\Kiro\kiro-gateway`（独立的 Rust API 网关项目）

### 已完成
- ✅ 复制 `thinking_parser.rs` 到 `src/`
- ✅ 复制 `websearch.rs` 到 `src/`
- ✅ 在 `main.rs` 中添加模块声明

### 待完成（需要手动集成）
- ⚠️ 在 `messages` 函数中集成 ThinkingParser
- ⚠️ 在 `messages` 函数中集成 WebSearch 检测
- ⚠️ 测试编译和运行

### 说明
kiro-gateway 已有基础的 thinking 和 signature 处理，但使用的是简单的字段判断方式。新的 ThinkingParser 提供了更完善的解析逻辑（处理引号、代码块等边界情况）。如需使用，需要参考本项目的 `server.rs` 集成方式。

## 下一步计划

### 需要从 kiro-gate 移植的功能
- [ ] 账号轮询策略
- [ ] 限流检测和自动切换
- [ ] 更完善的错误处理

### 需要增强的功能
- [ ] Web 管理界面集成到 Tauri
- [ ] 实时日志查看
- [ ] 请求统计和监控
- [ ] 账号健康度检测

## 参考资源

- **项目地址**: `E:\VSCodeSpace\Kiro\kiro-gateway`
- **KiroGate Python**: `E:\VSCodeSpace\Kiro\KiroGate`
- **Kiro IDE 源码**: `C:\Users\12925\AppData\Local\Programs\Kiro`
- **源码分析**: `E:\VSCodeSpace\Kiro\kiro-source-analysis`

## License

MIT

# Kiro IDE 自定义模型提供者分析

## 版本信息
- **Kiro IDE 版本**: v0.9.2
- **分析日期**: 2026-02-09
- **源码文件**: `C:\Users\12925\AppData\Local\Programs\Kiro\resources\app\extensions\kiro.kiro-agent\dist\extension.js`

## 🎯 核心发现（TL;DR）

✅ **Kiro IDE 确实支持直接转发到 Anthropic 官方 API！**

**关键信息**：
- 通过 LangChain 的 `ChatAnthropic` 类实现
- 使用 Anthropic SDK 直接调用 `https://api.anthropic.com`
- 需要设置 `ANTHROPIC_API_KEY` 环境变量
- **不经过** AWS CodeWhisperer，**不需要** kiro-gateway

**kiro-gateway 的价值**：
- 主要场景：AWS 用户想用 Anthropic 官方 API，但不想设置环境变量
- 企业场景：统一管理 API Key、监控使用量、成本控制
- 非必需场景：个人用户已有 Anthropic API Key

---

## 模型提供者架构

### 1. 支持的提供者列表

Kiro IDE 通过 LangChain 集成支持以下模型提供者：

| Provider | 说明 | API 端点 |
|----------|------|----------|
| `bedrock` | AWS Bedrock (默认凭证) | AWS Bedrock API |
| `kiro` | AWS Bedrock (Kiro 凭证) | AWS Bedrock API |
| `ollama` | Ollama 本地模型 | Ollama API |
| `openai` | OpenAI 官方 API | OpenAI API |
| **`anthropic`** | **Anthropic 官方 API** | **`https://api.anthropic.com`** |
| `Q_CLIENT_NAMESPACE` | AWS Q Developer | AWS CodeWhisperer API |

### 2. 核心代码位置

**文件**: `extension.js`  
**行号**: 686194-686244

**关键函数**: `loadModel(provider, model, mode, options2)`

```javascript
async function loadModel(provider, model, mode, options2) {
  const providerModel = `${provider}::${model}:${mode}`;
  
  // 缓存检查
  const value = clients.get(providerModel);
  if (value) {
    return value;
  }
  
  // 加载模型
  const client2 = await loadModelUncached(provider, model, mode, options2);
  clients.set(providerModel, client2);
  return client2;
}
```

### 3. Anthropic 提供者实现

**行号**: 686235-686238

```javascript
case "anthropic": {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return new ChatAnthropic({ ...commonParameters, apiKey });
}
```

**关键点**：
- ✅ 使用 LangChain 的 `ChatAnthropic` 类
- ✅ 从环境变量 `ANTHROPIC_API_KEY` 读取 API 密钥
- ✅ 直接调用 Anthropic 官方 API (`https://api.anthropic.com`)
- ✅ 不经过 AWS CodeWhisperer

## Anthropic SDK 集成

### 1. SDK 位置

**行号**: 651782-651808

```javascript
/**
 * API Client for interfacing with the Anthropic API.
 *
 * @param {string | null | undefined} [opts.apiKey=process.env['ANTHROPIC_API_KEY'] ?? null]
 * @param {string | null | undefined} [opts.authToken=process.env['ANTHROPIC_AUTH_TOKEN'] ?? null]
 * @param {string} [opts.baseURL=process.env['ANTHROPIC_BASE_URL'] ?? https://api.anthropic.com]
 */
constructor({ 
  baseURL = readEnv("ANTHROPIC_BASE_URL"), 
  apiKey = readEnv("ANTHROPIC_API_KEY") ?? null, 
  authToken = readEnv("ANTHROPIC_AUTH_TOKEN") ?? null, 
  ...opts 
} = {}) {
  const options2 = {
    apiKey,
    authToken,
    ...opts,
    baseURL: baseURL || `https://api.anthropic.com`
  };
  // ...
}
```

### 2. 支持的环境变量

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 | `null` |
| `ANTHROPIC_AUTH_TOKEN` | Anthropic 认证 Token | `null` |
| `ANTHROPIC_BASE_URL` | Anthropic API 基础 URL | `https://api.anthropic.com` |

### 3. LangChain 集成

**行号**: 653380-653382

```javascript
this.anthropicApiKey = fields?.apiKey ?? fields?.anthropicApiKey ?? 
  getEnvironmentVariable2("ANTHROPIC_API_KEY");

if (!this.anthropicApiKey && !fields?.createClient) {
  throw new Error("Anthropic API key not found");
}

// 创建 Anthropic SDK 客户端
this.createClient = fields?.createClient ?? ((options2) => new Anthropic(options2));
```

### 4. 实际 API 调用

**行号**: 653608-653625

```javascript
async createStreamWithRetry(request5, options2) {
  if (!this.streamingClient) {
    const options_ = this.apiUrl ? { baseURL: this.apiUrl } : void 0;
    this.streamingClient = this.createClient({
      dangerouslyAllowBrowser: true,
      ...this.clientOptions,
      ...options_,
      apiKey: this.apiKey,  // ← ANTHROPIC_API_KEY
      maxRetries: 0
    });
  }
  
  const makeCompletionRequest = async () => {
    try {
      // ✅ 调用 Anthropic 官方 API
      return await this.streamingClient.messages.create({
        ...request5,
        ...this.invocationKwargs,
        stream: true
      }, options2);
    } catch (e8) {
      const error11 = wrapAnthropicClientError(e8);
      throw error11;
    }
  };
  return this.caller.call(makeCompletionRequest);
}
```

**关键点**：
- ✅ `this.streamingClient` 是 Anthropic SDK 客户端
- ✅ 调用 `messages.create()` 方法
- ✅ 这是 Anthropic 官方 API 的标准调用方式
- ✅ 默认 baseURL 是 `https://api.anthropic.com`

## 使用方式

### 1. 配置环境变量

用户需要设置环境变量：

```bash
# Windows (PowerShell)
$env:ANTHROPIC_API_KEY = "sk-ant-xxxxx"

# Windows (CMD)
set ANTHROPIC_API_KEY=sk-ant-xxxxx

# Linux/macOS
export ANTHROPIC_API_KEY=sk-ant-xxxxx
```

**重要**：需要在启动 Kiro IDE **之前**设置环境变量，或者在系统环境变量中设置。

### 2. 配置 Kiro IDE

在 Kiro IDE 的设置中配置自定义模型：

**方式 1：通过 UI 配置**
1. 打开 Kiro IDE 设置
2. 找到 "Model Configuration" 或 "Custom Models"
3. 添加新模型：
   - Provider: `anthropic`
   - Model: `claude-opus-4.6` (或其他 Claude 模型)
   - API Key: 从环境变量读取

**方式 2：通过配置文件**

编辑 Kiro IDE 配置文件（通常在 `~/.kiro/settings.json` 或工作区配置）：

```json
{
  "models": [
    {
      "provider": "anthropic",
      "model": "claude-opus-4.6",
      "apiKey": "${ANTHROPIC_API_KEY}"
    }
  ]
}
```

### 3. 验证配置

启动 Kiro IDE 后，检查是否能正常使用：

1. 在 Kiro IDE 中选择 Anthropic 模型
2. 发送测试消息
3. 如果配置正确，应该能收到 Claude 的响应

**常见错误**：
- `Anthropic API key not found` → 环境变量未设置或 Kiro IDE 启动前未加载
- `401 Unauthorized` → API Key 无效
- `429 Too Many Requests` → 超过 Anthropic 配额限制

### 3. 完整调用链路

```
用户输入
  ↓
Kiro IDE Agent
  ↓
loadModel("anthropic", "claude-opus-4.6", "chat")  [行 686194]
  ↓
new ChatAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })  [行 686236]
  ↓
ChatAnthropic.constructor()  [行 653243]
  ├─ this.anthropicApiKey = getEnvironmentVariable("ANTHROPIC_API_KEY")  [行 653380]
  └─ this.createClient = (options) => new Anthropic(options)  [行 653387]
  ↓
ChatAnthropic._streamResponseChunks()  [行 653520]
  ↓
ChatAnthropic.createStreamWithRetry()  [行 653608]
  ├─ this.streamingClient = this.createClient({
  │    apiKey: this.apiKey,  // ANTHROPIC_API_KEY
  │    baseURL: this.apiUrl || "https://api.anthropic.com"
  │  })  [行 653611-653618]
  └─ this.streamingClient.messages.create({ stream: true })  [行 653621]
  ↓
Anthropic SDK (BaseAnthropic)  [行 651787]
  ├─ baseURL: "https://api.anthropic.com"  [行 651803]
  └─ apiKey: ANTHROPIC_API_KEY  [行 651785]
  ↓
HTTPS POST https://api.anthropic.com/v1/messages
  ↓
Claude API 响应
  ↓
返回给用户
```

**关键点**：
- ❌ **不经过** AWS CodeWhisperer
- ❌ **不经过** Kiro Gateway
- ✅ **直接调用** Anthropic 官方 API (`https://api.anthropic.com`)
- ✅ 使用 Anthropic SDK 的标准 `messages.create()` 方法

## 与 kiro-gateway 的关系

### 场景 1：使用 AWS CodeWhisperer（默认）

```
Kiro IDE → AWS CodeWhisperer → Claude (通过 AWS Bedrock)
```

**kiro-gateway 的作用**：
- 拦截 AWS CodeWhisperer 请求
- 转发到 Anthropic 官方 API
- 返回响应给 Kiro IDE

### 场景 2：使用 Anthropic 提供者（自定义）

```
Kiro IDE → Anthropic 官方 API (直接)
```

**kiro-gateway 的作用**：
- ❌ **不需要** kiro-gateway
- ✅ Kiro IDE 直接调用 Anthropic API
- ✅ 用户需要自己提供 `ANTHROPIC_API_KEY`

## 对比分析

| 维度 | AWS CodeWhisperer 路径 | Anthropic 提供者路径 |
|------|------------------------|----------------------|
| **API 端点** | AWS CodeWhisperer | `https://api.anthropic.com` |
| **认证方式** | AWS SSO / Builder ID | Anthropic API Key |
| **是否需要 kiro-gateway** | ✅ 需要（如果要用官转） | ❌ 不需要 |
| **消息格式** | CodeWhisperer 格式 | Anthropic 原生格式 |
| **配额限制** | AWS 配额 | Anthropic 配额 |
| **用户体验** | 无需额外配置 | 需要设置环境变量 |
| **成本** | AWS 计费 | Anthropic 直接计费 |
| **模型选择** | 受 AWS 限制 | 所有 Anthropic 模型 |

## 使用场景建议

### 场景 1：使用 AWS 账号 + 想用 Anthropic 官方 API

**推荐方案**：使用 kiro-gateway

```
用户 → Kiro IDE (AWS CodeWhisperer) → kiro-gateway → Anthropic API
```

**优点**：
- ✅ 无需设置 `ANTHROPIC_API_KEY`
- ✅ 使用现有的 AWS 登录
- ✅ kiro-gateway 自动转换消息格式
- ✅ 用户体验最佳

**缺点**：
- ❌ 需要部署 kiro-gateway
- ❌ 多一层代理

### 场景 2：已有 Anthropic API Key

**推荐方案**：直接使用 `anthropic` 提供者

```
用户 → Kiro IDE (anthropic provider) → Anthropic API
```

**优点**：
- ✅ 不需要 kiro-gateway
- ✅ 直连 Anthropic API，延迟更低
- ✅ 配置简单（只需设置环境变量）

**缺点**：
- ❌ 需要单独购买 Anthropic API 配额
- ❌ 需要设置环境变量

### 场景 3：企业用户 + 统一管理

**推荐方案**：使用 kiro-gateway + 企业 Anthropic 账号

```
多个用户 → Kiro IDE (AWS) → kiro-gateway (企业 API Key) → Anthropic API
```

**优点**：
- ✅ 统一管理 API Key
- ✅ 用户无需配置
- ✅ 可以监控和限制使用量

**缺点**：
- ❌ 需要维护 kiro-gateway 服务

## 结论

### 1. Kiro IDE 支持官转

✅ **是的**，Kiro IDE 通过 LangChain 集成支持直接转发到 Anthropic 官方 API。

**实现方式**：
- 使用 LangChain 的 `ChatAnthropic` 类
- 通过 Anthropic SDK 调用官方 API
- 支持所有 Anthropic 模型（Claude 3.5 Sonnet、Opus、Haiku 等）

### 2. 使用条件

用户需要：
1. ✅ 设置 `ANTHROPIC_API_KEY` 环境变量
2. ✅ 在 Kiro IDE 中选择 `anthropic` 作为模型提供者
3. ✅ 拥有 Anthropic API 账号和配额

### 3. kiro-gateway 的定位与价值

#### 主要价值场景

**场景 A：AWS 用户想用 Anthropic 官方 API**
- 用户已经用 AWS 账号登录 Kiro IDE
- 想使用 Anthropic 官方 API 而非 AWS Bedrock
- **不想**设置额外的环境变量和 API Key

**kiro-gateway 的作用**：
```
AWS CodeWhisperer 请求 → kiro-gateway → Anthropic API
```
- ✅ 无缝转换：用户无感知
- ✅ 统一认证：使用 AWS 登录
- ✅ 简化配置：无需设置 `ANTHROPIC_API_KEY`

#### 次要价值场景

**场景 B：企业统一管理**
- 企业有统一的 Anthropic API 账号
- 多个开发者使用 Kiro IDE
- 需要统一管理和监控 API 使用量

**kiro-gateway 的作用**：
- ✅ 集中管理 API Key
- ✅ 监控和限制使用量
- ✅ 成本控制和分摊

#### 非必需场景

**场景 C：个人用户 + 已有 Anthropic API Key**
- 用户已经有 Anthropic API Key
- 愿意设置环境变量
- 不介意直接配置 Kiro IDE

**建议**：直接使用 `anthropic` 提供者，**不需要** kiro-gateway

### 4. 项目定位建议

**kiro-gateway 的核心价值**：
1. ✅ **降低使用门槛**：AWS 用户无需额外配置即可使用 Anthropic API
2. ✅ **企业级管理**：统一管理 API Key 和使用量
3. ✅ **无缝体验**：用户无感知的 API 转换

**不是必需的场景**：
- ❌ 用户已有 Anthropic API Key 且愿意配置
- ❌ 个人开发者，不需要统一管理

**项目 Slogan 建议**：
> "让 AWS 用户无缝使用 Anthropic 官方 API"

### 5. 技术实现对比

| 方案 | 实现复杂度 | 用户体验 | 适用场景 |
|------|-----------|---------|---------|
| **kiro-gateway** | 中等（需要部署服务） | ⭐⭐⭐⭐⭐ 最佳 | AWS 用户、企业用户 |
| **anthropic 提供者** | 简单（只需设置环境变量） | ⭐⭐⭐ 一般 | 个人用户、已有 API Key |
| **AWS Bedrock** | 简单（Kiro IDE 默认） | ⭐⭐⭐⭐ 良好 | AWS 用户、不介意用 Bedrock |

### 6. 最终建议

**对于 kiro-gateway 项目**：
- ✅ 继续开发和维护
- ✅ 定位为"AWS 用户的 Anthropic 官转工具"
- ✅ 重点优化用户体验和部署便利性
- ✅ 添加企业级功能（监控、限流、成本分析）

**对于用户**：
- 如果用 AWS 账号登录 Kiro IDE → **推荐使用 kiro-gateway**
- 如果有 Anthropic API Key → 可以直接用 `anthropic` 提供者
- 如果不介意用 AWS Bedrock → 使用 Kiro IDE 默认配置

**对于企业**：
- 统一管理需求 → **强烈推荐 kiro-gateway**
- 成本控制需求 → **强烈推荐 kiro-gateway**
- 监控审计需求 → **强烈推荐 kiro-gateway**

## 相关文件

- `extension.js` (行 686194-686244) - 模型加载逻辑
- `extension.js` (行 651782-651808) - Anthropic SDK 初始化
- `extension.js` (行 653380-653382) - LangChain Anthropic 集成

## 更新记录

- 2026-02-09: 创建文档，分析 Kiro IDE v0.9.2 的自定义模型提供者支持

# Kiro IDE + Anthropic 集成方案对比

## 快速决策表

| 你的情况 | 推荐方案 | 是否需要 kiro-gateway |
|---------|---------|---------------------|
| 使用 AWS 账号登录 Kiro IDE | kiro-gateway 官转 | ✅ 需要 |
| 已有 Anthropic API Key | 直接用 `anthropic` 提供者 | ❌ 不需要 |
| 企业统一管理 | kiro-gateway | ✅ 需要 |
| 个人开发者 + 不想配置 | kiro-gateway | ✅ 需要 |
| 个人开发者 + 愿意配置 | 直接用 `anthropic` 提供者 | ❌ 不需要 |

## 三种方案对比

### 方案 1：AWS CodeWhisperer（默认）

```
Kiro IDE → AWS CodeWhisperer → Claude (via AWS Bedrock)
```

**特点**：
- ✅ 无需配置
- ✅ 使用 AWS 登录
- ❌ 使用 AWS Bedrock 的 Claude（可能有延迟）
- ❌ 受 AWS 配额限制

**适用场景**：不介意使用 AWS Bedrock 的用户

---

### 方案 2：kiro-gateway 官转

```
Kiro IDE → AWS CodeWhisperer → kiro-gateway → Anthropic API
```

**特点**：
- ✅ 使用 Anthropic 官方 API
- ✅ 使用 AWS 登录（无需额外配置）
- ✅ 用户无感知
- ❌ 需要部署 kiro-gateway

**适用场景**：
- AWS 用户想用 Anthropic 官方 API
- 企业统一管理
- 不想设置环境变量

**配置步骤**：
1. 部署 kiro-gateway
2. 配置 Anthropic API Key（在 kiro-gateway 中）
3. 正常使用 Kiro IDE（无需额外配置）

---

### 方案 3：Anthropic 提供者（直连）

```
Kiro IDE → Anthropic API (直接)
```

**特点**：
- ✅ 使用 Anthropic 官方 API
- ✅ 直连，延迟最低
- ✅ 不需要 kiro-gateway
- ❌ 需要设置环境变量
- ❌ 需要单独购买 Anthropic API 配额

**适用场景**：
- 已有 Anthropic API Key
- 个人开发者
- 愿意配置环境变量

**配置步骤**：
1. 设置环境变量：`export ANTHROPIC_API_KEY=sk-ant-xxxxx`
2. 在 Kiro IDE 中选择 `anthropic` 提供者
3. 选择 Claude 模型（如 `claude-opus-4.6`）

---

## 详细对比表

| 维度 | 方案 1: AWS CodeWhisperer | 方案 2: kiro-gateway | 方案 3: Anthropic 提供者 |
|------|-------------------------|---------------------|------------------------|
| **API 端点** | AWS CodeWhisperer | Anthropic API | Anthropic API |
| **认证方式** | AWS SSO/Builder ID | AWS SSO/Builder ID | Anthropic API Key |
| **配置复杂度** | ⭐ 最简单 | ⭐⭐ 中等 | ⭐⭐⭐ 较复杂 |
| **用户体验** | ⭐⭐⭐⭐ 良好 | ⭐⭐⭐⭐⭐ 最佳 | ⭐⭐⭐ 一般 |
| **响应延迟** | ⭐⭐⭐ 一般 | ⭐⭐⭐⭐ 良好 | ⭐⭐⭐⭐⭐ 最低 |
| **成本** | AWS 计费 | Anthropic 计费 | Anthropic 计费 |
| **配额限制** | AWS 配额 | Anthropic 配额 | Anthropic 配额 |
| **企业管理** | ❌ 不支持 | ✅ 支持 | ❌ 不支持 |
| **需要部署服务** | ❌ 不需要 | ✅ 需要 | ❌ 不需要 |
| **需要环境变量** | ❌ 不需要 | ❌ 不需要 | ✅ 需要 |

---

## 成本对比

### 方案 1: AWS CodeWhisperer

**计费方式**：AWS 按使用量计费

**优点**：
- 可能有免费额度（AWS Builder ID）
- 统一在 AWS 账单中

**缺点**：
- 可能比 Anthropic 直接购买贵
- 受 AWS 配额限制

### 方案 2 & 3: Anthropic API

**计费方式**：Anthropic 按 Token 计费

**价格**（2024 年）：
- Claude 3.5 Sonnet: $3/MTok (输入), $15/MTok (输出)
- Claude 3 Opus: $15/MTok (输入), $75/MTok (输出)
- Claude 3 Haiku: $0.25/MTok (输入), $1.25/MTok (输出)

**优点**：
- 价格透明
- 按实际使用付费

**缺点**：
- 需要单独管理 Anthropic 账号

---

## 企业场景建议

### 小团队（< 10 人）

**推荐**：方案 3（Anthropic 提供者）

**理由**：
- 配置简单
- 成本可控
- 不需要维护额外服务

### 中型团队（10-50 人）

**推荐**：方案 2（kiro-gateway）

**理由**：
- 统一管理 API Key
- 监控使用量
- 成本分摊

### 大型企业（> 50 人）

**推荐**：方案 2（kiro-gateway）+ 企业级功能

**理由**：
- 集中管理
- 审计和合规
- 成本控制和预算
- 使用量分析

**额外功能建议**：
- 用户级别的配额限制
- 使用量报表和分析
- 成本预警和控制
- 审计日志

---

## 技术实现细节

### 方案 2: kiro-gateway 架构

```
┌─────────────┐
│  Kiro IDE   │
└──────┬──────┘
       │ AWS CodeWhisperer Request
       ↓
┌─────────────────────────────────┐
│      kiro-gateway (Go + Gin)    │
│  ┌───────────────────────────┐  │
│  │ 1. 接收 CodeWhisperer 请求 │  │
│  └───────────┬───────────────┘  │
│              ↓                   │
│  ┌───────────────────────────┐  │
│  │ 2. 转换消息格式            │  │
│  │    CodeWhisperer → Anthropic│  │
│  └───────────┬───────────────┘  │
│              ↓                   │
│  ┌───────────────────────────┐  │
│  │ 3. 调用 Anthropic API     │  │
│  │    使用配置的 API Key      │  │
│  └───────────┬───────────────┘  │
│              ↓                   │
│  ┌───────────────────────────┐  │
│  │ 4. 转换响应格式            │  │
│  │    Anthropic → CodeWhisperer│  │
│  └───────────┬───────────────┘  │
└──────────────┼─────────────────┘
               ↓
       ┌───────────────┐
       │ Anthropic API │
       └───────────────┘
```

### 方案 3: Anthropic 提供者架构

```
┌─────────────┐
│  Kiro IDE   │
│             │
│  ┌────────────────────────┐
│  │ loadModel("anthropic") │
│  └──────────┬─────────────┘
│             ↓
│  ┌────────────────────────┐
│  │  ChatAnthropic         │
│  │  (LangChain)           │
│  └──────────┬─────────────┘
│             ↓
│  ┌────────────────────────┐
│  │  Anthropic SDK         │
│  │  apiKey: ANTHROPIC_API_KEY
│  │  baseURL: api.anthropic.com
│  └──────────┬─────────────┘
└─────────────┼─────────────┘
              ↓
      ┌───────────────┐
      │ Anthropic API │
      └───────────────┘
```

---

## 常见问题

### Q1: 我应该选择哪个方案？

**回答**：
- 如果你用 AWS 账号登录 Kiro IDE，且不想配置环境变量 → **方案 2**
- 如果你已有 Anthropic API Key，且愿意配置 → **方案 3**
- 如果你不介意用 AWS Bedrock → **方案 1**

### Q2: kiro-gateway 是必需的吗？

**回答**：不是必需的。

- 如果你愿意设置 `ANTHROPIC_API_KEY` 环境变量，可以直接用方案 3
- kiro-gateway 的主要价值是**降低使用门槛**和**企业级管理**

### Q3: 方案 2 和方案 3 有什么区别？

**回答**：

| 维度 | 方案 2 (kiro-gateway) | 方案 3 (直连) |
|------|---------------------|--------------|
| 认证 | AWS 登录 | Anthropic API Key |
| 配置 | 无需配置 | 需要设置环境变量 |
| 部署 | 需要部署 kiro-gateway | 不需要 |
| 管理 | 集中管理 | 分散管理 |

### Q4: 如何验证配置是否正确？

**方案 2**：
1. 检查 kiro-gateway 日志
2. 在 Kiro IDE 中发送测试消息
3. 查看是否收到 Claude 响应

**方案 3**：
1. 检查环境变量：`echo $ANTHROPIC_API_KEY`
2. 在 Kiro IDE 中选择 `anthropic` 提供者
3. 发送测试消息

### Q5: 可以同时使用多个方案吗？

**回答**：可以。

- 在 Kiro IDE 中可以配置多个模型提供者
- 用户可以根据需要切换
- 例如：AWS CodeWhisperer 用于日常开发，Anthropic 提供者用于重要任务

---

## 总结

**核心观点**：
1. ✅ Kiro IDE 支持直接调用 Anthropic 官方 API（方案 3）
2. ✅ kiro-gateway 仍然有价值（方案 2），主要用于降低使用门槛和企业管理
3. ✅ 用户可以根据自己的情况选择最合适的方案

**选择建议**：
- **个人用户 + 已有 API Key** → 方案 3
- **个人用户 + 不想配置** → 方案 2
- **企业用户** → 方案 2
- **不介意 AWS Bedrock** → 方案 1

**kiro-gateway 的定位**：
> "让 AWS 用户无缝使用 Anthropic 官方 API"

---

## 相关文档

- [Custom-Model-Provider-Analysis-v0.9.2.md](./Custom-Model-Provider-Analysis-v0.9.2.md) - 详细的源码分析
- [Message-Format-Conversion-Version-Comparison.md](./Message-Format-Conversion-Version-Comparison.md) - 消息格式对比

## 更新记录

- 2026-02-09: 创建文档，对比三种 Kiro + Anthropic 集成方案

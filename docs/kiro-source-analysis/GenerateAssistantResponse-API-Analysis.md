# GenerateAssistantResponse API 分析

## 版本信息
- **Kiro IDE 版本**：v0.9.2
- **分析日期**：2026-02-07
- **源码文件**：`dist/extension.js`
- **代码位置**：行 579131-579221

---

## 一、API 概述

**GenerateAssistantResponse** 是 Kiro IDE 的核心对话接口，用于生成 AI 助手的流式响应。

### 基本信息

| 属性 | 值 |
|------|-----|
| **端点** | `POST /generateAssistantResponse` |
| **协议** | HTTP/REST |
| **编码** | JSON |
| **响应类型** | 流式（Streaming） |
| **所属包** | `@aws/codewhisperer-streaming-client` |

---

## 二、请求实现（Serialization）

### 代码位置
**行号**：579131-579146

### 完整代码

```javascript
var se_GenerateAssistantResponseCommand = async (input, context2) => {
  // 1. 创建请求构建器
  const b8 = (0, core_2.requestBuilder)(input, context2);
  
  // 2. 设置请求头
  const headers2 = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
    "content-type": "application/json",
    [_xakam]: input[_aM]  // x-amzn-kiro-auth-method
  });
  
  // 3. 设置端点路径
  b8.bp("/generateAssistantResponse");
  
  // 4. 序列化请求体
  let body2;
  body2 = JSON.stringify((0, smithy_client_1.take)(input, {
    "conversationState": (_2) => se_ConversationState(_2, context2),
    "profileArn": []
  }));
  
  // 5. 构建 POST 请求
  b8.m("POST").h(headers2).b(body2);
  
  // 6. 返回构建的请求
  return b8.build();
};
```

### 请求参数

```typescript
interface GenerateAssistantResponseRequest {
  conversationState: ConversationState;  // 对话状态
  profileArn: string;                    // 用户配置 ARN
  authMethod?: string;                   // 认证方法（Header）
}

interface ConversationState {
  conversationId: string;                // 对话 ID
  currentMessage: ChatMessage;           // 当前消息
  chatTriggerType?: ChatTriggerType;     // 触发类型
  customizationArn?: string;             // 定制化 ARN
  history?: ChatMessage[];               // 历史消息
}
```

### 请求头

```http
Content-Type: application/json
x-amzn-kiro-auth-method: <auth_method>
```

### 请求体示例

```json
{
  "conversationState": {
    "conversationId": "conv-123456",
    "currentMessage": {
      "userInputMessage": {
        "content": "帮我写一个排序函数",
        "userIntent": "CODE_GENERATION"
      }
    },
    "chatTriggerType": "MANUAL",
    "history": []
  },
  "profileArn": "arn:aws:codewhisperer:us-east-1:123456789:profile/xxx"
}
```

---

## 三、响应实现（Deserialization）

### 代码位置
**行号**：579209-579221

### 完整代码

```javascript
var de_GenerateAssistantResponseCommand = async (output, context2) => {
  // 1. 检查 HTTP 状态码
  if (output.statusCode !== 200 && output.statusCode >= 300) {
    return de_CommandError2(output, context2);
  }
  
  // 2. 构建响应对象
  const contents2 = (0, smithy_client_1.map)({
    $metadata: deserializeMetadata2(output),
    [_cI3]: [, output.headers[_xacci]]  // conversationId from header
  });
  
  // 3. 解析响应体（流式）
  const data7 = output.body;
  contents2.generateAssistantResponseResponse = de_ChatResponseStream(data7, context2);
  
  // 4. 返回响应
  return contents2;
};
```

### 响应结构

```typescript
interface GenerateAssistantResponseResponse {
  $metadata: ResponseMetadata;                    // 元数据
  conversationId?: string;                        // 对话 ID（Header）
  generateAssistantResponseResponse: AsyncIterable<ChatResponseStream>;  // 流式响应
}

interface ResponseMetadata {
  httpStatusCode: number;
  requestId?: string;
  attempts?: number;
  totalRetryDelay?: number;
}
```

### 响应头

```http
HTTP/1.1 200 OK
Content-Type: application/vnd.amazon.eventstream
x-amzn-codewhisperer-conversation-id: conv-123456
```

### 流式响应事件

```typescript
type ChatResponseStream = 
  | AssistantResponseEvent          // 助手响应事件
  | CodeEvent                        // 代码事件
  | SupplementaryWebLinksEvent       // 补充链接事件
  | FollowupPromptEvent              // 后续提示事件
  | IntentsEvent                     // 意图事件
  | InteractionComponentsEvent       // 交互组件事件
  | InvalidStateException            // 无效状态异常
  | ThrottlingException              // 限流异常
  | ValidationException              // 验证异常
  | AccessDeniedException            // 访问拒绝异常
  | ResourceNotFoundException        // 资源未找到异常
  | ConflictException                // 冲突异常
  | InternalServerException          // 内部服务器错误
  | ServiceQuotaExceededException;   // 配额超限异常
```

---

## 四、版本对比

### 出现次数统计

| 版本 | 出现次数 | 说明 |
|------|----------|------|
| v0.8.206 | 35 次 | 包含请求/响应序列化、日志过滤等 |
| v0.9.2 | 35 次 | **无变化** |

### 变化分析

✅ **API 实现完全相同**
- 请求序列化逻辑：无变化
- 响应反序列化逻辑：无变化
- 端点路径：无变化（`/generateAssistantResponse`）
- 请求方法：无变化（`POST`）
- 流式响应处理：无变化

---

## 五、相关 API 对比

### 1. GenerateAssistantResponse（对话）

```javascript
// 端点
b8.bp("/generateAssistantResponse");

// 请求参数
{
  "conversationState": ConversationState,
  "profileArn": string
}

// 响应
generateAssistantResponseResponse: ChatResponseStream
```

### 2. GenerateTaskAssistPlan（任务规划）

```javascript
// 端点
b8.bp("/generateTaskAssistPlan");

// 请求参数
{
  "conversationState": ConversationState,
  "profileArn": string,
  "workspaceState": WorkspaceState
}

// 响应
planningResponseStream: ChatResponseStream
```

### 3. SendMessage（发送消息）

```javascript
// 端点
b8.bp("/SendMessageStreaming");

// 请求参数
{
  "conversationState": ConversationState,
  "profileArn": string,
  "dryRun": boolean,
  "source": string
}

// 响应
流式响应
```

### 4. InvokeMCP（调用 MCP）

```javascript
// 端点
b8.bp("/mcp");

// 请求参数
{
  "id": string,
  "jsonrpc": string,
  "method": string,
  "params": SensitiveDocument
}

// 响应
MCP 响应
```

---

## 六、流式响应处理

### ChatResponseStream 解析

```javascript
// 位置：行 579218
contents2.generateAssistantResponseResponse = de_ChatResponseStream(data7, context2);
```

### 流式事件类型

**1. AssistantResponseEvent**
- 助手的文本响应
- 包含消息内容、工具使用、推理内容等

**2. CodeEvent**
- 代码块事件
- 包含生成的代码

**3. SupplementaryWebLinksEvent**
- 补充的网页链接
- 提供参考资料

**4. FollowupPromptEvent**
- 后续提示
- 引导用户继续对话

**5. IntentsEvent**
- 意图识别事件
- 识别用户意图类型

**6. InteractionComponentsEvent**
- 交互组件事件
- 包含任务详情、步骤、进度等

**7. 异常事件**
- InvalidStateException
- ThrottlingException
- ValidationException
- AccessDeniedException
- ResourceNotFoundException
- ConflictException
- InternalServerException
- ServiceQuotaExceededException

---

## 七、敏感数据过滤

### 请求过滤

```javascript
// 位置：行 579038-579044
var GenerateAssistantResponseRequestFilterSensitiveLog = (obj) => ({
  ...obj,
  ...obj.conversationState && {
    conversationState: (0, exports2.ConversationStateFilterSensitiveLog)(obj.conversationState)
  }
});
```

### 响应过滤

```javascript
// 位置：行 579045-579051
var GenerateAssistantResponseResponseFilterSensitiveLog = (obj) => ({
  ...obj,
  ...obj.generateAssistantResponseResponse && {
    generateAssistantResponseResponse: "STREAMING_CONTENT"
  }
});
```

**说明**：
- 请求日志会过滤 `conversationState` 中的敏感信息
- 响应日志会将流式内容替换为 `"STREAMING_CONTENT"` 字符串
- 防止敏感数据泄露到日志中

---

## 八、使用示例

### TypeScript 调用示例

```typescript
import { CodeWhispererStreamingClient, GenerateAssistantResponseCommand } from '@aws/codewhisperer-streaming-client';

// 1. 创建客户端
const client = new CodeWhispererStreamingClient({
  region: 'us-east-1',
  credentials: credentialsProvider
});

// 2. 构建请求
const command = new GenerateAssistantResponseCommand({
  profileArn: 'arn:aws:codewhisperer:us-east-1:123456789:profile/xxx',
  conversationState: {
    conversationId: 'conv-123456',
    currentMessage: {
      userInputMessage: {
        content: '帮我写一个排序函数',
        userIntent: 'CODE_GENERATION'
      }
    },
    chatTriggerType: 'MANUAL',
    history: []
  }
});

// 3. 发送请求并处理流式响应
const response = await client.send(command);

// 4. 处理流式事件
for await (const event of response.generateAssistantResponseResponse) {
  if (event.assistantResponseEvent) {
    console.log('助手响应:', event.assistantResponseEvent);
  } else if (event.codeEvent) {
    console.log('代码:', event.codeEvent);
  } else if (event.followupPromptEvent) {
    console.log('后续提示:', event.followupPromptEvent);
  }
}
```

---

## 九、错误处理

### HTTP 状态码检查

```javascript
if (output.statusCode !== 200 && output.statusCode >= 300) {
  return de_CommandError2(output, context2);
}
```

### 常见错误

| 错误类型 | HTTP 状态码 | 说明 |
|----------|-------------|------|
| **ValidationException** | 400 | 请求参数验证失败 |
| **AccessDeniedException** | 403 | 访问被拒绝 |
| **ResourceNotFoundException** | 404 | 资源未找到 |
| **ConflictException** | 409 | 冲突（如对话已结束） |
| **ThrottlingException** | 429 | 请求过快，被限流 |
| **InternalServerException** | 500 | 内部服务器错误 |
| **ServiceQuotaExceededException** | 503 | 配额超限 |

---

## 十、总结

### 核心特点

1. ✅ **流式响应**：使用 EventStream 协议，实时返回 AI 生成内容
2. ✅ **对话状态管理**：通过 `conversationState` 维护对话上下文
3. ✅ **多种事件类型**：支持文本、代码、链接、提示等多种响应
4. ✅ **敏感数据保护**：自动过滤日志中的敏感信息
5. ✅ **错误处理完善**：支持多种异常类型的流式返回

### 版本稳定性

- ✅ v0.8.206 → v0.9.2：**API 实现完全相同，无任何变化**
- ✅ 端点路径、请求参数、响应结构均保持一致
- ✅ 向后兼容性良好

### 与其他 API 的关系

| API | 用途 | 端点 |
|-----|------|------|
| **GenerateAssistantResponse** | 对话生成 | `/generateAssistantResponse` |
| **GenerateTaskAssistPlan** | 任务规划 | `/generateTaskAssistPlan` |
| **SendMessage** | 发送消息 | `/SendMessageStreaming` |
| **InvokeMCP** | MCP 调用 | `/mcp` |

---

## 十一、相关文档

1. **CodeWhispererRuntimeService API.md** - CodeWhisperer API 完整文档
2. **generateAssistantResponse-projects.md** - 使用该 API 的开源项目汇总
3. **Kiro-v0.9.2-Final-Summary.md** - Kiro v0.9.2 完整变更总结

---

## 十二、更新记录

- 2026-02-07：创建文档，记录 GenerateAssistantResponse API 的完整实现
- 2026-02-07：分析请求序列化、响应反序列化、流式处理、错误处理
- 2026-02-07：对比 v0.8.206 和 v0.9.2，确认无变化

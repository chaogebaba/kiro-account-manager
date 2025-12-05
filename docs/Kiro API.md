# Kiro API 分析

## 概述

Kiro 后端包含以下主要服务：

| 服务 | 协议 | 编码格式 | 用途 | 状态 |
|------|------|----------|------|------|
| **KiroWebPortalService** | Smithy RPC v2 CBOR | CBOR | 用户认证、账户管理、订阅 | ✅ |
| **BigWeaverService** | REST | JSON | Agent 任务、会话、连接管理 | ✅ |
| **TelemetryService** | OTLP over HTTP | JSON | OpenTelemetry 指标/链路追踪 | ✅ |
| **DownloadService** | REST | JSON | IDE 下载元数据 | ✅ |
| **CodeWhispererRuntimeService** | REST | JSON | 代码补全、AI 助手 | ✅ |
| **AWS IAM Identity Center** | REST | JSON | 网页授权、设备授权 | ✅ |
| **AuthDesktopService** | - | - | 桌面端认证 | ⚠️ |

---

# 一、KiroWebPortalService

## 服务信息

- **基础路径**: `https://app.kiro.dev/service/KiroWebPortalService/operation/`
- **协议**: Smithy RPC v2 CBOR
- **编码**: CBOR (Concise Binary Object Representation)

### 通用请求头

```http
Content-Type: application/cbor
Accept: application/cbor
Smithy-Protocol: rpc-v2-cbor
X-CSRF-Token: <csrf_token>
X-Kiro-UserId: <user_id>
X-Kiro-VisitorId: <visitor_id>
```

---

## API 列表

### 1. RefreshToken - 刷新令牌

**端点**: `POST /service/KiroWebPortalService/operation/RefreshToken`

**请求结构**:
```typescript
interface RefreshTokenInput {
  csrfToken: string;  // CSRF 令牌
}
```

**响应结构**:
```typescript
interface RefreshTokenOutput {
  accessToken: string;   // 新的访问令牌
  csrfToken: string;     // 新的 CSRF 令牌
  expiresIn: number;     // 过期时间（秒），通常为 3600
}
```

**CBOR 请求示例**:
```
A1                        # map(1)
   69                     # text(9)
      637372665466F6B656E # "csrfToken"
   78 2C                  # text(44)
      ...                 # <csrf_token_value>
```

---

### 2. InitiateLogin - 发起登录

**端点**: `POST /service/KiroWebPortalService/operation/InitiateLogin`

**请求结构**:
```typescript
interface InitiateLoginInput {
  idp: "Google" | "Github" | "BuilderId" | "AWSIdC" | "Internal";  // 身份提供商
  redirectUri: string;           // 重定向 URI
  codeChallenge: string;         // PKCE 挑战码
  codeChallengeMethod: "S256";   // 挑战方法
  state: string;                 // 状态参数
  redirectFrom?: string;         // 重定向来源 (可选)
  idcRegion?: string;            // IDC 区域 (Enterprise 可选)
  startUrl?: string;             // 开始 URL (Enterprise 可选)
}
```

**响应结构**:
```typescript
interface InitiateLoginOutput {
  redirectUrl?: string;    // 重定向 URL
  clientSecret?: string;   // 客户端密钥
}
```

---

### 3. ExchangeToken - 交换令牌

**端点**: `POST /service/KiroWebPortalService/operation/ExchangeToken`

**请求结构**:
```typescript
interface ExchangeTokenInput {
  idp: string;              // 身份提供商
  code: string;             // 授权码
  codeVerifier: string;     // PKCE 验证器
  redirectUri: string;      // 重定向 URI
  invitationCode?: string;  // 邀请码 (可选)
  state?: string;           // 状态参数 (可选)
}
```

**响应结构**:
```typescript
interface ExchangeTokenOutput {
  csrfToken?: string;    // CSRF 令牌
  state?: string;        // 状态参数
  accessToken?: string;  // 访问令牌
}
```

---

### 4. Logout - 登出

**端点**: `POST /service/KiroWebPortalService/operation/Logout`

**请求结构**:
```typescript
interface LogoutInput {
  csrfToken?: string;  // CSRF 令牌
}
```

**响应结构**: 空对象 `{}`

---

### 5. GetUserInfo - 获取用户信息

**端点**: `POST /service/KiroWebPortalService/operation/GetUserInfo`

**请求结构**:
```typescript
interface GetUserInfoInput {
  origin: "KIRO_IDE";  // 来源
}
```

**响应结构**:
```typescript
interface GetUserInfoOutput {
  userId: string;
  status: "Active" | string;
  email?: string;
  featureFlags?: Record<string, any>;
  idp?: string;
}
```

---

### 6. GetUserUsageAndLimits - 获取用户使用量和限制

**端点**: `POST /service/KiroWebPortalService/operation/GetUserUsageAndLimits`

**请求结构**:
```typescript
interface GetUserUsageAndLimitsInput {
  csrfToken?: string;
}
```

**响应结构**:
```typescript
interface GetUserUsageAndLimitsOutput {
  daysUntilReset?: number;
  nextDateReset?: Date;
  limits?: UsageLimit[];
  overageConfiguration?: OverageConfiguration;
  subscriptionInfo?: any;
  usageBreakdown?: UsageBreakdown;
  usageBreakdownList?: UsageBreakdown[];
  userInfo?: any;
}

interface UsageLimit {
  currentUsage: bigint;
  percentUsed: number;
  totalUsageLimit: bigint;
  type: string;
}

interface UsageBreakdown {
  bonuses?: Bonus[];
  currency?: string;
  currentOverages?: number;
  currentUsage?: number;
  displayName?: string;
  freeTrialInfo?: FreeTrialInfo;
  overageRate?: number;
  resourceType?: string;
  usageLimit?: number;
}
```

---

### 7. DeleteAccount - 删除账户

**端点**: `POST /service/KiroWebPortalService/operation/DeleteAccount`

**请求结构**:
```typescript
interface DeleteAccountInput {
  csrfToken?: string;
}
```

**响应结构**: 空对象 `{}`

---

### 8. CreateUserBonus - 创建用户奖励

**端点**: `POST /service/KiroWebPortalService/operation/CreateUserBonus`

**响应结构**:
```typescript
interface CreateUserBonusOutput {
  amount?: number;
  bonusCode?: string;
  expirationDate?: Date;
}
```

---

### 9. GetAvailableSubscriptionPlans - 获取可用订阅计划

**端点**: `POST /service/KiroWebPortalService/operation/GetAvailableSubscriptionPlans`

**请求结构**:
```typescript
interface GetAvailableSubscriptionPlansInput {
  csrfToken?: string;
}
```

**响应结构**:
```typescript
interface GetAvailableSubscriptionPlansOutput {
  disclaimer?: any;
  subscriptionPlans?: SubscriptionPlan[];
}

interface SubscriptionPlan {
  description?: any;
  name?: string;
  pricing?: { amount: number; currency: string };
  qSubscriptionType?: string;
}
```

---

### 10. GenerateSubscriptionManagementUrl - 生成订阅管理 URL

**端点**: `POST /service/KiroWebPortalService/operation/GenerateSubscriptionManagementUrl`

**请求结构**:
```typescript
interface GenerateSubscriptionManagementUrlInput {
  csrfToken?: string;
}
```

---

### 11. UpdateBillingPreferences - 更新账单偏好

**端点**: `POST /service/KiroWebPortalService/operation/UpdateBillingPreferences`

**请求结构**:
```typescript
interface UpdateBillingPreferencesInput {
  csrfToken?: string;
  profileArn?: string;
  overageConfiguration?: {
    maxOverageAmount?: number;
    overageEnabled?: boolean;
  };
}
```

---

### 12. GetRootPage / GetWebPage - 获取页面

**端点**: 
- `POST /service/KiroWebPortalService/operation/GetRootPage`
- `POST /service/KiroWebPortalService/operation/GetWebPage`

**响应结构**:
```typescript
interface WebPageOutput {
  content?: any;
  contentSecurityPolicy?: string;
  contentType?: string;
  cookie?: string;
  headers?: any;
  httpResponseCode?: number;
  redirectUrl?: string;
}
```

---

## 错误类型

```typescript
type ErrorType = 
  | "AccountSuspendedException"   // 账户被暂停
  | "BadRequestException"         // 错误请求
  | "InternalFailureException"    // 内部错误
  | "ThrottlingException"         // 限流
  | "UnauthorizedException";      // 未授权
```

---

## CBOR 编解码

### 核心库
使用 `@smithy/core/cbor` 进行 CBOR 编解码。

### 序列化流程
```
JavaScript Object 
  → CBOR.serialize() 
    → Uint8Array (二进制)
      → HTTP Body
```

### 反序列化流程
```
HTTP Response Body (Uint8Array)
  → CBOR.deserialize()
    → JavaScript Object
```

### CBOR 类型映射

| CBOR 类型 | JavaScript 类型 |
|----------|----------------|
| Map | Object |
| Array | Array |
| Text String | String |
| Unsigned Int | Number |
| Negative Int | Number |
| Float | Number |
| True/False | Boolean |
| Null | null |
| Byte String | Uint8Array |

---

## 身份提供商 (IdP)

```typescript
const IdpMapping = {
  Google: "google",
  GitHub: "github", 
  BuilderId: "builderid",
  Internal: "internal",
  Enterprise: "awsidc"
};
```

---

## 认证流程

### OAuth 登录流程

```
1. 调用 InitiateLogin 获取 redirectUrl
2. 用户在 IdP 页面完成认证
3. 回调携带 code 和 state
4. 调用 ExchangeToken 交换令牌
5. 获取 accessToken 和 csrfToken
6. 调用 GetUserInfo 获取用户信息
```

### Token 刷新流程

```
1. 检测 accessToken 过期或 userStatus === "stale"
2. 调用 RefreshToken 传入当前 csrfToken
3. 获取新的 accessToken 和 csrfToken
4. 更新本地存储的令牌
```

---

## Cookie 结构

```
AccessToken=<jwt_token>;
SessionToken=<session_token>;
Idp=<identity_provider>;
kiro-visitor-id=<visitor_id>;
```

---

# 二、BigWeaverService (Agent 服务)

## 服务信息

- **基础路径**: `https://bigweaverservice.{region}.amazonaws.com/`
- **协议**: REST HTTP
- **编码**: JSON
- **认证**: Bearer Token

### 通用请求头

```http
Content-Type: application/json
Authorization: Bearer <token>
correlationid: <correlation_id>
```

---

## API 列表

### 1. CreateInstance - 创建实例

**端点**: `POST /CreateInstance`

**请求结构**:
```typescript
interface CreateInstanceInput {
  profileArn: string;
  stage?: string;
  dataCollectionOptIn?: boolean;
}
```

**响应结构**:
```typescript
interface CreateInstanceOutput {
  instanceId: string;
}
```

---

### 2. ListInstances - 列出实例

**端点**: `POST /ListInstances`

**请求结构**:
```typescript
interface ListInstancesInput {
  profileArn: string;
  stage?: string;
  instanceIds?: string[];
  maxResults?: number;
  nextToken?: string;
}
```

**响应结构**:
```typescript
interface ListInstancesOutput {
  instances: Instance[];
  nextToken?: string;
}

interface Instance {
  instanceId: string;
  instanceName?: string;
  description?: string;
}
```

---

### 3. CreateSession - 创建会话

**端点**: `POST /createSession`

**请求结构**:
```typescript
interface CreateSessionInput {
  profileArn: string;
  instanceId: string;
  stage?: string;
  name?: string;
  taskId?: string;
  providerResources?: ProviderResource[];
}

interface ProviderResource {
  github?: { name: string; owner: string };
}
```

**响应结构**:
```typescript
interface CreateSessionOutput {
  sessionId: string;
}
```

---

### 4. GetSession - 获取会话

**端点**: `POST /getSession`

**请求结构**:
```typescript
interface GetSessionInput {
  profileArn: string;
  instanceId: string;
  sessionId: string;
  stage?: string;
}
```

**响应结构**:
```typescript
interface GetSessionOutput {
  sessionId: string;
  instanceId: string;
  name?: string;
  taskId?: string;
  createdAt: Date;
  lastUpdatedAt: Date;
  providerResources?: any[];
}
```

---

### 5. ListSessions - 列出会话

**端点**: `POST /listSessions`

**请求结构**:
```typescript
interface ListSessionsInput {
  profileArn: string;
  instanceId: string;
  stage?: string;
  maxResults?: number;
  nextToken?: string;
  sortBy?: string;
  sortOrder?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}
```

**响应结构**:
```typescript
interface ListSessionsOutput {
  instanceId: string;
  sessions: Session[];
  nextToken?: string;
}
```

---

### 6. ListSessionHistory - 列出会话历史

**端点**: `POST /listSessionHistory`

**请求结构**:
```typescript
interface ListSessionHistoryInput {
  profileArn: string;
  instanceId: string;
  sessionId: string;
  stage?: string;
  maxResults?: number;
  nextToken?: string;
  sortOrder?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}
```

**响应结构**:
```typescript
interface ListSessionHistoryOutput {
  instanceId: string;
  sessionId: string;
  messages: Message[];
  nextToken?: string;
}

interface Message {
  messageId: string;
  content: string;
  role: string;
  createdAt: Date;
}
```

---

### 7. GenerateAgentSessionResponse - 生成 Agent 响应 (流式)

**端点**: `POST /generateAgentSessionResponse`

**请求结构**:
```typescript
interface GenerateAgentSessionResponseInput {
  profileArn: string;
  instanceId: string;
  sessionId: string;
  prompt: string;
  stage?: string;
}
```

**响应结构**: Server-Sent Events (SSE) 流
```typescript
interface AgentResponseEvent {
  chatResponse?: {
    // 流式响应内容
  };
}
```

---

### 8. GetAgentTask - 获取 Agent 任务

**端点**: `POST /getAgentTask`

**请求结构**:
```typescript
interface GetAgentTaskInput {
  profileArn: string;
  instanceId: string;
  taskId: string;
  stage?: string;
}
```

**响应结构**:
```typescript
interface GetAgentTaskOutput {
  taskId: string;
  instanceId: string;
  title?: string;
  description?: string;
  status: TaskStatus;
  priority?: number;
  version?: number;
  sourceUrl?: string;
  sourceProvider?: string;
  requestedBy?: string;
  createdTime: Date;
  lastUpdatedTime: Date;
  expiresTime?: Date;
}

type TaskStatus = 
  | "QUEUED" 
  | "IN_PROGRESS" 
  | "COMPLETED" 
  | "FAILED" 
  | "CANCELLED" 
  | "BLOCKED";
```

---

### 9. GetAgentTaskDetails - 获取任务详情

**端点**: `POST /getAgentTaskDetails`

**请求结构**:
```typescript
interface GetAgentTaskDetailsInput {
  profileArn: string;
  instanceId: string;
  taskId: string;
  stage?: string;
}
```

**响应结构**:
```typescript
interface GetAgentTaskDetailsOutput {
  taskId: string;
  requirements?: any[];
  resources?: any[];
  trajectories?: any[];
}
```

---

### 10. ListAgentTasks - 列出 Agent 任务

**端点**: `POST /listAgentTasks`

**请求结构**:
```typescript
interface ListAgentTasksInput {
  profileArn: string;
  instanceId: string;
  stage?: string;
  maxResults?: number;
  nextToken?: string;
  status?: TaskStatus[];
  sort?: SortOption[];
}
```

**响应结构**:
```typescript
interface ListAgentTasksOutput {
  items: AgentTaskSummary[];
  nextToken?: string;
}
```

---

### 11. GetAgentUsage - 获取 Agent 使用量

**端点**: `POST /GetAgentUsage`

**请求结构**:
```typescript
interface GetAgentUsageInput {
  profileArn: string;
  instanceId: string;
  resourceType: string;
  stage?: string;
}
```

**响应结构**:
```typescript
interface GetAgentUsageOutput {
  overLimit: boolean;
  retryAt?: Date;
}
```

---

### 12. GetStepEvents - 获取步骤事件

**端点**: `POST /getStepEvents`

**请求结构**:
```typescript
interface GetStepEventsInput {
  profileArn: string;
  instanceId: string;
  taskId: string;
  stepId: string;
  stage?: string;
  eventId?: string;
  startTime?: Date;
}
```

**响应结构**:
```typescript
interface GetStepEventsOutput {
  taskId: string;
  stepId: string;
  events: StepEvent[];
  totalEvents: number;
  lastProcessedTimestamp?: Date;
}
```

---

### 13. CreateConnectionForUser - 创建用户连接

**端点**: `POST /CreateConnectionForUser`

**请求结构**:
```typescript
interface CreateConnectionForUserInput {
  profileArn: string;
  instanceId: string;
  connectionType: string;
  connectionDisplayName?: string;
  connectionRegistrationInput?: any;
  stage?: string;
}
```

**响应结构**:
```typescript
interface CreateConnectionForUserOutput {
  connectionId: string;
}
```

---

### 14. DeleteConnection - 删除连接

**端点**: `POST /DeleteConnection`

**请求结构**:
```typescript
interface DeleteConnectionInput {
  profileArn: string;
  instanceId: string;
  connectionId: string;
  stage?: string;
}
```

**响应结构**:
```typescript
interface DeleteConnectionOutput {
  connectionId: string;
}
```

---

### 15. ListConnections - 列出连接

**端点**: `POST /ListConnections`

**请求结构**:
```typescript
interface ListConnectionsInput {
  profileArn: string;
  instanceId?: string;
  stage?: string;
  connectionIds?: string[];
  connectionTypes?: string[];
  instanceIds?: string[];
  maxResults?: number;
  nextToken?: string;
}
```

**响应结构**:
```typescript
interface ListConnectionsOutput {
  connectionIds: string[];
  nextToken?: string;
}
```

---

### 16. ListConnectionResources - 列出连接资源

**端点**: `POST /ListConnectionResources`

**请求结构**:
```typescript
interface ListConnectionResourcesInput {
  profileArn: string;
  instanceId: string;
  connectionId: string;
  stage?: string;
  maxResults?: number;
  nextToken?: string;
}
```

**响应结构**:
```typescript
interface ListConnectionResourcesOutput {
  resources: ConnectionResource[];
  nextToken?: string;
}

interface ConnectionResource {
  github?: { owner: string; repo: string };
  githubUser?: { owner: string; repo: string };
}
```

---

### 17. CreateEnvironmentConfiguration - 创建环境配置

**端点**: `POST /createEnvironmentConfiguration`

**请求结构**:
```typescript
interface CreateEnvironmentConfigurationInput {
  profileArn: string;
  instanceId: string;
  stage?: string;
  environmentConfiguration: EnvironmentConfiguration;
}

interface EnvironmentConfiguration {
  environmentVariables?: KeyValue[];
  secrets?: KeyValue[];
  mcpServers?: McpServer[];
  networkConfiguration?: NetworkConfiguration;
  rawMCPConfiguration?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface McpServer {
  stdio?: {
    name: string;
    command: string;
    args?: string;
    env?: KeyValue[];
  };
  remote?: {
    name: string;
    url: string;
    headers?: KeyValue[];
  };
}

type McpTransportType = "stdio" | "http" | "sse";

interface NetworkConfiguration {
  customDomains?: string[];
  networkType?: "OPEN_INTERNET" | "COMMON_DEPENDENCIES" | "INTEGRATIONS_ONLY";
}
```

**响应结构**:
```typescript
interface CreateEnvironmentConfigurationOutput {
  instanceId: string;
}
```

---

### 18. GetEnvironmentConfiguration - 获取环境配置

**端点**: `POST /getEnvironmentConfiguration`

**请求结构**:
```typescript
interface GetEnvironmentConfigurationInput {
  profileArn: string;
  instanceId: string;
  stage?: string;
}
```

**响应结构**:
```typescript
interface GetEnvironmentConfigurationOutput {
  instanceId: string;
  environmentConfiguration: EnvironmentConfiguration;
}
```

---

### 19. UpdateEnvironmentConfiguration - 更新环境配置

**端点**: `POST /updateEnvironmentConfiguration`

**请求结构**:
```typescript
interface UpdateEnvironmentConfigurationInput {
  profileArn: string;
  instanceId: string;
  stage?: string;
  environmentConfiguration: EnvironmentConfiguration;
}
```

**响应结构**:
```typescript
interface UpdateEnvironmentConfigurationOutput {
  instanceId: string;
}
```

---

## 错误类型

```typescript
type BigWeaverError = 
  | "AccessDeniedException"          // 访问被拒绝
  | "ConflictException"              // 冲突
  | "InternalServerException"        // 内部服务器错误
  | "ResourceNotFoundException"      // 资源未找到
  | "ServiceQuotaExceededException"  // 超出服务配额
  | "ThrottlingException"            // 限流
  | "ValidationException";           // 验证错误
```

---

# 三、TelemetryService (遥测服务)

## 服务信息

- **基础路径**: `https://prod.us-east-1.telemetry.kiro.aws.dev/`
- **协议**: OpenTelemetry Protocol (OTLP) over HTTP
- **编码**: JSON

### 通用请求头

```http
Content-Type: application/json
X-Kiro-MachineId: <machine_id>
Referer: https://app.kiro.dev/
```

---

## API 列表

### 1. PostMetrics - 上报指标

**端点**: `POST /v1/metrics`

> 用于上报 SDK 调用延迟、次数、状态等性能指标

**请求结构**:
```typescript
interface PostMetricsInput {
  resourceMetrics: ResourceMetrics[];
}

interface ResourceMetrics {
  resource: Resource;
  scopeMetrics: ScopeMetrics[];
}

interface Resource {
  attributes: Attribute[];
  droppedAttributesCount: number;
}

interface Attribute {
  key: string;
  value: { stringValue?: string; intValue?: number; doubleValue?: number };
}

interface ScopeMetrics {
  scope: {
    name: string;    // e.g. "kiro.web.portal"
    version: string;
  };
  metrics: Metric[];
}

interface Metric {
  name: string;         // 指标名称
  description: string;
  unit: string;         // e.g. "ms", ""
  // 以下三种类型任选一种
  exponentialHistogram?: ExponentialHistogram;
  sum?: Sum;
  gauge?: Gauge;
}

interface ExponentialHistogram {
  aggregationTemporality: number;  // 1 = Delta
  dataPoints: HistogramDataPoint[];
}

interface HistogramDataPoint {
  attributes: Attribute[];
  count: number;
  min: number;
  max: number;
  sum: number;
  positive: { offset: number; bucketCounts: number[] };
  negative: { offset: number; bucketCounts: number[] };
  scale: number;
  zeroCount: number;
  startTimeUnixNano: string;
  timeUnixNano: string;
}

interface Sum {
  aggregationTemporality: number;
  isMonotonic: boolean;
  dataPoints: SumDataPoint[];
}

interface SumDataPoint {
  attributes: Attribute[];
  startTimeUnixNano: string;
  timeUnixNano: string;
  asDouble: number;
}
```

**响应结构**: HTTP 200 OK (空响应)

---

### 2. PostTraces - 上报链路追踪

**端点**: `POST /v1/traces`

> 用于上报分布式链路追踪数据 (Distributed Tracing)

**请求结构**:
```typescript
interface PostTracesInput {
  resourceSpans: ResourceSpans[];
}

interface ResourceSpans {
  resource: Resource;
  scopeSpans: ScopeSpans[];
}

interface ScopeSpans {
  scope: {
    name: string;
    version: string;
  };
  spans: Span[];
}

interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Attribute[];
  status: { code: number; message?: string };
  events?: SpanEvent[];
  links?: SpanLink[];
}

type SpanKind = 0 | 1 | 2 | 3 | 4;  // UNSPECIFIED, INTERNAL, SERVER, CLIENT, PRODUCER, CONSUMER
```

**响应结构**: HTTP 200 OK (空响应)

---

## 收集的指标类型

| 指标名称 | 类型 | 单位 | 说明 |
|---------|------|------|------|
| `aws.sdk.latency` | ExponentialHistogram | ms | SDK 调用延迟 |
| `aws.sdk.attempts` | Sum | - | SDK 调用次数 |
| `aws.sdk.status` | Sum | - | SDK 调用状态统计 |

## 指标属性

| 属性 | 说明 |
|------|------|
| `OTelLib` | OpenTelemetry 库名 |
| `KiroClientVersion` | Kiro 客户端版本 |
| `Operation` | 操作名称 (e.g. `KiroWebPortalService.GetUserUsageAndLimits`) |
| `Service` | 服务名称 |
| `Region` | AWS 区域 |
| `UserId` | 用户 ID |
| `StatusCode` | HTTP 状态码 |

## 资源属性

```typescript
const resourceAttributes = {
  "service.name": "kiro.web.portal",
  "telemetry.sdk.language": "webjs",
  "telemetry.sdk.name": "opentelemetry",
  "telemetry.sdk.version": "1.30.1",
  "service.version": "1.0.0"
};
```

---

# 四、其他服务

## 1. DownloadService (下载服务) ✅ 已解析

- **基础路径**: `https://prod.download.desktop.kiro.dev`
- **协议**: REST HTTP
- **编码**: JSON
- **用途**: Kiro IDE 桌面端下载

### API: GetMetadata - 获取下载元数据

**端点**: `GET /stable/metadata-{platform}-stable.json`

**平台参数**:
| 平台 | metadataKey |
|------|-------------|
| Mac (Apple Silicon) | `stable/metadata-dmg-darwin-arm64-stable.json` |
| Mac (Intel) | `stable/metadata-dmg-darwin-x64-stable.json` |
| Windows | `stable/metadata-win32-x64-user-stable.json` |
| Linux (Debian/Ubuntu) | `stable/metadata-linux-x64-deb-stable.json` |

**响应结构**:
```typescript
interface MetadataResponse {
  releases: Release[];
}

interface Release {
  updateTo: {
    url: string;  // 下载链接
  };
}
```

**调用示例**:
```typescript
const response = await fetch(`${B9}/${metadataKey}`);
const data = await response.json();
const downloadUrl = data?.releases?.[0]?.updateTo?.url;
```

---

## 2. AuthDesktopService (桌面端认证) ⚠️ 网页端未使用

- **基础路径**: `https://prod.us-east-1.auth.desktop.kiro.dev`
- **用途**: 桌面端 IDE 认证服务
- **说明**: 此服务由 Kiro 桌面 IDE 使用，网页端 JS 中仅包含端点配置，无具体 API 调用

---

## 3. CLI Install (命令行安装) ✅ 已解析

- **安装脚本**: `https://cli.kiro.dev/install`
- **安装命令**: 
```bash
curl -fsSL https://cli.kiro.dev/install | bash
```
- **说明**: Shell 脚本，非 JSON API

---

## 4. CodeWhispererRuntimeService (代码补全服务) ✅ 已解析

- **基础路径**: `https://codewhisperer.us-east-1.amazonaws.com/`
- **协议**: REST HTTP
- **编码**: JSON
- **认证**: Bearer Token (smithy.api#httpBearerAuth)
- **用途**: 代码补全、AI 助手、代码分析、代码转换
- **说明**: 由 Kiro 桌面 IDE 使用
- **详细文档**: [CodeWhispererRuntimeService API.md](./CodeWhispererRuntimeService%20API.md)

### 通用请求头

```http
Content-Type: application/json
Authorization: Bearer <access_token>
x-amzn-codewhisperer-optout: true/false
```

### API 列表 (38 个)

#### 代码补全
| API | 端点 | 方法 | 说明 |
|-----|------|------|------|
| GenerateCompletions | `/generatecompletions` | POST | 生成代码补全建议 |

#### 对话与任务助手
| API | 端点 | 方法 | 说明 |
|-----|------|------|------|
| CreateTaskAssistConversation | `/createTaskAssistConversation` | POST | 创建任务助手对话 |
| DeleteTaskAssistConversation | `/deleteTaskAssistConversation` | POST | 删除任务助手对话 |
| GetTaskAssistCodeGeneration | `/getTaskAssistCodeGeneration/{conversationId}/{codeGenerationId}` | GET | 获取代码生成结果 |
| StartTaskAssistCodeGeneration | `/startTaskAssistCodeGeneration` | POST | 启动任务助手代码生成 |
| ListEvents | `/events` | POST | 列出事件 |

#### 代码分析
| API | 端点 | 方法 | 说明 |
|-----|------|------|------|
| StartCodeAnalysis | `/startcodeanalysis` | POST | 启动代码分析 |
| GetCodeAnalysis | `/getcodeanalysis/{jobId}` | GET | 获取代码分析结果 |
| ListCodeAnalysisFindings | `/listcodeanalysisfindings/{jobId}` | GET | 列出代码分析发现 |
| StartCodeFixJob | `/startcodefixjob` | POST | 启动代码修复任务 |
| GetCodeFixJob | `/getcodefixjob/{jobId}` | GET | 获取代码修复结果 |

#### 测试生成
| API | 端点 | 方法 | 说明 |
|-----|------|------|------|
| StartTestGeneration | `/startTestGeneration` | POST | 启动测试生成 |
| GetTestGeneration | `/getTestGeneration/{jobGroupName}/{jobId}` | GET | 获取测试生成结果 |

#### 代码转换
| API | 端点 | 方法 | 说明 |
|-----|------|------|------|
| StartTransformation | `/startTransformation` | POST | 启动代码转换 |
| GetTransformation | `/getTransformation/{jobId}` | GET | 获取转换状态 |
| GetTransformationPlan | `/getTransformationPlan/{jobId}` | GET | 获取转换计划 |
| ResumeTransformation | `/resumeTransformation/{jobId}` | POST | 恢复转换任务 |
| StopTransformation | `/stopTransformation/{jobId}` | GET | 停止转换任务 |

#### 上传管理
| API | 端点 | 方法 | 说明 |
|-----|------|------|------|
| CreateUploadUrl | `/createuploadurl` | POST | 创建上传 URL |
| CreateArtifactUploadUrl | `/createartifactuploadurl` | POST | 创建制品上传 URL |

#### 用户记忆
| API | 端点 | 方法 | 说明 |
|-----|------|------|------|
| CreateUserMemoryEntry | `/CreateUserMemoryEntry` | POST | 创建用户记忆条目 |
| DeleteUserMemoryEntry | `/DeleteUserMemoryEntry/{id}` | POST | 删除用户记忆条目 |
| ListUserMemoryEntries | `/ListUserMemoryEntries` | POST | 列出用户记忆条目 |

#### 工作区管理
| API | 端点 | 方法 | 说明 |
|-----|------|------|------|
| CreateWorkspace | `/CreateWorkspace` | POST | 创建工作区 |
| DeleteWorkspace | `/DeleteWorkspace` | POST | 删除工作区 |
| ListWorkspaceMetadata | `/ListWorkspaceMetadata` | POST | 列出工作区元数据 |

#### 配置与订阅
| API | 端点 | 方法 | 说明 |
|-----|------|------|------|
| GetProfile | `/GetProfile` | POST | 获取用户配置 |
| GetUsageLimits | `/getUsageLimits` | GET | 获取使用限制 |
| UpdateUsageLimits | `/updateUsageLimits` | POST | 更新使用限制 |
| SetUserPreference | `/setUserPreference` | POST | 设置用户偏好 |
| ListAvailableProfiles | `/ListAvailableProfiles` | POST | 列出可用配置 |
| ListAvailableCustomizations | `/ListAvailableCustomizations` | POST | 列出可用定制 |
| ListAvailableModels | `/ListAvailableModels` | GET | 列出可用模型 |
| ListAvailableSubscriptions | `/listAvailableSubscriptions` | POST | 列出可用订阅 |
| CreateSubscriptionToken | `/CreateSubscriptionToken` | POST | 创建订阅令牌 |
| ListFeatureEvaluations | `/ListFeatureEvaluations` | POST | 列出功能评估 |

#### 遥测
| API | 端点 | 方法 | 说明 |
|-----|------|------|------|
| SendTelemetryEvent | `/SendTelemetryEvent` | POST | 发送遥测事件 |
| PushTelemetryEvent | `/PushTelemetryEvent` | POST | 推送遥测事件 |

#### 检索
| API | 端点 | 方法 | 说明 |
|-----|------|------|------|
| GetRetrievals | `/GetRetrievals` | POST | 获取检索结果 |

---

# 五、AWS IAM Identity Center 网页授权 API

## 服务信息

- **SSO Portal 基础路径**: `https://portal.sso.{region}.amazonaws.com/`
- **OIDC 基础路径**: `https://oidc.{region}.amazonaws.com/`
- **协议**: REST HTTP
- **编码**: JSON
- **认证**: Bearer Token (JWE 格式)

---

## 授权流程概览

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Kiro IDE      │────>│  SSO Portal      │────>│  OIDC Endpoint  │
│ (本地应用)       │     │ (view.awsapps)   │     │  (amazonaws)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                      │                        │
        │  1. 发起设备授权      │                        │
        │─────────────────────>│                        │
        │                      │  2. whoAmI (验证身份)    │
        │                      │───────────────────────>│
        │                      │<───────────────────────│
        │                      │                        │
        │                      │  3. getDeviceSession   │
        │                      │───────────────────────>│
        │                      │<───────────────────────│
        │                      │                        │
        │                      │  4. consent_details    │
        │                      │───────────────────────>│
        │                      │<───────────────────────│
        │                      │                        │
        │                      │  5. associate_token    │
        │                      │───────────────────────>│
        │                      │<───────────────────────│
        │  6. 返回授权token     │                        │
        │<─────────────────────│                        │
```

---

## API 列表

### 1. WhoAmI - 验证用户身份

**端点**: `GET https://portal.sso.{region}.amazonaws.com/token/whoAmI`

**请求头**:
```http
Authorization: Bearer <JWE_TOKEN>
Accept: application/json
```

**响应结构**:
```typescript
interface WhoAmIResponse {
  userIdentifier: string;           // Base64 编码: "accountId/directoryId/identityStoreUserId"
  token: string | null;
  createDate: number;               // Token 创建时间戳
  tokenType: "NATIVE";              // 认证类型
  expireDate: number;               // Token 过期时间戳 (约30天)
  accountId: string;                // AWS 账户 ID
  directoryId: string;              // IAM Identity Center 目录 ID
  authenticationType: "NATIVE";
  identityStoreUserId: string;      // 用户唯一标识
  originSessionId: string;          // 原始会话 ID
  legacyAccessPortalEndpointStatus: string | null;
}
```

**响应示例**:
```json
{
  "userIdentifier": "NDMyNjc3MTk2Mjc4L2QtOTA2NzY0MmFjNy80NGE4NTQ2OC00MGUxLTcwOGUtZTAxOC0wMWNlODFmMTJjZjU=",
  "accountId": "432677196278",
  "directoryId": "d-9067642ac7",
  "authenticationType": "NATIVE",
  "identityStoreUserId": "44a85468-40e1-708e-e018-01ce81f12cf5",
  "tokenType": "NATIVE",
  "createDate": 1764863388000,
  "expireDate": 1767455385000
}
```

---

### 2. GetDeviceSessionToken - 获取设备会话令牌

**端点**: `POST https://portal.sso.{region}.amazonaws.com/session/device`

**请求头**:
```http
Authorization: Bearer <JWE_TOKEN>
Content-Type: application/json
```

**请求体**: `{}`

**响应结构**:
```typescript
interface GetDeviceSessionTokenResponse {
  token: string;  // 设备会话 JWT (JWE 格式)
}
```

---

### 3. ListDeviceAuthorizationConsentDetails - 获取授权同意详情

**端点**: `POST https://oidc.{region}.amazonaws.com/consent_details`

**请求头**:
```http
Content-Type: application/json
```

**请求结构**:
```typescript
interface ConsentDetailsRequest {
  authorizationResumptionContext: string;  // 授权恢复上下文 (加密 blob)
  clientId: string;                        // 客户端 ID
  clientType: "public" | "confidential";   // 客户端类型
  userSessionId: string;                   // 用户会话 JWT
}
```

**响应结构**:
```typescript
interface ConsentDetailsResponse {
  clientName: string;                      // 客户端名称 (如 "Kiro IDE")
  consentDetails: ConsentDetail[];
  nextToken: string | null;
}

interface ConsentDetail {
  applicationName: string;                 // 应用名称 (如 "Kiro")
  descriptions: ConsentDescription[];
}

interface ConsentDescription {
  detailedTitle: string;
  longDescription: string;
  resourceType: string;                    // 资源类型
  shortDescription: string;
}
```

**响应示例 (Kiro)**:
```json
{
  "clientName": "Kiro IDE",
  "consentDetails": [{
    "applicationName": "Kiro",
    "descriptions": [
      {
        "resourceType": "code transformations",
        "shortDescription": "Enable access to Kiro Agent for code transformation.",
        "longDescription": "Enable automated language upgrade tasks."
      },
      {
        "resourceType": "conversations",
        "shortDescription": "Enable access to Kiro chat.",
        "longDescription": "Enable users to ask software development questions..."
      },
      {
        "resourceType": "completions",
        "shortDescription": "Enable access to Kiro inline code suggestions.",
        "longDescription": "Enable inline code suggestions based on existing code..."
      },
      {
        "resourceType": "feature development",
        "shortDescription": "Enable access to Kiro Agent for software development.",
        "longDescription": "Enable generation of plan and code..."
      },
      {
        "resourceType": "analysis",
        "shortDescription": "Enable access to Kiro code analysis.",
        "longDescription": "Enable security scans with suggestions..."
      }
    ]
  }]
}
```

---

### 4. ApproveDeviceAuthorization - 批准设备授权

**端点**: `POST https://oidc.{region}.amazonaws.com/device_authorization/associate_token`

**请求头**:
```http
Content-Type: application/json
```

**请求结构**:
```typescript
interface ApproveDeviceAuthorizationRequest {
  authorizationResumptionContext: string;  // 授权恢复上下文
  userSessionId: string;                   // 用户会话 JWT
}
```

**响应结构**:
```typescript
interface ApproveDeviceAuthorizationResponse {
  location?: string;  // 重定向 URL (AuthCodeGrant 时返回)
}
```

---

### 5. CancelDeviceAuthorization - 取消设备授权

**端点**: `POST https://oidc.{region}.amazonaws.com/device_authorization/cancel`

**请求头**:
```http
Content-Type: application/json
```

**请求结构**:
```typescript
interface CancelDeviceAuthorizationRequest {
  deviceContext: DeviceContext;
}

interface DeviceContext {
  deviceContextId: string;
  clientId: string;
  clientType: string;
}
```

---

### 6. AcceptUserCode - 接受用户代码

**端点**: `POST https://oidc.{region}.amazonaws.com/device_authorization/accept_user_code`

**请求结构**:
```typescript
interface AcceptUserCodeRequest {
  userCode: string;  // 用户输入的验证码
}
```

---

## 授权类型 (Grant Types)

```typescript
enum GrantType {
  DeviceCodeGrant = "device-code",  // 设备代码授权 (Kiro IDE 使用)
  AuthCodeGrant = "auth-code"       // 授权码授权
}
```

---

## 授权状态机

```typescript
enum ConsentState {
  Consent = 0,        // 等待用户同意
  Cancelled = 1,      // 用户取消
  Successful = 2,     // 授权成功
  MissingRedirect = 3 // 缺少重定向 URL
}
```

---

## Token 结构 (JWE 格式)

### Header 解码示例
```json
{
  "enc": "A256GCM",        // 加密算法: AES-256-GCM
  "tag": "DiojnNCZfuyRnEPv",
  "alg": "A256GCMKW",      // 密钥包装算法
  "iv": "Phr6uQqwp-lpPfST" // 初始化向量
}
```

### 安全特性
- **加密算法**: AES-256-GCM
- **密钥管理**: AWS KMS (`arn:aws:kms:us-east-1:276787839696:key/4603c12d-5f0b-4eb4-b7c9-ccb048912c24`)
- **会话绑定**: 每个设备授权绑定到特定用户会话
- **权限范围明确**: 用户可清楚看到授权的具体权限
- **可撤销**: 用户可随时取消授权

---

## API 端点汇总

| 端点 | 方法 | 用途 |
|------|------|------|
| `portal.sso.{region}.amazonaws.com/token/whoAmI` | GET | 验证用户身份 |
| `portal.sso.{region}.amazonaws.com/session/device` | POST | 获取设备会话 |
| `oidc.{region}.amazonaws.com/consent_details` | POST | 获取权限详情 |
| `oidc.{region}.amazonaws.com/device_authorization/associate_token` | POST | 批准授权 |
| `oidc.{region}.amazonaws.com/device_authorization/cancel` | POST | 取消授权 |
| `oidc.{region}.amazonaws.com/device_authorization/accept_user_code` | POST | 接受用户代码 |

---

## Kiro IDE 完整授权流程

1. **Kiro IDE 启动授权**: 生成设备代码，打开浏览器访问 `view.awsapps.com`
2. **用户登录 SSO**: 使用 IAM Identity Center 凭证登录
3. **WhoAmI 验证**: 确认用户身份和权限
4. **获取设备会话**: 为设备创建临时会话
5. **显示权限页面**: 展示 Kiro 请求的 5 项权限
6. **用户点击 "Allow"**: 调用 `associate_token` 完成授权
7. **Kiro 获取 Token**: 设备端轮询获取授权后的 access token

---

# 六、服务端点配置

```typescript
const endpointConfig = {
  // 主要服务
  kirowebportalservice: "https://app.kiro.dev",
  bigweaverclient: "https://bigweaverservice.{region}.amazonaws.com",
  rtsruntime: "https://codewhisperer.us-east-1.amazonaws.com",
  
  // 遥测服务
  telemetry: "https://prod.{region}.telemetry.kiro.aws.dev",
  
  // 桌面端服务
  authDesktop: "https://prod.us-east-1.auth.desktop.kiro.dev",
  download: "https://prod.download.desktop.kiro.dev",
  cli: "https://cli.kiro.dev"
};

// 环境映射
const stageMapping = {
  kirowebportalservice: {
    Beta: "https://beta.app.kiro.dev",
    Gamma: "https://gamma.app.kiro.dev",
    Prod: "https://app.kiro.dev"
  },
  telemetry: {
    Beta: "https://beta.us-east-1.telemetry.kiro.aws.dev",
    Gamma: "https://gamma.us-east-1.telemetry.kiro.aws.dev",
    Prod: "https://prod.us-east-1.telemetry.kiro.aws.dev"
  },
  authDesktop: {
    Beta: "https://beta.us-east-1.auth.desktop.kiro.dev",
    Gamma: "https://gamma.us-east-1.auth.desktop.kiro.dev",
    Prod: "https://prod.us-east-1.auth.desktop.kiro.dev"
  }
};
```

---

# 七、API 汇总表

## KiroWebPortalService (13 个 API)

| API | 用途 | 编码 |
|-----|------|------|
| RefreshToken | 刷新访问令牌 | CBOR |
| InitiateLogin | 发起 OAuth 登录 | CBOR |
| ExchangeToken | 交换授权码 | CBOR |
| Logout | 登出 | CBOR |
| GetUserInfo | 获取用户信息 | CBOR |
| GetUserUsageAndLimits | 获取使用量限制 | CBOR |
| DeleteAccount | 删除账户 | CBOR |
| CreateUserBonus | 创建奖励 | CBOR |
| GetAvailableSubscriptionPlans | 获取订阅计划 | CBOR |
| GenerateSubscriptionManagementUrl | 生成订阅管理 URL | CBOR |
| UpdateBillingPreferences | 更新账单偏好 | CBOR |
| GetRootPage | 获取根页面 | CBOR |
| GetWebPage | 获取网页 | CBOR |

## BigWeaverService (19 个 API)

| API | 用途 | 编码 |
|-----|------|------|
| CreateInstance | 创建实例 | JSON |
| ListInstances | 列出实例 | JSON |
| CreateSession | 创建会话 | JSON |
| GetSession | 获取会话 | JSON |
| ListSessions | 列出会话 | JSON |
| ListSessionHistory | 列出会话历史 | JSON |
| GenerateAgentSessionResponse | 生成 Agent 响应 (流式) | JSON/SSE |
| GetAgentTask | 获取 Agent 任务 | JSON |
| GetAgentTaskDetails | 获取任务详情 | JSON |
| ListAgentTasks | 列出 Agent 任务 | JSON |
| GetAgentUsage | 获取 Agent 使用量 | JSON |
| GetStepEvents | 获取步骤事件 | JSON |
| CreateConnectionForUser | 创建用户连接 | JSON |
| DeleteConnection | 删除连接 | JSON |
| ListConnections | 列出连接 | JSON |
| ListConnectionResources | 列出连接资源 | JSON |
| CreateEnvironmentConfiguration | 创建环境配置 | JSON |
| GetEnvironmentConfiguration | 获取环境配置 | JSON |
| UpdateEnvironmentConfiguration | 更新环境配置 | JSON |

## TelemetryService (2 个 API)

| API | 用途 | 编码 |
|-----|------|------|
| PostMetrics | 上报 OpenTelemetry 指标 | JSON |
| PostTraces | 上报链路追踪数据 | JSON |

## DownloadService (1 个 API)

| API | 用途 | 编码 |
|-----|------|------|
| GetMetadata | 获取 IDE 下载元数据 | JSON |

---

## CodeWhispererRuntimeService (38 个 API)

| 分类 | API 数量 |
|------|----------|
| 代码补全 | 1 |
| 对话与任务助手 | 5 |
| 代码分析 | 5 |
| 测试生成 | 2 |
| 代码转换 | 5 |
| 上传管理 | 2 |
| 用户记忆 | 3 |
| 工作区管理 | 3 |
| 配置与订阅 | 10 |
| 遥测 | 2 |

## AWS IAM Identity Center (6 个 API)

| API | 用途 | 编码 |
|-----|------|------|
| WhoAmI | 验证用户身份 | JSON |
| GetDeviceSessionToken | 获取设备会话令牌 | JSON |
| ListDeviceAuthorizationConsentDetails | 获取授权同意详情 | JSON |
| ApproveDeviceAuthorization | 批准设备授权 | JSON |
| CancelDeviceAuthorization | 取消设备授权 | JSON |
| AcceptUserCode | 接受用户代码 | JSON |

---

## 总计

| 服务 | API 数量 | 协议 | 状态 |
|------|----------|------|------|
| KiroWebPortalService | 13 | CBOR | ✅ 已解析 |
| BigWeaverService | 19 | JSON | ✅ 已解析 |
| TelemetryService | 2 | JSON (OTLP) | ✅ 已解析 |
| DownloadService | 1 | JSON | ✅ 已解析 |
| CodeWhispererRuntimeService | 38 | JSON | ✅ 已解析 (桌面端) |
| AWS IAM Identity Center | 6 | JSON | ✅ 已解析 (网页授权) |
| AuthDesktopService | - | - | ⚠️ 网页端未使用 |
| **总计** | **79** | - | - |

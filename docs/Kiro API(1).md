# Kiro API 分析

## 概述

Kiro 后端包含两个主要服务：

| 服务 | 协议 | 编码格式 | 用途 |
|------|------|----------|------|
| **KiroWebPortalService** | Smithy RPC v2 CBOR | CBOR | 用户认证、账户管理、订阅 |
| **BigWeaverService** | REST | JSON | Agent 任务、会话、连接管理 |

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

# 三、服务端点配置

```typescript
const endpointConfig = {
  kirowebportalservice: "https://app.kiro.dev",
  bigweaverclient: "https://bigweaverservice.{region}.amazonaws.com",
  rtsruntime: "..." // RTS 运行时服务
};
```

---

# 四、API 汇总表

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

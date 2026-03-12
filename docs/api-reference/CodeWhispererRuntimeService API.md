# CodeWhispererRuntimeService API 详细文档

## 概述

- **服务名**: CodeWhispererRuntimeService
- **基础路径**: `https://codewhisperer.us-east-1.amazonaws.com/`
- **协议**: REST HTTP
- **编码**: JSON
- **认证**: Bearer Token (smithy.api#httpBearerAuth)
- **来源**: Kiro 桌面端 IDE

---

# 桌面端 OAuth 登录流程

## 1. 登录流程概述

Kiro 桌面端使用 **AWS SSO OIDC** (OpenID Connect) 协议进行身份认证，支持两种登录方式：

| 登录方式 | Provider | Start URL |
|----------|----------|-----------|
| **AWS Builder ID** | BuilderId | `https://view.awsapps.com/start` |
| **AWS IAM Identity Center** | Enterprise | 用户自定义 |

## 2. 认证流程图

```
┌─────────────┐     ┌───────────────┐     ┌──────────────────────┐
│  Kiro IDE   │     │ Local Server  │     │  AWS OIDC Service    │
│  (Client)   │     │ (127.0.0.1)   │     │ (oidc.*.amazonaws)   │
└──────┬──────┘     └───────┬───────┘     └──────────┬───────────┘
       │                    │                        │
       │ 1. Start local server                       │
       │───────────────────>│                        │
       │    (random port)   │                        │
       │                    │                        │
       │ 2. RegisterClient  │                        │
       │─────────────────────────────────────────────>
       │    (clientName, scopes, redirectUris)       │
       │<────────────────────────────────────────────│
       │    (clientId, clientSecret)                 │
       │                    │                        │
       │ 3. Generate PKCE   │                        │
       │  code_verifier     │                        │
       │  code_challenge    │                        │
       │                    │                        │
       │ 4. Open browser to authorize URL            │
       │─────────────────────────────────────────────>
       │  /authorize?client_id=&redirect_uri=        │
       │             &code_challenge=&state=         │
       │                    │                        │
       │                    │ 5. User logs in        │
       │                    │<───────────────────────│
       │                    │    (redirect with code)│
       │                    │                        │
       │ 6. Receive auth code                        │
       │<───────────────────│                        │
       │                    │                        │
       │ 7. CreateToken     │                        │
       │─────────────────────────────────────────────>
       │  (code, codeVerifier, redirectUri)          │
       │<────────────────────────────────────────────│
       │  (accessToken, refreshToken, expiresIn)     │
       │                    │                        │
       │ 8. Close local server                       │
       │───────────────────>│                        │
       └────────────────────┴────────────────────────┘
```

## 3. 详细步骤

### Step 1: 启动本地认证服务器

```typescript
// 本地服务器配置
const authServerConfig = {
  baseUrl: "http://127.0.0.1",
  oauthCallback: "/oauth/callback",
  authenticationFlowTimeoutInMs: 600000,  // 10 分钟
  authenticationWarningTimeoutInMs: 60000, // 1 分钟警告
  listenTimeoutMs: 10000                   // 10 秒启动超时
};

// 启动服务器 (随机端口)
const authServer = await AuthServer.init(state);
await authServer.start();
// redirectUri = "http://127.0.0.1:{port}/oauth/callback"
```

### Step 2: 注册 OIDC 客户端

**端点**: `POST https://oidc.{region}.amazonaws.com/client/register`

**请求结构**:
```typescript
interface RegisterClientRequest {
  clientName: string;           // "Kiro IDE"
  clientType: string;           // "public"
  scopes: string[];             // ["codewhisperer:completions", ...]
  grantTypes: string[];         // ["authorization_code", "refresh_token"]
  redirectUris: string[];       // ["http://127.0.0.1/oauth/callback"]
  issuerUrl: string;            // Start URL
}
```

**响应结构**:
```typescript
interface RegisterClientResponse {
  clientId: string;
  clientSecret: string;
  clientSecretExpiresAt: number;  // Unix timestamp
}
```

**作用域 (Scopes)**:
```typescript
const scopes = [
  "codewhisperer:completions",    // 代码补全
  "codewhisperer:analysis",       // 代码分析
  "codewhisperer:conversations",  // 对话
  "codewhisperer:transformations", // 代码转换
  "codewhisperer:taskassist"      // 任务助手
];
```

### Step 3: 生成 PKCE 参数

```typescript
import crypto from 'crypto';

// 生成 code_verifier (随机 32 字节)
const codeVerifier = crypto.randomBytes(32).toString('base64url');

// 计算 code_challenge (SHA256 哈希)
const codeChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest()
  .toString('base64url');

// 生成 state (UUID)
const state = crypto.randomUUID();
```

### Step 4: 构建授权 URL 并打开浏览器

**授权 URL 格式**:
```
https://oidc.{region}.amazonaws.com/authorize?
  response_type=code&
  client_id={clientId}&
  redirect_uri={redirectUri}&
  scopes={scopes}&
  state={state}&
  code_challenge={codeChallenge}&
  code_challenge_method=S256
```

**完整代码**:
```typescript
const authorizeUrl = new URL(`https://oidc.${region}.amazonaws.com/authorize`);
authorizeUrl.searchParams.set('response_type', 'code');
authorizeUrl.searchParams.set('client_id', clientRegistration.clientId);
authorizeUrl.searchParams.set('redirect_uri', authServer.redirectUri);
authorizeUrl.searchParams.set('scopes', scopes.join(','));
authorizeUrl.searchParams.set('state', state);
authorizeUrl.searchParams.set('code_challenge', codeChallenge);
authorizeUrl.searchParams.set('code_challenge_method', 'S256');

// 打开浏览器
await vscode.env.openExternal(vscode.Uri.parse(authorizeUrl.toString()));
```

### Step 5 & 6: 等待用户授权并接收回调

**本地服务器回调处理**:
```typescript
// 回调 URL 示例:
// http://127.0.0.1:54321/oauth/callback?code=AUTH_CODE&state=STATE

handleAuthentication(searchParams: URLSearchParams, response: http.ServerResponse) {
  // 检查错误
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  if (error && errorDescription) {
    if (error === 'access_denied') {
      throw new AccessDeniedError();
    }
    throw new OAuthError(`${error}: ${errorDescription}`);
  }

  // 获取授权码
  const code = searchParams.get('code');
  if (!code) {
    throw new MissingCodeError();
  }

  // 验证 state 防止 CSRF
  const returnedState = searchParams.get('state');
  if (returnedState !== this.state) {
    throw new StateMismatchError();
  }

  // 返回成功页面
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.write('You can close this window');
  response.end();

  // 解析 Promise，返回授权码
  this.deferred.resolve(code);
}
```

### Step 7: 使用授权码换取 Token

**端点**: `POST https://oidc.{region}.amazonaws.com/token`

**请求结构**:
```typescript
interface CreateTokenRequest {
  clientId: string;
  clientSecret: string;
  grantType: "authorization_code" | "refresh_token";
  redirectUri: string;
  code?: string;           // authorization_code 流程
  codeVerifier?: string;   // PKCE 验证
  refreshToken?: string;   // refresh_token 流程
}
```

**响应结构**:
```typescript
interface CreateTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;      // "Bearer"
  expiresIn: number;      // 秒数
}
```

**调用示例**:
```typescript
const tokenResponse = await ssoOidcClient.createToken({
  clientId: clientRegistration.clientId,
  clientSecret: clientRegistration.clientSecret,
  grantType: 'authorization_code',
  redirectUri: authServer.redirectUri,
  code: authorizationCode,
  codeVerifier: codeVerifier
});
```

### Step 8: 保存 Token 并关闭服务器

```typescript
interface TokenCacheData {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;        // ISO 8601
  clientIdHash: string;     // SHA1(startUrl)
  authMethod: "IdC";
  provider: "BuilderId" | "Enterprise";
  region: string;
}

// 保存 Token
const token: TokenCacheData = {
  accessToken: tokenResponse.accessToken,
  refreshToken: tokenResponse.refreshToken,
  expiresAt: new Date(Date.now() + tokenResponse.expiresIn * 1000).toISOString(),
  clientIdHash: crypto.createHash('sha1').update(JSON.stringify({ startUrl })).digest('hex'),
  authMethod: 'IdC',
  provider: 'BuilderId',
  region: 'us-east-1'
};

// 关闭本地服务器
await authServer.close();
```

## 4. Token 刷新流程

```typescript
async refreshToken(token: TokenCacheData): Promise<TokenCacheData> {
  const clientRegistration = storage.readClientRegistration(token.clientIdHash);
  
  if (!clientRegistration || isClientRegistrationExpired(clientRegistration)) {
    throw new Error('No valid client registration found');
  }

  const ssoOidcClient = new SSOOIDCClient({ region: token.region });
  
  const response = await ssoOidcClient.createToken({
    clientId: clientRegistration.clientId,
    clientSecret: clientRegistration.clientSecret,
    refreshToken: token.refreshToken,
    grantType: 'refresh_token'
  });

  return {
    ...token,
    accessToken: response.accessToken,
    refreshToken: response.refreshToken ?? token.refreshToken,
    expiresAt: new Date(Date.now() + response.expiresIn * 1000).toISOString()
  };
}
```

## 5. 客户端注册缓存

客户端注册信息缓存在本地文件系统：

```
~/.aws/sso/cache/{clientIdHash}.json
```

**缓存内容**:
```json
{
  "clientId": "...",
  "clientSecret": "...",
  "expiresAt": "2025-01-01T00:00:00.000Z"
}
```

## 6. SSOOIDC 服务 API

### RegisterClient

```http
POST https://oidc.{region}.amazonaws.com/client/register
Content-Type: application/json

{
  "clientName": "Kiro IDE",
  "clientType": "public",
  "scopes": ["codewhisperer:completions", ...],
  "grantTypes": ["authorization_code", "refresh_token"],
  "redirectUris": ["http://127.0.0.1/oauth/callback"],
  "issuerUrl": "https://view.awsapps.com/start"
}
```

### CreateToken

```http
POST https://oidc.{region}.amazonaws.com/token
Content-Type: application/json

{
  "clientId": "...",
  "clientSecret": "...",
  "grantType": "authorization_code",
  "redirectUri": "http://127.0.0.1:54321/oauth/callback",
  "code": "AUTH_CODE",
  "codeVerifier": "..."
}
```

### StartDeviceAuthorization (设备流程)

```http
POST https://oidc.{region}.amazonaws.com/device_authorization
Content-Type: application/json

{
  "clientId": "...",
  "clientSecret": "...",
  "startUrl": "https://view.awsapps.com/start"
}
```

## 7. 错误类型

| 错误 | 说明 |
|------|------|
| `AccessDeniedException` | 访问被拒绝 |
| `AuthorizationPendingException` | 等待用户授权 |
| `ExpiredTokenException` | Token 已过期 |
| `InvalidClientException` | 无效客户端 |
| `InvalidGrantException` | 无效授权 |
| `InvalidRequestException` | 无效请求 |
| `InvalidScopeException` | 无效作用域 |
| `SlowDownException` | 请求过快 |
| `UnauthorizedClientException` | 客户端未授权 |
| `InvalidRedirectUriException` | 无效重定向 URI |

---

## 通用请求头

```http
Content-Type: application/json
Authorization: Bearer <access_token>
User-Agent: <client_user_agent>
X-Amz-User-Agent: <sdk_user_agent>
x-amzn-codewhisperer-optout: true/false  # 数据收集偏好
```

---

## 通用错误类型

```typescript
// 访问被拒绝
interface AccessDeniedException {
  name: "AccessDeniedException";
  $fault: "client";
  message: string;
  reason: 
    | "FEATURE_NOT_SUPPORTED"
    | "TEMPORARILY_SUSPENDED"
    | "UNAUTHORIZED_CUSTOMIZATION_RESOURCE_ACCESS"
    | "UNAUTHORIZED_WORKSPACE_CONTEXT_FEATURE_ACCESS";
}

// 冲突异常
interface ConflictException {
  name: "ConflictException";
  $fault: "client";
  message: string;
  reason: 
    | "CUSTOMER_KMS_KEY_DISABLED"
    | "CUSTOMER_KMS_KEY_INVALID_KEY_POLICY"
    | "MISMATCHED_KMS_KEY";
}

// 内部服务器错误
interface InternalServerException {
  name: "InternalServerException";
  $fault: "server";
  $retryable: true;
  message: string;
  reason: "MODEL_TEMPORARILY_UNAVAILABLE";
}

// 限流异常
interface ThrottlingException {
  name: "ThrottlingException";
  $fault: "client";
  $retryable: { throttling: true };
  message: string;
  reason: 
    | "DAILY_REQUEST_COUNT"
    | "INSUFFICIENT_MODEL_CAPACITY"
    | "MONTHLY_REQUEST_COUNT";
}

// 验证异常
interface ValidationException {
  name: "ValidationException";
  $fault: "client";
  message: string;
  reason: 
    | "CONTENT_LENGTH_EXCEEDS_THRESHOLD"
    | "INVALID_CONVERSATION_ID"
    | "INVALID_KMS_GRANT"
    | "INVALID_MODEL_ID";
}

// 资源未找到
interface ResourceNotFoundException {
  name: "ResourceNotFoundException";
  $fault: "client";
  message: string;
}

// 服务配额超限
interface ServiceQuotaExceededException {
  name: "ServiceQuotaExceededException";
  $fault: "client";
  message: string;
  reason: 
    | "CONVERSATION_LIMIT_EXCEEDED"
    | "MONTHLY_REQUEST_COUNT"
    | "OVERAGE_REQUEST_LIMIT_EXCEEDED";
}
```

---

# 一、代码补全 API

## 1. GenerateCompletions - 生成代码补全

**端点**: `POST /generatecompletions`

**描述**: 根据当前文件上下文生成代码补全建议

### 请求结构

```typescript
interface GenerateCompletionsRequest {
  // 必填字段
  fileContext: FileContext;           // 文件上下文
  profileArn: string;                 // 用户配置 ARN
  
  // 可选字段
  customizationArn?: string;          // 定制化 ARN
  editorState?: EditorState;          // 编辑器状态
  maxResults?: number;                // 最大结果数
  modelId?: string;                   // 模型 ID
  nextToken?: string;                 // 分页令牌
  optOutPreference?: OptOutPreference; // 数据收集偏好
  predictionTypes?: PredictionType[]; // 预测类型
  referenceTrackerConfiguration?: ReferenceTrackerConfiguration;
  supplementalContexts?: SupplementalContext[]; // 补充上下文
  userContext?: UserContext;          // 用户上下文
  workspaceId?: string;               // 工作区 ID
}

interface FileContext {
  leftFileContent: string;   // 光标左侧内容
  rightFileContent: string;  // 光标右侧内容
  filename: string;          // 文件名
  fileUri?: string;          // 文件 URI
  programmingLanguage: {
    languageName: string;    // 语言名称 (e.g. "typescript")
  };
}

interface EditorState {
  cursorState?: CursorState;
  document?: TextDocument;
}

type OptOutPreference = "OPTIN" | "OPTOUT";
type PredictionType = "LINE" | "BLOCK";
```

### 响应结构

```typescript
interface GenerateCompletionsResponse {
  completions?: Completion[];  // 补全建议列表
  predictions?: Prediction[];  // 预测列表
  modelId?: string;            // 使用的模型 ID
  nextToken?: string;          // 分页令牌
}

interface Completion {
  content: string;           // 补全内容
  references?: Reference[];  // 代码参考来源
}

interface Prediction {
  content: string;
  predictionType: PredictionType;
}
```

### 调用示例

```typescript
const client = new CodeWhispererRuntimeClient({
  region: "us-east-1",
  credentials: credentialsProvider,
});

const response = await client.send(new GenerateCompletionsCommand({
  profileArn: "arn:aws:codewhisperer:us-east-1:123456789:profile/xxx",
  fileContext: {
    leftFileContent: "function hello() {\n  console.log(",
    rightFileContent: "\n}",
    filename: "index.ts",
    programmingLanguage: { languageName: "typescript" }
  },
  maxResults: 5,
  predictionTypes: ["LINE", "BLOCK"]
}));

console.log(response.completions);
```

---

# 二、对话与任务助手 API

## 2. CreateTaskAssistConversation - 创建任务助手对话

**端点**: `POST /createTaskAssistConversation`

### 请求结构

```typescript
interface CreateTaskAssistConversationRequest {
  profileArn: string;  // 用户配置 ARN
}
```

### 响应结构

```typescript
interface CreateTaskAssistConversationResponse {
  conversationId: string;  // 对话 ID
}
```

---

## 3. DeleteTaskAssistConversation - 删除任务助手对话

**端点**: `POST /deleteTaskAssistConversation`

### 请求结构

```typescript
interface DeleteTaskAssistConversationRequest {
  conversationId: string;  // 对话 ID
  profileArn: string;      // 用户配置 ARN
}
```

### 响应结构

```typescript
interface DeleteTaskAssistConversationResponse {
  conversationId: string;
}
```

---

## 4. StartTaskAssistCodeGeneration - 启动任务助手代码生成

**端点**: `POST /startTaskAssistCodeGeneration`

### 请求结构

```typescript
interface StartTaskAssistCodeGenerationRequest {
  profileArn: string;
  conversationState: ConversationState;
  codeGenerationId?: string;
  currentCodeGenerationId?: string;
  intent?: Intent;
  intentContext?: IntentContext;
  taskAssistPlan?: TaskAssistPlan;
  workspaceState?: WorkspaceState;
}

interface ConversationState {
  conversationId: string;
  currentMessage: ChatMessage;
  chatTriggerType?: ChatTriggerType;
  customizationArn?: string;
  history?: ChatMessage[];
}

interface ChatMessage {
  // Union 类型
  userInputMessage?: UserInputMessage;
  assistantResponseMessage?: AssistantResponseMessage;
}

interface UserInputMessage {
  content: string;
  userInputMessageContext?: UserInputMessageContext;
  userIntent?: UserIntent;
}

type Intent = 
  | "APPLY_COMMON_BEST_PRACTICES"
  | "CITE_SOURCES"
  | "CODE_GENERATION"
  | "EXPLAIN_CODE_SELECTION"
  | "EXPLAIN_LINE_BY_LINE"
  | "GENERATE_CLOUDFORMATION_TEMPLATE"
  | "GENERATE_UNIT_TESTS"
  | "IMPROVE_CODE"
  | "SHOW_EXAMPLES"
  | "SUGGEST_ALTERNATE_IMPLEMENTATION";
```

### 响应结构

```typescript
interface StartTaskAssistCodeGenerationResponse {
  codeGenerationId: string;
  codeGenerationStatus: CodeGenerationWorkflowStatus;
}

type CodeGenerationWorkflowStatus = 
  | "IN_PROGRESS"
  | "COMPLETE"
  | "FAILED";
```

---

## 5. GetTaskAssistCodeGeneration - 获取代码生成结果

**端点**: `GET /getTaskAssistCodeGeneration/{conversationId}/{codeGenerationId}`

### 请求结构

```typescript
interface GetTaskAssistCodeGenerationRequest {
  conversationId: string;    // 路径参数
  codeGenerationId: string;  // 路径参数
  profileArn?: string;       // 查询参数
}
```

### 响应结构

```typescript
interface GetTaskAssistCodeGenerationResponse {
  codeGenerationStatus: CodeGenerationWorkflowStatus;
  codeGenerationStatusDetail?: string;
  codeGenerationResult?: CodeGenerationResult;
}
```

---

## 6. ListEvents - 列出事件

**端点**: `POST /events`

### 请求结构

```typescript
interface ListEventsRequest {
  conversationId: string;
  maxResults?: number;
  nextToken?: string;
}
```

### 响应结构

```typescript
interface ListEventsResponse {
  events?: Event[];
  nextToken?: string;
}

interface Event {
  eventId: string;
  eventType: string;
  timestamp: Date;
  payload?: any;
}
```

---

# 三、代码分析 API

## 7. StartCodeAnalysis - 启动代码分析

**端点**: `POST /startcodeanalysis`

### 请求结构

```typescript
interface StartCodeAnalysisRequest {
  profileArn: string;
  artifacts: Artifact[];
  clientToken?: string;        // 幂等性令牌 (自动生成 UUID)
  clientType?: string;
  codeDiffMetadata?: CodeDiffMetadata;
  codeScanName?: string;
  languageModelId?: string;
  programmingLanguage?: ProgrammingLanguage;
  scope?: CodeAnalysisScope;
}

interface Artifact {
  artifactType: ArtifactType;
  uploadId: string;
}

type ArtifactType = "SourceCode" | "BuiltJars";
type CodeAnalysisScope = "FILE" | "PROJECT";
```

### 响应结构

```typescript
interface StartCodeAnalysisResponse {
  jobId: string;
  status: CodeAnalysisStatus;
}

type CodeAnalysisStatus = 
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED";
```

---

## 8. GetCodeAnalysis - 获取代码分析结果

**端点**: `GET /getcodeanalysis/{jobId}`

### 请求结构

```typescript
interface GetCodeAnalysisRequest {
  jobId: string;       // 路径参数
  profileArn?: string; // 查询参数
}
```

### 响应结构

```typescript
interface GetCodeAnalysisResponse {
  status: CodeAnalysisStatus;
  errorMessage?: string;
  codeAnalysisFindings?: CodeAnalysisFinding[];
}
```

---

## 9. ListCodeAnalysisFindings - 列出代码分析发现

**端点**: `GET /listcodeanalysisfindings/{jobId}`

### 请求结构

```typescript
interface ListCodeAnalysisFindingsRequest {
  jobId: string;                      // 路径参数
  codeAnalysisFindingsSchema: string; // 查询参数
  profileArn?: string;                // 查询参数
  nextToken?: string;                 // 查询参数
}
```

### 响应结构

```typescript
interface ListCodeAnalysisFindingsResponse {
  codeAnalysisFindings?: string;  // JSON 字符串
  nextToken?: string;
}
```

---

## 10. StartCodeFixJob - 启动代码修复任务

**端点**: `POST /startcodefixjob`

### 请求结构

```typescript
interface StartCodeFixJobRequest {
  profileArn: string;
  uploadId: string;
  ruleId: string;
  codeFixName?: string;
  description?: string;
  referenceTrackerConfiguration?: ReferenceTrackerConfiguration;
  snippetRange?: SnippetRange;
}

interface SnippetRange {
  startLine: number;
  endLine: number;
}
```

### 响应结构

```typescript
interface StartCodeFixJobResponse {
  jobId: string;
  status: CodeFixJobStatus;
}

type CodeFixJobStatus = 
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED";
```

---

## 11. GetCodeFixJob - 获取代码修复结果

**端点**: `GET /getcodefixjob/{jobId}`

### 请求结构

```typescript
interface GetCodeFixJobRequest {
  jobId: string;       // 路径参数
  profileArn?: string; // 查询参数
}
```

### 响应结构

```typescript
interface GetCodeFixJobResponse {
  status: CodeFixJobStatus;
  suggestedFixes?: SuggestedFix[];
}

interface SuggestedFix {
  code: string;
  description?: string;
}
```

---

# 四、测试生成 API

## 12. StartTestGeneration - 启动测试生成

**端点**: `POST /startTestGeneration`

### 请求结构

```typescript
interface StartTestGenerationRequest {
  profileArn: string;
  targetCodeList: TargetCode[];
  testGenerationJobGroupName: string;
  uploadId: string;
  clientToken?: string;
  referenceTrackerConfiguration?: ReferenceTrackerConfiguration;
  userInput?: string;
}

interface TargetCode {
  relativeTargetPath: string;
  targetLineRangeList?: LineRange[];
}
```

### 响应结构

```typescript
interface StartTestGenerationResponse {
  testGenerationJobGroupName: string;
  testGenerationJobId: string;
  testGenerationJobStatus: TestGenerationJobStatus;
}

type TestGenerationJobStatus = 
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED";
```

---

## 13. GetTestGeneration - 获取测试生成结果

**端点**: `GET /getTestGeneration/{testGenerationJobGroupName}/{testGenerationJobId}`

### 请求结构

```typescript
interface GetTestGenerationRequest {
  testGenerationJobGroupName: string;  // 路径参数
  testGenerationJobId: string;         // 路径参数
  profileArn?: string;                 // 查询参数
}
```

### 响应结构

```typescript
interface GetTestGenerationResponse {
  testGenerationJobStatus: TestGenerationJobStatus;
  testGenerationJob?: TestGenerationJob;
}
```

---

# 五、代码转换 API

## 14. StartTransformation - 启动代码转换

**端点**: `POST /startTransformation`

### 请求结构

```typescript
interface StartTransformationRequest {
  profileArn: string;
  transformationSpec: TransformationSpec;
  workspaceState?: WorkspaceState;
}

interface TransformationSpec {
  transformationType: TransformationType;
  source?: TransformationProjectState;
  target?: TransformationProjectState;
}

type TransformationType = 
  | "LANGUAGE_UPGRADE"
  | "SQL_CONVERSION";
```

### 响应结构

```typescript
interface StartTransformationResponse {
  transformationJobId: string;
  status: TransformationStatus;
}

type TransformationStatus = 
  | "CREATED"
  | "ACCEPTED"
  | "REJECTED"
  | "STARTED"
  | "PREPARING"
  | "PREPARED"
  | "PLANNING"
  | "PLANNED"
  | "TRANSFORMING"
  | "TRANSFORMED"
  | "PARTIALLY_COMPLETED"
  | "COMPLETED"
  | "STOPPING"
  | "STOPPED"
  | "FAILED"
  | "PAUSED"
  | "RESUMED";
```

---

## 15. GetTransformation - 获取转换状态

**端点**: `GET /getTransformation/{transformationJobId}`

### 请求结构

```typescript
interface GetTransformationRequest {
  transformationJobId: string;  // 路径参数
  profileArn?: string;          // 查询参数
}
```

---

## 16. GetTransformationPlan - 获取转换计划

**端点**: `GET /getTransformationPlan/{transformationJobId}`

---

## 17. ResumeTransformation - 恢复转换任务

**端点**: `POST /resumeTransformation/{transformationJobId}`

### 请求结构

```typescript
interface ResumeTransformationRequest {
  transformationJobId: string;  // 路径参数
  profileArn?: string;
  userActionStatus?: TransformationUserActionStatus;
}
```

---

## 18. StopTransformation - 停止转换任务

**端点**: `GET /stopTransformation/{transformationJobId}`

---

# 六、上传管理 API

## 19. CreateUploadUrl - 创建上传 URL

**端点**: `POST /createuploadurl`

### 请求结构

```typescript
interface CreateUploadUrlRequest {
  profileArn: string;
  artifactType: ArtifactType;
  contentChecksum?: string;
  contentChecksumType?: ContentChecksumType;
  contentLength?: number;
  contentMd5?: string;
  uploadContext?: UploadContext;
  uploadId?: string;
  uploadIntent?: UploadIntent;
}

type ContentChecksumType = "SHA_256";
type UploadIntent = 
  | "CODE_ANALYSIS"
  | "CODE_FIX"
  | "TASK_ASSIST_PLANNING"
  | "TEST_GENERATION"
  | "TRANSFORMATION"
  | "WORKSPACE_CONTEXT";
```

### 响应结构

```typescript
interface CreateUploadUrlResponse {
  uploadId: string;
  uploadUrl: string;
  kmsKeyArn?: string;
  requestHeaders?: Record<string, string>;
}
```

---

## 20. CreateArtifactUploadUrl - 创建制品上传 URL

**端点**: `POST /createartifactuploadurl`

结构与 CreateUploadUrl 类似。

---

# 七、用户记忆 API

## 21. CreateUserMemoryEntry - 创建用户记忆条目

**端点**: `POST /CreateUserMemoryEntry`

### 请求结构

```typescript
interface CreateUserMemoryEntryRequest {
  profileArn: string;
  memoryEntryString: string;  // 记忆内容
  origin?: Origin;
  clientToken?: string;       // 幂等性令牌
}

type Origin = "IDE" | "WEB";
```

### 响应结构

```typescript
interface CreateUserMemoryEntryResponse {
  memoryEntry?: MemoryEntry;
}

interface MemoryEntry {
  id: string;
  content: string;
  status: MemoryStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata?: MemoryEntryMetadata;
}

type MemoryStatus = "ACTIVE" | "DELETED";
```

---

## 22. DeleteUserMemoryEntry - 删除用户记忆条目

**端点**: `POST /DeleteUserMemoryEntry/{id}`

### 请求结构

```typescript
interface DeleteUserMemoryEntryRequest {
  id: string;          // 路径参数
  profileArn: string;
}
```

---

## 23. ListUserMemoryEntries - 列出用户记忆条目

**端点**: `POST /ListUserMemoryEntries`

### 请求结构

```typescript
interface ListUserMemoryEntriesRequest {
  profileArn: string;
  maxResults?: number;
  nextToken?: string;
}
```

### 响应结构

```typescript
interface ListUserMemoryEntriesResponse {
  memoryEntries?: MemoryEntry[];
  nextToken?: string;
}
```

---

# 八、工作区管理 API

## 24. CreateWorkspace - 创建工作区

**端点**: `POST /CreateWorkspace`

### 请求结构

```typescript
interface CreateWorkspaceRequest {
  profileArn: string;
  workspaceRoot: string;  // 工作区根路径
}
```

### 响应结构

```typescript
interface CreateWorkspaceResponse {
  workspace?: Workspace;
}

interface Workspace {
  workspaceId: string;
  workspaceRoot: string;
}
```

---

## 25. DeleteWorkspace - 删除工作区

**端点**: `POST /DeleteWorkspace`

### 请求结构

```typescript
interface DeleteWorkspaceRequest {
  profileArn: string;
  workspaceId: string;
}
```

---

## 26. ListWorkspaceMetadata - 列出工作区元数据

**端点**: `POST /ListWorkspaceMetadata`

### 请求结构

```typescript
interface ListWorkspaceMetadataRequest {
  profileArn: string;
  workspaceRoot?: string;
  maxResults?: number;
  nextToken?: string;
}
```

---

# 九、配置与订阅 API

## 27. GetProfile - 获取用户配置

**端点**: `POST /GetProfile`

### 请求结构

```typescript
interface GetProfileRequest {
  profileArn: string;
}
```

### 响应结构

```typescript
interface GetProfileResponse {
  profile?: Profile;
}

interface Profile {
  profileArn: string;
  profileName: string;
  profileType: ProfileType;
  profileStatus: ProfileStatus;
  overageStatus?: OverageStatus;
  // ... 其他字段
}

type ProfileType = "CODEWHISPERER" | "Q_DEVELOPER" | "KIRO";
type ProfileStatus = 
  | "ACTIVE"
  | "CREATE_FAILED"
  | "CREATING"
  | "DELETE_FAILED"
  | "DELETING"
  | "UPDATE_FAILED"
  | "UPDATING";
type OverageStatus = "ENABLED" | "DISABLED";
```

---

## 28. GetUsageLimits - 获取使用限制

**端点**: `GET /getUsageLimits`

### 请求参数 (Query String)

```typescript
interface GetUsageLimitsRequest {
  profileArn?: string;
  origin?: string;
  resourceType?: string;
  isEmailRequired?: boolean;
}
```

### 响应结构

```typescript
interface GetUsageLimitsResponse {
  usageLimits?: UsageLimit[];
  freeTrialStatus?: FreeTrialStatus;
}

interface UsageLimit {
  usageLimitType: UsageLimitType;
  currentUsage: number;
  maxUsage: number;
  resetAt?: Date;
}

type UsageLimitType = 
  | "CODE_COMPLETIONS"
  | "CODE_ANALYSIS"
  | "CHAT_MESSAGES"
  | "AGENT_TASKS";
```

---

## 29. UpdateUsageLimits - 更新使用限制

**端点**: `POST /updateUsageLimits`

### 请求结构

```typescript
interface UpdateUsageLimitsRequest {
  accountId?: string;
  accountlessUserId?: string;
  directoryId?: string;
  featureType?: string;
  justification?: string;
  permanentOverride?: boolean;
  requestedLimit?: number;
}
```

---

## 30. SetUserPreference - 设置用户偏好

**端点**: `POST /setUserPreference`

### 请求结构

```typescript
interface SetUserPreferenceRequest {
  profileArn: string;
  overageConfiguration?: OverageConfiguration;
}

interface OverageConfiguration {
  overageEnabled: boolean;
  overageLimit?: number;
}
```

---

## 31. ListAvailableProfiles - 列出可用配置

**端点**: `POST /ListAvailableProfiles`

---

## 32. ListAvailableCustomizations - 列出可用定制

**端点**: `POST /ListAvailableCustomizations`

---

## 33. ListAvailableModels - 列出可用模型

**端点**: `GET /ListAvailableModels`

### 请求参数

```typescript
interface ListAvailableModelsRequest {
  origin: string;      // 必填
  maxResults?: number;
  nextToken?: string;
  profileArn?: string;
  modelProvider?: ModelProvider;
}

type ModelProvider = "AMAZON" | "ANTHROPIC";
```

---

## 34. ListAvailableSubscriptions - 列出可用订阅

**端点**: `POST /listAvailableSubscriptions`

---

## 35. CreateSubscriptionToken - 创建订阅令牌

**端点**: `POST /CreateSubscriptionToken`

### 请求结构

```typescript
interface CreateSubscriptionTokenRequest {
  profileArn: string;
  provider: SubscriptionProvider;
  subscriptionType: SubscriptionType;
  cancelUrl?: string;
  successUrl?: string;
  statusOnly?: boolean;
  clientToken?: string;
}

type SubscriptionProvider = "AWS" | "STRIPE";
type SubscriptionType = "FREE" | "PRO" | "ENTERPRISE";
```

---

## 36. ListFeatureEvaluations - 列出功能评估

**端点**: `POST /ListFeatureEvaluations`

### 请求结构

```typescript
interface ListFeatureEvaluationsRequest {
  profileArn: string;
  userContext?: UserContext;
}
```

---

# 十、遥测 API

## 37. SendTelemetryEvent - 发送遥测事件

**端点**: `POST /SendTelemetryEvent`

### 请求结构

```typescript
interface SendTelemetryEventRequest {
  profileArn: string;
  telemetryEvent: TelemetryEvent;
  modelId?: string;
  optOutPreference?: OptOutPreference;
  userContext?: UserContext;
  clientToken?: string;
}

interface TelemetryEvent {
  // Union 类型，多种事件类型之一
  userTriggerDecisionEvent?: UserTriggerDecisionEvent;
  codeCoverageEvent?: CodeCoverageEvent;
  chatInteractWithMessageEvent?: ChatInteractWithMessageEvent;
  // ... 其他事件类型
}
```

---

## 38. PushTelemetryEvent - 推送遥测事件

**端点**: `POST /PushTelemetryEvent`

### 请求结构

```typescript
interface PushTelemetryEventRequest {
  eventType: string;
  event: any;  // 通用事件文档
  clientToken?: string;
}
```

---

# 十一、检索 API

## 39. GetRetrievals - 获取检索结果

**端点**: `POST /GetRetrievals`

### 请求结构

```typescript
interface GetRetrievalsRequest {
  query: string;
  languageName?: string;
  customizationArn?: string;
  maxResults?: number;
}
```

### 响应结构

```typescript
interface GetRetrievalsResponse {
  retrievals?: Retrieval[];
}

interface Retrieval {
  content: string;
  source?: string;
  score?: number;
}
```

---

# 枚举类型汇总

```typescript
// 功能名称
type FunctionalityName = 
  | "ANALYSIS"
  | "CHAT_CUSTOMIZATION"
  | "COMPLETIONS"
  | "CONVERSATIONS"
  | "FEATURE_DEVELOPMENT"
  | "TASK_ASSIST"
  | "TRANSFORMATIONS"
  | "TRANSFORMATIONS_WEBAPP";

// Agent 事件状态
type AgenticChatEventStatus = 
  | "CANCELLED"
  | "FAILED"
  | "SUCCEEDED";

// Agent 任务类型
type AgentTaskType = "spectask" | "vibe";

// 用户意图
type UserIntent = 
  | "APPLY_COMMON_BEST_PRACTICES"
  | "CITE_SOURCES"
  | "CODE_GENERATION"
  | "EXPLAIN_CODE_SELECTION"
  | "EXPLAIN_LINE_BY_LINE"
  | "GENERATE_CLOUDFORMATION_TEMPLATE"
  | "GENERATE_UNIT_TESTS"
  | "IMPROVE_CODE"
  | "SHOW_EXAMPLES"
  | "SUGGEST_ALTERNATE_IMPLEMENTATION";

// 支持的区域
const SUPPORTED_CODEWHISPERER_REGIONS = ["us-east-1", "eu-central-1"];
```

---

# SDK 调用示例

```typescript
import {
  CodeWhispererRuntimeClient,
  GenerateCompletionsCommand,
  CreateTaskAssistConversationCommand,
  StartCodeAnalysisCommand
} from "@amzn/codewhisperer-runtime";

// 初始化客户端
const client = new CodeWhispererRuntimeClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: "...",
    secretAccessKey: "...",
    sessionToken: "..."
  },
  // 或使用 Bearer Token
  token: async () => ({ token: "your-bearer-token" })
});

// 1. 生成代码补全
const completions = await client.send(new GenerateCompletionsCommand({
  profileArn: "arn:aws:codewhisperer:us-east-1:xxx:profile/xxx",
  fileContext: {
    leftFileContent: "function add(a, b) {\n  return ",
    rightFileContent: "\n}",
    filename: "math.js",
    programmingLanguage: { languageName: "javascript" }
  }
}));

// 2. 创建对话
const conversation = await client.send(new CreateTaskAssistConversationCommand({
  profileArn: "arn:aws:codewhisperer:us-east-1:xxx:profile/xxx"
}));
console.log("对话 ID:", conversation.conversationId);

// 3. 启动代码分析
const analysis = await client.send(new StartCodeAnalysisCommand({
  profileArn: "arn:aws:codewhisperer:us-east-1:xxx:profile/xxx",
  artifacts: [{
    artifactType: "SourceCode",
    uploadId: "upload-xxx"
  }],
  scope: "PROJECT"
}));
console.log("分析任务 ID:", analysis.jobId);
```

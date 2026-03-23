# HAR 文件中的 API 接口分析

## 源码位置

**Kiro IDE 源码**: `C:\Users\12925\AppData\Local\Programs\Kiro\resources\app\extensions\kiro.kiro-agent\dist\extension.js`

**端点配置** (行 678960-678975):
```javascript
usEast1Config = {
  region: "us-east-1",
  endpoint: "https://q.us-east-1.amazonaws.com"
};
euCentral1Config = {
  region: "eu-central-1",
  endpoint: "https://q.eu-central-1.amazonaws.com"
};
```

**支持的 Regions** (行 202771):
```javascript
SUPPORTED_CODEWHISPERER_REGIONS = ["us-east-1", "eu-central-1"]
```

**重要说明**：
- ✅ CodeWhisperer API (`q.amazonaws.com`) 只支持 2 个 region：`us-east-1`、`eu-central-1`
- ✅ AWS SSO OIDC Token 刷新 (`oidc.{region}.amazonaws.com`) 支持所有 AWS region（如 `ap-southeast-2`）
- ⚠️ **不要混淆**：Token 刷新的 region 和 CodeWhisperer API 的 region 是独立的

**API 路径定义**:
- `/GetProfile` - 行 554999
- `/getUsageLimits` - 行 555082
- `/ListAvailableModels` - 行 555113
- `/ListAvailableProfiles` - 行 555131
- `/mcp` - 行 566212

## 接口列表

### 1. AWS SSO OIDC Token 刷新
- **URL**: `https://oidc.ap-southeast-2.amazonaws.com/token`
- **方法**: POST
- **状态**: 200
- **用途**: 刷新 Enterprise 账号的 Access Token
- **请求体**:
  ```json
  {
    "clientId": "z9Ce-if5EqxVu6V09Cw1CWFwLXNvdXRoZWFzdC0y",
    "clientSecret": "eyJ...(JWT)",
    "grantType": "refresh_token",
    "refreshToken": "aorAAAAAGnnhFcE..."
  }
  ```

### 2. Kiro Powers 注册表
- **URL**: `https://prod.download.desktop.kiro.dev/powers/default_registry.json`
- **方法**: GET
- **状态**: 200
- **用途**: 获取可用的 Kiro Powers 列表

### 3. 列出可用 Profiles
- **URL**: `https://q.{region}.amazonaws.com/ListAvailableProfiles`
- **方法**: POST
- **状态**: 200
- **源码行号**: 555131
- **请求体**:
  ```json
  {
    "maxResults": 100,  // 可选
    "nextToken": ""     // 可选，分页
  }
  ```
- **用途**: 获取用户可用的 CodeWhisperer Profiles
- **Region**: us-east-1, eu-central-1

### 4. MCP 相关
- **URL**: `https://q.us-east-1.amazonaws.com/mcp`
- **方法**: POST
- **状态**: 200
- **用途**: MCP 服务器相关操作

### 5. 获取配额限制
- **URL**: `https://q.us-east-1.amazonaws.com/getUsageLimits`
- **方法**: GET
- **状态**: 200
- **参数**:
  - `origin=AI_EDITOR`
  - `resourceType=AGENTIC_REQUEST`
  - `profileArn=arn:aws:codewhisperer:us-east-1:026108249975:profile/CUMK4U4HCRNM` (可选)
  - `isEmailRequired=true` (可选)
- **用途**: 查询账号配额使用情况

### 6. 列出可用模型
- **URL**: `https://q.us-east-1.amazonaws.com/ListAvailableModels`
- **方法**: GET
- **状态**: 200
- **参数**:
  - `origin=AI_EDITOR`
  - `profileArn=arn:aws:codewhisperer:us-east-1:026108249975:profile/CUMK4U4HCRNM`
- **用途**: 获取可用的 AI 模型列表

### 7. 获取 Profile 详情
- **URL**: `https://q.us-east-1.amazonaws.com/GetProfile`
- **方法**: POST
- **状态**: 200
- **用途**: 获取 Profile 的详细信息

## 接口分类

### 认证相关
1. `POST https://oidc.{region}.amazonaws.com/token` - Token 刷新

### CodeWhisperer API (q.amazonaws.com)
1. `POST /ListAvailableProfiles` - 列出 Profiles
2. `GET /getUsageLimits` - 获取配额
3. `GET /ListAvailableModels` - 列出模型
4. `POST /GetProfile` - 获取 Profile 详情
5. `POST /mcp` - MCP 相关

### Kiro 服务
1. `GET https://prod.download.desktop.kiro.dev/powers/default_registry.json` - Powers 注册表

## 关键发现

### 1. Region 信息
- **OIDC Token 刷新**: `ap-southeast-2` (澳大利亚)
- **CodeWhisperer API**: `us-east-1` (主要), `eu-central-1` (备用)

### 2. Profile ARN 格式
```
arn:aws:codewhisperer:us-east-1:026108249975:profile/CUMK4U4HCRNM
```

### 3. 配额查询参数
- `origin=AI_EDITOR` - 来源标识
- `resourceType=AGENTIC_REQUEST` - 资源类型
- `profileArn` - Profile ARN (可选)
- `isEmailRequired=true` - 是否需要邮箱信息

### 4. 多 Region 支持
CodeWhisperer API 同时查询多个 Region：
- `us-east-1` (美国东部)
- `eu-central-1` (欧洲中部)

## 实现建议

### 已实现
- ✅ Token 刷新 (`aws_sso_client.rs`)

### 待实现
- ⏳ 列出可用 Profiles
- ⏳ 获取配额限制（更详细的信息）
- ⏳ 列出可用模型
- ⏳ 获取 Profile 详情

### 优先级
1. **高**: Token 刷新（已实现）
2. **中**: 获取配额限制（已部分实现）
3. **低**: 列出 Profiles、模型、详情

## 相关文件
- HAR 文件: `docs/har/prod.download.desktop.kiro.dev_2026_01_24_07_22_48.har`
- Token 刷新实现: `src-tauri/src/aws_sso_client.rs`
- JWT 分析: `docs/har/jwt-analysis.md`

# GetUserUsageAndLimits 接口文档

## 接口信息

- **服务**: KiroWebPortalService
- **操作**: GetUserUsageAndLimits
- **URL**: `https://app.kiro.dev/service/KiroWebPortalService/operation/GetUserUsageAndLimits`
- **方法**: POST
- **协议**: RPC-v2-CBOR
- **认证**: Bearer Token + Cookie

## 请求格式

### 请求头

```http
POST /service/KiroWebPortalService/operation/GetUserUsageAndLimits HTTP/1.1
Host: app.kiro.dev
Content-Type: application/cbor
Accept: application/cbor
smithy-protocol: rpc-v2-cbor
Authorization: Bearer {accessToken}
Cookie: Idp={provider}; AccessToken={accessToken}
```

### 请求体（CBOR 编码）

```json
{
  "isEmailRequired": true,
  "origin": "KIRO_IDE"
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `isEmailRequired` | boolean | 是 | 是否需要返回 email 字段 |
| `origin` | string | 是 | 请求来源，固定值 `"KIRO_IDE"` |

### 认证参数

| 参数 | 位置 | 说明 |
|------|------|------|
| `accessToken` | Header (Authorization) | Bearer Token 格式 |
| `accessToken` | Cookie | 同上，需要同时传递 |
| `provider` | Cookie (Idp) | 账号类型：`Google`、`Github`、`BuilderId`、`Enterprise` |

## 响应格式

### 响应头

```http
HTTP/1.1 200 OK
Content-Type: application/cbor
```

### 响应体（CBOR 编码）

响应体结构因账号类型而异，但都包含以下顶层字段：

```json
{
  "daysUntilReset": 0,
  "limits": [],
  "nextDateReset": "2026-02-01T00:00:00Z",
  "overageConfiguration": {
    "overageEnabled": false
  },
  "subscriptionInfo": { ... },
  "usageBreakdownList": [ ... ],
  "userInfo": { ... }
}
```

## 响应字段说明

### 顶层字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `daysUntilReset` | integer | 距离配额重置的天数 |
| `limits` | array | 限制列表（通常为空） |
| `nextDateReset` | datetime | 下次配额重置时间（UTC） |
| `overageConfiguration` | object | 超额配置 |
| `subscriptionInfo` | object | 订阅信息 |
| `usageBreakdownList` | array | 配额使用详情列表 |
| `userInfo` | object | 用户信息 |

### subscriptionInfo（订阅信息）

| 字段 | 类型 | 说明 | 可能值 |
|------|------|------|--------|
| `type` | string | 订阅类型 | `Q_DEVELOPER_STANDALONE_FREE`（免费版）<br>`Q_DEVELOPER_STANDALONE_POWER`（付费版） |
| `subscriptionTitle` | string | 订阅标题 | `KIRO FREE`、`KIRO POWER` |
| `overageCapability` | string | 超额能力 | `OVERAGE_INCAPABLE`（不支持）<br>`OVERAGE_CAPABLE`（支持） |
| `upgradeCapability` | string | 升级能力 | `UPGRADE_CAPABLE`（可升级）<br>`UPGRADE_INCAPABLE`（不可升级） |
| `subscriptionManagementTarget` | string | 订阅管理目标 | `PURCHASE`（需购买）<br>`MANAGE`（可管理） |

### usageBreakdownList[0]（配额详情）

#### 基础字段（所有账号类型）

| 字段 | 类型 | 说明 |
|------|------|------|
| `resourceType` | string | 资源类型，固定值 `"CREDIT"` |
| `displayName` | string | 显示名称（单数），固定值 `"Credit"` |
| `displayNamePlural` | string | 显示名称（复数），固定值 `"Credits"` |
| `unit` | string | 单位，固定值 `"INVOCATIONS"` |
| `currency` | string | 货币，固定值 `"USD"` |
| `usageLimit` | integer | 配额上限（整数） |
| `usageLimitWithPrecision` | float | 配额上限（精确值） |
| `currentUsage` | integer | 当前使用量（整数） |
| `currentUsageWithPrecision` | float | 当前使用量（精确值） |
| `currentOverages` | integer | 当前超额量（整数） |
| `currentOveragesWithPrecision` | float | 当前超额量（精确值） |
| `overageCap` | integer | 超额上限，固定值 `10000` |
| `overageCapWithPrecision` | float | 超额上限（精确值），固定值 `10000.0` |
| `overageRate` | float | 超额费率，固定值 `0.04` |
| `overageCharges` | float | 超额费用 |
| `bonuses` | array | 奖励配额列表 |
| `nextDateReset` | datetime | 下次重置时间（UTC） |

#### freeTrialInfo（试用配额）- 仅免费版

| 字段 | 类型 | 说明 |
|------|------|------|
| `usageLimit` | integer | 试用配额上限，固定值 `500` |
| `usageLimitWithPrecision` | float | 试用配额上限（精确值），固定值 `500.0` |
| `currentUsage` | integer | 试用配额使用量（整数） |
| `currentUsageWithPrecision` | float | 试用配额使用量（精确值） |
| `freeTrialStatus` | string | 试用状态：`"ACTIVE"`（激活）、`"EXPIRED"`（过期） |
| `freeTrialExpiry` | datetime | 试用过期时间（UTC） |

#### bonuses[i]（奖励配额）- 可选

| 字段 | 类型 | 说明 |
|------|------|------|
| `bonusCode` | string | 奖励代码（如 `"day-3-reinvent-gav-lemo-mit"`） |
| `displayName` | string | 显示名称（如 `"Day 3 Re:Invent"`） |
| `description` | string | 描述 |
| `usageLimit` | float | 奖励配额上限 |
| `currentUsage` | float | 奖励配额使用量 |
| `status` | string | 状态：`"ACTIVE"`（激活）、`"EXPIRED"`（过期） |
| `redeemedAt` | datetime | 兑换时间（UTC） |
| `expiresAt` | datetime | 过期时间（UTC） |

### userInfo（用户信息）

| 字段 | 类型 | 说明 |
|------|------|------|
| `userId` | string | 用户 ID（格式：`d-{orgId}.{uuid}`） |
| `email` | string | 用户邮箱（**Enterprise 账号无此字段**） |

## 账号类型差异

### 免费版（Google / Github / BuilderId）

```json
{
  "subscriptionInfo": {
    "type": "Q_DEVELOPER_STANDALONE_FREE",
    "subscriptionTitle": "KIRO FREE",
    "overageCapability": "OVERAGE_INCAPABLE",
    "upgradeCapability": "UPGRADE_CAPABLE"
  },
  "usageBreakdownList": [
    {
      "usageLimit": 50,
      "usageLimitWithPrecision": 50.0,
      "freeTrialInfo": {
        "usageLimit": 500,
        "usageLimitWithPrecision": 500.0,
        "freeTrialStatus": "ACTIVE",
        "freeTrialExpiry": "2026-01-31T06:52:04.970000Z"
      }
    }
  ],
  "userInfo": {
    "userId": "d-9067c98495.14783408-d041-703f-20bc-39709c27f6f3",
    "email": "user@example.com"
  }
}
```

**特点**：
- 主配额：50
- 试用配额：500
- 总配额：550（试用激活时）
- 有 email 字段
- 可能有 bonuses 字段

### 付费版（Enterprise）

```json
{
  "subscriptionInfo": {
    "type": "Q_DEVELOPER_STANDALONE_POWER",
    "subscriptionTitle": "KIRO POWER",
    "overageCapability": "OVERAGE_CAPABLE",
    "upgradeCapability": "UPGRADE_INCAPABLE"
  },
  "usageBreakdownList": [
    {
      "usageLimit": 10000,
      "usageLimitWithPrecision": 10000.0
      // ❌ 无 freeTrialInfo 字段
    }
  ],
  "userInfo": {
    "userId": "d-9767936181.c97e64c8-5011-709d-bf5b-d8401d5132d9"
    // ❌ 无 email 字段
  }
}
```

**特点**：
- 配额：10000
- 无试用配额
- 无 email 字段
- 支持超额使用

## 配额计算逻辑

### 免费版

```javascript
function calculateFreeUsage(breakdown) {
  // 主配额
  const mainUsed = breakdown.currentUsageWithPrecision ?? breakdown.currentUsage ?? 0
  const mainLimit = breakdown.usageLimitWithPrecision ?? breakdown.usageLimit ?? 50
  
  // 试用配额
  const trial = breakdown.freeTrialInfo
  const trialActive = trial?.freeTrialStatus === "ACTIVE"
  const trialUsed = trialActive ? (trial.currentUsageWithPrecision ?? trial.currentUsage ?? 0) : 0
  const trialLimit = trialActive ? (trial.usageLimitWithPrecision ?? trial.usageLimit ?? 0) : 0
  
  // 奖励配额
  const bonuses = breakdown.bonuses ?? []
  const bonusRemaining = bonuses.reduce((sum, b) => {
    if (b.status === "ACTIVE") {
      const limit = b.usageLimit ?? 0
      const used = b.currentUsage ?? 0
      return sum + Math.max(0, limit - used)
    }
    return sum
  }, 0)
  
  // 总配额
  const totalUsed = mainUsed + trialUsed
  const totalLimit = mainLimit + trialLimit + bonusRemaining
  const remaining = Math.max(0, totalLimit - totalUsed)
  
  return {
    used: Math.round(totalUsed),
    limit: Math.round(totalLimit),
    remaining: Math.round(remaining)
  }
}
```

### 付费版

```javascript
function calculatePowerUsage(breakdown) {
  const used = breakdown.currentUsageWithPrecision ?? breakdown.currentUsage ?? 0
  const limit = breakdown.usageLimitWithPrecision ?? breakdown.usageLimit ?? 10000
  const remaining = Math.max(0, limit - used)
  
  return {
    used: Math.round(used),
    limit: Math.round(limit),
    remaining: Math.round(remaining)
  }
}
```

## 错误响应

### 401 Unauthorized（Token 过期）

```json
{
  "__type": "UnauthorizedException",
  "message": "Token expired or invalid"
}
```

**处理**：需要刷新 Token

### 403 Forbidden（账号封禁）

```json
{
  "reason": "TEMPORARILY_SUSPENDED",
  "message": "账号已被暂停"
}
```

**处理**：标记账号为封禁状态

### 423 Locked（账号暂停）

```json
{
  "__type": "AccountSuspendedException",
  "message": "账号已被暂停"
}
```

**处理**：标记账号为封禁状态

## 示例代码

### Rust（使用 reqwest + ciborium）

```rust
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct GetUserUsageAndLimitsRequest {
    #[serde(rename = "isEmailRequired")]
    is_email_required: bool,
    origin: String,
}

async fn get_user_usage_and_limits(
    client: &Client,
    access_token: &str,
    idp: &str,
) -> Result<serde_json::Value, String> {
    let url = "https://app.kiro.dev/service/KiroWebPortalService/operation/GetUserUsageAndLimits";
    
    let request = GetUserUsageAndLimitsRequest {
        is_email_required: true,
        origin: "KIRO_IDE".to_string(),
    };
    
    // CBOR 编码
    let mut body = Vec::new();
    ciborium::into_writer(&request, &mut body)
        .map_err(|e| format!("CBOR encode error: {}", e))?;
    
    let cookie = format!("Idp={}; AccessToken={}", idp, access_token);
    
    let response = client
        .post(url)
        .header("Content-Type", "application/cbor")
        .header("Accept", "application/cbor")
        .header("smithy-protocol", "rpc-v2-cbor")
        .header("authorization", format!("Bearer {}", access_token))
        .header("Cookie", cookie)
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    let status = response.status();
    let bytes = response.bytes().await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    
    if !status.is_success() {
        return Err(format!("Request failed with status: {}", status));
    }
    
    // CBOR 解码
    ciborium::from_reader(&bytes[..])
        .map_err(|e| format!("CBOR decode error: {}", e))
}
```

### Python（使用 requests + cbor2）

```python
import requests
import cbor2

def get_user_usage_and_limits(access_token: str, idp: str) -> dict:
    url = "https://app.kiro.dev/service/KiroWebPortalService/operation/GetUserUsageAndLimits"
    
    # CBOR 编码
    request_data = {
        "isEmailRequired": True,
        "origin": "KIRO_IDE"
    }
    body = cbor2.dumps(request_data)
    
    # 请求头
    headers = {
        "Content-Type": "application/cbor",
        "Accept": "application/cbor",
        "smithy-protocol": "rpc-v2-cbor",
        "authorization": f"Bearer {access_token}",
        "Cookie": f"Idp={idp}; AccessToken={access_token}"
    }
    
    response = requests.post(url, data=body, headers=headers, timeout=30)
    response.raise_for_status()
    
    # CBOR 解码
    return cbor2.loads(response.content)
```

## 测试数据

完整的测试响应数据已保存到：
- [Google 账号响应](./usage_response_google.json)
- [Github 账号响应](./usage_response_github.json)
- [BuilderId 账号响应](./usage_response_builderid.json)
- [Enterprise 账号响应](./usage_response_enterprise.json)

## 相关文档

- [配额响应格式对比](./usage-response-comparison.md)
- [Enterprise 响应格式详解](./enterprise-response-format.md)
- [Enterprise vs BuilderId 对比](./Enterprise-vs-BuilderId.md)
- [Kiro API 核心服务](./Kiro%20API%20(核心服务).md)

## 更新记录

- 2026-01-25: 创建文档，测试所有四种账号类型

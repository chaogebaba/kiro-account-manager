# IdC 登录流程 (BuilderId/Enterprise)

## 流程概览

```
1. AWS SSO OIDC 注册客户端 → 获取 clientId, clientSecret
2. AWS SSO OIDC 设备授权 → 获取 deviceCode, userCode, verificationUri
3. 用户浏览器授权
4. AWS SSO OIDC 轮询 Token → 获取 accessToken, refreshToken
5. CodeWhisperer API 获取配额 → 获取 usageBreakdownList, bonuses 等
6. AWS SSO OIDC 刷新 → 获取新的 accessToken, refreshToken
```

---

## 1. POST /client/register - 注册客户端

**端点**: `https://oidc.{region}.amazonaws.com/client/register`

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
  "clientName": "Kiro-BuilderId",
  "clientType": "public",
  "scopes": [
    "codewhisperer:completions",
    "codewhisperer:analysis", 
    "codewhisperer:conversations"
  ],
  "grantTypes": [
    "authorization_code",
    "refresh_token"
  ],
  "redirectUris": [
    "http://127.0.0.1:{port}/oauth/callback"
  ],
  "issuerUrl": "https://identitycenter.amazonaws.com/ssoins-xxx"
}
```

**响应**:
```json
{
  "clientId": "string",
  "clientSecret": "string",
  "clientIdIssuedAt": 1764520000,
  "clientSecretExpiresAt": 1767112000
}
```

---

## 2. POST /device_authorization - 设备授权

**端点**: `https://oidc.{region}.amazonaws.com/device_authorization`

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
  "clientId": "string",
  "clientSecret": "string",
  "startUrl": "https://view.awsapps.com/start"
}
```

**响应**:
```json
{
  "deviceCode": "string",
  "userCode": "XXXX-XXXX",
  "verificationUri": "https://device.sso.{region}.amazonaws.com/",
  "verificationUriComplete": "https://device.sso.{region}.amazonaws.com/?user_code=XXXX-XXXX",
  "expiresIn": 600,
  "interval": 1
}
```

---

## 3. POST /token - 获取 Token (设备码轮询)

**端点**: `https://oidc.{region}.amazonaws.com/token`

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
  "clientId": "string",
  "clientSecret": "string",
  "grantType": "urn:ietf:params:oauth:grant-type:device_code",
  "deviceCode": "string"
}
```

**成功响应**:
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "id_token": "string | null",
  "token_type": "Bearer",
  "expires_in": 28800,
  "awsSsoAppSessionId": "string | null"
}
```

**轮询中响应**:
```json
{
  "error": "authorization_pending",
  "error_description": "User has not yet completed authorization"
}
```

**其他错误**:
```json
{
  "error": "slow_down | expired_token | access_denied",
  "error_description": "string"
}
```

---

## 4. POST /token - 获取 Token (授权码模式)

**端点**: `https://oidc.{region}.amazonaws.com/token`

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
  "clientId": "string",
  "clientSecret": "string",
  "grantType": "authorization_code",
  "code": "string",
  "codeVerifier": "string",
  "redirectUri": "http://127.0.0.1:{port}/oauth/callback"
}
```

**响应**:
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "id_token": "string | null",
  "token_type": "Bearer",
  "expires_in": 28800,
  "awsSsoAppSessionId": "string | null"
}
```

---

## 5. POST /token - 刷新 Token

**端点**: `https://oidc.{region}.amazonaws.com/token`

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
  "clientId": "string",
  "clientSecret": "string",
  "grantType": "refresh_token",
  "refreshToken": "string"
}
```

**响应**:
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "id_token": "string | null",
  "token_type": "Bearer",
  "expires_in": 28800,
  "awsSsoAppSessionId": "string | null"
}
```

---

## 6. GET /getUsageLimits - 获取配额

**端点**: `https://codewhisperer.us-east-1.amazonaws.com/getUsageLimits`

**请求参数 (Query)**:
```
isEmailRequired=true
origin=AI_EDITOR
profileArn=arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK
```

**请求头**:
```
Authorization: Bearer {accessToken}
Accept: application/json
```

**响应**:
```json
{
  "daysUntilReset": 30,
  "nextDateReset": 1767225600.0,
  "limits": [],
  "overageConfiguration": {
    "overageStatus": "DISABLED | ENABLED"
  },
  "subscriptionInfo": {
    "subscriptionTitle": "KIRO PRO+",
    "type": "Q_DEVELOPER_STANDALONE_PRO_PLUS",
    "overageCapability": "OVERAGE_CAPABLE",
    "upgradeCapability": "UPGRADE_CAPABLE",
    "subscriptionManagementTarget": "MANAGE"
  },
  "usageBreakdown": null,
  "usageBreakdownList": [
    {
      "usageLimit": 2000,
      "usageLimitWithPrecision": 2000.0,
      "currentUsage": 100,
      "currentUsageWithPrecision": 100.5,
      "nextDateReset": 1767225600.0,
      "displayName": "Credit",
      "displayNamePlural": "Credits",
      "resourceType": "CREDIT",
      "unit": "INVOCATIONS",
      "currency": "USD",
      "overageRate": 0.04,
      "overageCap": 10000,
      "overageCapWithPrecision": 10000.0,
      "currentOverages": 0,
      "currentOveragesWithPrecision": 0.0,
      "overageCharges": 0.0,
      "freeTrialInfo": {
        "usageLimit": 500,
        "usageLimitWithPrecision": 500.0,
        "currentUsage": 0,
        "currentUsageWithPrecision": 0.0,
        "freeTrialExpiry": 1765689306.937,
        "freeTrialStatus": "ACTIVE | EXPIRED"
      },
      "bonuses": [
        {
          "bonusCode": "day-3-reinvent-gav-lemo-mit",
          "displayName": "Day 3 Re:Invent",
          "usageLimit": 1000.0,
          "currentUsage": 0.0,
          "expiresAt": 1767410676.511,
          "status": "ACTIVE | EXHAUSTED | EXPIRED"
        }
      ]
    }
  ],
  "userInfo": {
    "email": "user@example.com",
    "userId": "d-xxx.xxx-xxx-xxx"
  }
}
```

---

## 字段清单

### 客户端注册响应
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| clientId | string | ✅ | 客户端ID |
| clientSecret | string | ✅ | 客户端密钥 |
| clientIdIssuedAt | number | ✅ | 签发时间戳 |
| clientSecretExpiresAt | number | ✅ | 过期时间戳 |

### 设备授权响应
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| deviceCode | string | ✅ | 设备码 |
| userCode | string | ✅ | 用户码 |
| verificationUri | string | ✅ | 验证地址 |
| verificationUriComplete | string | ✅ | 完整验证地址 |
| expiresIn | number | ✅ | 过期时间(秒) |
| interval | number | ✅ | 轮询间隔(秒) |

### Token 响应字段
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| access_token | string | ✅ | 访问令牌 |
| refresh_token | string | ✅ | 刷新令牌 |
| id_token | string | ❌ | ID Token |
| token_type | string | ✅ | Token 类型 |
| expires_in | number | ✅ | 过期时间(秒) |
| awsSsoAppSessionId | string | ❌ | SSO 会话ID |

### subscriptionInfo 字段
| 字段 | 类型 | 说明 |
|------|------|------|
| subscriptionTitle | string | 订阅名称 |
| type | string | 订阅类型 |
| overageCapability | string | 超额能力 |
| upgradeCapability | string | 升级能力 |
| subscriptionManagementTarget | string | 管理目标 |

### overageConfiguration 字段
| 字段 | 类型 | 说明 |
|------|------|------|
| overageStatus | string | DISABLED / ENABLED |

### usageBreakdownList[] 字段
| 字段 | 类型 | 说明 |
|------|------|------|
| usageLimit | number | 配额上限 |
| usageLimitWithPrecision | number | 配额上限(精确) |
| currentUsage | number | 已使用量 |
| currentUsageWithPrecision | number | 已使用量(精确) |
| nextDateReset | number | 重置时间戳 |
| displayName | string | 显示名称 |
| displayNamePlural | string | 复数名称 |
| resourceType | string | 资源类型 |
| unit | string | 单位 |
| currency | string | 货币 |
| overageRate | number | 超额费率 |
| overageCap | number | 超额上限 |
| overageCapWithPrecision | number | 超额上限(精确) |
| currentOverages | number | 当前超额 |
| currentOveragesWithPrecision | number | 当前超额(精确) |
| overageCharges | number | 超额费用 |

### freeTrialInfo 字段
| 字段 | 类型 | 说明 |
|------|------|------|
| usageLimit | number | 试用配额 |
| usageLimitWithPrecision | number | 试用配额(精确) |
| currentUsage | number | 试用已用 |
| currentUsageWithPrecision | number | 试用已用(精确) |
| freeTrialExpiry | number | 试用过期时间戳 |
| freeTrialStatus | string | ACTIVE / EXPIRED |

### bonuses[] 字段
| 字段 | 类型 | 说明 |
|------|------|------|
| bonusCode | string | 奖励码 |
| displayName | string | 显示名称 |
| usageLimit | number | 奖励配额 |
| currentUsage | number | 奖励已用 |
| expiresAt | number | 过期时间戳 |
| status | string | ACTIVE / EXHAUSTED / EXPIRED |

**注意**: IdC 的 bonuses 没有 `description` 和 `redeemedAt` 字段

### userInfo 字段
| 字段 | 类型 | 说明 |
|------|------|------|
| email | string | 邮箱 |
| userId | string | 用户ID |

---

## 与 Social 流程的区别

| 项目 | Social | IdC |
|------|--------|-----|
| 认证服务 | Desktop Auth API | AWS SSO OIDC |
| 配额服务 | CodeWhisperer API | CodeWhisperer API |
| csrfToken | ✅ 有 | ❌ 无 |
| 兑换奖励 | ✅ 支持 | ❌ 不支持 |
| WithPrecision 字段 | ❌ 无 | ✅ 有 |
| bonuses.description | ✅ 有 | ❌ 无 |
| bonuses.redeemedAt | ✅ 有 | ❌ 无 |
| 需要 clientId/Secret | ❌ 不需要 | ✅ 需要保存 |
| Token 过期时间 | 3600秒 (1小时) | 28800秒 (8小时) |

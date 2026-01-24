# Social 登录流程

Kiro 桌面端支持通过第三方社交账号登录。

## Social 登录类型

| Provider | idp 参数 | 说明 |
|----------|----------|------|
| **Google** | `Google` | Google 账号登录 |
| **Github** | `Github` | Github 账号登录 (注意小写 h) |

> **注意**: Github 的 idp 参数是 `Github` (小写 h)，不是 `Github`。

---

## 流程概览

```
1. Desktop Auth API 登录 → 获取 accessToken, refreshToken, csrfToken
2. Desktop Auth API 刷新 → 获取新的 accessToken, refreshToken, csrfToken
3. Desktop API 获取配额 → 获取 usageBreakdownList, bonuses 等
4. Web Portal API 兑换 → 使用 csrfToken 兑换奖励码
```

---

## 1. GET /login - 打开登录页面

**端点**: `https://prod.us-east-1.auth.desktop.kiro.dev/login`

**请求参数 (Query)**:
```
idp=Google | Github
redirect_uri=http://localhost:{port}/oauth/callback
code_challenge={base64url(sha256(code_verifier))}
code_challenge_method=S256
state={uuid}
```

**响应**: 302 重定向到 OAuth 提供商

---

## 2. POST /oauth/token - 登录获取 Token

**端点**: `https://prod.us-east-1.auth.desktop.kiro.dev/oauth/token`

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
  "code": "string",
  "code_verifier": "string",
  "redirect_uri": "http://localhost:{port}/oauth/callback",
  "invitation_code": "string | null"
}
```

**响应**:
```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "profileArn": "string | null",
  "expiresIn": 3600,
  "idToken": "string | null",
  "tokenType": "Bearer",
  "csrfToken": "string | null"
}
```

---

## 3. GET /getUsageLimits - 获取配额 (可选)

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
  "daysUntilReset": 0,
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
      "currentUsage": 0,
      "nextDateReset": 1767225600.0,
      "currency": "USD",
      "overageRate": 0.04,
      "overageCap": 10000,
      "freeTrialInfo": {
        "usageLimit": 500,
        "currentUsage": 0,
        "freeTrialExpiry": 1765689306.937,
        "freeTrialStatus": "ACTIVE | EXPIRED"
      },
      "bonuses": [
        {
          "bonusCode": "day-3-reinvent-gav-lemo-mit",
          "displayName": "Day 3 Re:Invent",
          "description": "Re:Invent day 3 code",
          "usageLimit": 1000.0,
          "currentUsage": 0.0,
          "expiresAt": 1767410676.511,
          "redeemedAt": 1764818676.511,
          "status": "ACTIVE | EXHAUSTED | EXPIRED"
        }
      ]
    }
  ],
  "userInfo": {
    "email": "user@gmail.com",
    "userId": "d-xxx.xxx-xxx-xxx"
  }
}
```

---

## 4. POST /refreshToken - 刷新 Token

**端点**: `https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken`

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
  "refreshToken": "string"
}
```

**响应**:
```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "profileArn": "string | null",
  "expiresIn": 3600,
  "csrfToken": "string | null"
}
```

---

## 5. POST CreateUserBonus - 兑换奖励码

**端点**: `https://app.kiro.dev/service/KiroWebPortalService/operation/CreateUserBonus`

**请求头**:
```
Content-Type: application/cbor
Accept: application/cbor
smithy-protocol: rpc-v2-cbor
Authorization: Bearer {accessToken}
Cookie: AccessToken={accessToken}; RefreshToken={refreshToken}; Idp=Google
x-csrf-token: {csrfToken}
amz-sdk-invocation-id: {uuid}
amz-sdk-request: attempt=1; max=1
x-amz-user-agent: aws-sdk-js/1.0.0
```

**请求体 (CBOR)**:
```json
{
  "bonusCode": "day-4-reinvent-xaw-xeno-tiw"
}
```

**成功响应 (CBOR)**:
```json
{
  "amount": 1000,
  "bonusCode": "day-4-reinvent-xaw-xeno-tiw",
  "expirationDate": 1767501836.671
}
```

**错误响应 (CBOR)**:
```json
{
  "__type": "com.amazon.kirowebportalservice#BadRequestException",
  "message": "You have already redeemed this code"
}
```

---

## 6. POST /logout - 登出

**端点**: `https://prod.us-east-1.auth.desktop.kiro.dev/logout`

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
  "refreshToken": "string"
}
```

**响应**: 200 OK

---

## 字段清单

### Token 响应字段
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| accessToken | string | ✅ | 访问令牌 |
| refreshToken | string | ✅ | 刷新令牌 |
| profileArn | string | ❌ | Profile ARN |
| expiresIn | number | ✅ | 过期时间(秒) |
| idToken | string | ❌ | ID Token |
| tokenType | string | ❌ | Token 类型 |
| csrfToken | string | ❌ | CSRF Token (兑换用) |

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
| currentUsage | number | 已使用量 |
| nextDateReset | number | 重置时间戳 |
| currency | string | 货币 |
| overageRate | number | 超额费率 |
| overageCap | number | 超额上限 |

### freeTrialInfo 字段
| 字段 | 类型 | 说明 |
|------|------|------|
| usageLimit | number | 试用配额 |
| currentUsage | number | 试用已用 |
| freeTrialExpiry | number | 试用过期时间戳 |
| freeTrialStatus | string | ACTIVE / EXPIRED |

### bonuses[] 字段
| 字段 | 类型 | 说明 |
|------|------|------|
| bonusCode | string | 奖励码 |
| displayName | string | 显示名称 |
| description | string | 描述 |
| usageLimit | number | 奖励配额 |
| currentUsage | number | 奖励已用 |
| expiresAt | number | 过期时间戳 |
| redeemedAt | number | 兑换时间戳 |
| status | string | ACTIVE / EXHAUSTED / EXPIRED |

### userInfo 字段
| 字段 | 类型 | 说明 |
|------|------|------|
| email | string | 邮箱 |
| userId | string | 用户ID |

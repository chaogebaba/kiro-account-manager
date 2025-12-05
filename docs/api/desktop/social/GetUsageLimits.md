# GetUsageLimits (Desktop) - 桌面端获取配额

## 说明

这是 Kiro IDE 桌面端使用的获取配额接口，与网页端接口不同：
- 网页端: `https://app.kiro.dev/service/KiroWebPortalService/operation/GetUserUsageAndLimits` (CBOR)
- 桌面端: `https://codewhisperer.us-east-1.amazonaws.com/getUsageLimits` (JSON)

## 请求

```
GET https://codewhisperer.us-east-1.amazonaws.com/getUsageLimits
Authorization: Bearer <accessToken>
```

## Query 参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| isEmailRequired | boolean | 是 | true |
| origin | string | 是 | AI_EDITOR |
| profileArn | string | 是 | AWS Profile ARN |
| resourceType | string | 否 | AGENTIC_REQUEST |

## 请求示例

```
GET https://codewhisperer.us-east-1.amazonaws.com/getUsageLimits?isEmailRequired=true&origin=AI_EDITOR&profileArn=arn%3Aaws%3Acodewhisperer%3Aus-east-1%3A699475941385%3Aprofile%2FEHGA3GRVQMUK&resourceType=AGENTIC_REQUEST
Authorization: Bearer aoaAAAAAGksktkS8fI-Y6vkULFiGG5W2HBIO19dVcCITFaz4h4SlUIPey6aKEUZdNqO1BPxt2mSzg9OCPLk2CXR3IBkc0:...
```

## 响应

```json
{
  "daysUntilReset": 0,
  "limits": [],
  "nextDateReset": 1.7645472E9,
  "overageConfiguration": {
    "overageStatus": "DISABLED"
  },
  "subscriptionInfo": {
    "overageCapability": "OVERAGE_CAPABLE",
    "subscriptionManagementTarget": "MANAGE",
    "subscriptionTitle": "KIRO PRO+",
    "type": "Q_DEVELOPER_STANDALONE_PRO_PLUS",
    "upgradeCapability": "UPGRADE_CAPABLE"
  },
  "usageBreakdownList": [
    {
      "bonuses": [],
      "currency": "USD",
      "currentOverages": 0,
      "currentOveragesWithPrecision": 0.0,
      "currentUsage": 0,
      "currentUsageWithPrecision": 0.0,
      "displayName": "Credit",
      "displayNamePlural": "Credits",
      "freeTrialInfo": {
        "currentUsage": 0,
        "currentUsageWithPrecision": 0.0,
        "freeTrialExpiry": 1.767074478869E9,
        "freeTrialStatus": "ACTIVE",
        "usageLimit": 500,
        "usageLimitWithPrecision": 500.0
      },
      "nextDateReset": 1.7645472E9,
      "overageCap": 10000,
      "overageCapWithPrecision": 10000.0,
      "overageCharges": 0.0,
      "overageRate": 0.04,
      "resourceType": "CREDIT",
      "unit": "INVOCATIONS",
      "usageLimit": 2000,
      "usageLimitWithPrecision": 2000.0
    }
  ],
  "userInfo": {
    "email": "a109ce63@lbatrust.co.uk",
    "userId": "d-9067c98495.04f84448-b041-70ec-42db-1c319e8039af"
  }
}
```

## 关键字段

| 字段 | 说明 |
|------|------|
| userInfo.email | 用户邮箱 |
| userInfo.userId | 用户 ID |
| subscriptionInfo.subscriptionTitle | 订阅类型 (KIRO PRO+) |
| subscriptionInfo.type | 订阅类型代码 |
| usageBreakdownList[0].usageLimit | 配额上限 (2000) |
| usageBreakdownList[0].currentUsage | 已使用量 |
| usageBreakdownList[0].freeTrialInfo | 免费试用信息 |

## 优势

相比网页端接口：
1. **不需要 csrfToken** - 只需要 Bearer Token
2. **JSON 格式** - 不需要 CBOR 编解码
3. **包含完整信息** - email、userId、订阅类型、配额等全部返回
4. **profileArn 固定** - `arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK`

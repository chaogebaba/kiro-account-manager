# GetUserUsageAndLimits - 获取配额使用情况

## 请求

```
POST https://app.kiro.dev/service/KiroWebPortalService/operation/GetUserUsageAndLimits
Content-Type: application/cbor
smithy-protocol: rpc-v2-cbor
Authorization: Bearer {accessToken}
x-csrf-token: {csrfToken}
```

## 参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| isEmailRequired | boolean | 是 | false |
| origin | string | 是 | KIRO_IDE |

## CBOR Body

```
[0xa2, 0x6f, 0x69, 0x73, 0x45, 0x6d, 0x61, 0x69, 0x6c, 0x52, 0x65, 0x71, 0x75, 0x69, 0x72, 0x65, 0x64, 0xf4, 0x66, 0x6f, 0x72, 0x69, 0x67, 0x69, 0x6e, 0x68, 0x4b, 0x49, 0x52, 0x4f, 0x5f, 0x49, 0x44, 0x45]
```
即 `{isEmailRequired: false, origin: "KIRO_IDE"}`

## 响应

### 顶层字段

| 字段 | 类型 | 说明 |
|------|------|------|
| daysUntilReset | number | 距离重置天数 |
| limits | object | 限制信息 |
| overageConfiguration | object | 超额配置 |
| subscriptionInfo | object | 订阅信息 |
| usageBreakdownList | array | 使用明细列表 |
| userInfo | object | 用户信息 |

### subscriptionInfo - 订阅信息

| 字段 | 类型 | 说明 |
|------|------|------|
| overageCapability | string | 超额能力: OVERAGE_CAPABLE |
| subscriptionManagementTarget | string | 管理目标: MANAGE |
| subscriptionTitle | string | 订阅名称: KIRO PRO+ |
| type | string | 订阅类型: _DEVELOPER_STANDALONE_PRO_PLUS |
| upgradeCapability | string | 升级能力: UPGRADE_CAPABLE |

### usageBreakdownList[0] - 使用明细

| 字段 | 类型 | 说明 |
|------|------|------|
| currentUsage | number | 当前已使用量 |
| usageLimit | number | 配额上限 |
| displayName | string | 显示名称: Credit |
| resourceType | string | 资源类型: CREDIT |
| unit | string | 单位: INVOCATIONS |
| nextDateReset | timestamp | 下次重置时间 |
| overageCap | number | 超额上限 |
| overageRate | number | 超额费率 |

### usageBreakdownList[0].freeTrialInfo - 免费试用信息

| 字段 | 类型 | 说明 |
|------|------|------|
| currentUsage | number | 试用已使用量 |
| freeTrialExpiry | timestamp | 试用过期时间 |
| freeTrialStatus | string | 试用状态: ACTIVE |
| usageLimit | number | 试用配额上限 |

### userInfo - 用户信息

| 字段 | 类型 | 说明 |
|------|------|------|
| email | string | 用户邮箱 |
| userId | string | 用户ID |

## 订阅类型 (subscriptionInfo.type)

| 值 | 说明 |
|----|------|
| _DEVELOPER_STANDALONE_FREE | 免费版 |
| _DEVELOPER_STANDALONE_PRO | Pro 版 |
| _DEVELOPER_STANDALONE_PRO_PLUS | Pro+ 版 |

## 示例响应

```json
{
  "daysUntilReset": 1,
  "subscriptionInfo": {
    "subscriptionTitle": "KIRO PRO+",
    "type": "_DEVELOPER_STANDALONE_PRO_PLUS",
    "upgradeCapability": "UPGRADE_CAPABLE"
  },
  "usageBreakdownList": [{
    "currentUsage": 10,
    "usageLimit": 1000,
    "displayName": "Credit",
    "resourceType": "CREDIT",
    "unit": "INVOCATIONS",
    "freeTrialInfo": {
      "freeTrialStatus": "ACTIVE",
      "currentUsage": 5,
      "usageLimit": 50
    }
  }],
  "userInfo": {
    "email": "hj6395759@gmail.com",
    "userId": "d-9067c98495.24086408-60c1-702b-48a8-ab955c773b71"
  }
}
```

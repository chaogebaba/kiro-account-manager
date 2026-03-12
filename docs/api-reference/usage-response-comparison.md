# 配额响应格式对比（四种账号类型）

## 测试信息

- **测试日期**: 2026-01-25
- **测试账号数量**: 119 个（Google: 49, Github: 2, BuilderId: 67, Enterprise: 1）
- **接口**: `GetUserUsageAndLimits`
- **测试结果**: ✅ 所有账号类型都成功获取配额

## 核心差异对比表

| 特性 | Google | Github | BuilderId | Enterprise |
|------|--------|--------|-----------|------------|
| **订阅类型** | `Q_DEVELOPER_STANDALONE_FREE` | `Q_DEVELOPER_STANDALONE_FREE` | `Q_DEVELOPER_STANDALONE_FREE` | `Q_DEVELOPER_STANDALONE_POWER` |
| **订阅标题** | `KIRO FREE` | `KIRO FREE` | `KIRO FREE` | `KIRO POWER` |
| **配额上限** | 50 | 50 | 50 | **10000** |
| **超额能力** | `OVERAGE_INCAPABLE` | `OVERAGE_INCAPABLE` | `OVERAGE_INCAPABLE` | **`OVERAGE_CAPABLE`** |
| **升级能力** | `UPGRADE_CAPABLE` | `UPGRADE_CAPABLE` | `UPGRADE_CAPABLE` | **`UPGRADE_INCAPABLE`** |
| **管理目标** | `PURCHASE` | `MANAGE` | `PURCHASE` | `MANAGE` |
| **有 email** | ✅ | ✅ | ✅ | ❌ |
| **试用配额** | ✅ 500 | ✅ 500 | ✅ 500 | ❌ |
| **奖励配额** | ❌ | ✅ (已过期) | ❌ | ❌ |

## 详细字段对比

### 1. subscriptionInfo（订阅信息）

#### Google / Github / BuilderId（免费版）
```json
{
  "type": "Q_DEVELOPER_STANDALONE_FREE",
  "subscriptionTitle": "KIRO FREE",
  "overageCapability": "OVERAGE_INCAPABLE",
  "upgradeCapability": "UPGRADE_CAPABLE",
  "subscriptionManagementTarget": "PURCHASE" // Google/BuilderId
  // 或 "MANAGE" // Github
}
```

#### Enterprise（付费版）
```json
{
  "type": "Q_DEVELOPER_STANDALONE_POWER",
  "subscriptionTitle": "KIRO POWER",
  "overageCapability": "OVERAGE_CAPABLE",
  "upgradeCapability": "UPGRADE_INCAPABLE",
  "subscriptionManagementTarget": "MANAGE"
}
```

### 2. usageBreakdownList[0]（配额详情）

#### 主配额字段（所有类型相同）
```json
{
  "resourceType": "CREDIT",
  "displayName": "Credit",
  "displayNamePlural": "Credits",
  "unit": "INVOCATIONS",
  "currency": "USD",
  "usageLimit": 50,  // 免费版
  // 或 10000,  // Enterprise
  "usageLimitWithPrecision": 50.0,
  "currentUsage": 50,
  "currentUsageWithPrecision": 50.0,
  "overageCap": 10000,
  "overageCapWithPrecision": 10000.0,
  "overageRate": 0.04,
  "overageCharges": 0.0
}
```

#### freeTrialInfo（试用配额）- 仅免费版有

**Google（试用中）**:
```json
{
  "freeTrialInfo": {
    "usageLimit": 500,
    "usageLimitWithPrecision": 500.0,
    "currentUsage": 500,
    "currentUsageWithPrecision": 500.0,
    "freeTrialStatus": "ACTIVE",
    "freeTrialExpiry": "2026-01-31T06:52:04.970000+00:00"
  }
}
```

**Github（试用已过期）**:
```json
{
  "freeTrialInfo": {
    "usageLimit": 500,
    "usageLimitWithPrecision": 500.0,
    "currentUsage": 500,
    "currentUsageWithPrecision": 500.0,
    "freeTrialStatus": "EXPIRED",
    "freeTrialExpiry": "2025-12-30T06:01:18.869000+00:00"
  }
}
```

**BuilderId（试用中）**:
```json
{
  "freeTrialInfo": {
    "usageLimit": 500,
    "usageLimitWithPrecision": 500.0,
    "currentUsage": 85,
    "currentUsageWithPrecision": 85.53,
    "freeTrialStatus": "ACTIVE",
    "freeTrialExpiry": "2026-02-20T22:31:51.108000+00:00"
  }
}
```

**Enterprise**: ❌ 无 `freeTrialInfo` 字段

#### bonuses（奖励配额）- 仅部分账号有

**Github（有奖励，已过期）**:
```json
{
  "bonuses": [
    {
      "bonusCode": "day-3-reinvent-gav-lemo-mit",
      "displayName": "Day 3 Re:Invent",
      "description": "Re:Invent day 3 code",
      "usageLimit": 1000.0,
      "currentUsage": 802.13,
      "status": "EXPIRED",
      "redeemedAt": "2025-12-04T06:35:38.484000+00:00",
      "expiresAt": "2026-01-03T06:35:38.484000+00:00"
    }
  ]
}
```

**其他账号**: `"bonuses": []`

### 3. userInfo（用户信息）

#### Google / Github / BuilderId
```json
{
  "userInfo": {
    "userId": "d-9067c98495.14783408-d041-703f-20bc-39709c27f6f3",
    "email": "dtamade@gmail.com"
  }
}
```

#### Enterprise
```json
{
  "userInfo": {
    "userId": "d-9767936181.c97e64c8-5011-709d-bf5b-d8401d5132d9"
    // ❌ 无 email 字段
  }
}
```

## 配额计算逻辑

### 免费版（Google / Github / BuilderId）

```javascript
function calculateFreeUsage(usageData) {
  const breakdown = usageData.usageBreakdownList[0]
  
  // 主配额
  const mainUsed = breakdown.currentUsageWithPrecision ?? breakdown.currentUsage ?? 0
  const mainLimit = breakdown.usageLimitWithPrecision ?? breakdown.usageLimit ?? 50
  
  // 试用配额
  const trial = breakdown.freeTrialInfo
  const trialUsed = trial?.currentUsageWithPrecision ?? trial?.currentUsage ?? 0
  const trialLimit = trial?.usageLimitWithPrecision ?? trial?.usageLimit ?? 0
  const trialStatus = trial?.freeTrialStatus // "ACTIVE" | "EXPIRED"
  
  // 奖励配额
  const bonuses = breakdown.bonuses ?? []
  const bonusTotal = bonuses.reduce((sum, b) => {
    if (b.status === "ACTIVE") {
      const limit = b.usageLimit ?? 0
      const used = b.currentUsage ?? 0
      return sum + Math.max(0, limit - used)
    }
    return sum
  }, 0)
  
  // 总配额 = 主配额 + 试用配额（如果激活） + 奖励配额（如果激活）
  let totalLimit = mainLimit
  let totalUsed = mainUsed
  
  if (trialStatus === "ACTIVE") {
    totalLimit += trialLimit
    totalUsed += trialUsed
  }
  
  totalLimit += bonusTotal
  
  return {
    used: Math.round(totalUsed),
    limit: Math.round(totalLimit),
    remaining: Math.max(0, Math.round(totalLimit - totalUsed)),
    // 详细信息
    main: { used: Math.round(mainUsed), limit: Math.round(mainLimit) },
    trial: trialStatus === "ACTIVE" ? { used: Math.round(trialUsed), limit: Math.round(trialLimit) } : null,
    bonuses: bonuses.filter(b => b.status === "ACTIVE")
  }
}
```

### 付费版（Enterprise）

```javascript
function calculatePowerUsage(usageData) {
  const breakdown = usageData.usageBreakdownList[0]
  
  const used = breakdown.currentUsageWithPrecision ?? breakdown.currentUsage ?? 0
  const limit = breakdown.usageLimitWithPrecision ?? breakdown.usageLimit ?? 10000
  
  return {
    used: Math.round(used),
    limit: Math.round(limit),
    remaining: Math.max(0, Math.round(limit - used))
  }
}
```

## 关键发现

### 1. 配额上限差异巨大
- **免费版**: 50（主配额）+ 500（试用）= **550 总配额**
- **付费版**: **10000**（是免费版的 18 倍）

### 2. 试用配额机制
- 所有免费版账号都有 500 试用配额
- 试用状态：`ACTIVE`（激活）或 `EXPIRED`（过期）
- 试用过期后只剩 50 主配额

### 3. 奖励配额机制
- 通过兑换码（如 Re:Invent 活动码）获得
- 有独立的过期时间
- 状态：`ACTIVE`（激活）或 `EXPIRED`（过期）

### 4. Email 字段差异
- **Social 登录**（Google/Github）: 有 email
- **BuilderId**: 有 email
- **Enterprise**: **无 email**（只有 userId）

### 5. 管理目标差异
- `PURCHASE`: 需要购买升级（Google、BuilderId）
- `MANAGE`: 可以管理订阅（Github、Enterprise）

## 前端显示建议

### 配额卡片显示

**免费版（试用中）**:
```
主配额: 50/50 (100%)
试用配额: 85/500 (17%)
总配额: 135/550 (24.5%)
```

**免费版（试用已过期）**:
```
主配额: 50/50 (100%)
试用配额: 已过期
总配额: 50/50 (100%)
```

**付费版**:
```
配额: 769/10000 (7.7%)
```

### 订阅类型徽章

- `KIRO FREE` → 蓝色徽章
- `KIRO POWER` → 金色徽章

### 试用状态提示

- `ACTIVE` → 绿色，显示过期时间
- `EXPIRED` → 灰色，显示"已过期"

## 测试数据文件

测试脚本已将四种账号类型的完整响应保存到：
- `usage_response_google.json`
- `usage_response_github.json`
- `usage_response_builderid.json`
- `usage_response_enterprise.json`

## 相关文档

- [Enterprise 响应格式详解](./enterprise-response-format.md)
- [Enterprise vs BuilderId 对比](./Enterprise-vs-BuilderId.md)
- [配额查询接口](./get-usage.md)

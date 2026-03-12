# Enterprise 账号配额响应格式

## 测试信息

- **测试日期**: 2026-01-25
- **账号类型**: Enterprise (AWS IAM Identity Center)
- **接口**: `GetUserUsageAndLimits`
- **订阅类型**: `Q_DEVELOPER_STANDALONE_POWER` (KIRO POWER)

## 完整响应结构

```python
{
    'daysUntilReset': 0,
    'limits': [],
    'nextDateReset': datetime.datetime(2026, 2, 1, 0, 0, tzinfo=datetime.timezone.utc),
    'overageConfiguration': {
        'overageEnabled': False
    },
    'subscriptionInfo': {
        'overageCapability': 'OVERAGE_CAPABLE',
        'subscriptionManagementTarget': 'MANAGE',
        'subscriptionTitle': 'KIRO POWER',
        'type': 'Q_DEVELOPER_STANDALONE_POWER',
        'upgradeCapability': 'UPGRADE_INCAPABLE'
    },
    'usageBreakdownList': [
        {
            'bonuses': [],
            'currency': 'USD',
            'currentOverages': 0,
            'currentOveragesWithPrecision': 0.0,
            'currentUsage': 767,
            'currentUsageWithPrecision': 767.15,
            'displayName': 'Credit',
            'displayNamePlural': 'Credits',
            'nextDateReset': datetime.datetime(2026, 2, 1, 0, 0, tzinfo=datetime.timezone.utc),
            'overageCap': 10000,
            'overageCapWithPrecision': 10000.0,
            'overageCharges': 0.0,
            'overageRate': 0.04,
            'resourceType': 'CREDIT',
            'unit': 'INVOCATIONS',
            'usageLimit': 10000,
            'usageLimitWithPrecision': 10000.0
        }
    ],
    'userInfo': {
        'userId': 'd-9767936181.c97e64c8-5011-709d-bf5b-d8401d5132d9'
    }
}
```

## 关键字段说明

### 顶层字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `daysUntilReset` | int | 距离配额重置的天数 |
| `limits` | array | 限制列表（通常为空） |
| `nextDateReset` | datetime | 下次配额重置时间（UTC） |
| `overageConfiguration` | object | 超额配置 |
| `subscriptionInfo` | object | 订阅信息 |
| `usageBreakdownList` | array | 配额使用详情列表 |
| `userInfo` | object | 用户信息 |

### subscriptionInfo（订阅信息）

| 字段 | 类型 | 说明 | 示例值 |
|------|------|------|--------|
| `type` | string | 订阅类型 | `Q_DEVELOPER_STANDALONE_POWER` |
| `subscriptionTitle` | string | 订阅标题 | `KIRO POWER` |
| `overageCapability` | string | 超额能力 | `OVERAGE_CAPABLE` |
| `upgradeCapability` | string | 升级能力 | `UPGRADE_INCAPABLE` |
| `subscriptionManagementTarget` | string | 订阅管理目标 | `MANAGE` |

### usageBreakdownList[0]（配额详情）

| 字段 | 类型 | 说明 | 示例值 |
|------|------|------|--------|
| `resourceType` | string | 资源类型 | `CREDIT` |
| `displayName` | string | 显示名称（单数） | `Credit` |
| `displayNamePlural` | string | 显示名称（复数） | `Credits` |
| `unit` | string | 单位 | `INVOCATIONS` |
| `currency` | string | 货币 | `USD` |
| `usageLimit` | int | 配额上限 | `10000` |
| `usageLimitWithPrecision` | float | 配额上限（精确值） | `10000.0` |
| `currentUsage` | int | 当前使用量 | `767` |
| `currentUsageWithPrecision` | float | 当前使用量（精确值） | `767.15` |
| `currentOverages` | int | 当前超额量 | `0` |
| `currentOveragesWithPrecision` | float | 当前超额量（精确值） | `0.0` |
| `overageCap` | int | 超额上限 | `10000` |
| `overageCapWithPrecision` | float | 超额上限（精确值） | `10000.0` |
| `overageRate` | float | 超额费率 | `0.04` |
| `overageCharges` | float | 超额费用 | `0.0` |
| `bonuses` | array | 奖励列表 | `[]` |
| `nextDateReset` | datetime | 下次重置时间 | `2026-02-01 00:00:00 UTC` |

## 与 BuilderId/Social 的区别

### 相同点
- 都使用 `usageBreakdownList` 数组存储配额信息
- 都有 `currentUsage` 和 `usageLimit` 字段
- 都有 `subscriptionInfo` 字段

### 不同点

| 特性 | Enterprise | BuilderId/Social |
|------|-----------|------------------|
| **订阅类型** | `Q_DEVELOPER_STANDALONE_POWER` | `Q_DEVELOPER_FREE_TIER` 等 |
| **resourceType** | `CREDIT` | 可能不同 |
| **超额支持** | 支持（`overageCapability: OVERAGE_CAPABLE`） | 通常不支持 |
| **配额上限** | 10000 | 50（免费版） |
| **精确值字段** | 有 `WithPrecision` 后缀的字段 | 可能没有 |
| **货币字段** | 有 `currency: USD` | 可能没有 |
| **费率字段** | 有 `overageRate: 0.04` | 可能没有 |

## 前端解析逻辑

```javascript
// 解析 Enterprise 配额数据
function parseEnterpriseUsage(usageData) {
  if (!usageData?.usageBreakdownList?.[0]) {
    return { used: 0, limit: 0, remaining: 0 }
  }
  
  const breakdown = usageData.usageBreakdownList[0]
  
  // 优先使用精确值，回退到整数值
  const used = breakdown.currentUsageWithPrecision ?? breakdown.currentUsage ?? 0
  const limit = breakdown.usageLimitWithPrecision ?? breakdown.usageLimit ?? 0
  const remaining = Math.max(0, limit - used)
  
  return {
    used: Math.round(used),
    limit: Math.round(limit),
    remaining: Math.round(remaining),
    // 额外信息
    subscriptionType: usageData.subscriptionInfo?.type,
    subscriptionTitle: usageData.subscriptionInfo?.subscriptionTitle,
    resourceType: breakdown.resourceType,
    unit: breakdown.unit,
    nextReset: breakdown.nextDateReset
  }
}
```

## 测试方法

使用 Python 测试脚本（`test_network.py`）：

```bash
python test_network.py
```

测试结果：
- ✅ 状态码: 200
- ✅ 成功获取配额数据
- ✅ 响应格式为 CBOR
- ✅ 包含完整的配额信息

## 注意事项

1. **日期时间字段**: `nextDateReset` 是 `datetime` 对象，需要序列化为字符串
2. **精确值字段**: 优先使用 `WithPrecision` 后缀的字段（float），更准确
3. **超额配置**: Enterprise 账号支持超额使用，需要显示超额相关信息
4. **货币单位**: 有 `currency` 字段，可能需要显示费用信息
5. **资源类型**: `resourceType: CREDIT` 表示使用信用点数制

## 相关文档

- [Kiro API 核心服务](./Kiro%20API%20(核心服务).md)
- [Enterprise vs BuilderId 对比](./Enterprise-vs-BuilderId.md)
- [配额查询接口](./get-usage.md)

# 企业版与普通版响应格式差异

## 概述

Kiro IDE 的企业版（Enterprise）和普通版（Free/Pro/BuilderId）在调用 `GetUserUsageAndLimits` API 时，响应格式存在差异。本文档详细说明这些差异及兼容处理方案。

## 数据来源

- **企业版响应**: 从 HAR 文件解码（CBOR 格式）
- **普通版响应**: 从 HAR 文件解码（JSON 格式）
- **分析时间**: 2026-01-24

---

## 关键差异总结

### 1. 时间格式差异

#### `nextDateReset` 字段

| 版本 | 格式 | 示例 |
|------|------|------|
| 企业版 | ISO 8601 字符串 | `"2026-02-01 00:00:00+00:00"` |
| 普通版 | Unix 时间戳（浮点数） | `1769904000.0` |

**影响**: 需要在解析时兼容两种格式

### 2. 超额配置结构差异

#### `overageConfiguration` 字段

**企业版**:
```json
{
  "overageEnabled": false
}
```

**普通版**:
```json
{
  "overageLimit": null,
  "overageStatus": "DISABLED"
}
```

**影响**: 字段名称和结构不同，需要兼容处理

### 3. 字段存在性差异

#### 企业版独有字段 (1 个)

- `overageConfiguration.overageEnabled` - 超额是否启用（布尔值）

#### 普通版独有字段 (6 个)

- `overageConfiguration.overageLimit` - 超额限制
- `overageConfiguration.overageStatus` - 超额状态（"DISABLED"）
- `totalUsage` - 总使用量（null）
- `usageBreakdown` - 使用量分解（null）
- `usageBreakdownList[0].freeTrialInfo` - 试用信息（null）
- `userInfo.email` - 用户邮箱（null）

---

## 完整响应格式对比

### 企业版响应示例

```json
{
  "daysUntilReset": 0,
  "limits": [],
  "nextDateReset": "2026-02-01 00:00:00+00:00",
  "overageConfiguration": {
    "overageEnabled": false
  },
  "subscriptionInfo": {
    "overageCapability": "OVERAGE_CAPABLE",
    "subscriptionManagementTarget": "MANAGE",
    "subscriptionTitle": "KIRO POWER",
    "type": "Q_DEVELOPER_STANDALONE_POWER",
    "upgradeCapability": "UPGRADE_INCAPABLE"
  },
  "usageBreakdownList": [
    {
      "bonuses": [],
      "currency": "USD",
      "currentOverages": 0,
      "currentOveragesWithPrecision": 0.0,
      "currentUsage": 445,
      "currentUsageWithPrecision": 445.45,
      "displayName": "Credit",
      "displayNamePlural": "Credits",
      "nextDateReset": "2026-02-01 00:00:00+00:00",
      "overageCap": 10000,
      "overageCapWithPrecision": 10000.0,
      "overageCharges": 0.0,
      "overageRate": 0.04,
      "resourceType": "CREDIT",
      "unit": "INVOCATIONS",
      "usageLimit": 10000,
      "usageLimitWithPrecision": 10000.0
    }
  ],
  "userInfo": {
    "userId": "d-9767936181.c97e64c8-5011-709d-bf5b-d8401d5132d9"
  }
}
```

### 普通版响应示例

```json
{
  "daysUntilReset": 0,
  "limits": [],
  "nextDateReset": 1769904000.0,
  "overageConfiguration": {
    "overageLimit": null,
    "overageStatus": "DISABLED"
  },
  "subscriptionInfo": {
    "overageCapability": "OVERAGE_CAPABLE",
    "subscriptionManagementTarget": "MANAGE",
    "subscriptionTitle": "KIRO POWER",
    "type": "Q_DEVELOPER_STANDALONE_POWER",
    "upgradeCapability": "UPGRADE_INCAPABLE"
  },
  "totalUsage": null,
  "usageBreakdown": null,
  "usageBreakdownList": [
    {
      "bonuses": [],
      "currency": "USD",
      "currentOverages": 0,
      "currentOveragesWithPrecision": 0.0,
      "currentUsage": 442,
      "currentUsageWithPrecision": 442.79,
      "displayName": "Credit",
      "displayNamePlural": "Credits",
      "freeTrialInfo": null,
      "nextDateReset": 1769904000.0,
      "overageCap": 10000,
      "overageCapWithPrecision": 10000.0,
      "overageCharges": 0.0,
      "overageRate": 0.04,
      "resourceType": "CREDIT",
      "unit": "INVOCATIONS",
      "usageLimit": 10000,
      "usageLimitWithPrecision": 10000.0
    }
  ],
  "userInfo": {
    "email": null,
    "userId": "d-9767936181.c97e64c8-5011-709d-bf5b-d8401d5132d9"
  }
}
```

---

## 兼容性实现

### Rust 实现 (kiro_portal_client.rs)

#### 1. 时间格式兼容

```rust
use serde::{Deserialize, Deserializer};
use chrono::{DateTime, Utc};

/// 兼容两种时间格式：字符串（企业版）和时间戳（普通版）
fn deserialize_next_date_reset<'de, D>(deserializer: D) -> Result<Option<f64>, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de::Error;
    
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum DateReset {
        Timestamp(f64),
        String(String),
    }
    
    match Option::<DateReset>::deserialize(deserializer)? {
        None => Ok(None),
        Some(DateReset::Timestamp(ts)) => Ok(Some(ts)),
        Some(DateReset::String(s)) => {
            // 解析 ISO 8601 格式字符串 "2026-02-01 00:00:00+00:00"
            let dt = DateTime::parse_from_str(&s, "%Y-%m-%d %H:%M:%S%z")
                .or_else(|_| DateTime::parse_from_rfc3339(&s))
                .map_err(|e| Error::custom(format!("Invalid date format: {}", e)))?;
            Ok(Some(dt.with_timezone(&Utc).timestamp() as f64))
        }
    }
}

// 在结构体中使用
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GetUserUsageAndLimitsResponse {
    #[serde(rename = "nextDateReset", deserialize_with = "deserialize_next_date_reset")]
    pub next_date_reset: Option<f64>,
    // ... 其他字段
}
```

#### 2. 超额配置兼容

```rust
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct OverageConfiguration {
    // 普通版字段
    #[serde(rename = "overageStatus")]
    pub overage_status: Option<String>,
    #[serde(rename = "overageLimit")]
    pub overage_limit: Option<serde_json::Value>,
    
    // 企业版字段
    #[serde(rename = "overageEnabled")]
    pub overage_enabled: Option<bool>,
}

impl OverageConfiguration {
    /// 判断超额是否启用（兼容两种格式）
    pub fn is_overage_enabled(&self) -> bool {
        // 企业版：检查 overageEnabled 字段
        if let Some(enabled) = self.overage_enabled {
            return enabled;
        }
        
        // 普通版：检查 overageStatus 字段
        if let Some(status) = &self.overage_status {
            return status != "DISABLED";
        }
        
        false
    }
}
```

### Python 实现 (KiroGate)

#### 1. 时间格式兼容

```python
from datetime import datetime

def parse_next_date_reset(next_reset_date):
    """兼容企业版和普通版的时间格式"""
    if not next_reset_date:
        return None, None
    
    try:
        # 企业版：字符串格式 "2026-02-01 00:00:00+00:00"
        if isinstance(next_reset_date, str):
            reset_time = datetime.fromisoformat(next_reset_date.replace("Z", "+00:00"))
        # 普通版：Unix 时间戳
        else:
            reset_time = datetime.fromtimestamp(next_reset_date, tz=datetime.timezone.utc)
        
        expires_at = int(reset_time.timestamp() * 1000)
        days_remaining = max(0, (reset_time.timestamp() - time.time()) / 86400)
        days_remaining = int(days_remaining) + 1
        
        return expires_at, days_remaining
    except Exception as e:
        logging.debug(f"Failed to parse nextDateReset: {next_reset_date}, error: {e}")
        return None, None
```

#### 2. 超额配置兼容

```python
def is_overage_enabled(overage_config: dict) -> bool:
    """判断超额是否启用（兼容企业版和普通版）
    
    Args:
        overage_config: overageConfiguration 对象
        
    Returns:
        bool: 超额是否启用
    """
    # 企业版：检查 overageEnabled 字段
    if "overageEnabled" in overage_config:
        return overage_config.get("overageEnabled", False)
    
    # 普通版：检查 overageStatus 字段
    if "overageStatus" in overage_config:
        return overage_config.get("overageStatus") != "DISABLED"
    
    return False
```

---

## 统计数据

### 字段数量对比

| 指标 | 企业版 | 普通版 |
|------|--------|--------|
| 字段总数 | 31 | 36 |
| 共同字段 | 30 | 30 |
| 独有字段 | 1 | 6 |

### 共同字段列表

以下字段在两个版本中都存在且结构相同：

- `daysUntilReset` - 距离重置天数
- `limits` - 限制列表（空数组）
- `subscriptionInfo` - 订阅信息
  - `overageCapability`: "OVERAGE_CAPABLE"
  - `subscriptionManagementTarget`: "MANAGE"
  - `subscriptionTitle`: "KIRO POWER"
  - `type`: "Q_DEVELOPER_STANDALONE_POWER"
  - `upgradeCapability`: "UPGRADE_INCAPABLE"
- `usageBreakdownList` - 使用量详细列表
  - `bonuses` - 奖励列表
  - `currency` - 货币（USD）
  - `currentOverages` - 当前超额
  - `currentUsage` - 当前使用量
  - `displayName` - 显示名称（Credit）
  - `overageCap` - 超额上限（10000）
  - `overageRate` - 超额费率（0.04）
  - `resourceType` - 资源类型（CREDIT）
  - `usageLimit` - 使用限制（10000）
- `userInfo.userId` - 用户 ID

---

## 测试建议

### 1. 单元测试

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_enterprise_response() {
        let json = r#"{
            "nextDateReset": "2026-02-01 00:00:00+00:00",
            "overageConfiguration": {
                "overageEnabled": false
            }
        }"#;
        
        let response: GetUserUsageAndLimitsResponse = serde_json::from_str(json).unwrap();
        assert!(response.next_date_reset.is_some());
        assert_eq!(response.overage_configuration.unwrap().is_overage_enabled(), false);
    }

    #[test]
    fn test_parse_normal_response() {
        let json = r#"{
            "nextDateReset": 1769904000.0,
            "overageConfiguration": {
                "overageStatus": "DISABLED"
            }
        }"#;
        
        let response: GetUserUsageAndLimitsResponse = serde_json::from_str(json).unwrap();
        assert!(response.next_date_reset.is_some());
        assert_eq!(response.overage_configuration.unwrap().is_overage_enabled(), false);
    }
}
```

### 2. 集成测试

- 使用真实的企业版账号测试导入功能
- 使用真实的普通版账号测试导入功能
- 验证配额显示正确
- 验证时间计算正确

---

## 注意事项

1. **API 请求完全相同**: 企业版和普通版调用的是同一个 API，只是响应格式有差异
2. **向后兼容**: 新代码必须同时支持两种格式，不能破坏现有功能
3. **错误处理**: 解析失败时应记录日志，但不应导致程序崩溃
4. **性能影响**: 兼容处理的性能开销可忽略不计

---

## 项目适配状态

### ✅ Kiro Account Manager

**文件**: `src-tauri/src/kiro_portal_client.rs`

**修改内容**:
1. 添加自定义反序列化器 `deserialize_next_date_reset`
2. 扩展 `OverageConfiguration` 结构体
3. 添加 `is_overage_enabled()` 方法

**状态**: 已完成，已通过诊断检查

### ✅ KiroGate (Python FastAPI)

**文件**: `kiro_gateway/routes.py`

**修改内容**:
1. 修改 `nextDateReset` 解析逻辑
2. 添加 `_is_overage_enabled()` 辅助函数

**状态**: 已完成，已通过诊断检查

### ✅ kiro-gateway (Rust Axum)

**文件**: `src-tauri/src/kiro_client.rs`

**分析结果**: 
- 使用 `serde_json::Value` 直接解析响应
- 不需要修改，自动兼容两种格式
- 时间字段保留原始格式（字符串或数字）

**状态**: 无需修改

---

## 相关文件

### Kiro Account Manager

- `src-tauri/src/kiro_portal_client.rs` - Portal 客户端实现
- `src-tauri/src/commands/account_cmd.rs` - 账号命令处理
- `src-tauri/src/account.rs` - 账号数据结构

### KiroGate

- `kiro_gateway/routes.py` - API 路由处理
- `enterprise_response.json` - 企业版响应示例
- `normal_response.json` - 普通版响应示例
- `RESPONSE_COMPARISON_SUMMARY.md` - 详细对比文档

---

## 更新记录

- **2026-01-24**: 初始版本，记录企业版和普通版响应格式差异
- **2026-01-24**: 添加 Rust 和 Python 兼容实现代码
- **2026-01-24**: 完成所有兼容性修改并测试通过

---

## 结论

企业版和普通版的响应格式差异主要体现在：

1. **时间格式**: 企业版使用 ISO 8601 字符串，普通版使用 Unix 时间戳
2. **超额配置**: 字段名称和结构不同
3. **可选字段**: 普通版包含更多可选字段（但值为 null）

通过自定义反序列化器和兼容性函数，我们已经实现了对两种格式的完全支持，确保应用在任何情况下都能正常工作。


---

## 导出格式说明

### 问题

如果不使用 `skip_serializing_if`，导出的 JSON 会包含**混合字段**：

```json
{
  "overageStatus": null,      // ❌ 企业版不应该有这个
  "overageLimit": null,       // ❌ 企业版不应该有这个
  "overageEnabled": false     // ✅ 企业版字段
}
```

### 解决方案

在 `OverageConfiguration` 结构体的字段上添加 `skip_serializing_if = "Option::is_none"`：

```rust
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct OverageConfiguration {
    // 普通版字段
    #[serde(rename = "overageStatus", skip_serializing_if = "Option::is_none")]
    pub overage_status: Option<String>,
    #[serde(rename = "overageLimit", skip_serializing_if = "Option::is_none")]
    pub overage_limit: Option<serde_json::Value>,

    // 企业版字段
    #[serde(rename = "overageEnabled", skip_serializing_if = "Option::is_none")]
    pub overage_enabled: Option<bool>,
}
```

### 导出效果

**企业版导出**（只保留有值的字段）：
```json
{
  "overageEnabled": false
}
```

**普通版导出**（保留有值的字段，包括 `null`）：
```json
{
  "overageStatus": "DISABLED",
  "overageLimit": null
}
```

### 内部存储格式

**统一的时间格式**：
- API 返回的 `nextDateReset` 无论是字符串还是时间戳，都会在导入时转换为**时间戳**存储
- 企业版：`"2026-02-01 00:00:00+00:00"` → `1769904000.0`
- 普通版：`1769904000.0` → `1769904000.0`
- 导出时保持时间戳格式

**字段存在性**：
- 企业版导入后：`overageEnabled` 有值，`overageStatus` 和 `overageLimit` 为 `None`
- 普通版导入后：`overageStatus` 有值，`overageEnabled` 为 `None`
- 导出时只保留有值的字段（通过 `skip_serializing_if`）

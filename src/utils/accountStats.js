// 账号统计计算工具函数

// 从 account 获取 quota（兼容旧数据和新 usage_data）
// API 返回 camelCase，后端 serde 序列化也是 camelCase
const getQuota = (a) => {
  const breakdown = a.usage_data?.usageBreakdownList?.[0]
  const main = breakdown?.usageLimit ?? a.quota ?? 50
  const freeTrial = breakdown?.freeTrialInfo?.usageLimit ?? 0
  const bonus = (breakdown?.bonuses || []).reduce((sum, b) => sum + (b.usageLimit || 0), 0)
  return main + freeTrial + bonus
}
const getUsed = (a) => {
  const breakdown = a.usage_data?.usageBreakdownList?.[0]
  const main = breakdown?.currentUsage ?? a.used ?? 0
  const freeTrial = breakdown?.freeTrialInfo?.currentUsage ?? 0
  const bonus = (breakdown?.bonuses || []).reduce((sum, b) => sum + (b.currentUsage || 0), 0)
  return main + freeTrial + bonus
}
const getSubType = (a) => a.usage_data?.subscriptionInfo?.type ?? a.subscription_type ?? ''
const getSubPlan = (a) => a.usage_data?.subscriptionInfo?.subscriptionTitle ?? a.subscription_plan ?? ''

export function calcAccountStats(accounts) {
  const total = accounts.length
  const active = accounts.filter(a => a.status === '正常' || a.status === '有效').length
  const totalQuota = accounts.reduce((sum, a) => sum + getQuota(a), 0)
  const totalUsed = accounts.reduce((sum, a) => sum + getUsed(a), 0)
  const proPlus = accounts.filter(a => getSubType(a).includes('PRO+') || getSubPlan(a).includes('PRO+')).length
  const pro = accounts.filter(a => 
    (getSubType(a).includes('PRO') || getSubPlan(a).includes('PRO')) && 
    !(getSubType(a).includes('PRO+') || getSubPlan(a).includes('PRO+'))
  ).length
  const usagePercent = totalQuota > 0 ? (totalUsed / totalQuota * 100).toFixed(1) : 0

  return { total, active, totalQuota, totalUsed, proPlus, pro, usagePercent, remaining: totalQuota - totalUsed }
}

export function getUsagePercent(used, quota) {
  return quota === 0 ? 0 : Math.min(100, (used / quota) * 100)
}

export { getQuota, getUsed, getSubType, getSubPlan }

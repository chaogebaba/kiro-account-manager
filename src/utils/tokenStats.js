// Token 统计计算工具函数

export function calcTokenStats(tokens) {
  const total = tokens.length
  const active = tokens.filter(t => t.status === '正常' || t.status === '有效').length
  const totalQuota = tokens.reduce((sum, t) => sum + (t.quota || 0), 0)
  const totalUsed = tokens.reduce((sum, t) => sum + (t.used || 0), 0)
  const proPlus = tokens.filter(t => t.subscription_type?.includes('PRO+') || t.subscription_plan?.includes('PRO+')).length
  const pro = tokens.filter(t => 
    (t.subscription_type?.includes('PRO') || t.subscription_plan?.includes('PRO')) && 
    !(t.subscription_type?.includes('PRO+') || t.subscription_plan?.includes('PRO+'))
  ).length
  const usagePercent = totalQuota > 0 ? (totalUsed / totalQuota * 100).toFixed(1) : 0

  return {
    total,
    active,
    totalQuota,
    totalUsed,
    proPlus,
    pro,
    usagePercent,
    remaining: totalQuota - totalUsed,
  }
}

export function getUsagePercent(used, quota) {
  return quota === 0 ? 0 : Math.min(100, (used / quota) * 100)
}

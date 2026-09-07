// getUsageLimits —— 用量 / 余额 / 邮箱 / 订阅的唯一来源
//
// kiro.rs（origin/master @ f357292）token_manager.rs:455-620：
//   区域候选：sso_region 是 eu-* → [eu-central-1, us-east-1]，否则 [us-east-1, eu-central-1]
//   每个区域先带真实 profileArn 试，再退回不带 → 共 4 次尝试
//   403（我们额外容忍 400）继续下一候选；5xx 直接抛
//   URL: https://q.<region>.amazonaws.com/getUsageLimits
//        ?origin=AI_EDITOR&resourceType=AGENTIC_REQUEST&isEmailRequired=true[&profileArn=<urlencoded>]
//   邮箱在 userInfo.email（isEmailRequired=true 才返回），订阅在 subscriptionInfo.subscriptionTitle。
//   ⚠️ 上游 token_manager.rs:545-547 的行内注释是旧文案（声称无需 profileArn），以常量文档与代码为准。

import { buildUsageHeaders } from './headers'
import { kiroFetch } from './transport'

export interface UsageLimitsFreeTrial {
  currentUsage?: number
  currentUsageWithPrecision?: number
  usageLimit?: number
  usageLimitWithPrecision?: number
  freeTrialStatus?: string
  freeTrialExpiry?: number | string
}

export interface UsageLimitsBonus {
  bonusCode?: string
  displayName?: string
  description?: string
  usageLimit?: number
  usageLimitWithPrecision?: number
  currentUsage?: number
  currentUsageWithPrecision?: number
  expiresAt?: number | string
  redeemedAt?: number | string
  status?: string
}

export interface UsageLimitsBreakdown {
  type?: string
  resourceType?: string
  displayName?: string
  displayNamePlural?: string
  currentUsage?: number
  currentUsageWithPrecision?: number
  usageLimit?: number
  usageLimitWithPrecision?: number
  currency?: string
  unit?: string
  overageRate?: number
  overageCap?: number
  overageCharges?: number
  currentOverages?: number
  freeTrialUsage?: UsageLimitsFreeTrial
  freeTrialInfo?: UsageLimitsFreeTrial
  bonuses?: UsageLimitsBonus[]
}

export interface UsageLimitsResponse {
  usageBreakdownList?: UsageLimitsBreakdown[]
  nextDateReset?: number | string
  subscriptionInfo?: {
    subscriptionName?: string
    subscriptionTitle?: string
    subscriptionType?: string
    status?: string
    subscriptionManagementTarget?: string
    upgradeCapability?: string
    overageCapability?: string
  }
  overageSettings?: { overageStatus?: string }
  overageConfiguration?: { overageEnabled?: boolean; overageStatus?: string }
  userInfo?: { email?: string; userId?: string }
}

export interface GetUsageLimitsOptions {
  profileArn?: string
  ssoRegion?: string
  machineId?: string
  proxyUrl?: string
  /** api_key → API_KEY，企业 SSO → EXTERNAL_IDP；social / idc 不带 */
  tokenType?: string
  /** 日志标识 */
  email?: string
}

export interface UsageAttempt {
  region: string
  profileArn?: string
}

/** kiro.rs rest_api_region_candidates（token_manager.rs:455-471） */
export function restApiRegionCandidates(ssoRegion?: string): [string, string] {
  const primaryEu = ssoRegion === 'eu-central-1' || !!ssoRegion?.startsWith('eu-')
  return primaryEu ? ['eu-central-1', 'us-east-1'] : ['us-east-1', 'eu-central-1']
}

/** kiro.rs usage_api_attempts：每个区域「先带 ARN 再不带」 */
export function buildUsageAttempts(
  regions: readonly string[],
  profileArn?: string
): UsageAttempt[] {
  const attempts: UsageAttempt[] = []
  for (const region of regions) {
    if (profileArn) attempts.push({ region, profileArn })
    attempts.push({ region })
  }
  return attempts
}

export function usageApiHost(region: string): string {
  return `q.${region}.amazonaws.com`
}

/** kiro.rs usage_limits_url + profile_arn_query */
export function usageLimitsUrl(host: string, profileArn?: string): string {
  const base = `https://${host}/getUsageLimits?origin=AI_EDITOR&resourceType=AGENTIC_REQUEST&isEmailRequired=true`
  return profileArn ? `${base}&profileArn=${encodeURIComponent(profileArn)}` : base
}

/**
 * 按候选梯子调用 getUsageLimits。
 * 400/403 继续下一候选，5xx 立刻抛，其他非 2xx 也抛。
 */
export async function getUsageLimits(
  accessToken: string,
  opts: GetUsageLimitsOptions = {}
): Promise<UsageLimitsResponse> {
  const regions = restApiRegionCandidates(opts.ssoRegion)
  const attempts = buildUsageAttempts(regions, opts.profileArn)
  const logTag = opts.email || `token:${accessToken?.slice(-6) || '?'}`

  let lastError: string | undefined
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i]
    const host = usageApiHost(attempt.region)
    const url = usageLimitsUrl(host, attempt.profileArn)
    const headers = buildUsageHeaders(accessToken, opts.machineId, host, {
      tokenType: opts.tokenType
    })

    const res = await kiroFetch(url, { method: 'GET', headers }, opts.proxyUrl)
    if (res.ok) {
      return (await res.json()) as UsageLimitsResponse
    }

    const body = await res.text().catch(() => '')
    lastError = `HTTP ${res.status}: ${body}`

    // 5xx 是上游故障，换区域也没意义
    if (res.status >= 500) {
      throw new Error(lastError)
    }
    // 权限 / 参数类错误：走下一候选（带 ARN → 不带 → 备用区域）
    if ((res.status === 403 || res.status === 400) && i + 1 < attempts.length) {
      console.log(
        `[KiroAPI] getUsageLimits [${logTag}] ${res.status} on ${attempt.region}` +
          `（profileArn=${attempt.profileArn ? 'yes' : 'no'}），尝试下一候选`
      )
      continue
    }
    throw new Error(lastError)
  }
  throw new Error(lastError || 'getUsageLimits 无可用候选端点')
}

/** userInfo.email（空字符串视为无） */
export function extractEmail(res: UsageLimitsResponse | undefined): string | undefined {
  const email = res?.userInfo?.email
  return email && email.length > 0 ? email : undefined
}

/** subscriptionInfo.subscriptionTitle，例如 "KIRO PRO+" / "KIRO FREE" */
export function extractSubscriptionTitle(res: UsageLimitsResponse | undefined): string | undefined {
  const title = res?.subscriptionInfo?.subscriptionTitle
  return title && title.length > 0 ? title : undefined
}

function pick(precise: number | undefined, plain: number | undefined): number {
  if (typeof precise === 'number' && Number.isFinite(precise)) return precise
  if (typeof plain === 'number' && Number.isFinite(plain)) return plain
  return 0
}

/**
 * 余额计算（kiro.rs usage_limits.rs:225-274）：
 * 取第一条 usageBreakdownList 的额度，加上 ACTIVE 的免费试用与 ACTIVE 的 bonus，
 * 已用量同理。开启超额时 remaining 可能为负。
 */
export function computeUsageBalance(res: UsageLimitsResponse | undefined): {
  limit: number
  used: number
  remaining: number
} {
  const b = res?.usageBreakdownList?.[0]
  if (!b) return { limit: 0, used: 0, remaining: 0 }

  let limit = pick(b.usageLimitWithPrecision, b.usageLimit)
  let used = pick(b.currentUsageWithPrecision, b.currentUsage)

  const trial = b.freeTrialInfo || b.freeTrialUsage
  if (trial && trial.freeTrialStatus === 'ACTIVE') {
    limit += pick(trial.usageLimitWithPrecision, trial.usageLimit)
    used += pick(trial.currentUsageWithPrecision, trial.currentUsage)
  }

  for (const bonus of b.bonuses || []) {
    if (bonus.status !== 'ACTIVE') continue
    limit += pick(bonus.usageLimitWithPrecision, bonus.usageLimit)
    used += pick(bonus.currentUsageWithPrecision, bonus.currentUsage)
  }

  return { limit, used, remaining: limit - used }
}

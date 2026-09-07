// Kiro / AWS 上游错误分类
//
// 规则逐条对齐 kiro.rs（origin/master @ f357292）：
//   - src/kiro/token_manager.rs:192-220   刷新错误分类
//   - src/kiro/endpoint/mod.rs:115-202    数据面失败判定（suspended / throttled / bearer 失效 / 配额）
//   - src/kiro/error.rs:35-45             Retry-After 归一化

/** refreshToken 永久失效（400 + invalid_grant + Invalid refresh token provided） */
export class RefreshTokenInvalidError extends Error {
  readonly status: number
  readonly body: string
  constructor(message: string, status = 400, body = '') {
    super(message)
    this.name = 'RefreshTokenInvalidError'
    this.status = status
    this.body = body
  }
}

/** 上游 429 限流。绝不计入刷新失败次数，也不代表账号失效。 */
export class UpstreamRateLimitError extends Error {
  readonly status: number
  readonly body: string
  /** 解析出的 Retry-After（毫秒），上游未给出或格式非法时为 undefined */
  readonly retryAfterMs?: number
  /** 原始 Retry-After 头（已归一化，非法值被丢弃） */
  readonly retryAfter?: string
  constructor(
    message: string,
    opts: { status?: number; body?: string; retryAfterMs?: number; retryAfter?: string } = {}
  ) {
    super(message)
    this.name = 'UpstreamRateLimitError'
    this.status = opts.status ?? 429
    this.body = opts.body ?? ''
    this.retryAfterMs = opts.retryAfterMs
    this.retryAfter = opts.retryAfter
  }
}

export function isRefreshTokenInvalidError(e: unknown): e is RefreshTokenInvalidError {
  return e instanceof RefreshTokenInvalidError
}

export function isUpstreamRateLimitError(e: unknown): e is UpstreamRateLimitError {
  return e instanceof UpstreamRateLimitError
}

/**
 * Retry-After 归一化：只接受 delta-seconds 或 HTTP-date，其余一律丢弃。
 * kiro.rs src/kiro/error.rs:35-45
 */
export function normalizeRetryAfter(value: string | null | undefined): string | undefined {
  const v = (value || '').trim()
  if (!v) return undefined
  if (/^\d+$/.test(v)) return v
  const parsed = Date.parse(v)
  if (!Number.isNaN(parsed)) return v
  return undefined
}

/** Retry-After → 毫秒（相对当前时间）。无法解析返回 undefined。 */
export function retryAfterToMs(value: string | null | undefined): number | undefined {
  const normalized = normalizeRetryAfter(value)
  if (!normalized) return undefined
  if (/^\d+$/.test(normalized)) return Number(normalized) * 1000
  const at = Date.parse(normalized)
  if (Number.isNaN(at)) return undefined
  return Math.max(0, at - Date.now())
}

/** 从响应头里构造 UpstreamRateLimitError */
export function rateLimitErrorFromHeaders(
  headers: { get(name: string): string | null } | undefined,
  body: string,
  status = 429
): UpstreamRateLimitError {
  const raw = headers?.get('retry-after') ?? undefined
  const retryAfter = normalizeRetryAfter(raw)
  const retryAfterMs = retryAfterToMs(raw)
  const suffix = retryAfter ? `，请在 ${retryAfter}s 后重试` : ''
  return new UpstreamRateLimitError(`请求过于频繁，已被上游限流${suffix}`, {
    status,
    body,
    retryAfter,
    retryAfterMs
  })
}

/**
 * 刷新接口的错误分类，返回待抛出的 Error 实例。
 * kiro.rs token_manager.rs:192-220 —— 顺序与文案一一对应。
 */
export function classifyRefreshError(
  status: number,
  body: string,
  headers?: { get(name: string): string | null }
): Error {
  if (status === 429) {
    return rateLimitErrorFromHeaders(headers, body, status)
  }

  // 400 + invalid_grant + Invalid refresh token provided → refreshToken 永久失效
  if (
    status === 400 &&
    body.includes('"invalid_grant"') &&
    body.includes('Invalid refresh token provided')
  ) {
    return new RefreshTokenInvalidError(
      `Social refreshToken 已失效 (invalid_grant): ${body}`,
      status,
      body
    )
  }

  let errorMsg: string
  if (status === 401) errorMsg = 'OAuth 凭证已过期或无效，需要重新认证'
  else if (status === 403) errorMsg = '权限不足，无法刷新 Token'
  else if (status >= 500 && status <= 599) errorMsg = '服务器错误，AWS OAuth 服务暂时不可用'
  else errorMsg = 'Token 刷新失败'

  return new Error(`${errorMsg}: ${status} ${body}`)
}

// ============ 数据面失败判定（kiro.rs src/kiro/endpoint/mod.rs） ============

/**
 * 账号被封禁/停用：403 + 同时出现 "suspended" 与 "locked your account"（大小写不敏感）。
 * 两个短语都命中才判定，避免把偶发 403 误判为封禁。 mod.rs:167-179
 */
export function isAccountSuspended(body: string | undefined | null): boolean {
  if (!body) return false
  const lower = body.toLowerCase()
  return lower.includes('suspended') && lower.includes('locked your account')
}

/**
 * 账号级风控：429 + "suspicious activity" + "temporary limits"（大小写敏感，同上游）。
 * mod.rs:154-165
 */
export function isAccountThrottled(body: string | undefined | null): boolean {
  if (!body) return false
  return body.includes('suspicious activity') && body.includes('temporary limits')
}

/** bearer token 被上游失效 → 应强制刷新。 mod.rs:149-152 */
export function isBearerTokenInvalid(body: string | undefined | null): boolean {
  if (!body) return false
  return body.includes('The bearer token included in the request is invalid')
}

const QUOTA_EXHAUSTED_REASONS = ['MONTHLY_REQUEST_COUNT', 'OVERAGE_REQUEST_LIMIT_EXCEEDED'] as const

/**
 * 配额耗尽：先做廉价子串扫描，再用 JSON 里的 reason / error.reason 确认。
 * mod.rs:115-147
 */
export function isQuotaExhausted(body: string | undefined | null): boolean {
  if (!body) return false
  if (!QUOTA_EXHAUSTED_REASONS.some((r) => body.includes(r))) return false
  try {
    const parsed = JSON.parse(body) as { reason?: unknown; error?: { reason?: unknown } }
    const reason =
      (typeof parsed?.reason === 'string' ? parsed.reason : undefined) ??
      (typeof parsed?.error?.reason === 'string' ? parsed.error.reason : undefined)
    if (typeof reason === 'string') {
      return QUOTA_EXHAUSTED_REASONS.some((r) => reason === r)
    }
  } catch {
    // 非 JSON：子串已命中，按上游的宽松策略视为命中
    return true
  }
  return false
}

/** 上游网关超时。 mod.rs:181-188 */
export function isGatewayTimeout(body: string | undefined | null): boolean {
  if (!body) return false
  const lower = body.toLowerCase()
  return (
    body.includes('524') &&
    (lower.includes('status code') ||
      lower.includes('gateway timeout') ||
      lower.includes('server-side issue'))
  )
}

/**
 * 把任意错误文本/状态码映射到账号状态。
 * 返回 undefined 表示"不属于 suspended / throttled 这两类特殊状态"。
 */
export function classifyAccountStatusFromError(
  body: string | undefined | null,
  status?: number
): 'suspended' | 'throttled' | undefined {
  if (isAccountSuspended(body)) return 'suspended'
  if (isAccountThrottled(body)) return 'throttled'
  // 无正文特征时按状态码兜底：429 一律视为限流（不是账号失效）
  if (status === 429) return 'throttled'
  return undefined
}

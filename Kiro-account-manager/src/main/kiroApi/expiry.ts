// Token 过期判定
//
// kiro.rs token_manager.rs:34-54：
//   is_token_expired      = 剩余 ≤ 5 分钟；expiresAt 缺失/不可解析 ⇒ true
//   is_token_expiring_soon= 剩余 ≤ 10 分钟；expiresAt 缺失/不可解析 ⇒ false
// 所有调用点都是 `expired || expiring_soon`，等效阈值 10 分钟，且不可解析强制刷新。

/** 「已过期」判定的提前量（分钟） */
export const EXPIRED_MARGIN_MINUTES = 5
/** 「即将过期」判定的提前量（分钟） */
export const EXPIRING_SOON_MARGIN_MINUTES = 10
/** 实际触发刷新的提前量（毫秒） */
export const REFRESH_LEAD_MS = EXPIRING_SOON_MARGIN_MINUTES * 60 * 1000

export type ExpiresAtLike = number | string | Date | null | undefined

/** 归一化 expiresAt（毫秒 epoch）。不可解析返回 undefined。 */
export function parseExpiresAt(value: ExpiresAtLike): number | undefined {
  if (value === null || value === undefined) return undefined
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isNaN(t) ? undefined : t
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return undefined
    // 秒级时间戳（10 位）自动转毫秒
    return value < 1e12 ? value * 1000 : value
  }
  const trimmed = String(value).trim()
  if (!trimmed) return undefined
  if (/^\d+$/.test(trimmed)) return parseExpiresAt(Number(trimmed))
  const parsed = Date.parse(trimmed)
  return Number.isNaN(parsed) ? undefined : parsed
}

/**
 * 是否在 minutes 分钟内过期。无法判定（expiresAt 缺失/非法）返回 undefined。
 * kiro.rs is_token_expiring_within
 */
export function isTokenExpiringWithin(
  expiresAt: ExpiresAtLike,
  minutes: number,
  now: number = Date.now()
): boolean | undefined {
  const at = parseExpiresAt(expiresAt)
  if (at === undefined) return undefined
  return at <= now + minutes * 60 * 1000
}

/** 已过期（提前 5 分钟判断）。不可解析 ⇒ true。 */
export function isTokenExpired(
  expiresAt: ExpiresAtLike,
  marginMinutes: number = EXPIRED_MARGIN_MINUTES,
  now: number = Date.now()
): boolean {
  return isTokenExpiringWithin(expiresAt, marginMinutes, now) ?? true
}

/** 即将过期（10 分钟内）。不可解析 ⇒ false。 */
export function isTokenExpiringSoon(
  expiresAt: ExpiresAtLike,
  marginMinutes: number = EXPIRING_SOON_MARGIN_MINUTES,
  now: number = Date.now()
): boolean {
  return isTokenExpiringWithin(expiresAt, marginMinutes, now) ?? false
}

/** 是否需要刷新：expired || expiringSoon（与 kiro.rs 每个调用点一致） */
export function needsTokenRefresh(expiresAt: ExpiresAtLike, now: number = Date.now()): boolean {
  return (
    isTokenExpired(expiresAt, EXPIRED_MARGIN_MINUTES, now) ||
    isTokenExpiringSoon(expiresAt, EXPIRING_SOON_MARGIN_MINUTES, now)
  )
}

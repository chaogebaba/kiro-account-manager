// 外部凭证源 → 账号 的匹配（kiroApi/refresh.setExternalRefreshTokenReader 的纯逻辑部分）
//
// kiro.rs try_reload_credential_from_file：refreshToken 被判失效时，先回源重读一次，
// 因为 Kiro IDE / kiro-cli 可能已经自己 refresh 过并把 refreshToken 轮换走了。
//
// 这里只做「候选 → 账号」的匹配，不碰 electron、不读盘，方便单测。
// 读盘部分（collectLocalCredentialCandidates）在 index.ts 的 app ready 里接上。

import { parseAccessTokenClaims } from './kiroAuthSync'

/** 账号侧已知信息（store 里的那份，可能已经过期） */
export interface ExternalMatchAccount {
  accountId?: string
  email?: string
  refreshToken?: string
  accessToken?: string
  authMethod?: string
  provider?: string
}

/** 本地凭证候选（结构上兼容 localCredentials.LocalCredentialCandidate） */
export interface ExternalMatchCandidate {
  refreshToken: string
  accessToken?: string
  authMethod?: string
  provider?: string
  source?: string
}

function normalizeEmail(email?: string): string | undefined {
  const e = email?.trim().toLowerCase()
  return e || undefined
}

/**
 * 在本地凭证候选里挑出属于该账号、且比账号当前 refreshToken 更新的那一个。
 *
 * 匹配优先级（与 kiroCli / IDE 反向同步的匹配顺序一致）：
 *   1. accessToken JWT 的 sub 相同
 *   2. accessToken JWT 的 email 相同（或与 account.email 相同）
 * 匹配不上就返回 undefined —— 宁可不换，也不能把别的账号的 refreshToken 塞给它。
 *
 * 返回值保证与 account.refreshToken 不同；相同视为「没有更新」。
 */
export function pickExternalRefreshToken(
  account: ExternalMatchAccount,
  candidates: readonly ExternalMatchCandidate[] | undefined | null
): string | undefined {
  if (!candidates || candidates.length === 0) return undefined

  const accountClaims = account.accessToken ? parseAccessTokenClaims(account.accessToken) : null
  const accountSub = accountClaims?.sub
  const accountEmail = normalizeEmail(account.email) || normalizeEmail(accountClaims?.email)

  // 没有任何可比对的身份信息时不做猜测
  if (!accountSub && !accountEmail) return undefined

  let byEmail: string | undefined

  for (const candidate of candidates) {
    if (!candidate?.refreshToken) continue
    // 与账号当前持有的是同一张票 ⇒ 没有更新可用
    if (account.refreshToken && candidate.refreshToken === account.refreshToken) continue

    const claims = candidate.accessToken ? parseAccessTokenClaims(candidate.accessToken) : null
    if (accountSub && claims?.sub && claims.sub === accountSub) {
      return candidate.refreshToken
    }
    if (accountEmail && normalizeEmail(claims?.email) === accountEmail && !byEmail) {
      byEmail = candidate.refreshToken
    }
  }

  return byEmail
}

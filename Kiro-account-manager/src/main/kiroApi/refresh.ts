// Token 刷新
//
// 对齐 kiro.rs token_manager.rs:118-355：
//   Social  POST https://prod.<region>.auth.desktop.kiro.dev/refreshToken   {"refreshToken"}
//   IdC     POST https://oidc.<region>.amazonaws.com/token
//           {"clientId","clientSecret","refreshToken","grantType":"refresh_token"}
// 两者响应都是 camelCase：accessToken / refreshToken? / profileArn? / expiresIn?，
// 只有 accessToken 必填；refreshToken 会轮换，调用方必须持久化新值。

import { buildIdcRefreshHeaders, buildSocialRefreshHeaders } from './headers'
import { classifyRefreshError, RefreshTokenInvalidError } from './errors'
import { kiroFetch } from './transport'

export type KiroAuthMethod = 'social' | 'IdC' | 'external_idp'

export interface RefreshInput {
  refreshToken: string
  authMethod?: 'social' | 'IdC' | 'external_idp'
  provider?: string
  clientId?: string
  clientSecret?: string
  region?: string
  machineId?: string
  proxyUrl?: string
}

export interface RefreshResult {
  accessToken: string
  /** 轮换后的 refreshToken；上游未轮换时回填入参值。必须持久化。 */
  refreshToken: string
  /**
   * 毫秒 epoch。上游没给 expiresIn 时为 undefined —— 调用方必须保留原有的
   * expiresAt（newExpiresAt ?? oldExpiresAt），绝不能凭空补一个 now+1h：
   * 那会让一张实际还能用很久（或已经快过期）的 token 带上假的到期时间，
   * 把主动续期和过期判定全部带偏。
   */
  expiresAt?: number
  profileArn?: string
  /** 上游返回的有效期（秒）。上游未给出时为 undefined。 */
  expiresIn?: number
}

export const DEFAULT_AUTH_REGION = 'us-east-1'
export const DEFAULT_EXPIRES_IN = 3600

interface RefreshResponseBody {
  accessToken?: string
  refreshToken?: string
  profileArn?: string
  expiresIn?: number
}

// ============ 外部凭证源（invalid_grant 后重读） ============
//
// kiro.rs try_reload_credential_from_file：refreshToken 失效时先回源重读，
// 因为 Kiro IDE / kiro-cli 可能已经把 token 轮换走了。
// WP-A 的 kiro-cli reader（或 IDE token 文件 reader）通过 setExternalRefreshTokenReader 注册。

export type ExternalRefreshTokenReader = (account: {
  accountId?: string
  email?: string
  refreshToken?: string
  accessToken?: string
  authMethod?: string
  provider?: string
}) => Promise<string | undefined>

let externalReader: ExternalRefreshTokenReader | undefined

/** 注册凭证源重读器（WP-A: kiro-cli readKiroCliAuth / IDE kiro-auth-token.json） */
export function setExternalRefreshTokenReader(
  reader: ExternalRefreshTokenReader | undefined
): void {
  externalReader = reader
}

export function getExternalRefreshTokenReader(): ExternalRefreshTokenReader | undefined {
  return externalReader
}

/**
 * 从外部凭证源重读 refreshToken。
 * 返回值仅在「存在且与当前不同」时有意义（与 kiro.rs 的判定一致）。
 */
export async function readExternalRefreshToken(account: {
  accountId?: string
  email?: string
  refreshToken?: string
  accessToken?: string
  authMethod?: string
  provider?: string
}): Promise<string | undefined> {
  if (!externalReader) return undefined
  try {
    const found = await externalReader(account)
    if (!found) return undefined
    if (account.refreshToken && found === account.refreshToken) return undefined
    return found
  } catch {
    return undefined
  }
}

// ============ 预检 ============

/** kiro.rs validate_refresh_token_str：拦截空/被截断的 refreshToken，避免无谓网络调用。 */
export function validateRefreshTokenStr(refreshToken: string | undefined | null): void {
  if (!refreshToken) throw new Error('refreshToken 为空')
  if (refreshToken.length < 100 || refreshToken.includes('...')) {
    throw new Error(
      `refreshToken 已被截断（长度: ${refreshToken.length} 字符）。` +
        `这通常是 Kiro IDE 为了防止凭证被第三方工具使用而故意截断的。`
    )
  }
}

// ============ authMethod 分派 ============

/**
 * kiro.rs token_manager.rs:284-299：
 *   显式 authMethod：idc / builder-id / iam → IdC，其余（含 social 与未知值）→ social
 *   未指定：clientId && clientSecret 都在 → IdC，否则 social
 * external_idp 单独分流（本轮不实现独立端点，沿用 IdC 路径，保持既有行为）。
 */
export function resolveAuthMethod(input: {
  authMethod?: string
  clientId?: string
  clientSecret?: string
}): KiroAuthMethod {
  const raw = input.authMethod?.trim()
  if (raw) {
    const lower = raw.toLowerCase()
    if (lower === 'external_idp' || lower === 'externalidp' || lower === 'enterprise_sso') {
      return 'external_idp'
    }
    if (lower === 'idc' || lower === 'builder-id' || lower === 'builderid' || lower === 'iam') {
      return 'IdC'
    }
    if (lower === 'social') return 'social'
    // 未识别值按 kiro.rs 落到 social
    return 'social'
  }
  return input.clientId && input.clientSecret ? 'IdC' : 'social'
}

// ============ 具体实现 ============

function toResult(data: RefreshResponseBody, fallbackRefreshToken: string): RefreshResult {
  if (!data.accessToken) {
    throw new Error('Token 刷新响应缺少 accessToken')
  }
  // 上游省略 expiresIn 时不编造有效期：留 undefined，由调用方沿用旧的 expiresAt
  const expiresIn =
    typeof data.expiresIn === 'number' && Number.isFinite(data.expiresIn) && data.expiresIn > 0
      ? data.expiresIn
      : undefined
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken || fallbackRefreshToken,
    expiresAt: expiresIn === undefined ? undefined : Date.now() + expiresIn * 1000,
    profileArn: data.profileArn,
    expiresIn
  }
}

export function socialRefreshUrl(region: string = DEFAULT_AUTH_REGION): string {
  return `https://prod.${region}.auth.desktop.kiro.dev/refreshToken`
}

export function idcRefreshUrl(region: string = DEFAULT_AUTH_REGION): string {
  return `https://oidc.${region}.amazonaws.com/token`
}

/** Social (GitHub / Google) 刷新 */
export async function refreshSocialToken(
  refreshToken: string,
  opts: { region?: string; machineId?: string; proxyUrl?: string } = {}
): Promise<RefreshResult> {
  validateRefreshTokenStr(refreshToken)
  const region = opts.region || DEFAULT_AUTH_REGION
  const url = socialRefreshUrl(region)
  const res = await kiroFetch(
    url,
    {
      method: 'POST',
      headers: buildSocialRefreshHeaders(opts.machineId),
      body: JSON.stringify({ refreshToken })
    },
    opts.proxyUrl
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw classifyRefreshError(res.status, body, res.headers)
  }
  const data = (await res.json()) as RefreshResponseBody
  return toResult(data, refreshToken)
}

/** IdC / Builder ID 刷新 */
export async function refreshIdcToken(
  refreshToken: string,
  opts: { clientId?: string; clientSecret?: string; region?: string; proxyUrl?: string } = {}
): Promise<RefreshResult> {
  validateRefreshTokenStr(refreshToken)
  if (!opts.clientId || !opts.clientSecret) {
    throw new Error('缺少 OIDC 刷新凭证 (clientId/clientSecret)')
  }
  const region = opts.region || DEFAULT_AUTH_REGION
  const url = idcRefreshUrl(region)
  const res = await kiroFetch(
    url,
    {
      method: 'POST',
      headers: buildIdcRefreshHeaders(),
      body: JSON.stringify({
        clientId: opts.clientId,
        clientSecret: opts.clientSecret,
        refreshToken,
        grantType: 'refresh_token'
      })
    },
    opts.proxyUrl
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw classifyRefreshError(res.status, body, res.headers)
  }
  const data = (await res.json()) as RefreshResponseBody
  return toResult(data, refreshToken)
}

/**
 * 统一刷新入口。
 * 抛出 RefreshTokenInvalidError（永久失效）/ UpstreamRateLimitError（限流，不算失败）/ Error。
 */
export async function refreshTokenByMethod(input: RefreshInput): Promise<RefreshResult> {
  const method = resolveAuthMethod(input)
  if (method === 'social') {
    return refreshSocialToken(input.refreshToken, {
      region: input.region,
      machineId: input.machineId,
      proxyUrl: input.proxyUrl
    })
  }
  // IdC 与 external_idp 目前都走 AWS SSO OIDC 端点（external_idp 独立端点见 round 2）
  return refreshIdcToken(input.refreshToken, {
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    region: input.region,
    proxyUrl: input.proxyUrl
  })
}

/**
 * 刷新 + invalid_grant 回源重试一次。
 * 命中 RefreshTokenInvalidError 时向外部凭证源（IDE 文件 / kiro-cli DB）重读 refreshToken，
 * 取到不同的值就用它再试一次；否则原样抛出。
 */
export async function refreshTokenWithReload(
  input: RefreshInput & { accountId?: string; email?: string; accessToken?: string }
): Promise<RefreshResult & { reloadedFromSource?: boolean }> {
  try {
    return await refreshTokenByMethod(input)
  } catch (error) {
    if (!(error instanceof RefreshTokenInvalidError)) throw error
    // accessToken 必须带上：外部凭证源的匹配首选 JWT 的 sub，
    // 不给它就只剩 email 一条路，sub 匹配永远不会生效。
    const fresh = await readExternalRefreshToken({
      accountId: input.accountId,
      email: input.email,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      authMethod: input.authMethod,
      provider: input.provider
    })
    if (!fresh) throw error
    const retried = await refreshTokenByMethod({ ...input, refreshToken: fresh })
    return { ...retried, reloadedFromSource: true }
  }
}

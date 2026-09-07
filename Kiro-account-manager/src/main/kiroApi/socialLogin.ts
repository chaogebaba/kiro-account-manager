// Social（Google / GitHub）浏览器登录：纯函数部分
//
// 对齐 kiro.rs src/kiro/auth/social.rs + src/admin/service.rs:2771-3014：
//   1. 本地起一个 loopback 回调服务器（端口候选表按序占用，见 socialLoginServer.ts）
//   2. 浏览器打开 https://app.kiro.dev/signin?state=..&code_challenge=..&..&redirect_uri=http://127.0.0.1:<port>
//   3. Portal 登录完回跳 http://127.0.0.1:<port>/oauth/callback?code=..&state=..&login_option=..
//   4. POST <auth_endpoint>/oauth/token 换 token
//
// 三个最容易踩的点（全部来自 kiro.rs 逐字对齐）：
//   - 给 portal 的 redirect_uri 是「裸」的 http://127.0.0.1:<port>，没有路径也没有结尾斜杠；
//   - 换 token 时的 redirectUri 却是「裸值 + 实际回跳路径 (+ ?login_option=..)」，两者不是同一个串；
//   - 请求体是 camelCase 的 {code, codeVerifier, redirectUri}，没有 grant_type / client_id。
//
// 本文件不 import electron，可直接被 bun test 加载。

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { kiroFetch } from './transport'
import { getEffectiveKiroVersion } from './version'
import { rateLimitErrorFromHeaders } from './errors'
import { parseExpiresAt } from './expiry'

/** Kiro auth service 端点（kiro.rs KIRO_AUTH_ENDPOINT）。/oauth/token 不做区域替换。 */
export const KIRO_AUTH_ENDPOINT = 'https://prod.us-east-1.auth.desktop.kiro.dev'

/** Portal 网页入口（kiro.rs KIRO_PORTAL_URL） */
export const KIRO_PORTAL_URL = 'https://app.kiro.dev'

/** 与 Kiro IDE 一致的本地回调端口候选表，按序尝试，第一个能 bind 的胜出 */
export const SOCIAL_CALLBACK_PORTS = [
  3128, 4649, 6588, 8008, 9091, 49153, 50153, 51153, 52153, 53153
] as const

/**
 * portal 的 redirect_from 取值。
 * kiro.rs 用 'KiroIDE'（生产验证过），kiro-cli 用 'kirocli'；
 * 上游是否校验这个字段未知，保留成常量以便一键切换。
 */
export const SOCIAL_REDIRECT_FROM = 'KiroIDE'

/** Portal 可能回跳到的两个路径（kiro.rs parse_callback） */
export const SOCIAL_CALLBACK_PATHS = ['/oauth/callback', '/signin/callback'] as const

export type SocialProvider = 'Google' | 'Github'

// ============ PKCE / state ============

/** base64url（无 padding） */
function base64url(buf: Buffer): string {
  return buf.toString('base64url')
}

/**
 * PKCE：verifier = 32 随机字节 base64url（43 字符），
 * challenge = base64url(SHA256(verifier 的 ASCII 文本))—— 是对字符串取哈希，不是对原始字节。
 */
export function generatePkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64url(randomBytes(32))
  const codeChallenge = base64url(createHash('sha256').update(codeVerifier, 'ascii').digest())
  return { codeVerifier, codeChallenge }
}

/** CSRF state（kiro.rs 用 UUIDv4） */
export function generateOAuthState(): string {
  return randomUUID()
}

// ============ URL 构造 ============

/** 给 portal 的 redirect_uri：裸的 scheme+host+port，无路径、无结尾斜杠 */
export function buildPortalRedirectUri(port: number): string {
  return `http://127.0.0.1:${port}`
}

/**
 * portal 登录 URL。参数顺序是固定的（state, code_challenge, code_challenge_method,
 * redirect_uri, redirect_from），所以手工拼接而不是 URLSearchParams。
 */
export function buildPortalUrl(p: {
  state: string
  codeChallenge: string
  redirectUri: string
  redirectFrom?: string
}): string {
  const params = [
    `state=${encodeURIComponent(p.state)}`,
    `code_challenge=${encodeURIComponent(p.codeChallenge)}`,
    'code_challenge_method=S256',
    `redirect_uri=${encodeURIComponent(p.redirectUri)}`,
    `redirect_from=${encodeURIComponent(p.redirectFrom || SOCIAL_REDIRECT_FROM)}`
  ].join('&')
  return `${KIRO_PORTAL_URL}/signin?${params}`
}

/**
 * 换 token 用的 redirectUri = 「给 portal 的裸值」+「实际回跳路径」
 * （回调带了 login_option 时再追加 ?login_option=<enc>）。
 * kiro.rs service.rs:2925-2932 —— 整个流程里最容易漏掉的一处。
 */
export function buildExchangeRedirectUri(
  portalRedirectUri: string,
  callbackPath: string,
  loginOption: string
): string {
  const base = `${portalRedirectUri}${callbackPath}`
  if (!loginOption) return base
  return `${base}?login_option=${encodeURIComponent(loginOption)}`
}

/** social access token 是不透明串，读不出 provider；只能靠回调里的 login_option 猜 */
export function providerFromLoginOption(loginOption: string): SocialProvider | null {
  const lower = (loginOption || '').toLowerCase()
  if (lower.includes('google')) return 'Google'
  if (lower.includes('github')) return 'Github'
  return null
}

// ============ 回调解析 ============

export type CallbackParse =
  | { kind: 'success'; code: string; state: string; loginOption: string; path: string }
  /** 路径命中但带 error / 缺 code */
  | { kind: 'error'; message: string }
  /** 其它路径（favicon 之类的顺手探测），必须忽略，绝不能因此终止会话 */
  | { kind: 'ignore' }

/**
 * 解析一次回调请求。只认 GET，只认 SOCIAL_CALLBACK_PATHS 里的两个路径。
 * 其余一律 ignore —— 浏览器会顺手请求 /favicon.ico，把它当失败会直接毁掉登录。
 */
export function parseCallbackRequest(method: string, rawUrl: string): CallbackParse {
  if ((method || '').toUpperCase() !== 'GET') return { kind: 'ignore' }
  let url: URL
  try {
    url = new URL(rawUrl || '', 'http://127.0.0.1')
  } catch {
    return { kind: 'ignore' }
  }
  const path = url.pathname
  if (!(SOCIAL_CALLBACK_PATHS as readonly string[]).includes(path)) return { kind: 'ignore' }

  const error = url.searchParams.get('error')
  const errorDescription = url.searchParams.get('error_description')
  if (error || errorDescription) {
    return { kind: 'error', message: errorDescription || error || '未知错误' }
  }

  const code = url.searchParams.get('code')
  if (!code) return { kind: 'error', message: 'missing code' }

  return {
    kind: 'success',
    code,
    state: url.searchParams.get('state') || '',
    loginOption: url.searchParams.get('login_option') || '',
    path
  }
}

// ============ Token 交换 ============

export interface SocialExchangeResult {
  accessToken: string
  refreshToken?: string
  /** 毫秒 epoch；上游 expiresAt / expiresIn 都没给时为 undefined（绝不编造） */
  expiresAt?: number
  profileArn?: string
}

interface SocialExchangeResponseBody {
  accessToken?: string
  refreshToken?: string
  expiresAt?: string
  expiresIn?: number
  profileArn?: string
}

export function socialExchangeUrl(authEndpoint: string = KIRO_AUTH_ENDPOINT): string {
  return `${authEndpoint}/oauth/token`
}

/**
 * 授权码换 token。
 * 头只有 Content-Type + `User-Agent: KiroIDE-<version>`（**不带 machineId**，
 * 与 refreshToken 那条刻意不同，见 kiro.rs social.rs:301-308 vs token_manager.rs:181-192）。
 * 请求体是 camelCase，没有 grant_type / client_id。
 */
export async function exchangeSocialCode(p: {
  code: string
  codeVerifier: string
  redirectUri: string
  authEndpoint?: string
  proxyUrl?: string
}): Promise<SocialExchangeResult> {
  const url = socialExchangeUrl(p.authEndpoint || KIRO_AUTH_ENDPOINT)
  const res = await kiroFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `KiroIDE-${getEffectiveKiroVersion()}`
      },
      body: JSON.stringify({
        code: p.code,
        codeVerifier: p.codeVerifier,
        redirectUri: p.redirectUri
      })
    },
    p.proxyUrl
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    // 429 归一成 UpstreamRateLimitError（不算账号失效），其余按普通错误抛
    if (res.status === 429) throw rateLimitErrorFromHeaders(res.headers, body, res.status)
    throw new Error(`social token exchange failed: HTTP ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = (await res.json()) as SocialExchangeResponseBody
  if (!data.accessToken) {
    throw new Error('social token exchange failed: 响应缺少 accessToken')
  }

  // expiresAt 优先（RFC3339），否则 now + expiresIn；两个都没有就留 undefined
  const expiresIn =
    typeof data.expiresIn === 'number' && Number.isFinite(data.expiresIn) && data.expiresIn > 0
      ? data.expiresIn
      : undefined
  const expiresAt =
    parseExpiresAt(data.expiresAt) ?? (expiresIn ? Date.now() + expiresIn * 1000 : undefined)

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt,
    profileArn: data.profileArn
  }
}

/** 供回调页面复用：把值转义后再插进 HTML */
export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

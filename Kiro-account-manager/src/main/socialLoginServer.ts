// Social 登录的本地回调服务器
//
// 形状照抄仓库里已有的 IAM SSO 回调服务器（index.ts start-iam-sso-login）：
// 本地起服务器 → 回调进来后**在请求处理里直接把 code 换成 token** → renderer 只轮询结果。
// 与 IAM SSO 的两点不同：
//   - 端口不是 listen(0) 随机的，而是按 SOCIAL_CALLBACK_PORTS 顺序占用（上游 redirect_uri
//     白名单很紧，见 kiro.rs v0.6.7 的回滚记录），且直接 listen + 监听 EADDRINUSE 换下一个，
//     不做「先探测再释放」，避免探测和真正 bind 之间被别人抢走；
//   - 成功页面在换 token **之前**就发出去，换 token 慢的时候浏览器标签页不至于一直转圈。
//
// 不 import electron，可直接被 bun test 加载。

import http from 'node:http'
import { randomUUID } from 'node:crypto'
import {
  SOCIAL_CALLBACK_PORTS,
  buildExchangeRedirectUri,
  buildPortalRedirectUri,
  buildPortalUrl,
  escapeHtml,
  exchangeSocialCode,
  generateOAuthState,
  generatePkce,
  parseCallbackRequest,
  providerFromLoginOption,
  type SocialProvider
} from './kiroApi/socialLogin'

/** 会话有效期，与 kiro.rs 一致的 10 分钟 */
export const SOCIAL_LOGIN_TTL_MS = 10 * 60 * 1000

export type SocialLoginOutcome =
  | {
      status: 'completed'
      provider: SocialProvider
      accessToken: string
      refreshToken?: string
      expiresAt?: number
      profileArn?: string
      loginOption: string
    }
  | { status: 'error'; error: string }

export interface SocialLoginSession {
  id: string
  provider: SocialProvider
  codeVerifier: string
  state: string
  port: number
  /** 给 portal 的裸 redirect_uri */
  portalRedirectUri: string
  portalUrl: string
  server: http.Server
  createdAt: number
  expiresAt: number
  result: SocialLoginOutcome | null
  /** 已取消（关弹窗 / 开新会话 / 过期）。飞行中的 exchange 回来后要靠它丢弃结果。 */
  cancelled: boolean
  /** 取消时 abort，把还在飞的 /oauth/token 请求一并掐掉 */
  abortController: AbortController
  /** 换 token 时透传的代理 */
  proxyUrl?: string
  /** 注入点：测试里换成假 exchange，绝不打真实上游 */
  exchange: typeof exchangeSocialCode
}

function successPage(): string {
  return (
    '<html><head><meta charset="utf-8"><title>登录成功</title></head>' +
    '<body style="font-family:sans-serif;text-align:center;padding:60px">' +
    '<h2>&#10003; 登录成功</h2>' +
    '<p>可以关闭此页面并返回 Kiro Account Manager。</p>' +
    '<p style="color:#888;font-size:13px">Login succeeded. You can close this tab and return to Kiro Account Manager.</p>' +
    '</body></html>'
  )
}

function failurePage(message: string): string {
  return (
    '<html><head><meta charset="utf-8"><title>登录失败</title></head>' +
    '<body style="font-family:sans-serif;text-align:center;padding:60px">' +
    '<h2>&#10007; 登录失败</h2>' +
    `<p>${escapeHtml(message)}</p>` +
    '<p style="color:#888;font-size:13px">Login failed. Please close this tab and try again.</p>' +
    '</body></html>'
  )
}

function sendHtml(res: http.ServerResponse, html: string): void {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(html)
}

/**
 * 关掉服务器、抹掉 verifier、abort 掉还在飞的换 token 请求。
 * cancelled 一旦置上，后到的 exchange 结果会被丢弃（见 finish）。
 */
export function cancelSocialLoginSession(s: SocialLoginSession | null): void {
  if (!s) return
  s.cancelled = true
  s.codeVerifier = ''
  s.abortController.abort()
  try {
    s.server.close()
  } catch {
    /* 已经关了 */
  }
}

/**
 * 处理一次回调请求。session 由调用方传入（服务器 listen 拿到端口后才建得出来），
 * 所以这里是模块级函数而不是闭包 —— 不存在「handler 引用了还没赋值的 session」的窗口。
 */
async function handleCallbackRequest(
  session: SocialLoginSession,
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const parsed = parseCallbackRequest(req.method || 'GET', req.url || '')

  if (parsed.kind === 'ignore') {
    // 浏览器的 /favicon.ico 之类：404 了事，服务器继续等真正的回调
    res.writeHead(404)
    res.end()
    return
  }

  if (parsed.kind === 'error') {
    sendHtml(res, failurePage(parsed.message))
    finish(session, { status: 'error', error: parsed.message })
    return
  }

  // 成功页先发出去：换 token 可能要几秒，别把浏览器标签页吊着
  sendHtml(res, successPage())

  if (parsed.state !== session.state) {
    console.warn('[SocialLogin] state 不匹配，已拒绝该回调')
    finish(session, { status: 'error', error: 'SOCIAL_LOGIN_STATE_MISMATCH' })
    return
  }

  const redirectUri = buildExchangeRedirectUri(
    session.portalRedirectUri,
    parsed.path,
    parsed.loginOption
  )
  console.log(
    `[SocialLogin] 收到回调：port=${session.port} path=${parsed.path} login_option=${parsed.loginOption || '(空)'}`
  )

  // codeVerifier 要在 await 之前取：取消会把它抹成空串
  const codeVerifier = session.codeVerifier
  try {
    const token = await session.exchange({
      code: parsed.code,
      codeVerifier,
      redirectUri,
      proxyUrl: session.proxyUrl,
      signal: session.abortController.signal
    })
    // 只打 key 名，绝不打 token 值 —— 第一次真实登录靠这行确认上游到底回了哪些字段
    console.log(
      `[SocialLogin] 换 token 成功，响应字段: ${Object.keys(token)
        .filter((k) => (token as unknown as Record<string, unknown>)[k] !== undefined)
        .join(',')}`
    )
    finish(session, {
      status: 'completed',
      provider: providerFromLoginOption(parsed.loginOption) ?? session.provider,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      profileArn: token.profileArn,
      loginOption: parsed.loginOption
    })
  } catch (e) {
    finish(session, { status: 'error', error: e instanceof Error ? e.message : String(e) })
  }
}

/**
 * 起一个登录会话：占端口 → 建会话 → 挂上请求处理 → 拼 portal URL。
 * 同一时刻只允许一个会话，调用方负责在开新会话前取消旧的。
 */
export async function startSocialLoginSession(p: {
  provider: SocialProvider
  ports?: readonly number[]
  ttlMs?: number
  exchange?: typeof exchangeSocialCode
  /** 换 token 时透传的代理（主进程注入的 fetch 会用到） */
  proxyUrl?: string
}): Promise<SocialLoginSession> {
  const ports = p.ports && p.ports.length > 0 ? p.ports : SOCIAL_CALLBACK_PORTS
  const { codeVerifier, codeChallenge } = generatePkce()
  const state = generateOAuthState()
  const now = Date.now()

  // 先占端口再建会话：portalRedirectUri / portalUrl 都要用真实端口。
  // 请求处理在 session 建好之后才挂上去，中间不会有请求落到半成品会话上。
  const server = http.createServer()
  const port = await listenOnFirstFreePort(server, ports)
  const portalRedirectUri = buildPortalRedirectUri(port)

  const session: SocialLoginSession = {
    id: randomUUID(),
    provider: p.provider,
    codeVerifier,
    state,
    port,
    portalRedirectUri,
    portalUrl: buildPortalUrl({ state, codeChallenge, redirectUri: portalRedirectUri }),
    server,
    createdAt: now,
    expiresAt: now + (p.ttlMs ?? SOCIAL_LOGIN_TTL_MS),
    result: null,
    cancelled: false,
    abortController: new AbortController(),
    proxyUrl: p.proxyUrl,
    exchange: p.exchange || exchangeSocialCode
  }

  server.on('request', (req, res) => {
    void handleCallbackRequest(session, req, res)
  })

  console.log(`[SocialLogin] 回调服务器已监听 127.0.0.1:${port}（provider=${p.provider}）`)
  return session
}

/**
 * 记录结果并释放端口：一次回调（成功或失败）就结束这个会话。
 * 会话已被取消（关弹窗 / 开了新会话 / 过期）时直接丢弃 —— 那份结果的归属者已经不在了。
 */
function finish(session: SocialLoginSession, outcome: SocialLoginOutcome): void {
  if (session.result || session.cancelled) return
  session.result = outcome
  cancelSocialLoginSession(session)
}

/**
 * 按序 bind，EADDRINUSE 就换下一个。listener 一直持有（不做探测-释放），
 * 全部占用时抛出带端口表的错误。
 */
function listenOnFirstFreePort(server: http.Server, ports: readonly number[]): Promise<number> {
  return new Promise((resolve, reject) => {
    let index = 0
    const tryNext = (): void => {
      if (index >= ports.length) {
        reject(new Error(`所有回调端口均被占用，请确保没有其他程序占用 ${ports.join(', ')}`))
        return
      }
      const port = ports[index++]
      const onError = (err: NodeJS.ErrnoException): void => {
        server.removeListener('listening', onListening)
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          tryNext()
          return
        }
        reject(err)
      }
      const onListening = (): void => {
        server.removeListener('error', onError)
        // 之后的运行期错误不能再走 bind 逻辑，也不能把进程带崩
        server.on('error', (e) => console.error('[SocialLogin] 回调服务器错误:', e))
        resolve(port)
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(port, '127.0.0.1')
    }
    tryNext()
  })
}

/** 轮询：pending / expired / 已有结果。expired 时顺手释放端口。 */
export function pollSocialLoginSession(
  s: SocialLoginSession | null
): { status: 'pending' } | { status: 'expired' } | SocialLoginOutcome {
  if (!s) return { status: 'expired' }
  if (s.result) return s.result
  if (Date.now() >= s.expiresAt) {
    cancelSocialLoginSession(s)
    return { status: 'expired' }
  }
  return { status: 'pending' }
}

/**
 * 粘贴回调地址的兜底路径（浏览器在另一台机器上时用）。
 * 走的是和服务器完全相同的完成逻辑，state 不匹配一样拒绝。
 */
export async function completeSocialLoginFromUrl(
  s: SocialLoginSession | null,
  rawUrl: string,
  proxyUrl?: string
): Promise<SocialLoginOutcome> {
  if (!s) return { status: 'error', error: 'SOCIAL_LOGIN_CANCELLED' }
  if (s.result) return s.result
  if (Date.now() >= s.expiresAt) {
    cancelSocialLoginSession(s)
    return { status: 'error', error: 'SOCIAL_LOGIN_EXPIRED' }
  }

  const parsed = parseCallbackRequest('GET', rawUrl)
  if (parsed.kind === 'ignore') {
    return { status: 'error', error: '回调地址无法识别，请粘贴完整的 /oauth/callback?... 地址' }
  }
  if (parsed.kind === 'error') {
    const outcome: SocialLoginOutcome = { status: 'error', error: parsed.message }
    finish(s, outcome)
    return outcome
  }
  if (parsed.state !== s.state) {
    const outcome: SocialLoginOutcome = { status: 'error', error: 'SOCIAL_LOGIN_STATE_MISMATCH' }
    finish(s, outcome)
    return outcome
  }

  const redirectUri = buildExchangeRedirectUri(s.portalRedirectUri, parsed.path, parsed.loginOption)
  // codeVerifier 要在 await 之前取：取消会把它抹成空串
  const codeVerifier = s.codeVerifier
  try {
    const token = await s.exchange({
      code: parsed.code,
      codeVerifier,
      redirectUri,
      proxyUrl: proxyUrl ?? s.proxyUrl,
      signal: s.abortController.signal
    })
    const outcome: SocialLoginOutcome = {
      status: 'completed',
      provider: providerFromLoginOption(parsed.loginOption) ?? s.provider,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      profileArn: token.profileArn,
      loginOption: parsed.loginOption
    }
    finish(s, outcome)
    return outcome
  } catch (e) {
    const outcome: SocialLoginOutcome = {
      status: 'error',
      error: e instanceof Error ? e.message : String(e)
    }
    finish(s, outcome)
    return outcome
  }
}

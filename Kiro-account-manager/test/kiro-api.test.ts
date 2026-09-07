// WP-B 单元测试：kiroApi/* 与 kiro.rs（origin/master @ f357292）逐字对齐
//
// 运行：bun test test/kiro-api.test.ts   （bun 实现了 node:test API）
// 绝不发起真实网络请求：所有 HTTP 都通过 setKiroApiFetch 注入的假 fetch。

import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

import { setKiroApiFetch, type KiroFetch } from '../src/main/kiroApi/transport'
import {
  buildSocialRefreshHeaders,
  buildIdcRefreshHeaders,
  buildUsageHeaders,
  buildUsageUserAgent,
  buildUsageAmzUserAgent,
  buildIdeStreamingUserAgent,
  buildIdeStreamingAmzUserAgent,
  setKiroClientEnv,
  __resetKiroClientEnvForTests
} from '../src/main/kiroApi/headers'
import {
  classifyRefreshError,
  RefreshTokenInvalidError,
  UpstreamRateLimitError,
  normalizeRetryAfter,
  isAccountSuspended,
  isAccountThrottled,
  isBearerTokenInvalid,
  isQuotaExhausted,
  classifyAccountStatusFromError
} from '../src/main/kiroApi/errors'
import {
  isTokenExpired,
  isTokenExpiringSoon,
  needsTokenRefresh,
  parseExpiresAt
} from '../src/main/kiroApi/expiry'
import {
  refreshSocialToken,
  refreshIdcToken,
  refreshTokenByMethod,
  refreshTokenWithReload,
  resolveAuthMethod,
  setExternalRefreshTokenReader,
  readExternalRefreshToken,
  validateRefreshTokenStr
} from '../src/main/kiroApi/refresh'
import {
  restApiRegionCandidates,
  buildUsageAttempts,
  usageLimitsUrl,
  getUsageLimits,
  computeUsageBalance,
  extractEmail,
  extractSubscriptionTitle
} from '../src/main/kiroApi/usage'
import { pickExternalRefreshToken } from '../src/main/externalRefresh'
import { buildSecondTargetCredentials } from '../src/renderer/src/utils/accountSwitch'
import { decideTokenWriteBack, shouldRefreshBeforeVerify } from '../src/main/localTokenSync'
import {
  parseKiroVersionMetadata,
  refreshKiroVersion,
  __resetKiroVersionCacheForTests,
  USAGE_API_KIRO_VERSION,
  KIRO_VERSION_FALLBACK
} from '../src/main/kiroApi/version'
import {
  generatePkce,
  generateOAuthState,
  buildPortalRedirectUri,
  buildPortalUrl,
  buildExchangeRedirectUri,
  parseCallbackRequest,
  providerFromLoginOption,
  exchangeSocialCode,
  SOCIAL_CALLBACK_PORTS,
  SOCIAL_REDIRECT_FROM
} from '../src/main/kiroApi/socialLogin'

const MID = 'a'.repeat(64)
const LONG_TOKEN = 'r'.repeat(120)

interface FakeCall {
  url: string
  init: RequestInit
  proxyUrl?: string
}

/** 装一个假 fetch，返回记录到的调用列表 */
function installFakeFetch(
  responder: (
    call: FakeCall,
    index: number
  ) => {
    status?: number
    body?: string
    json?: unknown
    headers?: Record<string, string>
  }
): FakeCall[] {
  const calls: FakeCall[] = []
  const fake: KiroFetch = async (url, init, proxyUrl) => {
    const call = { url, init, proxyUrl }
    calls.push(call)
    const r = responder(call, calls.length - 1)
    const status = r.status ?? 200
    const bodyText = r.json !== undefined ? JSON.stringify(r.json) : (r.body ?? '')
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: (name: string) => r.headers?.[name.toLowerCase()] ?? null
      },
      text: async () => bodyText,
      json: async () => JSON.parse(bodyText)
    } as unknown as Response
  }
  setKiroApiFetch(fake)
  return calls
}

function resetAll(): void {
  setKiroApiFetch(undefined)
  setExternalRefreshTokenReader(undefined)
  __resetKiroClientEnvForTests()
  __resetKiroVersionCacheForTests()
}

// ============================ headers ============================

test('headers: Social refresh UA 与 kiro.rs token_manager.rs:178-181 一致', () => {
  resetAll()
  const h = buildSocialRefreshHeaders(MID, { version: '0.12.301' })
  assert.equal(h['User-Agent'], `KiroIDE-0.12.301-${MID}`)
  assert.equal(h['Accept'], 'application/json, text/plain, */*')
  assert.equal(h['Content-Type'], 'application/json')
  // Social 刷新没有 Authorization / x-amz-user-agent / amz-sdk-*
  assert.equal(h['Authorization'], undefined)
  assert.equal(h['x-amz-user-agent'], undefined)
  assert.equal(h['amz-sdk-invocation-id'], undefined)
  // 无 machineId 时退化
  assert.equal(
    buildSocialRefreshHeaders(undefined, { version: '1.0.0' })['User-Agent'],
    'KiroIDE-1.0.0'
  )
  // 逐字复刻模式才带传输层头
  const full = buildSocialRefreshHeaders(MID, { version: '1.0.0', includeTransportHeaders: true })
  assert.equal(full['Accept-Encoding'], 'gzip, compress, deflate, br')
  assert.equal(full['Connection'], 'close')
})

test('headers: 未取到实时版本时回退 KIRO_VERSION_FALLBACK', () => {
  resetAll()
  assert.equal(
    buildSocialRefreshHeaders(MID)['User-Agent'],
    `KiroIDE-${KIRO_VERSION_FALLBACK}-${MID}`
  )
})

test('headers: IdC refresh UA 与 kiro.rs token_manager.rs:271-276 一致（无 machineId）', () => {
  resetAll()
  const h = buildIdcRefreshHeaders()
  assert.equal(h['x-amz-user-agent'], 'aws-sdk-js/3.980.0 KiroIDE')
  assert.equal(
    h['user-agent'],
    'aws-sdk-js/3.980.0 ua/2.1 os/macos lang/js md/nodejs#22.22.0 api/sso-oidc#3.980.0 m/E KiroIDE'
  )
  assert.equal(h['amz-sdk-request'], 'attempt=1; max=4')
  assert.match(h['amz-sdk-invocation-id'], /^[0-9a-f-]{36}$/)
  assert.equal(h['content-type'], 'application/json')
  assert.ok(!h['user-agent'].includes(MID))
})

test('headers: 用量类 REST UA 固定 0.9.2（kiro.rs token_manager.rs:546-556）', () => {
  resetAll()
  assert.equal(USAGE_API_KIRO_VERSION, '0.9.2')
  assert.equal(
    buildUsageUserAgent(MID),
    `aws-sdk-js/1.0.0 ua/2.1 os/macos lang/js md/nodejs#22.22.0 api/codewhispererruntime#1.0.0 m/N,E KiroIDE-0.9.2-${MID}`
  )
  assert.equal(buildUsageAmzUserAgent(MID), `aws-sdk-js/1.0.0 KiroIDE-0.9.2-${MID}`)

  const h = buildUsageHeaders('tok', MID)
  assert.equal(h['Authorization'], 'Bearer tok')
  assert.equal(h['amz-sdk-request'], 'attempt=1; max=1')
  // social / idc 不带 tokentype
  assert.equal(h['tokentype'], undefined)
  assert.equal(
    buildUsageHeaders('tok', MID, undefined, { tokenType: 'EXTERNAL_IDP' })['tokentype'],
    'EXTERNAL_IDP'
  )
})

test('headers: os/node 可配置，影响 IdC 与用量 UA', () => {
  resetAll()
  setKiroClientEnv({ systemVersion: 'linux', nodeVersion: '20.11.0' })
  assert.ok(buildIdcRefreshHeaders()['user-agent'].includes('os/linux lang/js md/nodejs#20.11.0'))
  assert.ok(buildUsageUserAgent(MID).includes('os/linux lang/js md/nodejs#20.11.0'))
  __resetKiroClientEnvForTests()
})

test('headers: ide streaming UA 使用 1.0.34 + 实时版本（kiro.rs endpoint/ide.rs:34-50）', () => {
  resetAll()
  assert.equal(
    buildIdeStreamingUserAgent(MID, '0.12.301'),
    `aws-sdk-js/1.0.34 ua/2.1 os/macos lang/js md/nodejs#22.22.0 api/codewhispererstreaming#1.0.34 m/E KiroIDE-0.12.301-${MID}`
  )
  assert.equal(
    buildIdeStreamingAmzUserAgent(MID, '0.12.301'),
    `aws-sdk-js/1.0.34 KiroIDE-0.12.301-${MID}`
  )
})

// ============================ errors ============================

test('errors: classifyRefreshError 429 → UpstreamRateLimitError（带 Retry-After）', () => {
  const headers = { get: (n: string) => (n.toLowerCase() === 'retry-after' ? '120' : null) }
  const e = classifyRefreshError(429, 'Too Many Requests', headers)
  assert.ok(e instanceof UpstreamRateLimitError)
  assert.equal((e as UpstreamRateLimitError).retryAfterMs, 120_000)
  assert.equal((e as UpstreamRateLimitError).retryAfter, '120')
})

test('errors: classifyRefreshError 400 + invalid_grant + Invalid refresh token provided → 永久失效', () => {
  const body = '{"error":"invalid_grant","error_description":"Invalid refresh token provided"}'
  const e = classifyRefreshError(400, body)
  assert.ok(e instanceof RefreshTokenInvalidError)
  assert.ok(e.message.includes('invalid_grant'))
})

test('errors: 400 缺任一标记 → 普通瞬时错误', () => {
  assert.ok(
    !(classifyRefreshError(400, '{"error":"invalid_grant"}') instanceof RefreshTokenInvalidError)
  )
  assert.ok(
    !(
      classifyRefreshError(400, 'Invalid refresh token provided') instanceof
      RefreshTokenInvalidError
    )
  )
  assert.equal(classifyRefreshError(400, 'oops').message, 'Token 刷新失败: 400 oops')
})

test('errors: 401 / 403 / 5xx 文案映射', () => {
  assert.ok(
    classifyRefreshError(401, 'x').message.startsWith('OAuth 凭证已过期或无效，需要重新认证: 401')
  )
  assert.ok(classifyRefreshError(403, 'x').message.startsWith('权限不足，无法刷新 Token: 403'))
  assert.ok(
    classifyRefreshError(503, 'x').message.startsWith('服务器错误，AWS OAuth 服务暂时不可用: 503')
  )
  assert.ok(!(classifyRefreshError(503, 'x') instanceof UpstreamRateLimitError))
})

test('errors: Retry-After 只接受 delta-seconds 或 HTTP-date', () => {
  assert.equal(normalizeRetryAfter('30'), '30')
  assert.equal(
    normalizeRetryAfter('Wed, 21 Oct 2026 07:28:00 GMT'),
    'Wed, 21 Oct 2026 07:28:00 GMT'
  )
  assert.equal(normalizeRetryAfter('soon'), undefined)
  assert.equal(normalizeRetryAfter(''), undefined)
  assert.equal(normalizeRetryAfter(null), undefined)
})

test('errors: suspended / throttled / bearer / quota 判定（kiro.rs endpoint/mod.rs）', () => {
  const suspendedBody =
    "Your User ID (d-123) temporarily is SUSPENDED. We've LOCKED YOUR ACCOUNT as a security precaution."
  assert.equal(isAccountSuspended(suspendedBody), true) // 大小写不敏感
  assert.equal(isAccountSuspended('account suspended'), false) // 只有一个短语 → 不判定
  assert.equal(isAccountSuspended(undefined), false)

  const throttledBody =
    'Due to suspicious activity, we are imposing temporary limits on how frequently your account (d-1) can send a request.'
  assert.equal(isAccountThrottled(throttledBody), true)
  assert.equal(isAccountThrottled('rate limit exceeded'), false)

  assert.equal(isBearerTokenInvalid('The bearer token included in the request is invalid'), true)
  assert.equal(isBearerTokenInvalid('token invalid'), false)

  assert.equal(isQuotaExhausted('{"reason":"MONTHLY_REQUEST_COUNT"}'), true)
  assert.equal(isQuotaExhausted('{"error":{"reason":"OVERAGE_REQUEST_LIMIT_EXCEEDED"}}'), true)
  assert.equal(isQuotaExhausted('{"reason":"SOMETHING_ELSE"}'), false)
  assert.equal(isQuotaExhausted('nothing here'), false)
})

test('errors: classifyAccountStatusFromError 正文优先，429 兜底为 throttled', () => {
  assert.equal(classifyAccountStatusFromError('suspended ... locked your account'), 'suspended')
  assert.equal(
    classifyAccountStatusFromError('suspicious activity + temporary limits'),
    'throttled'
  )
  assert.equal(classifyAccountStatusFromError('boom', 429), 'throttled')
  assert.equal(classifyAccountStatusFromError('boom', 500), undefined)
})

// ============================ expiry ============================

test('expiry: 5 分钟已过期 / 10 分钟即将过期，且不可解析时不对称', () => {
  const now = Date.parse('2026-01-01T00:00:00Z')
  const at = (min: number): number => now + min * 60 * 1000

  assert.equal(isTokenExpired(at(4), 5, now), true)
  assert.equal(isTokenExpired(at(6), 5, now), false)
  assert.equal(isTokenExpiringSoon(at(9), 10, now), true)
  assert.equal(isTokenExpiringSoon(at(11), 10, now), false)

  // 不可解析：expired ⇒ true，expiringSoon ⇒ false，合起来强制刷新
  assert.equal(isTokenExpired(undefined, 5, now), true)
  assert.equal(isTokenExpiringSoon(undefined, 10, now), false)
  assert.equal(needsTokenRefresh(undefined, now), true)
  assert.equal(isTokenExpired('not-a-date', 5, now), true)

  // 有效阈值是 10 分钟
  assert.equal(needsTokenRefresh(at(9), now), true)
  assert.equal(needsTokenRefresh(at(11), now), false)
})

test('expiry: parseExpiresAt 接受毫秒/秒/RFC3339', () => {
  assert.equal(parseExpiresAt('2026-01-01T00:00:00Z'), Date.parse('2026-01-01T00:00:00Z'))
  assert.equal(parseExpiresAt(1_767_225_600_000), 1_767_225_600_000)
  assert.equal(parseExpiresAt(1_767_225_600), 1_767_225_600_000)
  assert.equal(parseExpiresAt(undefined), undefined)
  assert.equal(parseExpiresAt(''), undefined)
})

// ============================ refresh ============================

test('refresh: authMethod 分派（kiro.rs token_manager.rs:284-299）', () => {
  assert.equal(resolveAuthMethod({ authMethod: 'social' }), 'social')
  assert.equal(resolveAuthMethod({ authMethod: 'IdC' }), 'IdC')
  assert.equal(resolveAuthMethod({ authMethod: 'builder-id' }), 'IdC')
  assert.equal(resolveAuthMethod({ authMethod: 'iam' }), 'IdC')
  assert.equal(resolveAuthMethod({ authMethod: 'external_idp' }), 'external_idp')
  // 未识别值落到 social
  assert.equal(resolveAuthMethod({ authMethod: 'whatever' }), 'social')
  // 未指定：两者都有 → IdC，否则 social
  assert.equal(resolveAuthMethod({ clientId: 'a', clientSecret: 'b' }), 'IdC')
  assert.equal(resolveAuthMethod({ clientId: 'a' }), 'social')
  assert.equal(resolveAuthMethod({}), 'social')
})

test('refresh: 预检拦截空/被截断的 refreshToken', () => {
  assert.throws(() => validateRefreshTokenStr(''), /refreshToken 为空/)
  assert.throws(() => validateRefreshTokenStr('short'), /已被截断/)
  assert.throws(() => validateRefreshTokenStr('x'.repeat(150) + '...'), /已被截断/)
  assert.doesNotThrow(() => validateRefreshTokenStr(LONG_TOKEN))
})

test('refresh: Social 端点/报文/轮换/expiresAt', async () => {
  resetAll()
  const calls = installFakeFetch(() => ({
    json: { accessToken: 'AT', refreshToken: 'RT2', profileArn: 'arn:x', expiresIn: 1800 }
  }))
  const before = Date.now()
  const r = await refreshSocialToken(LONG_TOKEN, {
    region: 'eu-central-1',
    machineId: MID,
    proxyUrl: 'http://p'
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://prod.eu-central-1.auth.desktop.kiro.dev/refreshToken')
  assert.equal(calls[0].init.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].init.body as string), { refreshToken: LONG_TOKEN })
  assert.equal(calls[0].proxyUrl, 'http://p')
  assert.equal(r.accessToken, 'AT')
  assert.equal(r.refreshToken, 'RT2')
  assert.equal(r.profileArn, 'arn:x')
  assert.equal(r.expiresIn, 1800)
  assert.ok(r.expiresAt >= before + 1800 * 1000)
  resetAll()
})

test('refresh: Social 未轮换时回填入参 refreshToken；缺 expiresIn 不编造有效期', async () => {
  resetAll()
  installFakeFetch(() => ({ json: { accessToken: 'AT' } }))
  const r = await refreshSocialToken(LONG_TOKEN)
  assert.equal(r.refreshToken, LONG_TOKEN)
  // 上游没给 ⇒ undefined，由调用方沿用账号原有的 expiresAt（不再默认 3600）
  assert.equal(r.expiresIn, undefined)
  assert.equal(r.expiresAt, undefined)
  resetAll()
})

test('refresh: IdC 端点与 camelCase 报文', async () => {
  resetAll()
  const calls = installFakeFetch(() => ({ json: { accessToken: 'AT', expiresIn: 600 } }))
  await refreshIdcToken(LONG_TOKEN, { clientId: 'CID', clientSecret: 'SEC', region: 'us-east-1' })
  assert.equal(calls[0].url, 'https://oidc.us-east-1.amazonaws.com/token')
  assert.deepEqual(JSON.parse(calls[0].init.body as string), {
    clientId: 'CID',
    clientSecret: 'SEC',
    refreshToken: LONG_TOKEN,
    grantType: 'refresh_token'
  })
  resetAll()
})

test('refresh: 429 抛 UpstreamRateLimitError，不当成账号失效', async () => {
  resetAll()
  installFakeFetch(() => ({ status: 429, body: 'slow down', headers: { 'retry-after': '42' } }))
  await assert.rejects(
    () => refreshTokenByMethod({ refreshToken: LONG_TOKEN, authMethod: 'social' }),
    (e: unknown) => e instanceof UpstreamRateLimitError && e.retryAfterMs === 42_000
  )
  resetAll()
})

test('refresh: invalid_grant → 回源重读拿到新 refreshToken 后重试一次', async () => {
  resetAll()
  const fresh = 'n'.repeat(120)
  const calls = installFakeFetch((call) => {
    const body = JSON.parse(call.init.body as string) as { refreshToken: string }
    if (body.refreshToken === fresh) return { json: { accessToken: 'AT2', refreshToken: fresh } }
    return {
      status: 400,
      body: '{"error":"invalid_grant","message":"Invalid refresh token provided"}'
    }
  })
  setExternalRefreshTokenReader(async () => fresh)
  const r = await refreshTokenWithReload({ refreshToken: LONG_TOKEN, authMethod: 'social' })
  assert.equal(calls.length, 2)
  assert.equal(r.accessToken, 'AT2')
  assert.equal(r.reloadedFromSource, true)
  resetAll()
})

test('refresh: 回源读不到（或同一个 token）时原样抛 RefreshTokenInvalidError', async () => {
  resetAll()
  installFakeFetch(() => ({
    status: 400,
    body: '{"error":"invalid_grant","message":"Invalid refresh token provided"}'
  }))
  setExternalRefreshTokenReader(async () => LONG_TOKEN) // 与当前相同 → 视为无更新
  await assert.rejects(
    () => refreshTokenWithReload({ refreshToken: LONG_TOKEN, authMethod: 'social' }),
    RefreshTokenInvalidError
  )
  resetAll()
})

// ============================ usage ============================

test('usage: 区域候选顺序（kiro.rs rest_api_region_candidates）', () => {
  assert.deepEqual(restApiRegionCandidates('eu-central-1'), ['eu-central-1', 'us-east-1'])
  assert.deepEqual(restApiRegionCandidates('eu-west-1'), ['eu-central-1', 'us-east-1'])
  assert.deepEqual(restApiRegionCandidates('us-east-1'), ['us-east-1', 'eu-central-1'])
  assert.deepEqual(restApiRegionCandidates(undefined), ['us-east-1', 'eu-central-1'])
})

test('usage: 候选梯子 = 每区域先带 ARN 再不带', () => {
  assert.deepEqual(buildUsageAttempts(['us-east-1', 'eu-central-1'], 'arn:a'), [
    { region: 'us-east-1', profileArn: 'arn:a' },
    { region: 'us-east-1' },
    { region: 'eu-central-1', profileArn: 'arn:a' },
    { region: 'eu-central-1' }
  ])
  // 无 ARN 时只有「不带」一种形态，与加此参数前行为一致
  assert.deepEqual(buildUsageAttempts(['us-east-1', 'eu-central-1']), [
    { region: 'us-east-1' },
    { region: 'eu-central-1' }
  ])
})

test('usage: URL 形状与 profileArn URL 编码', () => {
  assert.equal(
    usageLimitsUrl('q.us-east-1.amazonaws.com'),
    'https://q.us-east-1.amazonaws.com/getUsageLimits?origin=AI_EDITOR&resourceType=AGENTIC_REQUEST&isEmailRequired=true'
  )
  assert.equal(
    usageLimitsUrl('q.us-east-1.amazonaws.com', 'arn:aws:codewhisperer:us-east-1:1:profile/A B'),
    'https://q.us-east-1.amazonaws.com/getUsageLimits?origin=AI_EDITOR&resourceType=AGENTIC_REQUEST&isEmailRequired=true' +
      '&profileArn=arn%3Aaws%3Acodewhisperer%3Aus-east-1%3A1%3Aprofile%2FA%20B'
  )
})

test('usage: 403 逐候选回退，第 3 次成功', async () => {
  resetAll()
  const calls = installFakeFetch((_call, i) =>
    i < 2
      ? { status: 403, body: 'User is not authorized to make this call.' }
      : { json: { userInfo: { email: 'a@b.c' } } }
  )
  const res = await getUsageLimits('tok', {
    profileArn: 'arn:a',
    ssoRegion: 'us-east-1',
    machineId: MID
  })
  assert.equal(calls.length, 3)
  assert.ok(
    calls[0].url.startsWith('https://q.us-east-1.amazonaws.com/') &&
      calls[0].url.includes('profileArn=')
  )
  assert.ok(
    calls[1].url.startsWith('https://q.us-east-1.amazonaws.com/') &&
      !calls[1].url.includes('profileArn=')
  )
  assert.ok(
    calls[2].url.startsWith('https://q.eu-central-1.amazonaws.com/') &&
      calls[2].url.includes('profileArn=')
  )
  assert.equal(extractEmail(res), 'a@b.c')
  // 用量类头固定 0.9.2
  const headers = calls[0].init.headers as Record<string, string>
  assert.equal(headers['x-amz-user-agent'], `aws-sdk-js/1.0.0 KiroIDE-0.9.2-${MID}`)
  assert.equal(headers['Authorization'], 'Bearer tok')
  resetAll()
})

test('usage: 5xx 立刻抛，不换候选', async () => {
  resetAll()
  const calls = installFakeFetch(() => ({ status: 503, body: 'upstream down' }))
  await assert.rejects(() => getUsageLimits('tok', { profileArn: 'arn:a' }), /HTTP 503/)
  assert.equal(calls.length, 1)
  resetAll()
})

test('usage: 四个候选全 403 时抛最后一个错误', async () => {
  resetAll()
  const calls = installFakeFetch(() => ({ status: 403, body: 'nope' }))
  await assert.rejects(() => getUsageLimits('tok', { profileArn: 'arn:a' }), /HTTP 403/)
  assert.equal(calls.length, 4)
  resetAll()
})

test('usage: 邮箱 / 订阅 / 余额解析', () => {
  const res = {
    userInfo: { email: '' },
    subscriptionInfo: { subscriptionTitle: 'KIRO PRO+' },
    usageBreakdownList: [
      {
        usageLimitWithPrecision: 100,
        currentUsageWithPrecision: 30,
        freeTrialInfo: {
          freeTrialStatus: 'ACTIVE',
          usageLimitWithPrecision: 50,
          currentUsageWithPrecision: 10
        },
        bonuses: [
          { status: 'ACTIVE', usageLimitWithPrecision: 20, currentUsageWithPrecision: 5 },
          { status: 'EXPIRED', usageLimitWithPrecision: 999, currentUsageWithPrecision: 999 }
        ]
      }
    ]
  }
  assert.equal(extractEmail(res), undefined) // 空字符串视为无
  assert.equal(extractSubscriptionTitle(res), 'KIRO PRO+')
  assert.deepEqual(computeUsageBalance(res), { limit: 170, used: 45, remaining: 125 })
  assert.deepEqual(computeUsageBalance(undefined), { limit: 0, used: 0, remaining: 0 })
})

// ============================ version ============================

test('version: metadata 取 currentRelease，缺失时退到 releases[0].version', () => {
  assert.equal(parseKiroVersionMetadata({ currentRelease: '1.0.437' }), '1.0.437')
  assert.equal(parseKiroVersionMetadata({ releases: [{ version: '1.0.400' }] }), '1.0.400')
  assert.equal(parseKiroVersionMetadata({ currentRelease: 'not-a-version' }), undefined)
  assert.equal(parseKiroVersionMetadata(null), undefined)
})

test('version: 拉取成功后 headers 用实时版本；失败静默回退', async () => {
  resetAll()
  installFakeFetch(() => ({ json: { currentRelease: '1.0.437', releases: [] } }))
  assert.equal(await refreshKiroVersion(true), '1.0.437')
  assert.equal(buildSocialRefreshHeaders(MID)['User-Agent'], `KiroIDE-1.0.437-${MID}`)
  // 用量类不跟随实时版本
  assert.equal(buildUsageAmzUserAgent(MID), `aws-sdk-js/1.0.0 KiroIDE-0.9.2-${MID}`)

  __resetKiroVersionCacheForTests()
  installFakeFetch(() => ({ status: 500, body: 'boom' }))
  assert.equal(await refreshKiroVersion(true), undefined)
  assert.equal(
    buildSocialRefreshHeaders(MID)['User-Agent'],
    `KiroIDE-${KIRO_VERSION_FALLBACK}-${MID}`
  )
  resetAll()
})


// ============ 外部凭证源匹配（integration: setExternalRefreshTokenReader 注册的那个 reader） ============

/** 造一个只有 payload 有意义的假 JWT（parseAccessTokenClaims 不校验签名） */
function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `header.${b64}.sig`
}

const RT_A = 'a'.repeat(120)
const RT_B = 'b'.repeat(120)
const RT_STALE = 's'.repeat(120)

test('pickExternalRefreshToken: JWT sub 命中对应候选', () => {
  const account = {
    email: 'alice@example.com',
    refreshToken: RT_STALE,
    accessToken: fakeJwt({ sub: 'user-1', email: 'alice@example.com' })
  }
  const candidates = [
    { refreshToken: RT_B, accessToken: fakeJwt({ sub: 'user-2', email: 'bob@example.com' }) },
    { refreshToken: RT_A, accessToken: fakeJwt({ sub: 'user-1', email: 'alice@example.com' }) }
  ]
  assert.equal(pickExternalRefreshToken(account, candidates), RT_A)
})

test('pickExternalRefreshToken: sub 缺失时回落到 email 匹配', () => {
  const account = { email: 'alice@example.com', refreshToken: RT_STALE }
  const candidates = [
    { refreshToken: RT_B, accessToken: fakeJwt({ email: 'bob@example.com' }) },
    { refreshToken: RT_A, accessToken: fakeJwt({ email: 'ALICE@example.com' }) }
  ]
  assert.equal(pickExternalRefreshToken(account, candidates), RT_A)
})

test('pickExternalRefreshToken: 匹配不上任何候选时返回 undefined（绝不乱串号）', () => {
  const account = {
    email: 'alice@example.com',
    refreshToken: RT_STALE,
    accessToken: fakeJwt({ sub: 'user-1' })
  }
  const candidates = [
    { refreshToken: RT_B, accessToken: fakeJwt({ sub: 'user-2', email: 'bob@example.com' }) }
  ]
  assert.equal(pickExternalRefreshToken(account, candidates), undefined)
})

test('pickExternalRefreshToken: 候选与账号持有的是同一张票 ⇒ 视为无更新', () => {
  const account = {
    email: 'alice@example.com',
    refreshToken: RT_A,
    accessToken: fakeJwt({ sub: 'user-1' })
  }
  const candidates = [{ refreshToken: RT_A, accessToken: fakeJwt({ sub: 'user-1' }) }]
  assert.equal(pickExternalRefreshToken(account, candidates), undefined)
})

test('pickExternalRefreshToken: 账号没有任何身份信息时不做猜测', () => {
  assert.equal(
    pickExternalRefreshToken({ refreshToken: RT_STALE }, [{ refreshToken: RT_A }]),
    undefined
  )
  assert.equal(pickExternalRefreshToken({ email: 'a@b.c' }, []), undefined)
})

test('pickExternalRefreshToken: 注册后 readExternalRefreshToken 能拿到匹配结果', async () => {
  resetAll()
  const candidates = [
    { refreshToken: RT_A, accessToken: fakeJwt({ sub: 'user-1', email: 'alice@example.com' }) }
  ]
  setExternalRefreshTokenReader(async (acc) => pickExternalRefreshToken(acc, candidates))
  const found = await readExternalRefreshToken({
    email: 'alice@example.com',
    refreshToken: RT_STALE,
    accessToken: fakeJwt({ sub: 'user-1' })
  })
  assert.equal(found, RT_A)
  resetAll()
})


// ============================ expiresIn 缺失 ============================

test('refresh: 上游省略 expiresIn ⇒ expiresIn/expiresAt 均为 undefined（不编造 now+1h）', async () => {
  resetAll()
  installFakeFetch(() => ({ json: { accessToken: 'AT-no-exp' } }))
  const r = await refreshSocialToken(LONG_TOKEN)
  assert.equal(r.accessToken, 'AT-no-exp')
  // 未轮换时回填入参
  assert.equal(r.refreshToken, LONG_TOKEN)
  assert.equal(r.expiresIn, undefined)
  assert.equal(r.expiresAt, undefined)
  resetAll()
})

test('refresh: 上游给了 expiresIn ⇒ expiresAt = now + expiresIn*1000', async () => {
  resetAll()
  const before = Date.now()
  installFakeFetch(() => ({ json: { accessToken: 'AT', expiresIn: 1800 } }))
  const r = await refreshSocialToken(LONG_TOKEN)
  assert.equal(r.expiresIn, 1800)
  assert.ok(r.expiresAt !== undefined)
  assert.ok(r.expiresAt >= before + 1800 * 1000)
  assert.ok(r.expiresAt <= Date.now() + 1800 * 1000)
  resetAll()
})

test('refresh: expiresIn 非法（0 / 负数 / NaN）同样视为未给出', async () => {
  for (const bad of [0, -1, 'x']) {
    resetAll()
    installFakeFetch(() => ({ json: { accessToken: 'AT', expiresIn: bad } }))
    const r = await refreshSocialToken(LONG_TOKEN)
    assert.equal(r.expiresIn, undefined, `expiresIn=${String(bad)}`)
    assert.equal(r.expiresAt, undefined, `expiresIn=${String(bad)}`)
  }
  resetAll()
})

// ============================ 组合切号：不得二次刷新 ============================

test('buildSecondTargetCredentials: 上一步刷过 ⇒ 带 alreadyRefreshed 并原样透传', () => {
  const base = { accessToken: 'AT1', refreshToken: 'RT1', expiresAt: 111 }
  const out = buildSecondTargetCredentials(base, {
    accessToken: 'AT2',
    refreshToken: 'RT2',
    expiresIn: 1800,
    expiresAt: 222
  })
  assert.deepEqual(out, {
    accessToken: 'AT2',
    refreshToken: 'RT2',
    alreadyRefreshed: true,
    expiresIn: 1800,
    expiresAt: 222
  })
})

test('buildSecondTargetCredentials: 上一步没刷 ⇒ 用账号原凭证，由主进程去刷', () => {
  const out = buildSecondTargetCredentials(
    { accessToken: 'AT1', refreshToken: 'RT1', expiresAt: 111 },
    undefined
  )
  assert.deepEqual(out, {
    accessToken: 'AT1',
    refreshToken: 'RT1',
    alreadyRefreshed: false,
    expiresAt: 111
  })
})

test('buildSecondTargetCredentials: 缺字段时补空串，不产生 undefined 落盘', () => {
  const out = buildSecondTargetCredentials({}, undefined)
  assert.equal(out.accessToken, '')
  assert.equal(out.refreshToken, '')
  assert.equal(out.alreadyRefreshed, false)
})

test('buildSecondTargetCredentials: 上一步刷过但没给有效期 ⇒ expiresIn/expiresAt 保持 undefined', () => {
  const out = buildSecondTargetCredentials(
    { accessToken: 'AT1', refreshToken: 'RT1', expiresAt: 111 },
    { accessToken: 'AT2', refreshToken: 'RT2' }
  )
  assert.equal(out.alreadyRefreshed, true)
  assert.equal(out.expiresIn, undefined)
  // 上一步没给到期时间时不回填旧值：调用方（主进程）会沿用账号原有的 expiresAt
  assert.equal(out.expiresAt, undefined)
})


// ============ 轮换后回写本地客户端的判定 ============

const R_OLD = 'o'.repeat(120)
const R_NEW = 'n'.repeat(120)
const R_OTHER = 'z'.repeat(120)

test('decideTokenWriteBack: 目标记录的正是刚被换掉的那张票 ⇒ 回写', () => {
  const d = decideTokenWriteBack({
    currentRefreshToken: R_OLD,
    oldRefreshToken: R_OLD,
    newRefreshToken: R_NEW
  })
  assert.equal(d.write, true)
  assert.equal(d.reason, 'refreshToken match')
})

test('decideTokenWriteBack: 目标登录着别的账号 ⇒ 不写', () => {
  const d = decideTokenWriteBack({
    currentRefreshToken: R_OTHER,
    oldRefreshToken: R_OLD,
    newRefreshToken: R_NEW,
    accountId: 'a1',
    lastSwitchedAccountId: 'a2'
  })
  assert.equal(d.write, false)
  assert.equal(d.reason, 'not-this-account')
})

test('decideTokenWriteBack: 目标已经是新票 ⇒ 不写', () => {
  const d = decideTokenWriteBack({
    currentRefreshToken: R_NEW,
    oldRefreshToken: R_OLD,
    newRefreshToken: R_NEW
  })
  assert.equal(d.write, false)
  assert.equal(d.reason, 'already-current')
})

test('decideTokenWriteBack: 目标已自刷过、票对不上，但就是我们刚切进去的账号 ⇒ 回写', () => {
  const d = decideTokenWriteBack({
    currentRefreshToken: R_OTHER,
    oldRefreshToken: R_OLD,
    newRefreshToken: R_NEW,
    accountId: 'a1',
    lastSwitchedAccountId: 'a1'
  })
  assert.equal(d.write, true)
  assert.equal(d.reason, 'lastSwitchedAccountId fallback')
})

test('decideTokenWriteBack: 目标不存在（IDE 未登录 / CLI 没建库）⇒ 不写', () => {
  const d = decideTokenWriteBack({
    targetExists: false,
    oldRefreshToken: R_OLD,
    newRefreshToken: R_NEW,
    accountId: 'a1',
    lastSwitchedAccountId: 'a1'
  })
  assert.equal(d.write, false)
  assert.equal(d.reason, 'target-not-present')
})

test('decideTokenWriteBack: 没有新 refreshToken（未轮换）⇒ 不写', () => {
  const d = decideTokenWriteBack({ currentRefreshToken: R_OLD, oldRefreshToken: R_OLD })
  assert.equal(d.write, false)
  assert.equal(d.reason, 'no-new-refresh-token')
})

test('shouldRefreshBeforeVerify: 没有 accessToken（手填表单）⇒ 必须先刷', () => {
  assert.equal(
    shouldRefreshBeforeVerify({ expiresAt: Date.now() + 3600_000, needsRefresh: () => false }),
    true
  )
})

test('shouldRefreshBeforeVerify: 有 accessToken 且未进刷新窗口 ⇒ 直接复用，不轮换', () => {
  const calls: Array<number | undefined> = []
  const out = shouldRefreshBeforeVerify({
    accessToken: 'AT',
    expiresAt: 1234,
    needsRefresh: (e) => {
      calls.push(e)
      return false
    }
  })
  assert.equal(out, false)
  assert.deepEqual(calls, [1234])
})

test('shouldRefreshBeforeVerify: 有 accessToken 但已到刷新窗口 ⇒ 先刷', () => {
  assert.equal(
    shouldRefreshBeforeVerify({ accessToken: 'AT', expiresAt: 1, needsRefresh: () => true }),
    true
  )
})

// ============================ socialLogin（浏览器登录） ============================

test('socialLogin: PKCE verifier 43 字符 base64url，challenge = base64url(SHA256(verifier ASCII))', () => {
  resetAll()
  const { codeVerifier, codeChallenge } = generatePkce()
  assert.equal(codeVerifier.length, 43)
  assert.match(codeVerifier, /^[A-Za-z0-9_-]+$/)
  assert.match(codeChallenge, /^[A-Za-z0-9_-]{43}$/)
  // 逐字复算一遍，确认哈希取的是 verifier 的文本而不是随机字节
  const expected = createHash('sha256').update(codeVerifier, 'ascii').digest('base64url')
  assert.equal(codeChallenge, expected)
  // 已知向量（RFC 7636 附录 B 的 verifier）
  assert.equal(
    createHash('sha256').update('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk', 'ascii').digest('base64url'),
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
  )
})

test('socialLogin: state 每次不同', () => {
  resetAll()
  assert.notEqual(generateOAuthState(), generateOAuthState())
})

test('socialLogin: 给 portal 的 redirect_uri 是裸的 127.0.0.1:<port>，无路径无结尾斜杠', () => {
  resetAll()
  assert.equal(buildPortalRedirectUri(3128), 'http://127.0.0.1:3128')
})

test('socialLogin: portal URL 参数顺序与 kiro.rs social.rs:276-285 逐字一致', () => {
  resetAll()
  const url = buildPortalUrl({
    state: 'st ate',
    codeChallenge: 'ch-al_len',
    redirectUri: 'http://127.0.0.1:3128'
  })
  assert.equal(
    url,
    'https://app.kiro.dev/signin?state=st%20ate&code_challenge=ch-al_len&code_challenge_method=S256' +
      '&redirect_uri=http%3A%2F%2F127.0.0.1%3A3128&redirect_from=KiroIDE'
  )
  assert.equal(SOCIAL_REDIRECT_FROM, 'KiroIDE')
  assert.deepEqual(
    [...SOCIAL_CALLBACK_PORTS],
    [3128, 4649, 6588, 8008, 9091, 49153, 50153, 51153, 52153, 53153]
  )
})

test('socialLogin: parseCallbackRequest 两个回调路径都认，login_option 透传', () => {
  resetAll()
  for (const path of ['/oauth/callback', '/signin/callback']) {
    const r = parseCallbackRequest('GET', `${path}?code=C1&state=S1&login_option=Google`)
    assert.equal(r.kind, 'success')
    if (r.kind !== 'success') return
    assert.equal(r.code, 'C1')
    assert.equal(r.state, 'S1')
    assert.equal(r.loginOption, 'Google')
    assert.equal(r.path, path)
  }
})

test('socialLogin: parseCallbackRequest 其它路径/非 GET 一律 ignore（favicon 不能终止会话）', () => {
  resetAll()
  assert.equal(parseCallbackRequest('GET', '/favicon.ico').kind, 'ignore')
  assert.equal(parseCallbackRequest('GET', '/').kind, 'ignore')
  assert.equal(parseCallbackRequest('GET', '/oauth/callback/x?code=C').kind, 'ignore')
  assert.equal(parseCallbackRequest('POST', '/oauth/callback?code=C&state=S').kind, 'ignore')
})

test('socialLogin: parseCallbackRequest error → error，error_description 优先', () => {
  resetAll()
  const onlyError = parseCallbackRequest('GET', '/oauth/callback?error=access_denied')
  assert.equal(onlyError.kind, 'error')
  if (onlyError.kind === 'error') assert.equal(onlyError.message, 'access_denied')

  const withDesc = parseCallbackRequest(
    'GET',
    '/oauth/callback?error=access_denied&error_description=User%20refused'
  )
  assert.equal(withDesc.kind, 'error')
  if (withDesc.kind === 'error') assert.equal(withDesc.message, 'User refused')

  const noCode = parseCallbackRequest('GET', '/oauth/callback?state=S')
  assert.equal(noCode.kind, 'error')
  if (noCode.kind === 'error') assert.equal(noCode.message, 'missing code')
})

test('socialLogin: parseCallbackRequest 查询串里的 + 按 URL 规则解成空格', () => {
  resetAll()
  const r = parseCallbackRequest('GET', '/oauth/callback?code=a+b&state=S&login_option=Sign+in')
  assert.equal(r.kind, 'success')
  if (r.kind !== 'success') return
  assert.equal(r.code, 'a b')
  assert.equal(r.loginOption, 'Sign in')
})

test('socialLogin: 换 token 的 redirectUri = 裸值 + 实际路径 (+ ?login_option)', () => {
  resetAll()
  // 无 login_option
  assert.equal(
    buildExchangeRedirectUri('http://127.0.0.1:3128', '/oauth/callback', ''),
    'http://127.0.0.1:3128/oauth/callback'
  )
  // 有 login_option
  assert.equal(
    buildExchangeRedirectUri('http://127.0.0.1:3128', '/oauth/callback', 'Google'),
    'http://127.0.0.1:3128/oauth/callback?login_option=Google'
  )
  // 另一个路径 + 需要转义的 login_option
  assert.equal(
    buildExchangeRedirectUri('http://127.0.0.1:4649', '/signin/callback', 'a b&c'),
    'http://127.0.0.1:4649/signin/callback?login_option=a%20b%26c'
  )
})

test('socialLogin: providerFromLoginOption 大小写不敏感，认不出返回 null', () => {
  resetAll()
  assert.equal(providerFromLoginOption('Google'), 'Google')
  assert.equal(providerFromLoginOption('SIGNIN_WITH_GOOGLE'), 'Google')
  assert.equal(providerFromLoginOption('github'), 'Github')
  assert.equal(providerFromLoginOption('GitHub OAuth'), 'Github')
  assert.equal(providerFromLoginOption(''), null)
  assert.equal(providerFromLoginOption('builderId'), null)
})

test('socialLogin: exchangeSocialCode 的 URL / 方法 / 头 / camelCase 请求体', async () => {
  resetAll()
  const calls = installFakeFetch(() => ({ json: { accessToken: 'AT', refreshToken: 'RT' } }))
  const out = await exchangeSocialCode({
    code: 'C1',
    codeVerifier: 'V1',
    redirectUri: 'http://127.0.0.1:3128/oauth/callback?login_option=Google'
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://prod.us-east-1.auth.desktop.kiro.dev/oauth/token')
  assert.equal(calls[0].init.method, 'POST')
  const headers = calls[0].init.headers as Record<string, string>
  assert.equal(headers['Content-Type'], 'application/json')
  // 交换这一条只带版本，不带 machineId（与 refreshToken 那条刻意不同）
  assert.equal(headers['User-Agent'], `KiroIDE-${KIRO_VERSION_FALLBACK}`)
  assert.ok(!headers['User-Agent'].includes(MID))
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    code: 'C1',
    codeVerifier: 'V1',
    redirectUri: 'http://127.0.0.1:3128/oauth/callback?login_option=Google'
  })
  // 没有 grant_type / client_id / code_verifier 蛇形键
  assert.equal(String(calls[0].init.body).includes('grant_type'), false)
  assert.equal(String(calls[0].init.body).includes('code_verifier'), false)
  assert.equal(out.accessToken, 'AT')
  assert.equal(out.refreshToken, 'RT')
  assert.equal(out.expiresAt, undefined)
  resetAll()
})

test('socialLogin: expiresAt 优先于 expiresIn，两者都没有时不编造有效期', async () => {
  resetAll()
  installFakeFetch(() => ({
    json: { accessToken: 'AT', expiresAt: '2030-01-01T00:00:00Z', expiresIn: 3600 }
  }))
  const withAbsolute = await exchangeSocialCode({ code: 'c', codeVerifier: 'v', redirectUri: 'r' })
  assert.equal(withAbsolute.expiresAt, Date.parse('2030-01-01T00:00:00Z'))

  installFakeFetch(() => ({ json: { accessToken: 'AT', expiresIn: 3600 } }))
  const before = Date.now()
  const withRelative = await exchangeSocialCode({ code: 'c', codeVerifier: 'v', redirectUri: 'r' })
  assert.ok(withRelative.expiresAt !== undefined)
  assert.ok(withRelative.expiresAt! >= before + 3600 * 1000)

  installFakeFetch(() => ({ json: { accessToken: 'AT' } }))
  const neither = await exchangeSocialCode({ code: 'c', codeVerifier: 'v', redirectUri: 'r' })
  assert.equal(neither.expiresAt, undefined)
  resetAll()
})

test('socialLogin: 非 2xx 抛错并带状态码，429 归到 UpstreamRateLimitError', async () => {
  resetAll()
  installFakeFetch(() => ({ status: 400, body: 'bad code' }))
  await assert.rejects(
    () => exchangeSocialCode({ code: 'c', codeVerifier: 'v', redirectUri: 'r' }),
    (e: Error) => e.message.includes('HTTP 400') && e.message.includes('bad code')
  )

  installFakeFetch(() => ({ status: 429, body: 'slow down', headers: { 'retry-after': '30' } }))
  await assert.rejects(
    () => exchangeSocialCode({ code: 'c', codeVerifier: 'v', redirectUri: 'r' }),
    (e: Error) => e instanceof UpstreamRateLimitError && e.retryAfterMs === 30_000
  )

  installFakeFetch(() => ({ json: { refreshToken: 'RT' } }))
  await assert.rejects(
    () => exchangeSocialCode({ code: 'c', codeVerifier: 'v', redirectUri: 'r' }),
    /缺少 accessToken/
  )
  resetAll()
})

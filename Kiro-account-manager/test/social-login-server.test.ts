// Social 登录回调服务器的集成测试
//
// 运行：bun test test/social-login-server.test.ts
// 绝不打真实上游：exchange 一律注入假实现，端口用高位随机端口，只绑 127.0.0.1。

import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

import {
  startSocialLoginSession,
  pollSocialLoginSession,
  cancelSocialLoginSession,
  completeSocialLoginFromUrl,
  type SocialLoginSession
} from '../src/main/socialLoginServer'
import type { SocialExchangeResult } from '../src/main/kiroApi/socialLogin'

interface ExchangeCall {
  code: string
  codeVerifier: string
  redirectUri: string
}

/** 记录调用的假 exchange */
function fakeExchange(
  result: Partial<SocialExchangeResult> | Error = { accessToken: 'AT', refreshToken: 'RT' }
): { calls: ExchangeCall[]; fn: (p: ExchangeCall) => Promise<SocialExchangeResult> } {
  const calls: ExchangeCall[] = []
  return {
    calls,
    fn: async (p) => {
      calls.push({ code: p.code, codeVerifier: p.codeVerifier, redirectUri: p.redirectUri })
      if (result instanceof Error) throw result
      return { accessToken: 'AT', ...result } as SocialExchangeResult
    }
  }
}

/** 一个大概率空闲的高位端口（bind 失败会自动落到下一个候选） */
function randomPorts(count = 3): number[] {
  const base = 41000 + Math.floor(Math.random() * 15000)
  return Array.from({ length: count }, (_, i) => base + i)
}

async function get(port: number, path: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`)
  return { status: res.status, body: await res.text() }
}

/** 端口是否真的被释放了：能重新 bind 就算释放 */
function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = http.createServer()
    s.once('error', () => resolve(false))
    s.once('listening', () => s.close(() => resolve(true)))
    s.listen(port, '127.0.0.1')
  })
}

/** 等到会话拿到结果（换 token 是异步的，成功页先发出去了） */
async function waitForResult(s: SocialLoginSession, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!s.result && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10))
  }
}

test('回调服务器：成功回调 → completed，换 token 的 redirectUri 带上路径与 login_option', async () => {
  const exchange = fakeExchange({ accessToken: 'AT', refreshToken: 'RT', profileArn: 'arn:x' })
  const session = await startSocialLoginSession({
    provider: 'Google',
    ports: randomPorts(),
    exchange: exchange.fn
  })
  // 会话结束时 codeVerifier 会被抹掉，先存一份用于断言
  const verifier = session.codeVerifier
  try {
    assert.equal(pollSocialLoginSession(session).status, 'pending')

    const res = await get(
      session.port,
      `/oauth/callback?code=C1&state=${encodeURIComponent(session.state)}&login_option=Github`
    )
    assert.equal(res.status, 200)
    assert.ok(res.body.includes('登录成功'))

    await waitForResult(session)
    const outcome = pollSocialLoginSession(session)
    assert.equal(outcome.status, 'completed')
    if (outcome.status !== 'completed') return
    assert.equal(outcome.accessToken, 'AT')
    assert.equal(outcome.refreshToken, 'RT')
    assert.equal(outcome.profileArn, 'arn:x')
    // provider 以回调里的 login_option 为准，覆盖会话发起时的 Google
    assert.equal(outcome.provider, 'Github')

    assert.deepEqual(exchange.calls, [
      {
        code: 'C1',
        codeVerifier: verifier,
        redirectUri: `http://127.0.0.1:${session.port}/oauth/callback?login_option=Github`
      }
    ])
  } finally {
    cancelSocialLoginSession(session)
  }
})

test('回调服务器：/signin/callback 且无 login_option → redirectUri 就是裸值 + 路径', async () => {
  const exchange = fakeExchange()
  const session = await startSocialLoginSession({
    provider: 'Github',
    ports: randomPorts(),
    exchange: exchange.fn
  })
  try {
    await get(session.port, `/signin/callback?code=C2&state=${encodeURIComponent(session.state)}`)
    await waitForResult(session)
    assert.equal(exchange.calls[0].redirectUri, `http://127.0.0.1:${session.port}/signin/callback`)
    const outcome = pollSocialLoginSession(session)
    assert.equal(outcome.status, 'completed')
    // login_option 认不出 provider 时退回会话发起时选的那个
    if (outcome.status === 'completed') assert.equal(outcome.provider, 'Github')
  } finally {
    cancelSocialLoginSession(session)
  }
})

test('回调服务器：/favicon.ico → 404 且服务器还活着', async () => {
  const exchange = fakeExchange()
  const session = await startSocialLoginSession({
    provider: 'Google',
    ports: randomPorts(),
    exchange: exchange.fn
  })
  try {
    assert.equal((await get(session.port, '/favicon.ico')).status, 404)
    assert.equal((await get(session.port, '/')).status, 404)
    assert.equal(pollSocialLoginSession(session).status, 'pending')
    assert.equal(exchange.calls.length, 0)

    // 真正的回调依然能进来
    await get(session.port, `/oauth/callback?code=C3&state=${encodeURIComponent(session.state)}`)
    await waitForResult(session)
    assert.equal(pollSocialLoginSession(session).status, 'completed')
  } finally {
    cancelSocialLoginSession(session)
  }
})

test('回调服务器：error=access_denied → error，服务器关闭，端口释放', async () => {
  const exchange = fakeExchange()
  const session = await startSocialLoginSession({
    provider: 'Google',
    ports: randomPorts(),
    exchange: exchange.fn
  })
  const res = await get(
    session.port,
    '/oauth/callback?error=access_denied&error_description=User%20refused'
  )
  assert.equal(res.status, 200)
  assert.ok(res.body.includes('登录失败'))
  assert.ok(res.body.includes('User refused'))

  const outcome = pollSocialLoginSession(session)
  assert.equal(outcome.status, 'error')
  if (outcome.status === 'error') assert.equal(outcome.error, 'User refused')
  assert.equal(exchange.calls.length, 0)
  assert.equal(await portIsFree(session.port), true)
})

test('回调服务器：state 不匹配 → error，绝不换 token', async () => {
  const exchange = fakeExchange()
  const session = await startSocialLoginSession({
    provider: 'Google',
    ports: randomPorts(),
    exchange: exchange.fn
  })
  await get(session.port, '/oauth/callback?code=C4&state=WRONG')
  await waitForResult(session)
  const outcome = pollSocialLoginSession(session)
  assert.equal(outcome.status, 'error')
  if (outcome.status === 'error') assert.equal(outcome.error, 'SOCIAL_LOGIN_STATE_MISMATCH')
  assert.equal(exchange.calls.length, 0)
  cancelSocialLoginSession(session)
})

test('回调服务器：换 token 抛错 → error 结果（成功页已经发出去了）', async () => {
  const exchange = fakeExchange(new Error('social token exchange failed: HTTP 400: bad code'))
  const session = await startSocialLoginSession({
    provider: 'Google',
    ports: randomPorts(),
    exchange: exchange.fn
  })
  const res = await get(
    session.port,
    `/oauth/callback?code=C5&state=${encodeURIComponent(session.state)}`
  )
  assert.equal(res.status, 200)
  assert.ok(res.body.includes('登录成功'))
  await waitForResult(session)
  const outcome = pollSocialLoginSession(session)
  assert.equal(outcome.status, 'error')
  if (outcome.status === 'error') assert.ok(outcome.error.includes('HTTP 400'))
  cancelSocialLoginSession(session)
})

test('回调服务器：cancel 释放端口并抹掉 codeVerifier', async () => {
  const session = await startSocialLoginSession({
    provider: 'Google',
    ports: randomPorts(),
    exchange: fakeExchange().fn
  })
  const port = session.port
  cancelSocialLoginSession(session)
  assert.equal(session.codeVerifier, '')
  assert.equal(await portIsFree(port), true)
})

test('回调服务器：端口被占用时顺延到下一个候选', async () => {
  const ports = randomPorts(2)
  const blocker = http.createServer()
  await new Promise<void>((r) => blocker.listen(ports[0], '127.0.0.1', () => r()))
  try {
    const session = await startSocialLoginSession({
      provider: 'Google',
      ports,
      exchange: fakeExchange().fn
    })
    assert.equal(session.port, ports[1])
    assert.equal(session.portalRedirectUri, `http://127.0.0.1:${ports[1]}`)
    assert.ok(session.portalUrl.startsWith('https://app.kiro.dev/signin?state='))
    cancelSocialLoginSession(session)
  } finally {
    blocker.close()
  }
})

test('回调服务器：候选端口全被占用 → 抛错并列出端口', async () => {
  const ports = randomPorts(2)
  const blockers = ports.map(() => http.createServer())
  await Promise.all(
    blockers.map((s, i) => new Promise<void>((r) => s.listen(ports[i], '127.0.0.1', () => r())))
  )
  try {
    await assert.rejects(
      () => startSocialLoginSession({ provider: 'Google', ports, exchange: fakeExchange().fn }),
      (e: Error) => e.message.includes(String(ports[0])) && e.message.includes(String(ports[1]))
    )
  } finally {
    blockers.forEach((s) => s.close())
  }
})

test('回调服务器：ttl 到了 → expired 并释放端口', async () => {
  const session = await startSocialLoginSession({
    provider: 'Google',
    ports: randomPorts(),
    ttlMs: 1,
    exchange: fakeExchange().fn
  })
  const port = session.port
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(pollSocialLoginSession(session).status, 'expired')
  assert.equal(await portIsFree(port), true)
})

test('粘贴回调地址：完整 URL 走与服务器相同的完成逻辑', async () => {
  const exchange = fakeExchange({ accessToken: 'AT2', refreshToken: 'RT2' })
  const session = await startSocialLoginSession({
    provider: 'Google',
    ports: randomPorts(),
    exchange: exchange.fn
  })
  try {
    const outcome = await completeSocialLoginFromUrl(
      session,
      `http://127.0.0.1:${session.port}/oauth/callback?code=C6&state=${encodeURIComponent(session.state)}&login_option=Google`
    )
    assert.equal(outcome.status, 'completed')
    if (outcome.status !== 'completed') return
    assert.equal(outcome.accessToken, 'AT2')
    assert.equal(
      exchange.calls[0].redirectUri,
      `http://127.0.0.1:${session.port}/oauth/callback?login_option=Google`
    )
  } finally {
    cancelSocialLoginSession(session)
  }
})

test('粘贴回调地址：没有会话 / state 不匹配 / 地址无法识别 都被拒', async () => {
  const noSession = await completeSocialLoginFromUrl(
    null,
    'http://127.0.0.1:3128/oauth/callback?code=x'
  )
  assert.equal(noSession.status, 'error')
  if (noSession.status === 'error') assert.equal(noSession.error, 'SOCIAL_LOGIN_CANCELLED')

  const exchange = fakeExchange()
  const session = await startSocialLoginSession({
    provider: 'Google',
    ports: randomPorts(),
    exchange: exchange.fn
  })
  try {
    const garbage = await completeSocialLoginFromUrl(session, 'https://example.com/whatever')
    assert.equal(garbage.status, 'error')
    // 粘错地址不该毁掉会话
    assert.equal(session.result, null)
    assert.equal(pollSocialLoginSession(session).status, 'pending')

    const mismatch = await completeSocialLoginFromUrl(
      session,
      `http://127.0.0.1:${session.port}/oauth/callback?code=C7&state=WRONG`
    )
    assert.equal(mismatch.status, 'error')
    if (mismatch.status === 'error') assert.equal(mismatch.error, 'SOCIAL_LOGIN_STATE_MISMATCH')
    assert.equal(exchange.calls.length, 0)
  } finally {
    cancelSocialLoginSession(session)
  }
})

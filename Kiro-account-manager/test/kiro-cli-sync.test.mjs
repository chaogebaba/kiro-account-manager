/**
 * kiro-cli 认证同步单元测试
 *
 * 运行： bun run test:kirocli   （等价于 node --test test/kiro-cli-sync.test.mjs）
 * （Node 22 内置 TypeScript type-stripping，可直接 import src/main/kiroCli.ts）
 *
 * 安全约定：
 *  - 全程使用 XDG_DATA_HOME 指向临时目录，绝不触碰 ~/.local/share/kiro-cli/data.sqlite3
 *  - 所有 token 都是假的，expires_at 永远在未来 —— 避免 kiro-cli 触发 refresh
 *  - 需要 kiro-cli 在 PATH 上才会跑 whoami 断言，否则自动跳过
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'

// 临时 XDG_DATA_HOME 的落地目录。默认写外置 SSD（/data），绝不写 /tmp、$HOME 或仓库里；
// /data 不可用时用 KIRO_CLI_TEST_DIR 显式指定一个别的目录。
const SCRATCH =
  process.env.KIRO_CLI_TEST_DIR || '/data/claude-scratch/worker-scratch/kiro-cli-test/xdg'

if (!process.env.KIRO_CLI_TEST_DIR && !fs.existsSync('/data')) {
  throw new Error(
    '/data 未挂载：请挂载后重跑，或用 KIRO_CLI_TEST_DIR 指定一个可写的临时目录。' +
      '（本测试不会退回 /tmp 或 $HOME）'
  )
}
const SOCIAL_ARN = 'arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK'
const BUILDER_ARN = 'arn:aws:codewhisperer:us-east-1:638616132270:profile/AAAACCCCXXXX'

function futureMs(hours = 8) {
  return Date.now() + hours * 3600 * 1000
}

function makeXdg(name) {
  const dir = path.join(SCRATCH, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(path.join(dir, 'kiro-cli'), { recursive: true })
  return dir
}

function hasKiroCli() {
  try {
    execFileSync('kiro-cli', ['--version'], { encoding: 'utf-8', timeout: 15000 })
    return true
  } catch {
    return false
  }
}

function whoami(xdgHome) {
  try {
    return execFileSync('kiro-cli', ['whoami'], {
      encoding: 'utf-8',
      timeout: 30000,
      env: { ...process.env, XDG_DATA_HOME: xdgHome, HOME: os.homedir() }
    }).trim()
  } catch (e) {
    return `<failed rc=${e.status}> ${(e.stdout || '').trim()} ${(e.stderr || '').trim()}`.trim()
  }
}

/** 让 kiro-cli 自己建库（跑一次 whoami），保证 schema/migrations 与真实环境一致 */
function seedDb(xdgHome) {
  whoami(xdgHome)
  return path.join(xdgHome, 'kiro-cli', 'data.sqlite3')
}

const kiroCliAvailable = hasKiroCli()

// 动态 import，避免 kiroCli.ts 里读到宿主的 XDG_DATA_HOME
const mod = await import('../src/main/kiroCli.ts')
const {
  readKiroCliAuth,
  writeKiroCliAuth,
  getKiroCliDbPath,
  kiroCliDbExists,
  normalizeCliProvider,
  KIROCLI_SOCIAL_TOKEN_KEY,
  KIROCLI_IDC_TOKEN_KEY,
  KIROCLI_IDC_REGISTRATION_KEY
} = mod

test('getKiroCliDbPath honours XDG_DATA_HOME on linux/macOS', () => {
  if (process.platform === 'win32') return
  const prev = process.env.XDG_DATA_HOME
  process.env.XDG_DATA_HOME = '/tmp-does-not-exist/xdg'
  try {
    assert.equal(getKiroCliDbPath(), '/tmp-does-not-exist/xdg/kiro-cli/data.sqlite3')
  } finally {
    if (prev === undefined) delete process.env.XDG_DATA_HOME
    else process.env.XDG_DATA_HOME = prev
  }
})

test('normalizeCliProvider lowercases known providers', () => {
  assert.equal(normalizeCliProvider('Github'), 'github')
  assert.equal(normalizeCliProvider('GitHub'), 'github')
  assert.equal(normalizeCliProvider('Google'), 'google')
  assert.equal(normalizeCliProvider(''), undefined)
  assert.equal(normalizeCliProvider(undefined), undefined)
})

test('kiroCliDbExists is false for a missing database', () => {
  assert.equal(kiroCliDbExists(path.join(SCRATCH, 'nope', 'data.sqlite3')), false)
})

for (const provider of ['Github', 'Google']) {
  const expected = provider === 'Github' ? 'Logged in with GitHub' : 'Logged in with Google'

  test(`social record (${provider}) is byte-compatible and kiro-cli accepts it`, () => {
    const xdg = makeXdg(`social-${provider.toLowerCase()}`)
    const dbPath = seedDb(xdg)

    const res = writeKiroCliAuth(
      {
        authMethod: 'social',
        provider,
        accessToken: `fake-access-${provider}`,
        refreshToken: `fake-refresh-${provider}`,
        expiresAt: futureMs(),
        profileArn: SOCIAL_ARN
      },
      dbPath
    )

    assert.equal(res.tokenKey, KIROCLI_SOCIAL_TOKEN_KEY)
    // 字段集合必须与 kiro-cli 自己写的完全一致
    assert.deepEqual(Object.keys(res.record).sort(), [
      'access_token',
      'expires_at',
      'profile_arn',
      'provider',
      'refresh_token'
    ])
    assert.equal(res.record.provider, provider.toLowerCase())
    assert.equal(res.record.profile_arn, SOCIAL_ARN)

    // 回读
    const auth = readKiroCliAuth(dbPath)
    assert.equal(auth.kind, 'social')
    assert.equal(auth.token.accessToken, `fake-access-${provider}`)
    assert.equal(auth.token.refreshToken, `fake-refresh-${provider}`)
    assert.equal(auth.token.provider, provider.toLowerCase())
    assert.equal(auth.token.profileArn, SOCIAL_ARN)
    assert.equal(auth.profile.arn, SOCIAL_ARN)
    assert.equal(auth.profile.profileName, 'Social_Default_Profile')
    assert.ok(Date.parse(auth.token.expiresAt) > Date.now())

    if (kiroCliAvailable) {
      const out = whoami(xdg)
      console.log(`[whoami ${provider}] ${out}`)
      assert.equal(out, expected)
    }
  })
}

test('idc record keeps the BuilderId shape and writes device-registration', () => {
  const xdg = makeXdg('idc')
  const dbPath = seedDb(xdg)

  const res = writeKiroCliAuth(
    {
      authMethod: 'IdC',
      provider: 'BuilderId',
      accessToken: 'fake-access-idc',
      refreshToken: 'fake-refresh-idc',
      expiresAt: futureMs(),
      profileArn: BUILDER_ARN,
      region: 'us-east-1',
      clientId: 'fake-client-id',
      clientSecret: 'fake-client-secret'
    },
    dbPath
  )

  assert.equal(res.tokenKey, KIROCLI_IDC_TOKEN_KEY)
  assert.deepEqual(Object.keys(res.record).sort(), [
    'access_token',
    'expires_at',
    'oauth_flow',
    'profile_arn',
    'refresh_token',
    'region',
    'scopes',
    'start_url'
  ])

  const auth = readKiroCliAuth(dbPath)
  assert.equal(auth.kind, 'idc')
  assert.equal(auth.token.refreshToken, 'fake-refresh-idc')
  assert.equal(auth.registration.clientId, 'fake-client-id')
  assert.equal(auth.registration.clientSecret, 'fake-client-secret')
  assert.equal(auth.profile.arn, BUILDER_ARN)

  if (kiroCliAvailable) {
    const out = whoami(xdg)
    console.log(`[whoami idc] ${out}`)
    assert.match(out, /Logged in/)
  }
})

test('switching social -> idc -> social leaves exactly one token key', () => {
  const xdg = makeXdg('switching')
  const dbPath = seedDb(xdg)

  writeKiroCliAuth(
    {
      authMethod: 'social',
      provider: 'Github',
      accessToken: 'a1',
      refreshToken: 'r1',
      expiresAt: futureMs(),
      profileArn: SOCIAL_ARN
    },
    dbPath
  )
  writeKiroCliAuth(
    {
      authMethod: 'IdC',
      accessToken: 'a2',
      refreshToken: 'r2',
      expiresAt: futureMs(),
      profileArn: BUILDER_ARN,
      clientId: 'c',
      clientSecret: 's'
    },
    dbPath
  )
  let auth = readKiroCliAuth(dbPath)
  assert.equal(auth.kind, 'idc')
  assert.equal(auth.token.accessToken, 'a2')

  writeKiroCliAuth(
    {
      authMethod: 'social',
      provider: 'Google',
      accessToken: 'a3',
      refreshToken: 'r3',
      expiresAt: futureMs(),
      profileArn: SOCIAL_ARN
    },
    dbPath
  )
  auth = readKiroCliAuth(dbPath)
  assert.equal(auth.kind, 'social')
  assert.equal(auth.token.accessToken, 'a3')
  // social 切换后必须清掉 IdC 的 device-registration
  assert.equal(auth.registration, undefined)

  const rows = execFileSync('sqlite3', [dbPath, 'select key from auth_kv order by key'], {
    encoding: 'utf-8'
  })
    .trim()
    .split('\n')
    .filter(Boolean)
  assert.deepEqual(rows, [KIROCLI_SOCIAL_TOKEN_KEY])
  assert.ok(!rows.includes(KIROCLI_IDC_REGISTRATION_KEY))
})

test('readKiroCliAuth on a missing database returns kind none', () => {
  const auth = readKiroCliAuth(path.join(SCRATCH, 'missing', 'data.sqlite3'))
  assert.equal(auth.kind, 'none')
  assert.equal(auth.token, undefined)
})

test('rotation write-back: R1 -> R2 round-trips and kiro-cli stays logged in', () => {
  const xdg = makeXdg('rotation')
  const dbPath = seedDb(xdg)

  // 1) 初始记录 R1（模拟 kiro-cli 自己登录 / 我们切号写进去的那一份）
  writeKiroCliAuth(
    {
      authMethod: 'social',
      provider: 'Github',
      accessToken: 'access-v1',
      refreshToken: 'refresh-v1',
      expiresAt: futureMs(),
      profileArn: SOCIAL_ARN
    },
    dbPath
  )
  const before = readKiroCliAuth(dbPath)
  assert.equal(before.token.refreshToken, 'refresh-v1')

  // 2) 账号管理器刷新了这个账号，上游把 R1 轮换成 R2。
  //    决策：CLI 记录的正是我们刚换掉的 R1 ⇒ 必须回写，否则它下次自刷就是 invalid_grant。
  assert.equal(before.token.refreshToken, 'refresh-v1', 'CLI 仍持有旧票，属于要回写的情形')
  writeKiroCliAuth(
    {
      authMethod: 'social',
      provider: 'Github',
      accessToken: 'access-v2',
      refreshToken: 'refresh-v2',
      expiresAt: futureMs(),
      profileArn: SOCIAL_ARN
    },
    dbPath
  )

  // 3) 回读拿到 R2，且记录形状没有被破坏
  const after = readKiroCliAuth(dbPath)
  assert.equal(after.kind, 'social')
  assert.equal(after.token.accessToken, 'access-v2')
  assert.equal(after.token.refreshToken, 'refresh-v2')
  assert.equal(after.token.provider, 'github')
  assert.equal(after.token.profileArn, SOCIAL_ARN)
  assert.equal(after.profile.arn, SOCIAL_ARN)
  assert.equal(after.profile.profileName, 'Social_Default_Profile')
  assert.ok(Date.parse(after.token.expiresAt) > Date.now())

  // 4) 回写之后 kiro-cli 依然是登录态
  if (kiroCliAvailable) {
    const out = whoami(xdg)
    console.log(`[whoami rotation] ${out}`)
    assert.equal(out, 'Logged in with GitHub')
  }
})

test('writeKiroCliAuth rejects a non-finite expiresAt instead of throwing RangeError', () => {
  const xdg = makeXdg('bad-expires')
  const dbPath = seedDb(xdg)
  assert.throws(
    () =>
      writeKiroCliAuth(
        {
          authMethod: 'social',
          provider: 'Github',
          accessToken: 'a',
          refreshToken: 'r',
          expiresAt: Number.NaN,
          profileArn: SOCIAL_ARN
        },
        dbPath
      ),
    /KIRO_CLI_INVALID_EXPIRES_AT/
  )
})

// 注：src/main/localCredentials.ts 用的是 bundler 风格的无扩展名 import（'./kiroAuthSync'），
// 纯 node 的 ESM 解析器加载不了，所以它的单测放在应用构建体系里跑，这里只覆盖 kiroCli.ts。

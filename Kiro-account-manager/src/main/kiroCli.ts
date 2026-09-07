// kiro-cli 认证同步层
//
// kiro-cli（Kiro 官方命令行）把登录状态持久化在一个 SQLite 数据库里：
//   Linux / macOS : $XDG_DATA_HOME/kiro-cli/data.sqlite3（默认 ~/.local/share/kiro-cli/data.sqlite3）
//   Windows       : %LOCALAPPDATA%\kiro-cli\data.sqlite3
//
// 表结构（kiro-cli 2.21.x 实测）：
//   auth_kv(key TEXT PRIMARY KEY, value TEXT)
//   state(key TEXT PRIMARY KEY, value BLOB)
//
// auth_kv 中的 key（"odic" 是 kiro-cli 自己的拼写错误，必须原样保留）：
//   kirocli:social:token             Google / GitHub 社交登录
//   kirocli:odic:token               Builder ID / IdC 登录
//   kirocli:odic:device-registration IdC 的客户端注册（client_id / client_secret）
//   kirocli:external-idp:token       外部 IdP
//   codewhisperer:odic:token         旧版遗留 key
//
// **Social 记录的字段集合是固定的**：{access_token, expires_at, refresh_token, provider, profile_arn}。
// provider 与 profile_arn 缺一不可（缺失时 `kiro-cli whoami` 直接报 "Not logged in"）。
// provider 大小写不敏感，但 kiro-cli 自己写的是小写，这里也写小写。
//
// state 中的 api.codewhisperer.profile = {"arn": ..., "profile_name": ...}，
// social 登录时 profile_name 为 "Social_Default_Profile"。

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as crypto from 'crypto'
import { DatabaseSync } from 'node:sqlite'

export const KIROCLI_SOCIAL_TOKEN_KEY = 'kirocli:social:token'
export const KIROCLI_IDC_TOKEN_KEY = 'kirocli:odic:token'
export const KIROCLI_IDC_REGISTRATION_KEY = 'kirocli:odic:device-registration'
export const KIROCLI_EXTERNAL_IDP_TOKEN_KEY = 'kirocli:external-idp:token'
export const KIROCLI_LEGACY_TOKEN_KEY = 'codewhisperer:odic:token'
export const KIROCLI_PROFILE_STATE_KEY = 'api.codewhisperer.profile'

/** 所有可能承载 token 的 auth_kv key（切号时非目标 key 会被删除） */
export const KIROCLI_ALL_TOKEN_KEYS = [
  KIROCLI_SOCIAL_TOKEN_KEY,
  KIROCLI_IDC_TOKEN_KEY,
  KIROCLI_EXTERNAL_IDP_TOKEN_KEY,
  KIROCLI_LEGACY_TOKEN_KEY
]

const KIRO_CLI_DEFAULT_START_URL = 'https://view.awsapps.com/start'
const KIRO_CLI_DEFAULT_SCOPES = [
  'codewhisperer:completions',
  'codewhisperer:analysis',
  'codewhisperer:conversations'
]

// =============== 路径 ===============

/** kiro-cli 的数据目录（遵循 XDG_DATA_HOME，实测 kiro-cli 2.21.1 在 Linux 上确实遵循） */
export function getKiroCliDataDir(): string {
  if (process.platform === 'win32') {
    const localAppData =
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
    return path.join(localAppData, 'kiro-cli')
  }
  const xdg = process.env.XDG_DATA_HOME
  if (xdg && xdg.trim()) return path.join(xdg, 'kiro-cli')
  return path.join(os.homedir(), '.local', 'share', 'kiro-cli')
}

export function getKiroCliDbPath(): string {
  return path.join(getKiroCliDataDir(), 'data.sqlite3')
}

export function kiroCliDbExists(dbPath?: string): boolean {
  try {
    return fs.existsSync(dbPath || getKiroCliDbPath())
  } catch {
    return false
  }
}

// =============== 类型 ===============

export type KiroCliAuthKind = 'social' | 'idc' | 'external_idp' | 'none'

export interface KiroCliToken {
  accessToken: string
  refreshToken: string
  /** RFC3339 字符串，原样保留 kiro-cli 磁盘上的值 */
  expiresAt: string
  provider?: string
  profileArn?: string
  region?: string
  startUrl?: string
  scopes?: string[]
}

export interface KiroCliRegistration {
  clientId: string
  clientSecret: string
  clientSecretExpiresAt?: string
  region?: string
}

export interface KiroCliProfile {
  arn: string
  profileName?: string
}

export interface KiroCliAuth {
  kind: KiroCliAuthKind
  dbPath: string
  token?: KiroCliToken
  registration?: KiroCliRegistration
  profile?: KiroCliProfile
}

export interface WriteKiroCliAuthInput {
  authMethod: 'social' | 'IdC'
  /** social 必填：'Github' | 'Google'（大小写不敏感，落盘统一小写） */
  provider?: string
  accessToken: string
  refreshToken: string
  /** ms epoch */
  expiresAt: number
  profileArn: string
  region?: string
  startUrl?: string
  clientId?: string
  clientSecret?: string
  scopes?: string[]
}

export interface WriteKiroCliAuthResult {
  dbPath: string
  tokenKey: string
  /** 实际落盘的 token JSON（便于日志/测试断言） */
  record: Record<string, unknown>
}

// =============== SQLite 访问 ===============
//
// 首选 Node 22 内置的 node:sqlite（DatabaseSync + 参数化语句，无需系统依赖）；
// 当它不可用（旧 runtime / 平台缺失）时退回 sqlite3 命令行。

interface SqliteRunner {
  /** 参数化查询，返回行对象数组 */
  all(sql: string, params: unknown[]): Array<Record<string, unknown>>
  /** 参数化写入 */
  run(sql: string, params: unknown[]): void
  exec(sql: string): void
  close(): void
}

function openNodeSqlite(dbPath: string): SqliteRunner {
  const db = new DatabaseSync(dbPath)
  return {
    all(sql, params) {
      const stmt = db.prepare(sql)
      return stmt.all(...(params as never[])) as Array<Record<string, unknown>>
    },
    run(sql, params) {
      const stmt = db.prepare(sql)
      stmt.run(...(params as never[]))
    },
    exec(sql) {
      db.exec(sql)
    },
    close() {
      db.close()
    }
  }
}

/** 把值转成 SQL 字面量（仅用于 sqlite3 命令行兜底路径） */
function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  return `'${String(v).replace(/'/g, "''")}'`
}

function inlineParams(sql: string, params: unknown[]): string {
  let i = 0
  return sql.replace(/\?/g, () => sqlLiteral(params[i++]))
}

function openSqlite3Binary(dbPath: string): SqliteRunner {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { execFileSync } = require('child_process') as typeof import('child_process')
  const bin = process.platform === 'win32' ? 'sqlite3.exe' : 'sqlite3'
  const pending: string[] = []
  const call = (input: string, json: boolean): string =>
    execFileSync(bin, json ? ['-json', dbPath] : [dbPath], {
      input,
      timeout: 10000,
      encoding: 'utf-8'
    })
  return {
    all(sql, params) {
      const out = call(inlineParams(sql, params) + ';', true)
      if (!out || !out.trim()) return []
      try {
        return JSON.parse(out) as Array<Record<string, unknown>>
      } catch {
        return []
      }
    },
    run(sql, params) {
      pending.push(inlineParams(sql, params) + ';')
    },
    exec(sql) {
      pending.push(sql.trim().endsWith(';') ? sql : sql + ';')
    },
    close() {
      if (pending.length) {
        call(pending.join('\n') + '\n', false)
        pending.length = 0
      }
    }
  }
}

function openDb(dbPath: string): SqliteRunner {
  try {
    return openNodeSqlite(dbPath)
  } catch (e) {
    console.warn('[kiroCli] node:sqlite unavailable, falling back to sqlite3 binary:', e)
    return openSqlite3Binary(dbPath)
  }
}

// =============== 读 ===============

function asString(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (v instanceof Uint8Array) return Buffer.from(v).toString('utf-8')
  return undefined
}

function parseJson(raw: string | undefined): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function str(o: Record<string, unknown>, k: string): string | undefined {
  const v = o[k]
  return typeof v === 'string' && v ? v : undefined
}

function toToken(raw: Record<string, unknown>): KiroCliToken | undefined {
  const accessToken = str(raw, 'access_token')
  const refreshToken = str(raw, 'refresh_token')
  if (!accessToken && !refreshToken) return undefined
  const scopesRaw = raw['scopes']
  return {
    accessToken: accessToken || '',
    refreshToken: refreshToken || '',
    expiresAt: str(raw, 'expires_at') || '',
    provider: str(raw, 'provider'),
    profileArn: str(raw, 'profile_arn'),
    region: str(raw, 'region'),
    startUrl: str(raw, 'start_url'),
    scopes: Array.isArray(scopesRaw) ? (scopesRaw.filter((s) => typeof s === 'string') as string[]) : undefined
  }
}

/**
 * 读取 kiro-cli 当前的登录态。
 * 优先级：social > idc > external_idp > 旧版 legacy key。
 * 数据库不存在或没有任何 token 时返回 kind:'none'。
 */
export function readKiroCliAuth(dbPath?: string): KiroCliAuth {
  const file = dbPath || getKiroCliDbPath()
  const empty: KiroCliAuth = { kind: 'none', dbPath: file }
  if (!kiroCliDbExists(file)) return empty

  let db: SqliteRunner | null = null
  try {
    db = openDb(file)
    const authRows = db.all(
      `SELECT key, value FROM auth_kv WHERE key IN (?, ?, ?, ?, ?)`,
      [
        KIROCLI_SOCIAL_TOKEN_KEY,
        KIROCLI_IDC_TOKEN_KEY,
        KIROCLI_EXTERNAL_IDP_TOKEN_KEY,
        KIROCLI_LEGACY_TOKEN_KEY,
        KIROCLI_IDC_REGISTRATION_KEY
      ]
    )
    const byKey = new Map<string, Record<string, unknown> | null>()
    for (const row of authRows) {
      byKey.set(String(row.key), parseJson(asString(row.value)))
    }

    let kind: KiroCliAuthKind = 'none'
    let token: KiroCliToken | undefined
    const order: Array<[string, KiroCliAuthKind]> = [
      [KIROCLI_SOCIAL_TOKEN_KEY, 'social'],
      [KIROCLI_IDC_TOKEN_KEY, 'idc'],
      [KIROCLI_EXTERNAL_IDP_TOKEN_KEY, 'external_idp'],
      [KIROCLI_LEGACY_TOKEN_KEY, 'idc']
    ]
    for (const [key, k] of order) {
      const raw = byKey.get(key)
      if (!raw) continue
      const parsed = toToken(raw)
      if (parsed) {
        kind = k
        token = parsed
        break
      }
    }

    let registration: KiroCliRegistration | undefined
    const regRaw = byKey.get(KIROCLI_IDC_REGISTRATION_KEY)
    if (regRaw) {
      const clientId = str(regRaw, 'client_id')
      const clientSecret = str(regRaw, 'client_secret')
      if (clientId && clientSecret) {
        registration = {
          clientId,
          clientSecret,
          clientSecretExpiresAt: str(regRaw, 'client_secret_expires_at'),
          region: str(regRaw, 'region')
        }
      }
    }

    let profile: KiroCliProfile | undefined
    try {
      const stateRows = db.all(`SELECT value FROM state WHERE key = ?`, [KIROCLI_PROFILE_STATE_KEY])
      const parsed = parseJson(asString(stateRows[0]?.value))
      const arn = parsed ? str(parsed, 'arn') : undefined
      if (arn) profile = { arn, profileName: parsed ? str(parsed, 'profile_name') : undefined }
    } catch {
      // state 表可能不存在（极旧版本），忽略
    }

    if (kind === 'none') return { ...empty, registration, profile }
    return { kind, dbPath: file, token, registration, profile }
  } catch (e) {
    console.warn('[kiroCli] readKiroCliAuth failed:', e)
    return empty
  } finally {
    try {
      db?.close()
    } catch {
      // ignore
    }
  }
}

// =============== 写 ===============

/** 'Github' | 'GitHub' | 'github' → 'github'；kiro-cli 落盘用小写 */
export function normalizeCliProvider(provider?: string): string | undefined {
  if (!provider) return undefined
  const p = provider.trim().toLowerCase()
  if (!p) return undefined
  if (p === 'github') return 'github'
  if (p === 'google') return 'google'
  return p
}

/**
 * 写入 kiro-cli 的登录态（切号）。
 *
 * social 记录严格只有 5 个字段 {access_token, expires_at, refresh_token, provider, profile_arn}，
 * 多写 region / start_url / oauth_flow / scopes 会让 kiro-cli 反序列化到 BuilderId 结构上，
 * whoami 直接 "Not logged in"（这是本轮修复的核心 bug）。
 *
 * IdC 记录沿用 BuilderIdToken 结构，并同时写 device-registration。
 * 两种情况都会：删除其它 token key（含 legacy），并 upsert state['api.codewhisperer.profile']。
 */
export function writeKiroCliAuth(
  input: WriteKiroCliAuthInput,
  dbPath?: string
): WriteKiroCliAuthResult {
  const file = dbPath || getKiroCliDbPath()
  fs.mkdirSync(path.dirname(file), { recursive: true })

  const isSocial = input.authMethod === 'social'
  const tokenKey = isSocial ? KIROCLI_SOCIAL_TOKEN_KEY : KIROCLI_IDC_TOKEN_KEY
  const expiresAtIso = new Date(input.expiresAt).toISOString()

  let record: Record<string, unknown>
  if (isSocial) {
    const provider = normalizeCliProvider(input.provider)
    if (!provider) {
      throw new Error('KIRO_CLI_SOCIAL_PROVIDER_REQUIRED')
    }
    if (!input.profileArn) {
      throw new Error('KIRO_CLI_SOCIAL_PROFILE_ARN_REQUIRED')
    }
    // 字段集合与顺序刻意与 kiro-cli 自己写的一致
    record = {
      access_token: input.accessToken,
      expires_at: expiresAtIso,
      refresh_token: input.refreshToken,
      provider,
      profile_arn: input.profileArn
    }
  } else {
    record = {
      access_token: input.accessToken,
      expires_at: expiresAtIso,
      refresh_token: input.refreshToken,
      region: input.region || 'us-east-1',
      start_url: input.startUrl || KIRO_CLI_DEFAULT_START_URL,
      oauth_flow: 'PKCE',
      scopes: input.scopes || KIRO_CLI_DEFAULT_SCOPES
    }
    if (input.profileArn) record.profile_arn = input.profileArn
  }

  // profile_name：social 固定 Social_Default_Profile，其它沿用已有值（缺省 default）
  let profileName = 'default'
  if (isSocial) {
    profileName = 'Social_Default_Profile'
  } else {
    const existing = readKiroCliAuth(file).profile?.profileName
    if (existing) profileName = existing
  }

  const db = openDb(file)
  try {
    db.exec('CREATE TABLE IF NOT EXISTS auth_kv (key TEXT PRIMARY KEY, value TEXT);')
    db.exec('CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value BLOB);')
    db.exec('BEGIN;')
    db.run('INSERT OR REPLACE INTO auth_kv (key, value) VALUES (?, ?)', [
      tokenKey,
      JSON.stringify(record)
    ])

    if (!isSocial && input.clientId && input.clientSecret) {
      const regData = {
        client_id: input.clientId,
        client_secret: input.clientSecret,
        client_secret_expires_at: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
        region: input.region || 'us-east-1',
        oauth_flow: 'PKCE',
        scopes: input.scopes || KIRO_CLI_DEFAULT_SCOPES
      }
      db.run('INSERT OR REPLACE INTO auth_kv (key, value) VALUES (?, ?)', [
        KIROCLI_IDC_REGISTRATION_KEY,
        JSON.stringify(regData)
      ])
    }

    for (const key of KIROCLI_ALL_TOKEN_KEYS) {
      if (key !== tokenKey) {
        db.run('DELETE FROM auth_kv WHERE key = ?', [key])
      }
    }
    if (isSocial) {
      // social 不需要 device-registration，留着会让 kiro-cli 认为 oauth flow 不匹配
      db.run('DELETE FROM auth_kv WHERE key = ?', [KIROCLI_IDC_REGISTRATION_KEY])
    }

    if (input.profileArn) {
      db.run('INSERT OR REPLACE INTO state (key, value) VALUES (?, ?)', [
        KIROCLI_PROFILE_STATE_KEY,
        JSON.stringify({ arn: input.profileArn, profile_name: profileName })
      ])
    }
    db.exec('COMMIT;')
  } catch (e) {
    try {
      db.exec('ROLLBACK;')
    } catch {
      // ignore
    }
    throw e
  } finally {
    try {
      db.close()
    } catch {
      // ignore
    }
  }

  return { dbPath: file, tokenKey, record }
}

// =============== 监听 ===============

/** 当前 kiro-cli 记录的内容签名（用于回环保护 / 去抖） */
export function kiroCliAuthSignature(auth: KiroCliAuth): string {
  if (!auth.token) return `${auth.kind}|`
  return `${auth.kind}|${auth.token.accessToken}|${auth.token.refreshToken}`
}

/** access/refresh 对的签名，和 IDE watcher 的 lastWrittenTokenSignature 同格式 */
export function kiroCliTokenSignature(accessToken: string, refreshToken: string): string {
  return `${accessToken}|${refreshToken}`
}

export type KiroCliWatchCallback = (auth: KiroCliAuth) => void | Promise<void>

/**
 * 监听 kiro-cli 数据库变化（kiro-cli 自己 refresh 时会 rotate refresh token）。
 * 与 IDE 的 watcher 保持同样的策略：fs.watchFile 轮询 + 内容签名去抖。
 * 同时监听 -wal（WAL 模式下主库文件 mtime 可能不变）。
 */
export function watchKiroCliDb(onChange: KiroCliWatchCallback, intervalMs = 1000): () => void {
  const dbPath = getKiroCliDbPath()
  const walPath = `${dbPath}-wal`
  let debounceTimer: NodeJS.Timeout | null = null
  let lastSeenSig = ''
  let disposed = false

  const tick = async (): Promise<void> => {
    if (disposed) return
    try {
      const auth = readKiroCliAuth(dbPath)
      if (auth.kind === 'none' || !auth.token) return
      const sig = kiroCliAuthSignature(auth)
      if (sig === lastSeenSig) return
      lastSeenSig = sig
      await onChange(auth)
    } catch (e) {
      console.warn('[kiroCli] watcher tick failed:', e)
    }
  }

  const listener = (): void => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void tick()
    }, 600)
  }

  // 基线读，避免启动后第一次"虚假变更"
  try {
    const baseline = readKiroCliAuth(dbPath)
    if (baseline.token) lastSeenSig = kiroCliAuthSignature(baseline)
  } catch {
    // ignore
  }

  fs.watchFile(dbPath, { interval: intervalMs }, listener)
  fs.watchFile(walPath, { interval: intervalMs }, listener)

  return () => {
    disposed = true
    if (debounceTimer) clearTimeout(debounceTimer)
    fs.unwatchFile(dbPath, listener)
    fs.unwatchFile(walPath, listener)
  }
}

/** 供导入/匹配使用：token 的稳定指纹（避免把明文 token 写进日志） */
export function fingerprintToken(token: string | undefined): string {
  if (!token) return ''
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 12)
}

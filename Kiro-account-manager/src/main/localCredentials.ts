// 本地凭证发现层（"本地导入" / "当前使用" 的数据源）
//
// 两个来源：
//   1. kiro-cli  —— $XDG_DATA_HOME/kiro-cli/data.sqlite3（Windows: %LOCALAPPDATA%\kiro-cli）
//   2. Kiro IDE  —— ~/.aws/sso/cache/kiro-auth-token.json (+ <clientIdHash>.json 客户端注册)
//
// 之前只有 IDE 一个来源，且错误文案是硬编码中文。这里统一返回"候选列表" + i18n 错误码，
// 由 renderer 决定怎么展示。

import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  KIRO_SSO_CACHE_DIR,
  KIRO_AUTH_TOKEN_PATH,
  readKiroAuthTokenFile,
  resolveProfileArnForWrite
} from './kiroAuthSync'
import { readKiroCliAuth, kiroCliDbExists, getKiroCliDbPath } from './kiroCli'

export type LocalCredentialSource = 'kiro-cli' | 'kiro-ide'
export type LocalCredentialProvider = 'Github' | 'Google' | 'BuilderId' | 'Enterprise'

export interface LocalCredentialCandidate {
  source: LocalCredentialSource
  authMethod: 'IdC' | 'social' | 'external_idp'
  provider: LocalCredentialProvider
  accessToken: string
  refreshToken: string
  /** ms epoch；来源没给就留空 */
  expiresAt?: number
  clientId?: string
  clientSecret?: string
  region: string
  startUrl?: string
  profileArn?: string
  /** 该来源当前正在使用的记录（用于导入后标记"当前使用"） */
  isCurrent: boolean
  /** 数据来源文件/数据库路径，仅用于展示与日志 */
  path: string
}

/** 主进程返回给 renderer 的错误码（renderer 用 i18n 映射，主进程不出现中文文案） */
export const LOCAL_CREDENTIALS_NOT_FOUND = 'localCredentialsNotFound'
export const LOCAL_CREDENTIALS_NO_REFRESH_TOKEN = 'localCredentialsNoRefreshToken'
export const LOCAL_CREDENTIALS_NO_CLIENT_REGISTRATION = 'localCredentialsNoClientRegistration'

/** 'github' / 'Github' / 'GitHub' → 'Github'（应用内部统一首字母大写） */
export function normalizeAppProvider(provider?: string): LocalCredentialProvider {
  const p = (provider || '').trim().toLowerCase()
  if (p === 'github') return 'Github'
  if (p === 'google') return 'Google'
  if (p === 'enterprise') return 'Enterprise'
  return 'BuilderId'
}

function parseExpiresAt(value?: string): number | undefined {
  if (!value) return undefined
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : undefined
}

/** 从 SSO cache 目录里找 clientId/clientSecret（IdC 刷新需要） */
async function findIdeClientRegistration(
  clientIdHash?: string,
  startUrl = 'https://view.awsapps.com/start'
): Promise<{ clientId: string; clientSecret: string } | null> {
  const hash =
    clientIdHash ||
    crypto.createHash('sha1').update(JSON.stringify({ startUrl })).digest('hex')
  try {
    const raw = await fs.readFile(path.join(KIRO_SSO_CACHE_DIR, `${hash}.json`), 'utf-8')
    const data = JSON.parse(raw) as { clientId?: string; clientSecret?: string }
    if (data.clientId && data.clientSecret) {
      return { clientId: data.clientId, clientSecret: data.clientSecret }
    }
  } catch {
    // 落到下面的目录扫描
  }
  try {
    const files = await fs.readdir(KIRO_SSO_CACHE_DIR)
    for (const file of files) {
      if (!file.endsWith('.json') || file === 'kiro-auth-token.json') continue
      try {
        const raw = await fs.readFile(path.join(KIRO_SSO_CACHE_DIR, file), 'utf-8')
        const data = JSON.parse(raw) as { clientId?: string; clientSecret?: string }
        if (data.clientId && data.clientSecret) {
          return { clientId: data.clientId, clientSecret: data.clientSecret }
        }
      } catch {
        // 忽略无法解析的文件
      }
    }
  } catch {
    // 忽略目录读取错误
  }
  return null
}

/** kiro-cli 数据库里的当前登录态 → 候选 */
export function readKiroCliCandidate(dbPath?: string): LocalCredentialCandidate | null {
  const file = dbPath || getKiroCliDbPath()
  if (!kiroCliDbExists(file)) return null
  const auth = readKiroCliAuth(file)
  if (auth.kind === 'none' || !auth.token?.refreshToken) return null

  const token = auth.token
  const authMethod: LocalCredentialCandidate['authMethod'] =
    auth.kind === 'social' ? 'social' : auth.kind === 'external_idp' ? 'external_idp' : 'IdC'
  const provider =
    auth.kind === 'social'
      ? normalizeAppProvider(token.provider)
      : auth.kind === 'external_idp'
        ? 'Enterprise'
        : 'BuilderId'
  const region = token.region || 'us-east-1'

  return {
    source: 'kiro-cli',
    authMethod,
    provider,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: parseExpiresAt(token.expiresAt),
    clientId: auth.registration?.clientId,
    clientSecret: auth.registration?.clientSecret,
    region,
    startUrl: token.startUrl,
    profileArn:
      token.profileArn ||
      auth.profile?.arn ||
      resolveProfileArnForWrite({ authMethod, provider, region }),
    isCurrent: true,
    path: auth.dbPath
  }
}

/** Kiro IDE 的 token 文件 → 候选 */
export async function readKiroIdeCandidate(): Promise<LocalCredentialCandidate | null> {
  const token = await readKiroAuthTokenFile()
  if (!token?.refreshToken) return null

  const authMethod: LocalCredentialCandidate['authMethod'] =
    token.authMethod === 'social'
      ? 'social'
      : token.authMethod === 'external_idp'
        ? 'external_idp'
        : 'IdC'
  const provider = normalizeAppProvider(token.provider)
  const region = token.region || 'us-east-1'

  let clientId: string | undefined
  let clientSecret: string | undefined
  if (authMethod !== 'social') {
    const reg = await findIdeClientRegistration(token.clientIdHash)
    clientId = reg?.clientId
    clientSecret = reg?.clientSecret
  }

  return {
    source: 'kiro-ide',
    authMethod,
    provider,
    accessToken: token.accessToken || '',
    refreshToken: token.refreshToken,
    expiresAt: parseExpiresAt(token.expiresAt),
    clientId,
    clientSecret,
    region,
    startUrl: 'https://view.awsapps.com/start',
    profileArn: token.profileArn || resolveProfileArnForWrite({ authMethod, provider, region }),
    isCurrent: true,
    path: KIRO_AUTH_TOKEN_PATH
  }
}

/**
 * 收集所有本地凭证候选（kiro-cli 优先，其次 Kiro IDE），按 refreshToken 去重。
 */
export async function collectLocalCredentialCandidates(): Promise<LocalCredentialCandidate[]> {
  const candidates: LocalCredentialCandidate[] = []

  try {
    const cli = readKiroCliCandidate()
    if (cli) candidates.push(cli)
  } catch (e) {
    console.warn('[LocalCredentials] kiro-cli read failed:', e)
  }

  try {
    const ide = await readKiroIdeCandidate()
    if (ide) candidates.push(ide)
  } catch (e) {
    console.warn('[LocalCredentials] Kiro IDE read failed:', e)
  }

  const seen = new Set<string>()
  return candidates.filter((c) => {
    if (seen.has(c.refreshToken)) return false
    seen.add(c.refreshToken)
    return true
  })
}

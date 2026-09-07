// Kiro / AWS 出站请求的身份头构造
//
// 字符串逐字对齐 kiro.rs（origin/master @ f357292）§9 header matrix：
//   Social refresh   token_manager.rs:169,178-181
//   IdC refresh      token_manager.rs:271-276
//   用量类 REST      token_manager.rs:546-556 / :645-655 / :739-748 / :834-844
//   ide streaming    endpoint/ide.rs:34-50
//
// 三个模板变量：
//   os_name      = config.system_version（kiro.rs 默认 "macos"）
//   node_version = config.node_version   （kiro.rs 默认 "22.22.0"）
//   machine_id   = 64 位 hex

import { getEffectiveKiroVersion, USAGE_API_KIRO_VERSION } from './version'

export interface KiroClientEnv {
  /** kiro.rs config.system_version，默认 macos */
  systemVersion: string
  /** kiro.rs config.node_version，默认 22.22.0 */
  nodeVersion: string
}

const DEFAULT_CLIENT_ENV: KiroClientEnv = {
  systemVersion: 'macos',
  nodeVersion: '22.22.0'
}

let clientEnv: KiroClientEnv = { ...DEFAULT_CLIENT_ENV }

/** 设置 os/node 标识（预留给设置页；未设置时与 kiro.rs 默认一致） */
export function setKiroClientEnv(env: Partial<KiroClientEnv>): void {
  clientEnv = {
    systemVersion: env.systemVersion || clientEnv.systemVersion,
    nodeVersion: env.nodeVersion || clientEnv.nodeVersion
  }
}

export function getKiroClientEnv(): KiroClientEnv {
  return { ...clientEnv }
}

/** 仅供测试：恢复默认 os/node */
export function __resetKiroClientEnvForTests(): void {
  clientEnv = { ...DEFAULT_CLIENT_ENV }
}

/** amz-sdk-invocation-id 用的 UUID v4 */
export function generateInvocationId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** `KiroIDE-<ver>-<mid>`；无 machineId 时退化为 `KiroIDE-<ver>` */
export function kiroIdeTag(version: string, machineId?: string): string {
  return machineId ? `KiroIDE-${version}-${machineId}` : `KiroIDE-${version}`
}

// ============ 1. Social refresh ============
//
// 上游只认一个 User-Agent，没有 Authorization / x-amz-user-agent / amz-sdk-*。
// machineId 只通过 UA 字符串到达服务端。
//
// 注意：kiro.rs 还发 `Accept-Encoding: gzip, compress, deflate, br`、`host` 和
// `Connection: close`。在 Node/undici 里手动设置 Accept-Encoding 会关闭自动解压，
// host/Connection 属于禁止修改的头，故默认不发；需要逐字复刻时传 includeTransportHeaders。
export function buildSocialRefreshHeaders(
  machineId?: string,
  opts: { includeTransportHeaders?: boolean; version?: string } = {}
): Record<string, string> {
  const version = opts.version || getEffectiveKiroVersion()
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'User-Agent': kiroIdeTag(version, machineId)
  }
  if (opts.includeTransportHeaders) {
    headers['Accept-Encoding'] = 'gzip, compress, deflate, br'
    headers['Connection'] = 'close'
  }
  return headers
}

// ============ 2. IdC / Builder ID refresh ============
//
// 没有 machineId，没有 Authorization。SDK 版本硬编码 3.980.0。
export const IDC_AWS_SDK_VERSION = '3.980.0'

export function buildIdcRefreshHeaders(): Record<string, string> {
  const { systemVersion, nodeVersion } = clientEnv
  return {
    'content-type': 'application/json',
    'x-amz-user-agent': `aws-sdk-js/${IDC_AWS_SDK_VERSION} KiroIDE`,
    'user-agent':
      `aws-sdk-js/${IDC_AWS_SDK_VERSION} ua/2.1 os/${systemVersion} lang/js md/nodejs#${nodeVersion} ` +
      `api/sso-oidc#${IDC_AWS_SDK_VERSION} m/E KiroIDE`,
    'amz-sdk-invocation-id': generateInvocationId(),
    'amz-sdk-request': 'attempt=1; max=4'
  }
}

// ============ 3. 用量类 REST（getUsageLimits / ListAvailableModels / ListAvailableProfiles / setUserPreference） ============
//
// 版本固定 0.9.2，不跟随最新 IDE 版本。
export const USAGE_AWS_SDK_VERSION = '1.0.0'

export interface UsageHeaderOptions {
  /** social / idc 为空；api_key → API_KEY；企业 SSO → EXTERNAL_IDP */
  tokenType?: string
  /** 逐字复刻 kiro.rs 时可带上 host（Node 里通常被丢弃） */
  includeHostHeader?: boolean
}

export function buildUsageUserAgent(machineId?: string): string {
  const { systemVersion, nodeVersion } = clientEnv
  return (
    `aws-sdk-js/${USAGE_AWS_SDK_VERSION} ua/2.1 os/${systemVersion} lang/js md/nodejs#${nodeVersion} ` +
    `api/codewhispererruntime#${USAGE_AWS_SDK_VERSION} m/N,E ${kiroIdeTag(USAGE_API_KIRO_VERSION, machineId)}`
  )
}

export function buildUsageAmzUserAgent(machineId?: string): string {
  return `aws-sdk-js/${USAGE_AWS_SDK_VERSION} ${kiroIdeTag(USAGE_API_KIRO_VERSION, machineId)}`
}

export function buildUsageHeaders(
  accessToken: string,
  machineId?: string,
  host?: string,
  opts: UsageHeaderOptions = {}
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'user-agent': buildUsageUserAgent(machineId),
    'x-amz-user-agent': buildUsageAmzUserAgent(machineId),
    'amz-sdk-invocation-id': generateInvocationId(),
    'amz-sdk-request': 'attempt=1; max=1',
    Authorization: `Bearer ${accessToken}`
  }
  if (opts.tokenType) headers['tokentype'] = opts.tokenType
  if (host && opts.includeHostHeader) headers['host'] = host
  return headers
}

// ============ 4. IDE streaming ============
//
// SDK 版本 1.0.34，用实时 Kiro 版本。src/main/proxy 本轮不改，这里先导出供其下一轮接入。
export const IDE_STREAMING_SDK_VERSION = '1.0.34'

export function buildIdeStreamingUserAgent(machineId?: string, version?: string): string {
  const { systemVersion, nodeVersion } = clientEnv
  const v = version || getEffectiveKiroVersion()
  return (
    `aws-sdk-js/${IDE_STREAMING_SDK_VERSION} ua/2.1 os/${systemVersion} lang/js md/nodejs#${nodeVersion} ` +
    `api/codewhispererstreaming#${IDE_STREAMING_SDK_VERSION} m/E ${kiroIdeTag(v, machineId)}`
  )
}

export function buildIdeStreamingAmzUserAgent(machineId?: string, version?: string): string {
  const v = version || getEffectiveKiroVersion()
  return `aws-sdk-js/${IDE_STREAMING_SDK_VERSION} ${kiroIdeTag(v, machineId)}`
}

export function buildIdeStreamingHeaders(
  accessToken: string,
  machineId?: string,
  opts: { tokenType?: string; agentMode?: 'vibe' | 'spec'; version?: string } = {}
): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': buildIdeStreamingUserAgent(machineId, opts.version),
    'x-amz-user-agent': buildIdeStreamingAmzUserAgent(machineId, opts.version),
    'amz-sdk-invocation-id': generateInvocationId(),
    'amz-sdk-request': 'attempt=1; max=3',
    Authorization: `Bearer ${accessToken}`,
    'x-amzn-codewhisperer-optout': 'true',
    'x-amzn-kiro-agent-mode': opts.agentMode || 'vibe'
  }
  if (opts.tokenType) headers['tokentype'] = opts.tokenType
  return headers
}

// ============ 5. app.kiro.dev 门户 CBOR（kiro.rs 没有的接口） ============
//
// KiroWebPortalService 的 GetUserInfo / GetUserUsageAndLimits 只在本项目里用到。
// 保持既有报文形状（`aws-sdk-js/1.0.18 KiroIDE <ver> <mid>`），但版本号改为实时版本，
// 不再冻结在 0.6.18。
export const PORTAL_AWS_SDK_VERSION = '1.0.18'

export function buildPortalAmzUserAgent(machineId?: string, version?: string): string {
  const v = version || getEffectiveKiroVersion()
  const suffix = machineId ? `KiroIDE ${v} ${machineId}` : `KiroIDE-${v}`
  return `aws-sdk-js/${PORTAL_AWS_SDK_VERSION} ${suffix}`
}

export function buildPortalCborHeaders(
  accessToken: string,
  idp: string,
  machineId?: string
): Record<string, string> {
  return {
    accept: 'application/cbor',
    'content-type': 'application/cbor',
    'smithy-protocol': 'rpc-v2-cbor',
    'amz-sdk-invocation-id': generateInvocationId(),
    'amz-sdk-request': 'attempt=1; max=1',
    'x-amz-user-agent': buildPortalAmzUserAgent(machineId),
    authorization: `Bearer ${accessToken}`,
    cookie: `Idp=${idp}; AccessToken=${accessToken}`
  }
}

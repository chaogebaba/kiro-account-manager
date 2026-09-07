// 切号的单一实现
//
// 以前 AccountCard / AccountListRow / store 的自动换号各写了一份几乎一样的逻辑，
// 三处都有同一个 bug：IDE 没装时静默跳过写盘，但外面照样 setActiveAccount，
// "当前使用"于是指向一个磁盘上根本没生效的账号。
//
// 这里统一：
//   - switchTarget 'auto'（新默认）= 写入所有"存在的"目标（IDE 装了就写 IDE，kiro-cli 有库就写 CLI）
//   - 一个目标都没有 → 返回 errorCode，调用方不得 setActiveAccount
//   - 至少写成功一个才算成功
//   - 把 main 进程 refresh 后（可能 rotate 过）的 credentials 回传给调用方持久化

import type { Account } from '../types/account'

export type SwitchTarget = 'auto' | 'ide' | 'cli' | 'both'

export interface SwitchRefreshedCredentials {
  accessToken: string
  refreshToken: string
  /** 上游返回的有效期（秒）；上游省略时 undefined */
  expiresIn?: number
  /** 绝对到期时间（毫秒 epoch）；undefined 表示沿用账号原有的值 */
  expiresAt?: number
}

/** 写第二个目标时用的凭证（外加"上一步已经刷过了"的标记） */
export interface SecondTargetCredentials {
  accessToken: string
  refreshToken: string
  /**
   * 上一步（写第一个目标时）已经 refresh 过。第二个目标必须原样落盘：
   * 再刷一次会把刚写进第一个目标的 refreshToken 轮换作废，
   * 那个客户端下次自刷就是 invalid_grant → 强制登出。
   */
  alreadyRefreshed: boolean
  expiresIn?: number
  expiresAt?: number
}

/**
 * 组合切号里第二个目标该用哪份凭证。
 * 有上一步的 refreshedCredentials 就用它并打上 alreadyRefreshed，
 * 没有（上一步没跑或没回传）才让主进程自己刷一次。
 */
export function buildSecondTargetCredentials(
  base: { accessToken?: string; refreshToken?: string; expiresAt?: number },
  refreshed?: SwitchRefreshedCredentials
): SecondTargetCredentials {
  if (refreshed) {
    return {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      alreadyRefreshed: true,
      expiresIn: refreshed.expiresIn,
      expiresAt: refreshed.expiresAt
    }
  }
  return {
    accessToken: base.accessToken || '',
    refreshToken: base.refreshToken || '',
    alreadyRefreshed: false,
    expiresAt: base.expiresAt
  }
}

export interface SwitchOutcome {
  success: boolean
  wroteIde: boolean
  wroteCli: boolean
  /** i18n key（不含 errors. 前缀），renderer 用 t(`errors.${errorCode}`) */
  errorCode?: string
  /** 服务端/主进程的原始错误详情，附在 i18n 文案后面 */
  errorDetail?: string
  refreshedCredentials?: SwitchRefreshedCredentials
}

/** profileArn 统一读取：顶层优先，其次 credentials（历史上 OAuth 登录只填了后者） */
export function getAccountProfileArn(account: {
  profileArn?: string
  credentials?: { profileArn?: string }
}): string | undefined {
  return account.profileArn || account.credentials?.profileArn
}

/** 凭证是否足够切号：social 只要 refreshToken，IdC 还需要 clientId/clientSecret */
export function canSwitchAccount(account: Account): boolean {
  const c = account.credentials
  if (!c?.refreshToken) return false
  if (c.authMethod === 'social') return true
  return !!(c.clientId && c.clientSecret)
}

async function detectTargets(): Promise<{ ide: boolean; cli: boolean }> {
  const [ide, cli] = await Promise.all([
    window.api.checkKiroIdeInstalled().catch(() => ({ installed: false })),
    window.api.checkKiroCliInstalled?.().catch(() => ({ installed: false })) ??
      Promise.resolve({ installed: false })
  ])
  return { ide: !!ide?.installed, cli: !!cli?.installed }
}

/**
 * 把账号凭证写入本地客户端。**不会**修改 store —— 调用方拿到 success 后自行
 * setActiveAccount + 持久化 refreshedCredentials。
 */
export async function performAccountSwitch(
  account: Account,
  target: SwitchTarget
): Promise<SwitchOutcome> {
  const credentials = account.credentials
  if (!canSwitchAccount(account)) {
    return { success: false, wroteIde: false, wroteCli: false, errorCode: 'switchIncompleteCredentials' }
  }

  const available = await detectTargets()
  let wantIde: boolean
  let wantCli: boolean
  switch (target) {
    case 'ide':
      if (!available.ide) {
        return { success: false, wroteIde: false, wroteCli: false, errorCode: 'switchIdeNotInstalled' }
      }
      wantIde = true
      wantCli = false
      break
    case 'cli':
      if (!available.cli) {
        return { success: false, wroteIde: false, wroteCli: false, errorCode: 'switchCliNotInstalled' }
      }
      wantIde = false
      wantCli = true
      break
    case 'both':
    case 'auto':
    default:
      wantIde = available.ide
      wantCli = available.cli
      break
  }

  if (!wantIde && !wantCli) {
    return { success: false, wroteIde: false, wroteCli: false, errorCode: 'switchNoTargetAvailable' }
  }

  const profileArn = getAccountProfileArn(account)
  const region = credentials.region || 'us-east-1'
  const outcome: SwitchOutcome = { success: false, wroteIde: false, wroteCli: false }
  const failures: Array<{ errorCode: string; errorDetail?: string }> = []

  if (wantIde) {
    // IDE 通常是第一个目标，但 CLI 先跑的顺序也要兜住：已经刷过就原样落盘
    const ideCreds = buildSecondTargetCredentials(credentials, outcome.refreshedCredentials)
    const result = await window.api.switchAccount({
      accessToken: ideCreds.accessToken,
      refreshToken: ideCreds.refreshToken,
      clientId: credentials.clientId || '',
      clientSecret: credentials.clientSecret || '',
      region,
      startUrl: credentials.startUrl,
      authMethod: credentials.authMethod,
      provider: credentials.provider,
      profileArn,
      accountId: account.id,
      alreadyRefreshed: ideCreds.alreadyRefreshed,
      expiresIn: ideCreds.expiresIn,
      expiresAt: ideCreds.expiresAt
    })
    if (result?.success) {
      outcome.wroteIde = true
      if (result.refreshedCredentials) outcome.refreshedCredentials = result.refreshedCredentials
    } else {
      failures.push({ errorCode: 'switchIdeFailed', errorDetail: result?.error })
    }
  }

  if (wantCli) {
    // IDE 那一步可能已经 rotate 过 refreshToken：这里既要用最新的那一对，
    // 又必须带上 alreadyRefreshed —— 否则主进程会再刷一次，把刚写进 IDE
    // 文件的 refreshToken 轮换作废，IDE 后续自刷必然 invalid_grant。
    const cliCreds = buildSecondTargetCredentials(credentials, outcome.refreshedCredentials)
    const result = await window.api.switchAccountCli({
      accessToken: cliCreds.accessToken,
      refreshToken: cliCreds.refreshToken,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      region,
      startUrl: credentials.startUrl,
      profileArn,
      authMethod: credentials.authMethod,
      provider: credentials.provider,
      accountId: account.id,
      alreadyRefreshed: cliCreds.alreadyRefreshed,
      expiresIn: cliCreds.expiresIn,
      expiresAt: cliCreds.expiresAt
    })
    if (result?.success) {
      outcome.wroteCli = true
      if (result.refreshedCredentials) outcome.refreshedCredentials = result.refreshedCredentials
    } else {
      failures.push({
        errorCode: result?.errorCode || 'switchCliFailed',
        errorDetail: result?.errorDetail
      })
    }
  }

  outcome.success = outcome.wroteIde || outcome.wroteCli
  if (!outcome.success && failures.length > 0) {
    outcome.errorCode = failures[0].errorCode
    outcome.errorDetail = failures[0].errorDetail
  }
  return outcome
}

/** importSource → i18n key（accounts.*） */
export function sourceLabelKey(source: string | undefined): string {
  switch (source) {
    case 'kiro-cli':
      return 'sourceKiroCli'
    case 'kiro-ide':
      return 'sourceKiroIde'
    case 'oauth':
      return 'sourceOauth'
    default:
      return 'sourceManual'
  }
}

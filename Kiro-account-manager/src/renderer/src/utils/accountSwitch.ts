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
  expiresIn: number
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
    const result = await window.api.switchAccount({
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken || '',
      clientId: credentials.clientId || '',
      clientSecret: credentials.clientSecret || '',
      region,
      startUrl: credentials.startUrl,
      authMethod: credentials.authMethod,
      provider: credentials.provider,
      profileArn,
      accountId: account.id
    })
    if (result?.success) {
      outcome.wroteIde = true
      if (result.refreshedCredentials) outcome.refreshedCredentials = result.refreshedCredentials
    } else {
      failures.push({ errorCode: 'switchIdeFailed', errorDetail: result?.error })
    }
  }

  if (wantCli) {
    // IDE 那一步可能已经 rotate 过 refreshToken，这里必须用最新的，否则 CLI 拿到的是废票
    const rc = outcome.refreshedCredentials
    const result = await window.api.switchAccountCli({
      accessToken: rc?.accessToken || credentials.accessToken,
      refreshToken: rc?.refreshToken || credentials.refreshToken || '',
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      region,
      startUrl: credentials.startUrl,
      profileArn,
      authMethod: credentials.authMethod,
      provider: credentials.provider,
      accountId: account.id
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

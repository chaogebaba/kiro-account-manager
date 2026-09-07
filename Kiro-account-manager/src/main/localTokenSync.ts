// 轮换后的 token 回写本地客户端（Kiro IDE 文件 / kiro-cli SQLite）的判定逻辑。
//
// 背景：refreshToken 会轮换。账号管理器任何一次刷新（主动续期、单账号刷新、
// 后台批量、状态检查里的重试、导入时的 verify、反代池的自动刷新）都会把
// R1 换成 R2，而本地客户端磁盘上留着的还是 R1。等它自己去刷新时就是
// invalid_grant → 强制登出。kiro.rs 的 try_reload_credential_from_file
// 正是为了兜住这件事而存在的；我们这里做的是它的另一半：主动回写。
//
// 这个模块只放"要不要写"的纯判断，不碰 electron、不读盘，方便单测。

export interface WriteBackInput {
  /** 目标客户端当前记录着的 refreshToken（磁盘文件 / SQLite 里的那个） */
  currentRefreshToken?: string
  /** 我们这次刷新前用的那个 refreshToken */
  oldRefreshToken?: string
  /** 刷新后拿到的新 refreshToken */
  newRefreshToken?: string
  /** 本次刷新的账号 id */
  accountId?: string
  /** 我们最近一次切号写进这个目标的账号 id */
  lastSwitchedAccountId?: string | null
  /** 目标是否存在（IDE 未登录 / kiro-cli 没建库时为 false） */
  targetExists?: boolean
}

export interface WriteBackDecision {
  write: boolean
  reason: string
}

/**
 * 判断这次轮换要不要回写到某个本地客户端。
 *
 * 只有"这个客户端确实用着我们刚换掉的那张票"才写；否则宁可不写，
 * 也绝不能把 A 账号的 token 覆盖到正登录着 B 账号的客户端上。
 *
 * 判定顺序：
 *   1. 没有新 token / 新旧相同     → 不写（没有轮换发生）
 *   2. 客户端记录的就是新 token     → 不写（已经是最新的了）
 *   3. 客户端记录的 === 旧 token    → 写（最准的证据）
 *   4. accountId === 最近切号进去的那个 → 写（客户端已经自刷过一轮、
 *      磁盘上的 refreshToken 已经和我们记的对不上时的兜底）
 *   5. 其余                        → 不写
 */
export function decideTokenWriteBack(input: WriteBackInput): WriteBackDecision {
  const { currentRefreshToken, oldRefreshToken, newRefreshToken, accountId, lastSwitchedAccountId } =
    input

  if (input.targetExists === false) {
    return { write: false, reason: 'target-not-present' }
  }
  if (!newRefreshToken) {
    return { write: false, reason: 'no-new-refresh-token' }
  }
  if (currentRefreshToken && currentRefreshToken === newRefreshToken) {
    return { write: false, reason: 'already-current' }
  }
  if (currentRefreshToken && oldRefreshToken && currentRefreshToken === oldRefreshToken) {
    return { write: true, reason: 'refreshToken match' }
  }
  if (accountId && lastSwitchedAccountId && accountId === lastSwitchedAccountId) {
    return { write: true, reason: 'lastSwitchedAccountId fallback' }
  }
  return { write: false, reason: 'not-this-account' }
}

/**
 * 导入/验证时要不要先刷新。
 * accessToken 还没到刷新窗口就先拿它去调用量接口，省掉一次无谓的轮换 ——
 * 否则"本地导入"必然把 kiro-cli / IDE 手上的票换掉。
 * 手填 OIDC 表单（没有 accessToken）时一律先刷。
 */
export function shouldRefreshBeforeVerify(input: {
  accessToken?: string
  expiresAt?: number
  /** 传 kiroApi.needsTokenRefresh */
  needsRefresh: (expiresAt: number | undefined) => boolean
}): boolean {
  if (!input.accessToken) return true
  return input.needsRefresh(input.expiresAt)
}

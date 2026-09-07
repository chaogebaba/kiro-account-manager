// Kiro IDE 版本解析
//
// 对齐 kiro.rs src/kiro/kiro_version.rs：
//   - 后台任务轮询 metadata JSON，取 currentRelease 作为「最新版本」
//   - effective() = 已获取到的最新版本 ?? fallback
//   - 用量类 REST 接口（getUsageLimits / ListAvailableModels / setUserPreference）
//     固定用 USAGE_API_KIRO_VERSION，不跟随最新版本漂移
//
// metadata JSON 形状（2026-09-07 实测 linux-x64-stable）：
//   {
//     "currentRelease": "1.0.437",
//     "releases": [
//       { "version": "1.0.437",
//         "updateTo": { "version": "1.0.437", "pub_date": "2026-09-01",
//                       "notes": "...", "name": "...", "url": "https://..." } },
//       ...
//     ]
//   }
// currentRelease 是字符串。win32-* 路径在 CDN 上返回 403（kiro.rs 文档注释），故固定用 linux-x64。

import { kiroFetch } from './transport'

/** 自动获取失败时的回退版本（kiro.rs default_kiro_version） */
export const KIRO_VERSION_FALLBACK = '2.3.0'

/** 用量类接口固定使用的版本（kiro.rs USAGE_API_KIRO_VERSION）。只影响 User-Agent。 */
export const USAGE_API_KIRO_VERSION = '0.9.2'

export const KIRO_VERSION_METADATA_URL =
  'https://prod.download.desktop.kiro.dev/stable/metadata-linux-x64-stable.json'

/** 24 小时缓存 */
export const KIRO_VERSION_CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface CachedVersion {
  version: string
  fetchedAt: number
}

/** 持久化适配器（主进程用 electron-store 注入；测试里可省略） */
export interface KiroVersionCacheAdapter {
  get(): CachedVersion | undefined | null
  set(value: CachedVersion): void
}

let memoryCache: CachedVersion | undefined
let adapter: KiroVersionCacheAdapter | undefined
let refreshTimer: ReturnType<typeof setInterval> | undefined
let inflight: Promise<string | undefined> | undefined

export function setKiroVersionCacheAdapter(a: KiroVersionCacheAdapter | undefined): void {
  adapter = a
  if (a && !memoryCache) {
    const stored = a.get()
    if (stored && typeof stored.version === 'string' && stored.version) {
      memoryCache = stored
    }
  }
}

function isVersionString(v: unknown): v is string {
  return typeof v === 'string' && /^\d+(\.\d+)*$/.test(v.trim())
}

/** 已缓存的最新版本（后台刷新成功后才有值） */
export function cachedKiroVersion(): string | undefined {
  return memoryCache?.version
}

/** 有效的 Kiro IDE 版本：最新版本 ?? fallback */
export function getEffectiveKiroVersion(fallback: string = KIRO_VERSION_FALLBACK): string {
  return memoryCache?.version || fallback
}

/** 缓存是否已过期（或从未获取） */
export function isKiroVersionCacheStale(now: number = Date.now()): boolean {
  if (!memoryCache) return true
  return now - memoryCache.fetchedAt >= KIRO_VERSION_CACHE_TTL_MS
}

/** 解析 metadata JSON，取 currentRelease，退而取 releases[0].version */
export function parseKiroVersionMetadata(json: unknown): string | undefined {
  const data = json as { currentRelease?: unknown; releases?: Array<{ version?: unknown }> } | null
  if (!data || typeof data !== 'object') return undefined
  if (isVersionString(data.currentRelease)) return String(data.currentRelease).trim()
  const first = Array.isArray(data.releases) ? data.releases[0] : undefined
  if (first && isVersionString(first.version)) return String(first.version).trim()
  return undefined
}

/**
 * 拉取最新版本。失败一律吞掉（返回 undefined），绝不阻塞调用方。
 * @param force 忽略 24h 缓存强制刷新
 */
export async function refreshKiroVersion(force = false): Promise<string | undefined> {
  if (!force && !isKiroVersionCacheStale()) return memoryCache?.version
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await kiroFetch(KIRO_VERSION_METADATA_URL, { method: 'GET' })
      if (!res.ok) return undefined
      const json = (await res.json()) as unknown
      const version = parseKiroVersionMetadata(json)
      if (!version) return undefined
      memoryCache = { version, fetchedAt: Date.now() }
      try {
        adapter?.set(memoryCache)
      } catch {
        /* 持久化失败不影响本次结果 */
      }
      return version
    } catch {
      return undefined
    } finally {
      inflight = undefined
    }
  })()
  return inflight
}

/** app ready 时启动：立刻拉一次，之后每 24h 一次；错误忽略。 */
export function startKiroVersionAutoRefresh(): void {
  stopKiroVersionAutoRefresh()
  void refreshKiroVersion()
  refreshTimer = setInterval(() => {
    void refreshKiroVersion(true)
  }, KIRO_VERSION_CACHE_TTL_MS)
  // 定时器不应阻止进程退出
  ;(refreshTimer as unknown as { unref?: () => void })?.unref?.()
}

export function stopKiroVersionAutoRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = undefined
  }
}

/** 仅供测试：清空内存缓存 */
export function __resetKiroVersionCacheForTests(): void {
  memoryCache = undefined
  adapter = undefined
  inflight = undefined
}

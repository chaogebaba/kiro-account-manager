// kiroApi 传输层注入点
//
// kiroApi/* 不直接依赖 electron / undici，方便 node:test 里 mock。
// 主进程在启动时用 setKiroApiFetch() 注入 fetchWithAppProxy（带 K-Proxy / 账号绑定代理）。

export type KiroFetch = (url: string, init: RequestInit, proxyUrl?: string) => Promise<Response>

const defaultFetch: KiroFetch = (url, init) => fetch(url, init)

let currentFetch: KiroFetch = defaultFetch

/** 注入带代理能力的 fetch（主进程 fetchWithAppProxy） */
export function setKiroApiFetch(fn: KiroFetch | undefined | null): void {
  currentFetch = fn || defaultFetch
}

export function getKiroApiFetch(): KiroFetch {
  return currentFetch
}

/** 直接发起一次请求（内部统一入口，测试里通过 setKiroApiFetch 拦截） */
export function kiroFetch(url: string, init: RequestInit, proxyUrl?: string): Promise<Response> {
  return currentFetch(url, init, proxyUrl)
}

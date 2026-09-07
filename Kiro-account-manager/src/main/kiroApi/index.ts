// kiroApi —— 与 kiro.rs 对齐的 Kiro / AWS API 层
//
// 该目录是账号管理器所有 Kiro 出站调用的唯一实现处：
//   version.ts  实时 Kiro IDE 版本（24h 缓存）+ 用量类固定版本 0.9.2
//   headers.ts  各端点的 User-Agent / amz-sdk-* 头（逐字对齐 kiro.rs header matrix）
//   errors.ts   刷新错误分类 + suspended/throttled/bearer 失效/配额 判定
//   refresh.ts  Social / IdC 刷新，含 authMethod 分派与 invalid_grant 回源重试
//   usage.ts    getUsageLimits 候选梯子（区域 × 带不带 profileArn）
//   expiry.ts   5 分钟 / 10 分钟过期判定
//   socialLogin.ts Social 浏览器登录：PKCE / portal URL / 回调解析 / 授权码换 token
//   transport.ts fetch 注入点（主进程注入带代理的 fetch）

export * from './transport'
export * from './version'
export * from './headers'
export * from './errors'
export * from './expiry'
export * from './refresh'
export * from './usage'
export * from './socialLogin'

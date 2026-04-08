export function dismissBootSplash(doc = document) {
  console.log('[dismissBootSplash] 开始执行')
  const splash = doc?.getElementById?.('boot-splash')
  console.log('[dismissBootSplash] splash 元素:', splash)
  if (!splash) {
    console.log('[dismissBootSplash] 未找到 splash 元素')
    return false
  }

  splash.dataset.state = 'hidden'
  console.log('[dismissBootSplash] 设置 state = hidden')
  splash.remove()
  console.log('[dismissBootSplash] 移除元素完成')
  return true
}

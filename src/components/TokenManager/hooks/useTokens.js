import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export function useTokens() {
  const [tokens, setTokens] = useState([])
  const [autoRefreshing, setAutoRefreshing] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0, currentEmail: '', results: [] })
  const [lastRefreshTime, setLastRefreshTime] = useState(null)
  const [refreshingId, setRefreshingId] = useState(null)
  const [switchingId, setSwitchingId] = useState(null)

  const isExpiringSoon = useCallback((token) => {
    if (!token.expires_at) return true
    const expiresAt = new Date(token.expires_at.replace(/\//g, '-'))
    return expiresAt.getTime() - Date.now() < 5 * 60 * 1000
  }, [])

  const loadTokens = useCallback(async () => {
    try {
      setTokens(await invoke('get_tokens'))
    } catch (e) {
      console.error(e)
    }
  }, [])

  const autoRefreshAll = useCallback(async (tokenList, forceAll = false) => {
    if (autoRefreshing || tokenList.length === 0) return
    const tokensToRefresh = forceAll ? tokenList : tokenList.filter(isExpiringSoon)
    if (tokensToRefresh.length === 0) return

    setAutoRefreshing(true)
    setRefreshProgress({ current: 0, total: tokensToRefresh.length, currentEmail: '', results: [] })

    const updatedTokens = [...tokenList]
    const results = []

    for (let i = 0; i < tokensToRefresh.length; i++) {
      const token = tokensToRefresh[i]
      setRefreshProgress(prev => ({ ...prev, currentEmail: token.email }))
      let success = false, message = ''
      try {
        const updated = await invoke('refresh_token_from_api', { id: token.id })
        const idx = updatedTokens.findIndex(t => t.id === token.id)
        if (idx !== -1) updatedTokens[idx] = updated
        success = true
        message = `${updated.used}/${updated.quota}`
      } catch (e) {
        message = String(e).slice(0, 30)
      }
      results.push({ email: token.email, success, message })
      setRefreshProgress({ current: i + 1, total: tokensToRefresh.length, currentEmail: '', results: [...results] })
      if (i < tokensToRefresh.length - 1) await new Promise(r => setTimeout(r, 500))
    }

    setTokens(updatedTokens)
    setLastRefreshTime(new Date().toLocaleTimeString())
    setTimeout(() => {
      setAutoRefreshing(false)
      setRefreshProgress({ current: 0, total: 0, currentEmail: '', results: [] })
    }, 1500)
  }, [autoRefreshing, isExpiringSoon])

  const handleDelete = useCallback(async (id) => {
    if (confirm('确定删除？')) {
      await invoke('delete_token', { id })
      loadTokens()
    }
  }, [loadTokens])

  const handleBatchDelete = useCallback(async (selectedIds, setSelectedIds) => {
    if (selectedIds.length && confirm(`删除 ${selectedIds.length} 个账号？`)) {
      await invoke('delete_tokens', { ids: selectedIds })
      setSelectedIds([])
      loadTokens()
    }
  }, [loadTokens])

  const handleRefreshStatus = useCallback(async (id) => {
    setRefreshingId(id)
    try {
      const updated = await invoke('refresh_token_from_api', { id })
      setTokens(prev => prev.map(t => t.id === id ? updated : t))
    } catch (e) {
      console.warn(e)
    }
    setRefreshingId(null)
  }, [])

  const handleExport = useCallback(async () => {
    const json = await invoke('export_tokens')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    a.download = `kiro-tokens-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }, [])

  const handleSwitchAccount = useCallback(async (token) => {
    if (!token.access_token || !token.refresh_token) {
      alert('缺少认证信息')
      return
    }
    if (!confirm(`切换到 ${token.email}？\n\n需要重启 Kiro IDE 生效。`)) return
    setSwitchingId(token.id)
    try {
      const usage = await invoke('verify_token', {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        csrfToken: token.csrf_token || null,
        provider: token.provider || 'Google'
      })
      await invoke('switch_kiro_account', {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        provider: token.provider || 'Google',
        resetMachineId: true
      })
      alert(`切换成功！配额: ${usage.current_usage || 0}/${usage.usage_limit || 50}\n\n请重启 Kiro IDE`)
    } catch (e) {
      alert('切换失败: ' + e)
    } finally {
      setSwitchingId(null)
    }
  }, [])

  // 初始化和事件监听
  useEffect(() => {
    loadTokens()
    const unlistenLoginSuccess = listen('login-success', () => loadTokens())
    const unlistenKiroLoginData = listen('kiro-login-data', async (event) => {
      try {
        const data = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload
        if (data?.accessToken && data?.refreshToken) {
          await invoke('add_kiro_token', {
            email: data.email || 'unknown@kiro.dev',
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            csrfToken: data.csrfToken || '',
            idp: data.idp || 'Google',
            quota: data.quota ?? null,
            used: data.used ?? null
          })
          loadTokens()
        }
      } catch (e) {
        console.error('Failed to handle kiro-login-data:', e)
      }
    })

    // 自动刷新改为 5 分钟一次
    const interval = setInterval(async () => {
      if (document.hidden) return
      const data = await invoke('get_tokens')
      if (data.length > 0) autoRefreshAll(data)
    }, 5 * 60 * 1000)

    return () => {
      unlistenLoginSuccess.then(fn => fn())
      unlistenKiroLoginData.then(fn => fn())
      clearInterval(interval)
    }
  }, [loadTokens, autoRefreshAll])

  return {
    tokens,
    loadTokens,
    autoRefreshing,
    refreshProgress,
    lastRefreshTime,
    refreshingId,
    switchingId,
    autoRefreshAll,
    handleDelete,
    handleBatchDelete,
    handleRefreshStatus,
    handleExport,
    handleSwitchAccount,
  }
}

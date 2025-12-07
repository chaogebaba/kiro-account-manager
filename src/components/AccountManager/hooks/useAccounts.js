import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getQuota, getUsed } from '../../../utils/accountStats'

export function useAccounts() {
  const [accounts, setAccounts] = useState([])
  const [autoRefreshing, setAutoRefreshing] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0, currentEmail: '', results: [] })
  const [lastRefreshTime, setLastRefreshTime] = useState(null)
  const [refreshingId, setRefreshingId] = useState(null)
  const [switchingId, setSwitchingId] = useState(null)

  const isExpiringSoon = useCallback((account) => {
    if (!account.expiresAt) return true
    const expiresAt = new Date(account.expiresAt.replace(/\//g, '-'))
    return expiresAt.getTime() - Date.now() < 5 * 60 * 1000
  }, [])

  const loadAccounts = useCallback(async () => {
    try {
      setAccounts(await invoke('get_accounts'))
    } catch (e) {
      console.error(e)
    }
  }, [])

  const autoRefreshAll = useCallback(async (accountList, forceAll = false) => {
    if (autoRefreshing || accountList.length === 0) return
    const accountsToRefresh = forceAll ? accountList : accountList.filter(isExpiringSoon)
    if (accountsToRefresh.length === 0) return

    setAutoRefreshing(true)
    setRefreshProgress({ current: 0, total: accountsToRefresh.length, currentEmail: '', results: [] })

    const updatedAccounts = [...accountList]
    const results = []

    for (let i = 0; i < accountsToRefresh.length; i++) {
      const account = accountsToRefresh[i]
      setRefreshProgress(prev => ({ ...prev, currentEmail: account.email }))
      let success = false, message = ''
      try {
        const updated = await invoke('sync_account', { id: account.id })
        const idx = updatedAccounts.findIndex(a => a.id === account.id)
        if (idx !== -1) updatedAccounts[idx] = updated
        success = true
        message = `${getUsed(updated)}/${getQuota(updated)}`
      } catch (e) {
        message = String(e).slice(0, 30)
      }
      results.push({ email: account.email, success, message })
      setRefreshProgress({ current: i + 1, total: accountsToRefresh.length, currentEmail: '', results: [...results] })
      if (i < accountsToRefresh.length - 1) await new Promise(r => setTimeout(r, 500))
    }

    setAccounts(updatedAccounts)
    setLastRefreshTime(new Date().toLocaleTimeString())
    setTimeout(() => {
      setAutoRefreshing(false)
      setRefreshProgress({ current: 0, total: 0, currentEmail: '', results: [] })
    }, 1500)
  }, [autoRefreshing, isExpiringSoon])


  const handleDelete = useCallback(async (id) => {
    if (confirm('确定删除？')) {
      await invoke('delete_account', { id })
      loadAccounts()
    }
  }, [loadAccounts])

  const handleBatchDelete = useCallback(async (selectedIds, setSelectedIds) => {
    if (selectedIds.length && confirm(`删除 ${selectedIds.length} 个账号？`)) {
      await invoke('delete_accounts', { ids: selectedIds })
      setSelectedIds([])
      loadAccounts()
    }
  }, [loadAccounts])

  const handleRefreshStatus = useCallback(async (id) => {
    setRefreshingId(id)
    try {
      const updated = await invoke('sync_account', { id })
      setAccounts(prev => prev.map(a => a.id === id ? updated : a))
    } catch (e) {
      console.warn(e)
    }
    setRefreshingId(null)
  }, [])

  const handleExport = useCallback(async () => {
    const json = await invoke('export_accounts')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    a.download = `kiro-accounts-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }, [])

  const handleSwitchAccount = useCallback(async (account) => {
    if (!account.accessToken || !account.refreshToken) {
      alert('缺少认证信息')
      return
    }
    if (!confirm(`切换到 ${account.email}？\n\n需要重启 Kiro IDE 生效。`)) return
    setSwitchingId(account.id)
    try {
      const usage = await invoke('verify_account', {
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        csrfToken: account.csrfToken || null,
        provider: account.provider || 'Google'
      })
      
      // 根据账号类型判断 authMethod
      const isIdC = account.provider === 'BuilderId' || account.provider === 'Enterprise' || account.clientIdHash
      const authMethod = isIdC ? 'IdC' : 'social'
      
      // 构建完整的切换参数
      const params = {
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        provider: account.provider || 'Google',
        authMethod,
        resetMachineId: true,
        autoRestart: true
      }
      
      if (isIdC) {
        // IdC 账号: 需要 clientIdHash, region, clientId, clientSecret
        params.clientIdHash = account.clientIdHash || null
        params.region = account.ssoRegion || 'us-east-1'
        params.clientId = account.ssoClientId || null
        params.clientSecret = account.ssoClientSecret || null
      } else {
        // Social 账号: 需要 profileArn
        params.profileArn = account.profileArn || 'arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK'
      }
      
      await invoke('switch_kiro_account', { params })
      alert(`切换成功！配额: ${usage.currentUsage || 0}/${usage.usageLimit || 50}\n\nKiro IDE 将自动重启`)
    } catch (e) {
      alert('切换失败: ' + e)
    } finally {
      setSwitchingId(null)
    }
  }, [])

  // 初始化和事件监听
  useEffect(() => {
    loadAccounts()
    const unlistenLoginSuccess = listen('login-success', () => loadAccounts())
    const unlistenKiroLoginData = listen('kiro-login-data', async (event) => {
      try {
        const data = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload
        if (data?.accessToken && data?.refreshToken) {
          await invoke('add_kiro_account', {
            email: data.email || 'unknown@kiro.dev',
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            csrfToken: data.csrfToken || '',
            idp: data.idp || 'Google',
            quota: data.quota ?? null,
            used: data.used ?? null
          })
          loadAccounts()
        }
      } catch (e) {
        console.error('Failed to handle kiro-login-data:', e)
      }
    })

    const interval = setInterval(async () => {
      if (document.hidden) return
      const data = await invoke('get_accounts')
      if (data.length > 0) autoRefreshAll(data)
    }, 5 * 60 * 1000)

    return () => {
      unlistenLoginSuccess.then(fn => fn())
      unlistenKiroLoginData.then(fn => fn())
      clearInterval(interval)
    }
  }, [loadAccounts, autoRefreshAll])

  return {
    accounts,
    loadAccounts,
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

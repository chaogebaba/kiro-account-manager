import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { listen } from '@tauri-apps/api/event'
import { Search, Download, RefreshCw, Edit2, Trash2, Plus, Copy, Check, X, Loader, Users, Zap, Clock, Shield, Repeat, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'
import EditTokenModal from './EditTokenModal'
import { useTheme } from '../contexts/ThemeContext'

function TokenManager() {
  const { theme, colors } = useTheme()
  const isDark = theme === 'dark'
  const [tokens, setTokens] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [editingToken, setEditingToken] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [autoRefreshing, setAutoRefreshing] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0, currentEmail: '', results: [] })
  const [lastRefreshTime, setLastRefreshTime] = useState(null)
  const [refreshingId, setRefreshingId] = useState(null)
  const [switchingId, setSwitchingId] = useState(null)

  const isExpiringSoon = (token) => {
    if (!token.expires_at) return true
    const expiresAt = new Date(token.expires_at.replace(/\//g, '-'))
    return expiresAt.getTime() - Date.now() < 5 * 60 * 1000
  }

  const autoRefreshAll = async (tokenList, forceAll = false) => {
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
  }

  useEffect(() => {
    loadTokens()
    const unlistenLoginSuccess = listen('login-success', () => loadTokens())
    const unlistenKiroLoginData = listen('kiro-login-data', async (event) => {
      try {
        const data = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload
        if (data?.accessToken && data?.refreshToken) {
          await invoke('add_kiro_token', { email: data.email || 'unknown@kiro.dev', accessToken: data.accessToken, refreshToken: data.refreshToken, csrfToken: data.csrfToken || '', idp: data.idp || 'Google', quota: data.quota ?? null, used: data.used ?? null })
          loadTokens()
        }
      } catch (e) { console.error('Failed to handle kiro-login-data:', e) }
    })
    // 自动刷新改为 5 分钟一次，减少 API 调用
    const interval = setInterval(async () => {
      if (document.hidden) return // 页面不可见时跳过
      const data = await invoke('get_tokens')
      if (data.length > 0) autoRefreshAll(data)
    }, 5 * 60 * 1000)
    return () => { unlistenLoginSuccess.then(fn => fn()); unlistenKiroLoginData.then(fn => fn()); clearInterval(interval) }
  }, [])

  const loadTokens = async () => { try { setTokens(await invoke('get_tokens')) } catch (e) { console.error(e) } }
  const handleDelete = async (id) => { if (confirm('确定删除？')) { await invoke('delete_token', { id }); loadTokens() } }
  const handleBatchDelete = async () => { if (selectedIds.length && confirm(`删除 ${selectedIds.length} 个账号？`)) { await invoke('delete_tokens', { ids: selectedIds }); setSelectedIds([]); loadTokens() } }
  
  const handleRefreshStatus = async (id) => {
    setRefreshingId(id)
    try {
      const updated = await invoke('refresh_token_from_api', { id })
      setTokens(prev => prev.map(t => t.id === id ? updated : t))
    } catch (e) { console.warn(e) }
    setRefreshingId(null)
  }

  const handleExport = async () => {
    const json = await invoke('export_tokens')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    a.download = `kiro-tokens-${new Date().toISOString().slice(0,10)}.json`
    a.click()
  }

  const handleSwitchAccount = async (token) => {
    if (!token.access_token || !token.refresh_token) { alert('缺少认证信息'); return }
    if (!confirm(`切换到 ${token.email}？\n\n需要重启 Kiro IDE 生效。`)) return
    setSwitchingId(token.id)
    try {
      const usage = await invoke('verify_token', { accessToken: token.access_token, refreshToken: token.refresh_token, csrfToken: token.csrf_token || null, provider: token.provider || 'Google' })
      await invoke('switch_kiro_account', { accessToken: token.access_token, refreshToken: token.refresh_token, provider: token.provider || 'Google', resetMachineId: true })
      alert(`切换成功！配额: ${usage.current_usage || 0}/${usage.usage_limit || 50}\n\n请重启 Kiro IDE`)
    } catch (e) { alert('切换失败: ' + e) }
    finally { setSwitchingId(null) }
  }

  const filteredTokens = tokens.filter(t => t.email.toLowerCase().includes(searchTerm.toLowerCase()) || t.label.toLowerCase().includes(searchTerm.toLowerCase()))
  const totalPages = Math.ceil(filteredTokens.length / pageSize) || 1
  const paginatedTokens = filteredTokens.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const getUsagePercent = (used, quota) => quota === 0 ? 0 : Math.min(100, (used / quota) * 100)

  // 统计
  const stats = {
    total: tokens.length,
    active: tokens.filter(t => t.status === '正常' || t.status === '有效').length,
    totalQuota: tokens.reduce((sum, t) => sum + (t.quota || 0), 0),
    totalUsed: tokens.reduce((sum, t) => sum + (t.used || 0), 0),
  }

  return (
    <div className={`h-full flex flex-col ${colors.main}`}>
      {/* Header */}
      <div className={`${colors.card} border-b ${colors.cardBorder} px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h1 className={`text-xl font-bold ${colors.text}`}>账号管理</h1>
              <p className={`text-sm ${colors.textMuted} mt-0.5`}>管理你的 Kiro 账号和配额</p>
            </div>
            {/* 统计卡片 */}
            <div className="flex gap-3 ml-4">
              <div className={`flex items-center gap-2 px-3 py-1.5 ${isDark ? 'bg-blue-500/20' : 'bg-blue-50'} rounded-xl`}>
                <Users size={16} className="text-blue-500" />
                <span className={`text-sm font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{stats.total} 账号</span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 ${isDark ? 'bg-green-500/20' : 'bg-green-50'} rounded-xl`}>
                <Shield size={16} className="text-green-500" />
                <span className={`text-sm font-medium ${isDark ? 'text-green-300' : 'text-green-700'}`}>{stats.active} 正常</span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 ${isDark ? 'bg-purple-500/20' : 'bg-purple-50'} rounded-xl`}>
                <Zap size={16} className="text-purple-500" />
                <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{stats.totalUsed}/{stats.totalQuota}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastRefreshTime && !autoRefreshing && <span className={`text-xs ${colors.textMuted}`}>上次刷新: {lastRefreshTime}</span>}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder="搜索..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }} className={`pl-9 pr-4 py-2 ${isDark ? 'bg-white/5' : 'bg-gray-50'} border-0 rounded-xl text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${colors.text}`} />
            </div>
            {selectedIds.length > 0 && <button onClick={handleBatchDelete} className="px-3 py-2 bg-red-500 text-white rounded-xl text-sm hover:bg-red-600 flex items-center gap-1"><Trash2 size={14} />删除 ({selectedIds.length})</button>}
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 flex items-center gap-1.5 shadow-sm"><Plus size={16} />添加</button>
            <button onClick={handleExport} className={`p-2 ${colors.card} border ${colors.cardBorder} rounded-xl ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`} title="导出"><Download size={18} className={colors.textMuted} /></button>
            <button onClick={() => autoRefreshAll(tokens, true)} disabled={autoRefreshing} className={`p-2 ${colors.card} border ${colors.cardBorder} rounded-xl ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'} disabled:opacity-50`} title="刷新全部"><RefreshCw size={18} className={`${colors.textMuted} ${autoRefreshing ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>
        {/* 刷新进度 */}
        {autoRefreshing && refreshProgress.total > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(refreshProgress.current / refreshProgress.total) * 100}%` }} />
            </div>
            <span className="text-xs text-blue-600 font-medium">{refreshProgress.current}/{refreshProgress.total}</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className={`${colors.card} rounded-2xl shadow-sm overflow-hidden max-w-6xl`}>
          <table className="w-full table-fixed">
            <thead>
              <tr className={`${isDark ? 'bg-white/5' : 'bg-gray-50'} border-b ${colors.cardBorder} text-left text-xs font-medium ${colors.textMuted} uppercase tracking-wider`}>
                <th className="px-3 py-3 w-10"><input type="checkbox" checked={selectedIds.length === filteredTokens.length && filteredTokens.length > 0} onChange={(e) => setSelectedIds(e.target.checked ? filteredTokens.map(t => t.id) : [])} className="rounded" /></th>
                <th className="px-3 py-3 w-[200px]">账号</th>
                <th className="px-3 py-3 w-[70px]">订阅</th>
                <th className="px-3 py-3 w-[200px]">配额</th>
                <th className="px-3 py-3 w-[50px]">状态</th>
                <th className="px-3 py-3 w-[100px]">Token</th>
                <th className="px-3 py-3 w-[130px] text-right">操作</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-100'}`}>
              {paginatedTokens.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-20 text-center"><div className={`flex flex-col items-center gap-3 ${colors.textMuted}`}><Users size={48} strokeWidth={1} /><p>暂无账号</p><button onClick={() => setShowAddModal(true)} className="text-blue-500 hover:underline text-sm">添加第一个账号</button></div></td></tr>
              ) : paginatedTokens.map((token) => {
                const percent = getUsagePercent(token.used, token.quota)
                const isExpired = token.expires_at && new Date(token.expires_at.replace(/\//g, '-')) < new Date()
                return (
                  <tr key={token.id} className={`${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50/50'} transition-colors group`}>
                    <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(token.id)} onChange={(e) => setSelectedIds(e.target.checked ? [...selectedIds, token.id] : selectedIds.filter(i => i !== token.id))} className="rounded" /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-medium shadow-sm ${token.provider === 'Google' ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600') : token.provider === 'Github' ? (isDark ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700') : (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600')}`}>
                          {token.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${colors.text} text-sm`}>{token.email}</span>
                            <button onClick={() => { navigator.clipboard.writeText(token.email); setCopiedId(token.id); setTimeout(() => setCopiedId(null), 1500) }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {copiedId === token.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-400" />}
                            </button>
                          </div>
                          <div className={`text-xs ${colors.textMuted}`}>{token.provider || '未知'} · {token.label || '无标签'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium ${token.subscription_type?.includes('PRO+') ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm' : token.subscription_type?.includes('PRO') ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm' : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                        {token.subscription_type || 'Free'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{token.used}/{token.quota}</span>
                            <span className={`${isDark ? 'text-gray-500' : 'text-gray-400'}`}>剩余 {token.quota - token.used}</span>
                          </div>
                          <span className={`font-semibold ${percent > 80 ? 'text-red-500' : percent > 50 ? 'text-yellow-500' : 'text-green-500'}`}>{Math.round(percent)}%</span>
                        </div>
                        <div className={`h-2 ${isDark ? 'bg-white/10' : 'bg-gray-100'} rounded-full overflow-hidden`}>
                          <div className={`h-full rounded-full transition-all ${percent > 80 ? 'bg-gradient-to-r from-red-400 to-red-500' : percent > 50 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-gradient-to-r from-green-400 to-emerald-500'}`} style={{ width: `${percent}%` }} />
                        </div>
                        {token.reset_date && (
                          <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {token.reset_date} 重置{token.days_until_reset > 0 && <span className="ml-1">({token.days_until_reset}天后)</span>}
                          </div>
                        )}
                        {(token.free_trial_quota || token.bonus_quota) && (
                          <div className="flex flex-col gap-1 pt-0.5">
                            {token.free_trial_quota && (
                              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full w-fit ${token.free_trial_status === 'ACTIVE' ? (isDark ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-cyan-50 text-cyan-600 border border-cyan-200') : (isDark ? 'bg-gray-700/50 text-gray-500' : 'bg-gray-100 text-gray-400')}`} title={`过期: ${token.free_trial_expiry || '未知'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${token.free_trial_status === 'ACTIVE' ? 'bg-cyan-500' : 'bg-gray-400'}`}></span>
                                试用 {token.free_trial_used || 0}/{token.free_trial_quota}
                              </span>
                            )}
                            {token.bonus_quota && (
                              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full w-fit ${token.bonus_status === 'ACTIVE' ? (isDark ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-purple-50 text-purple-600 border border-purple-200') : (isDark ? 'bg-gray-700/50 text-gray-500' : 'bg-gray-100 text-gray-400')}`} title={`${token.bonus_name || '奖励'} 过期: ${token.bonus_expiry || '未知'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${token.bonus_status === 'ACTIVE' ? 'bg-purple-500' : 'bg-gray-400'}`}></span>
                                {token.bonus_name || '奖励'} {token.bonus_used || 0}/{token.bonus_quota}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium ${token.status === '正常' || token.status === '有效' ? (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700') : (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600')}`}>{token.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {token.expires_at ? (
                        <div className={`text-xs ${isExpired ? 'text-red-500' : colors.textMuted}`}>
                          <div className="flex items-center gap-1"><Clock size={12} />{token.expires_at.split(' ')[1]}</div>
                          <div className={`${isDark ? 'text-gray-500' : 'text-gray-400'} mt-0.5`}>{token.expires_at.split(' ')[0]}</div>
                        </div>
                      ) : <span className={`text-xs ${colors.textMuted}`}>-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleSwitchAccount(token)} disabled={switchingId === token.id} className={`p-1.5 ${isDark ? 'bg-blue-500/20 hover:bg-blue-500/30' : 'bg-blue-50 hover:bg-blue-100'} rounded-lg disabled:opacity-50`} title="切换账号"><Repeat size={14} className={`text-blue-500 ${switchingId === token.id ? 'animate-spin' : ''}`} /></button>
                        <button onClick={() => handleRefreshStatus(token.id)} disabled={refreshingId === token.id} className={`p-1.5 ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} rounded-lg`} title="刷新"><RefreshCw size={14} className={`${colors.textMuted} ${refreshingId === token.id ? 'animate-spin' : ''}`} /></button>
                        <button onClick={() => setEditingToken(token)} className={`p-1.5 ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} rounded-lg`} title="编辑"><Edit2 size={14} className={colors.textMuted} /></button>
                        <button onClick={() => handleDelete(token.id)} className={`p-1.5 ${isDark ? 'hover:bg-red-500/20' : 'hover:bg-red-50'} rounded-lg`} title="删除"><Trash2 size={14} className="text-red-400" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredTokens.length > 0 && (
        <div className={`${colors.card} border-t ${colors.cardBorder} px-6 py-3 flex items-center justify-between`}>
          <div className={`flex items-center gap-2 text-sm ${colors.textMuted}`}>
            <span>每页</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }} className={`px-2 py-1 border rounded-lg ${colors.card} ${colors.cardBorder} text-sm ${colors.text}`}>
              <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
            </select>
            <span>条，共 {filteredTokens.length} 条</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className={`p-2 border ${colors.cardBorder} rounded-lg ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'} disabled:opacity-40`} title="首页"><ChevronsLeft size={16} className={colors.textMuted} /></button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className={`p-2 border ${colors.cardBorder} rounded-lg ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'} disabled:opacity-40`} title="上一页"><ChevronLeft size={16} className={colors.textMuted} /></button>
            <span className={`px-4 py-1.5 text-sm ${colors.text} font-medium`}>{currentPage} / {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={`p-2 border ${colors.cardBorder} rounded-lg ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'} disabled:opacity-40`} title="下一页"><ChevronRight size={16} className={colors.textMuted} /></button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className={`p-2 border ${colors.cardBorder} rounded-lg ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'} disabled:opacity-40`} title="末页"><ChevronsRight size={16} className={colors.textMuted} /></button>
          </div>
        </div>
      )}

      {/* Modals */}
      {editingToken && <EditTokenModal token={editingToken} onClose={() => setEditingToken(null)} onSuccess={() => { setEditingToken(null); loadTokens() }} />}
      
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className={`${colors.card} rounded-2xl w-[400px] shadow-2xl`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${colors.cardBorder}`}>
              <h2 className={`text-lg font-semibold ${colors.text}`}>添加账号</h2>
              <button onClick={() => setShowAddModal(false)} className={`p-1.5 hover:opacity-70 rounded-xl`}><X size={18} className={colors.textMuted} /></button>
            </div>
            <div className="p-5 space-y-3">
              {/* 保存本地账号 */}
              <button
                onClick={async () => {
                  setAddLoading(true); setAddError('')
                  try {
                    const localToken = await invoke('get_kiro_local_token')
                    if (!localToken?.refreshToken) {
                      setAddError('未找到本地 Kiro 账号，请先在 Kiro IDE 中登录')
                      return
                    }
                    await invoke('add_token_by_refresh', { refreshToken: localToken.refreshToken })
                    loadTokens()
                    setShowAddModal(false)
                  } catch (e) { setAddError(e.toString()) }
                  finally { setAddLoading(false) }
                }}
                disabled={addLoading}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 ${colors.loginBtn} border hover:border-green-500 rounded-lg transition-all disabled:opacity-50`}
              >
                <Download size={18} className="text-green-500" />
                <span className={`${colors.text} font-medium`}>保存本地账号</span>
              </button>
              
              {/* 分隔线 */}
              <div className="flex items-center gap-3">
                <div className={`flex-1 h-px ${colors.cardBorder}`}></div>
                <span className={`text-xs ${colors.textMuted}`}>或手动输入</span>
                <div className={`flex-1 h-px ${colors.cardBorder}`}></div>
              </div>
              
              {/* 手动输入 Token */}
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Refresh Token (aor 开头)"
                  id="manual-account-input"
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm ${colors.text} ${colors.input} focus:outline-none focus:ring-2 ${colors.inputFocus}`}
                />
                <button
                  onClick={async () => {
                    const tokenInput = document.getElementById('manual-account-input')
                    const token = tokenInput?.value?.trim()
                    if (!token) { setAddError('请输入 Refresh Token'); return }
                    if (!token.startsWith('aor')) { setAddError('Token 格式错误，应以 aor 开头'); return }
                    setAddLoading(true); setAddError('')
                    try {
                      await invoke('add_token_by_refresh', { refreshToken: token })
                      loadTokens()
                      setShowAddModal(false)
                    } catch (e) { setAddError(e.toString()) }
                    finally { setAddLoading(false) }
                  }}
                  disabled={addLoading}
                  className={`w-full px-4 py-2.5 ${colors.loginBtn} border rounded-xl text-sm font-medium ${colors.text} transition-colors disabled:opacity-50`}
                >
                  {addLoading ? '验证中...' : '添加账号'}
                </button>
              </div>
              
              {addError && <div className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl text-center">{addError}</div>}
            </div>
          </div>
        </div>
      )}

      {autoRefreshing && refreshProgress.total > 0 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`${colors.card} rounded-2xl w-[400px] shadow-2xl overflow-hidden`}>
            <div className={`px-5 py-4 border-b ${colors.cardBorder} ${isDark ? 'bg-blue-500/20' : 'bg-blue-50'} flex items-center gap-2`}>
              <RefreshCw size={18} className="text-blue-500 animate-spin" />
              <h2 className={`font-semibold ${colors.text}`}>刷新账号</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <div className={`flex justify-between text-sm mb-2`}><span className={colors.textMuted}>进度</span><span className="text-blue-500 font-medium">{refreshProgress.current}/{refreshProgress.total}</span></div>
                <div className={`h-2 ${isDark ? 'bg-white/10' : 'bg-gray-200'} rounded-full overflow-hidden`}><div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(refreshProgress.current / refreshProgress.total) * 100}%` }} /></div>
              </div>
              {refreshProgress.currentEmail && <div className={`text-sm ${colors.textMuted}`}>正在刷新: <span className={colors.text}>{refreshProgress.currentEmail}</span></div>}
              {refreshProgress.results.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {refreshProgress.results.map((r, i) => (
                    <div key={i} className={`text-xs px-3 py-2 rounded-xl flex justify-between ${r.success ? (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-700') : (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600')}`}>
                      <span className="truncate">{r.email}</span>
                      <span>{r.success ? `✓ ${r.message}` : `✗ ${r.message}`}</span>
                    </div>
                  ))}
                </div>
              )}
              {refreshProgress.current === refreshProgress.total && <div className="text-center text-green-500 font-medium">刷新完成！</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TokenManager

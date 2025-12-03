import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { listen } from '@tauri-apps/api/event'
import { Search, Download, RefreshCw, Edit2, Trash2, Plus, Copy, Check, X, Loader } from 'lucide-react'
import EditTokenModal from './EditTokenModal'

function TokenManager() {
  const [tokens, setTokens] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [editingToken, setEditingToken] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ refreshToken: '' })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [autoRefreshing, setAutoRefreshing] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0, currentEmail: '', results: [] })
  const [lastRefreshTime, setLastRefreshTime] = useState(null)

  // 检查 Token 是否即将过期（5分钟内）
  const isExpiringSoon = (token) => {
    if (!token.expires_at) return true // 没有过期时间，需要刷新
    const expiresAt = new Date(token.expires_at.replace(/\//g, '-'))
    const now = new Date()
    const fiveMinutes = 5 * 60 * 1000
    return expiresAt.getTime() - now.getTime() < fiveMinutes
  }

  // 自动刷新即将过期的账号
  const autoRefreshAll = async (tokenList, forceAll = false) => {
    if (autoRefreshing || tokenList.length === 0) return
    
    // 筛选需要刷新的 Token
    const tokensToRefresh = forceAll ? tokenList : tokenList.filter(isExpiringSoon)
    if (tokensToRefresh.length === 0) {
      console.log('没有需要刷新的账号')
      return
    }
    
    setAutoRefreshing(true)
    setRefreshProgress({ current: 0, total: tokensToRefresh.length, currentEmail: '', results: [] })
    console.log(`开始刷新 ${tokensToRefresh.length} 个账号...`)
    
    const updatedTokens = [...tokenList]
    const results = []
    let current = 0
    
    for (const token of tokensToRefresh) {
      setRefreshProgress(prev => ({ ...prev, currentEmail: token.email }))
      let success = false
      let message = ''
      try {
        const updated = await invoke('refresh_token_from_api', { id: token.id })
        const idx = updatedTokens.findIndex(t => t.id === token.id)
        if (idx !== -1) updatedTokens[idx] = updated
        success = true
        message = `${updated.used}/${updated.quota}`
      } catch (e) {
        console.warn(`刷新账号 ${token.email} 失败:`, e)
        message = String(e).slice(0, 30)
      }
      current++
      results.push({ email: token.email, success, message })
      setRefreshProgress({ current, total: tokensToRefresh.length, currentEmail: '', results: [...results] })
      
      // 请求间隔，避免太快
      if (current < tokensToRefresh.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }
    
    setTokens(updatedTokens)
    setLastRefreshTime(new Date().toLocaleTimeString())
    
    // 延迟关闭对话框，让用户看到结果
    setTimeout(() => {
      setAutoRefreshing(false)
      setRefreshProgress({ current: 0, total: 0, currentEmail: '', results: [] })
    }, 1500)
    console.log('刷新完成')
  }

  useEffect(() => {
    // 初始加载
    const init = async () => {
      const data = await invoke('get_tokens')
      setTokens(data)
      // 启动时强制刷新所有账号
      if (data.length > 0) {
        setTimeout(() => autoRefreshAll(data, true), 1000)
      }
    }
    init()

    // 监听登录成功事件
    const unlistenLoginSuccess = listen('login-success', () => {
      loadTokens()
    })

    // 监听 Kiro OAuth 登录数据事件，自动添加账号
    const unlistenKiroLoginData = listen('kiro-login-data', async (event) => {
      try {
        const payload = event.payload
        const data = typeof payload === 'string' ? JSON.parse(payload) : payload

        if (!data || !data.accessToken || !data.refreshToken) {
          console.warn('Invalid kiro-login-data payload:', data)
          return
        }

        await invoke('add_kiro_token', {
          email: data.email || 'unknown@kiro.dev',
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          csrfToken: data.csrfToken || '',
          idp: data.idp || 'Google',
          quota: data.quota ?? null,
          used: data.used ?? null
        })

        // 添加成功后刷新列表
        loadTokens()
      } catch (e) {
        console.error('Failed to handle kiro-login-data:', e)
      }
    })

    // 定时检查（每分钟检查一次，只刷新即将过期的Token）
    const interval = setInterval(async () => {
      const data = await invoke('get_tokens')
      if (data.length > 0) {
        autoRefreshAll(data) // 只刷新即将过期的
      }
    }, 60 * 1000)

    return () => {
      unlistenLoginSuccess.then(fn => fn())
      unlistenKiroLoginData.then(fn => fn())
      clearInterval(interval)
    }
  }, [])

  const loadTokens = async () => {
    try {
      const data = await invoke('get_tokens')
      setTokens(data)
    } catch (e) {
      console.error('Failed to load tokens:', e)
    }
  }

  const handleDelete = async (id) => {
    if (confirm('确定要删除这个账号吗？')) {
      await invoke('delete_token', { id })
      loadTokens()
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return
    if (confirm(`确定要删除选中的 ${selectedIds.length} 个账号吗？`)) {
      await invoke('delete_tokens', { ids: selectedIds })
      setSelectedIds([])
      loadTokens()
    }
  }

  const [refreshingId, setRefreshingId] = useState(null)
  const [refreshResult, setRefreshResult] = useState(null)

  const handleRefreshStatus = async (id) => {
    setRefreshingId(id)
    setRefreshResult(null)
    try {
      // 调用真正的 API 刷新
      const updatedToken = await invoke('refresh_token_from_api', { id })
      // 显示刷新结果
      setRefreshResult({
        id,
        success: true,
        message: `配额: ${updatedToken.used} / ${updatedToken.quota}，状态: ${updatedToken.status}`
      })
      // 更新本地列表
      setTokens(prev => prev.map(t => t.id === id ? updatedToken : t))
    } catch (e) {
      console.warn('API refresh failed:', e)
      setRefreshResult({
        id,
        success: false,
        message: `刷新失败: ${e}`
      })
      // 回退到本地刷新
      await invoke('refresh_token_status', { id })
      loadTokens()
    }
    setRefreshingId(null)
    // 3秒后清除提示
    setTimeout(() => setRefreshResult(null), 3000)
  }

  const handleExport = async () => {
    const json = await invoke('export_tokens')
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kiro-tokens-${new Date().toISOString().slice(0,10)}.json`
    a.click()
  }

  const handleAddByRefresh = async () => {
    if (!addForm.refreshToken.trim()) {
      setAddError('请输入 RefreshToken')
      return
    }
    setAddLoading(true)
    setAddError('')
    try {
      await invoke('add_token_by_refresh', { refreshToken: addForm.refreshToken.trim() })
      setShowAddModal(false)
      setAddForm({ refreshToken: '' })
      loadTokens()
    } catch (e) {
      setAddError(e.toString())
    } finally {
      setAddLoading(false)
    }
  }

  const handleCopyEmail = (email, id) => {
    navigator.clipboard.writeText(email)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const [switchingId, setSwitchingId] = useState(null)

  const handleSwitchAccount = async (token) => {
    if (!token.access_token || !token.refresh_token) {
      alert('此账号缺少认证信息，无法切换')
      return
    }
    if (!confirm(`确定要切换到账号 ${token.email} 吗？\n\n切换后需要重启 Kiro IDE 才能生效。`)) {
      return
    }
    
    setSwitchingId(token.id)
    try {
      // 先验证 token 是否有效
      const usage = await invoke('verify_token', {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        csrfToken: token.csrf_token || null,
        provider: token.provider || 'Google'
      })
      console.log('Token verified, usage:', usage)
      
      // 验证通过，执行切换
      await invoke('switch_kiro_account', {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        provider: token.provider || 'Google'
      })
      alert(`账号切换成功！\n\n当前配额: ${usage.current_usage || 0} / ${usage.usage_limit || 50}\n\n请重启 Kiro IDE 生效。`)
    } catch (e) {
      console.error('Switch account failed:', e)
      alert('切换失败: ' + e + '\n\n该 Token 可能已过期，请重新登录获取。')
    } finally {
      setSwitchingId(null)
    }
  }

  const handleSelectAll = (checked) => {
    setSelectedIds(checked ? filteredTokens.map(t => t.id) : [])
  }

  const handleSelectOne = (id, checked) => {
    setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(i => i !== id))
  }

  const filteredTokens = tokens.filter(token => 
    token.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredTokens.length / pageSize) || 1
  const paginatedTokens = filteredTokens.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const getStatusStyle = (status) => {
    if (status === '有效' || status === '正常') return 'bg-green-100 text-green-700'
    if (status === '已失效') return 'bg-red-100 text-red-600'
    return 'bg-gray-100 text-gray-600'
  }

  const getUsagePercent = (used, quota) => {
    if (quota === 0) return 0
    return Math.min(100, (used / quota) * 100)
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-800">账号管理</h1>
          <span className="text-sm text-gray-500">{tokens.length} 个账号</span>
          {autoRefreshing && refreshProgress.total > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-blue-600">
                <RefreshCw size={12} className="animate-spin" />
                <span>{refreshProgress.current}/{refreshProgress.total}</span>
              </div>
              <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${(refreshProgress.current / refreshProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          {lastRefreshTime && !autoRefreshing && (
            <span className="text-xs text-gray-400">上次刷新: {lastRefreshTime}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="搜索邮箱或标签..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
              className="pl-9 pr-4 py-2 border rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          {selectedIds.length > 0 && (
            <button
              onClick={handleBatchDelete}
              className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 flex items-center gap-1"
            >
              <Trash2 size={14} />
              删除 ({selectedIds.length})
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 flex items-center gap-1.5 transition-colors"
          >
            <Plus size={16} />
            添加账号
          </button>
          <button
            onClick={handleExport}
            className="p-2 border rounded-lg hover:bg-gray-50 transition-colors"
            title="导出"
          >
            <Download size={18} className="text-gray-600" />
          </button>
          <button
            onClick={loadTokens}
            className="p-2 border rounded-lg hover:bg-gray-50 transition-colors"
            title="刷新"
          >
            <RefreshCw size={18} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="text-left text-sm text-gray-600">
              <th className="px-6 py-3 font-medium w-12">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredTokens.length && filteredTokens.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3 font-medium">邮箱</th>
              <th className="px-4 py-3 font-medium w-24">来源</th>
              <th className="px-4 py-3 font-medium w-24">订阅</th>
              <th className="px-4 py-3 font-medium w-48">额度使用</th>
              <th className="px-4 py-3 font-medium w-24">状态</th>
              <th className="px-4 py-3 font-medium w-36">Token过期</th>
              <th className="px-4 py-3 font-medium w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTokens.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-16 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <Plus size={40} className="text-gray-300" />
                    <p>暂无账号，点击登录按钮添加</p>
                  </div>
                </td>
              </tr>
            ) : paginatedTokens.map((token) => (
              <tr key={token.id} className="border-b hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(token.id)}
                    onChange={(e) => handleSelectOne(token.id, e.target.checked)}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-800 font-medium">{token.email}</span>
                    <button
                      onClick={() => handleCopyEmail(token.email, token.id)}
                      className="p-1 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="复制邮箱"
                    >
                      {copiedId === token.id ? (
                        <Check size={14} className="text-green-500" />
                      ) : (
                        <Copy size={14} className="text-gray-400" />
                      )}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={`text-xs px-2 py-1 rounded ${
                    token.provider === 'Google' ? 'bg-red-50 text-red-600' : 
                    token.provider === 'Github' ? 'bg-gray-100 text-gray-700' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {token.provider || '未知'}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className={`text-xs px-2 py-1 rounded ${
                    token.subscription_type?.includes('PRO+') ? 'bg-purple-100 text-purple-700' :
                    token.subscription_type?.includes('PRO') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {token.subscription_type || 'Free'}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{token.used} / {token.quota}</span>
                      <span className="text-gray-400">{Math.round(getUsagePercent(token.used, token.quota))}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          getUsagePercent(token.used, token.quota) > 80 ? 'bg-red-500' : 
                          getUsagePercent(token.used, token.quota) > 50 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${getUsagePercent(token.used, token.quota)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium inline-block w-fit ${getStatusStyle(token.status)}`}>
                      {token.status}
                    </span>
                    {refreshResult?.id === token.id && (
                      <span className={`text-xs ${refreshResult.success ? 'text-green-600' : 'text-red-500'}`}>
                        {refreshResult.message}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  {token.expires_at ? (
                    <div className="text-xs">
                      <div className={`${
                        new Date(token.expires_at.replace(/\//g, '-')) < new Date() ? 'text-red-500' :
                        new Date(token.expires_at.replace(/\//g, '-')) - new Date() < 10 * 60 * 1000 ? 'text-yellow-600' : 'text-gray-500'
                      }`}>
                        {token.expires_at.split(' ')[1]}
                      </div>
                      <div className="text-gray-400">{token.expires_at.split(' ')[0]}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSwitchAccount(token)}
                      disabled={switchingId === token.id}
                      className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors disabled:opacity-50"
                      title="切换到此账号（会先验证Token有效性）"
                    >
                      {switchingId === token.id ? '验证中...' : '切号'}
                    </button>
                    <button
                      onClick={() => handleRefreshStatus(token.id)}
                      disabled={refreshingId === token.id}
                      className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                      title="刷新状态（从API获取最新配额）"
                    >
                      <RefreshCw size={14} className={`text-gray-400 ${refreshingId === token.id ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => setEditingToken(token)}
                      className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                      title="编辑"
                    >
                      <Edit2 size={14} className="text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(token.id)}
                      className="p-1.5 hover:bg-red-50 rounded transition-colors"
                      title="删除"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredTokens.length > 0 && (
        <div className="flex items-center justify-between px-6 py-3 border-t bg-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>每页</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
              className="px-2 py-1 border rounded bg-white text-sm"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span>条</span>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-gray-500 mr-2">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 border rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              首页
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ‹
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ›
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 border rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              末页
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingToken && (
        <EditTokenModal
          token={editingToken}
          onClose={() => setEditingToken(null)}
          onSuccess={() => { setEditingToken(null); loadTokens() }}
        />
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl w-[480px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">添加账号</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">RefreshToken</label>
                <textarea
                  value={addForm.refreshToken}
                  onChange={(e) => setAddForm({ refreshToken: e.target.value })}
                  placeholder="从 Kiro IDE 的 kiro-auth-token.json 文件中获取"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 h-24 resize-none font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">
                  文件位置: ~/.aws/sso/cache/kiro-auth-token.json
                </p>
              </div>
              {addError && (
                <div className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{addError}</div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleAddByRefresh}
                  disabled={addLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {addLoading && <Loader size={14} className="animate-spin" />}
                  {addLoading ? '添加中...' : '添加'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refresh Progress Dialog */}
      {autoRefreshing && refreshProgress.total > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-[400px] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b bg-blue-50">
              <div className="flex items-center gap-2">
                <RefreshCw size={18} className="text-blue-600 animate-spin" />
                <h2 className="text-lg font-semibold text-gray-800">刷新账号</h2>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {/* 进度条 */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">进度</span>
                  <span className="text-blue-600 font-medium">{refreshProgress.current} / {refreshProgress.total}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${(refreshProgress.current / refreshProgress.total) * 100}%` }}
                  />
                </div>
              </div>
              
              {/* 当前刷新 */}
              {refreshProgress.currentEmail && (
                <div className="text-sm text-gray-500">
                  正在刷新: <span className="text-gray-700">{refreshProgress.currentEmail}</span>
                </div>
              )}
              
              {/* 结果列表 */}
              {refreshProgress.results.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {refreshProgress.results.map((r, i) => (
                    <div key={i} className={`text-xs px-3 py-2 rounded flex items-center justify-between ${
                      r.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                    }`}>
                      <span className="truncate flex-1">{r.email}</span>
                      <span className={`ml-2 ${r.success ? 'text-green-600' : 'text-red-500'}`}>
                        {r.success ? `✓ ${r.message}` : `✗ ${r.message}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 完成提示 */}
              {refreshProgress.current === refreshProgress.total && (
                <div className="text-center text-sm text-green-600 font-medium">
                  刷新完成！
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TokenManager

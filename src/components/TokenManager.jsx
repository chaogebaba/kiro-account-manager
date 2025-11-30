import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { listen } from '@tauri-apps/api/event'
import { Search, Download, RefreshCw, Edit2, Trash2, Plus, Copy, Check } from 'lucide-react'
import EditTokenModal from './EditTokenModal'

function TokenManager() {
  const [tokens, setTokens] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [editingToken, setEditingToken] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => {
    loadTokens()
    // 监听登录成功事件，自动刷新列表
    const unlisten = listen('login-success', () => {
      loadTokens()
    })
    return () => { unlisten.then(fn => fn()) }
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
              <th className="px-4 py-3 font-medium w-40">添加时间</th>
              <th className="px-4 py-3 font-medium w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTokens.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center text-gray-400">
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
                <td className="px-4 py-4 text-sm text-gray-500">{token.created_at}</td>
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
    </div>
  )
}

export default TokenManager

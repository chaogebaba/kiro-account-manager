import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { Search, Upload, Download, RefreshCw, Edit2, Trash2, RefreshCcw } from 'lucide-react'
import AddTokenModal from './AddTokenModal'
import EditTokenModal from './EditTokenModal'

function TokenManager() {
  const [tokens, setTokens] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState('所有标签')
  const [selectedIds, setSelectedIds] = useState([])
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingToken, setEditingToken] = useState(null)

  useEffect(() => {
    loadTokens()
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
    if (confirm('确定要删除这个 Token 吗？')) {
      await invoke('delete_token', { id })
      loadTokens()
    }
  }

  const handleRefreshStatus = async (id) => {
    await invoke('refresh_token_status', { id })
    loadTokens()
  }

  const handleExport = async () => {
    const json = await invoke('export_tokens')
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tokens.json'
    a.click()
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (file) {
        const text = await file.text()
        await invoke('import_tokens', { tokensJson: text })
        loadTokens()
      }
    }
    input.click()
  }

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(filteredTokens.map(t => t.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id, checked) => {
    if (checked) {
      setSelectedIds([...selectedIds, id])
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id))
    }
  }

  const filteredTokens = tokens.filter(token => {
    const matchSearch = token.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       token.label.toLowerCase().includes(searchTerm.toLowerCase())
    return matchSearch
  })

  const totalPages = Math.ceil(filteredTokens.length / pageSize)
  const paginatedTokens = filteredTokens.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const getStatusStyle = (status) => {
    switch (status) {
      case '有效': return 'bg-green-100 text-green-600'
      case '正常': return 'bg-green-100 text-green-600'
      case '已失效': return 'bg-red-100 text-red-500'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-xl font-semibold text-gray-800">Token 管理</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm text-gray-600 bg-white"
          >
            <option>所有标签</option>
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="搜索邮箱..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-lg text-sm w-48"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-[#4361ee] text-white rounded-lg text-sm hover:bg-[#3651de]"
          >
            导入
          </button>
          <button
            onClick={handleImport}
            className="p-2 border rounded-lg hover:bg-gray-50"
            title="导入"
          >
            <Upload size={18} className="text-gray-600" />
          </button>
          <button
            onClick={handleExport}
            className="p-2 border rounded-lg hover:bg-gray-50"
            title="导出"
          >
            <Download size={18} className="text-gray-600" />
          </button>
          <button
            onClick={loadTokens}
            className="p-2 border rounded-lg hover:bg-gray-50"
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
              <th className="px-6 py-3 font-medium">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredTokens.length && filteredTokens.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">标签</th>
              <th className="px-4 py-3 font-medium">可用额度</th>
              <th className="px-4 py-3 font-medium">Token 状态</th>
              <th className="px-4 py-3 font-medium">添加时间</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTokens.map((token) => (
              <tr key={token.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(token.id)}
                    onChange={(e) => handleSelectOne(token.id, e.target.checked)}
                    className="rounded"
                  />
                </td>
                <td className="px-4 py-4 text-sm text-gray-800">{token.email}</td>
                <td className="px-4 py-4">
                  <span className="token-label">{token.label}</span>
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm">
                    <span className="text-green-600">{token.used}</span>
                    <span className="text-gray-400"> / </span>
                    <span className="text-gray-600">{token.quota}</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${getStatusStyle(token.status)}`}>
                      {token.status}
                    </span>
                    <button
                      onClick={() => handleRefreshStatus(token.id)}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="刷新状态"
                    >
                      <RefreshCcw size={14} className="text-gray-400" />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">{token.created_at}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingToken(token)}
                      className="p-2 hover:bg-gray-100 rounded"
                      title="编辑"
                    >
                      <Edit2 size={16} className="text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(token.id)}
                      className="p-2 hover:bg-red-50 rounded"
                      title="删除"
                    >
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-3 border-t bg-gray-50">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>每页显示</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-2 py-1 border rounded bg-white"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span>条</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>共 {filteredTokens.length} 条, 第 {currentPage} / {totalPages || 1} 页</span>
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-2 py-1 border rounded hover:bg-white disabled:opacity-50"
          >
            首页
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-2 py-1 border rounded hover:bg-white disabled:opacity-50"
          >
            &lt;
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-2 py-1 border rounded hover:bg-white disabled:opacity-50"
          >
            &gt;
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-2 py-1 border rounded hover:bg-white disabled:opacity-50"
          >
            末页
          </button>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddTokenModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            loadTokens()
          }}
        />
      )}
      {editingToken && (
        <EditTokenModal
          token={editingToken}
          onClose={() => setEditingToken(null)}
          onSuccess={() => {
            setEditingToken(null)
            loadTokens()
          }}
        />
      )}
    </div>
  )
}

export default TokenManager

import { useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { X, Copy, Check, RefreshCw, Eye, EyeOff } from 'lucide-react'

function EditTokenModal({ token, onClose, onSuccess }) {
  const [form, setForm] = useState({
    email: token.email,
    label: token.label,
    quota: token.quota,
    used: token.used,
    status: token.status,
  })
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied] = useState(null)
  const [showTokens, setShowTokens] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await invoke('update_token', { 
        id: token.id, 
        email: form.email, 
        label: form.label, 
        quota: form.quota, 
        used: form.used, 
        status: form.status 
      })
      onSuccess()
    } catch (err) {
      alert('更新失败: ' + err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const updated = await invoke('refresh_token_from_api', { id: token.id })
      setForm(prev => ({
        ...prev,
        quota: updated.quota,
        used: updated.used,
        status: updated.status,
      }))
    } catch (e) {
      alert('刷新失败: ' + e)
    } finally {
      setRefreshing(false)
    }
  }

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 1500)
  }

  const maskToken = (str) => {
    if (!str) return '-'
    if (str.length <= 20) return str
    return str.slice(0, 10) + '...' + str.slice(-10)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-[520px] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="text-lg font-semibold text-gray-800">编辑账号</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">邮箱</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">标签</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* 配额信息 */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">配额信息</span>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? '刷新中...' : '从API刷新'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">总额度</label>
                <input
                  type="number"
                  value={form.quota}
                  onChange={(e) => setForm({ ...form, quota: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border rounded text-sm bg-white"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">已使用</label>
                <input
                  type="number"
                  value={form.used}
                  onChange={(e) => setForm({ ...form, used: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border rounded text-sm bg-white"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">状态</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-2.5 py-1.5 border rounded text-sm bg-white"
                >
                  <option value="正常">正常</option>
                  <option value="有效">有效</option>
                  <option value="已失效">已失效</option>
                </select>
              </div>
            </div>
          </div>

          {/* 账号信息（只读） */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">账号信息</span>
              <button
                type="button"
                onClick={() => setShowTokens(!showTokens)}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                {showTokens ? <EyeOff size={12} /> : <Eye size={12} />}
                {showTokens ? '隐藏' : '显示'}
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">来源</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  token.provider === 'Google' ? 'bg-red-50 text-red-600' : 
                  token.provider === 'Github' ? 'bg-gray-100 text-gray-700' : 'bg-blue-50 text-blue-600'
                }`}>
                  {token.provider || '未知'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">订阅类型</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  token.subscription_type?.includes('PRO+') ? 'bg-purple-100 text-purple-700' :
                  token.subscription_type?.includes('PRO') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {token.subscription_type || 'Free'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">添加时间</span>
                <span className="text-gray-700">{token.created_at}</span>
              </div>
            </div>
          </div>

          {/* Token 信息 */}
          {showTokens && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <span className="text-sm font-medium text-gray-700">Token 信息</span>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">AccessToken</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(token.access_token || '', 'access')}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      {copied === 'access' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <div className="text-xs font-mono bg-white px-2 py-1.5 rounded border text-gray-600 break-all">
                    {maskToken(token.access_token)}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">RefreshToken</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(token.refresh_token || '', 'refresh')}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      {copied === 'refresh' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <div className="text-xs font-mono bg-white px-2 py-1.5 rounded border text-gray-600 break-all">
                    {maskToken(token.refresh_token)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 按钮 */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditTokenModal

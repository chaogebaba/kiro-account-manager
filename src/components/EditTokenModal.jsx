import { useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { X, Copy, Check, RefreshCw, Eye, EyeOff, User, CreditCard, Key } from 'lucide-react'

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
    return str.slice(0, 12) + '••••••••' + str.slice(-8)
  }

  const usagePercent = form.quota > 0 ? Math.min(100, (form.used / form.quota) * 100) : 0

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <User size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">编辑账号</h2>
              <p className="text-xs text-gray-500">{token.email}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/80 rounded-full transition-all duration-200 hover:rotate-90"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* 基本信息 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">邮箱地址</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">备注标签</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="可选，用于区分账号"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* 配额卡片 */}
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CreditCard size={18} />
                    <span className="font-medium">配额使用</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                    {refreshing ? '刷新中' : '同步'}
                  </button>
                </div>
                
                <div className="flex items-end gap-1 mb-3">
                  <span className="text-4xl font-bold">{form.used}</span>
                  <span className="text-white/70 mb-1">/ {form.quota}</span>
                </div>
                
                <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-2">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      usagePercent > 80 ? 'bg-red-400' : usagePercent > 50 ? 'bg-yellow-400' : 'bg-green-400'
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                
                <div className="flex justify-between text-xs text-white/70">
                  <span>已使用 {usagePercent.toFixed(0)}%</span>
                  <span>剩余 {form.quota - form.used}</span>
                </div>
              </div>
            </div>

            {/* 配额编辑 */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">总额度</label>
                <input
                  type="number"
                  value={form.quota}
                  onChange={(e) => setForm({ ...form, quota: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-center font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">已使用</label>
                <input
                  type="number"
                  value={form.used}
                  onChange={(e) => setForm({ ...form, used: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-center font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">状态</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-center font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white"
                >
                  <option value="正常">正常</option>
                  <option value="有效">有效</option>
                  <option value="已失效">已失效</option>
                </select>
              </div>
            </div>

            {/* 账号详情 */}
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div 
                className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setShowTokens(!showTokens)}
              >
                <div className="flex items-center gap-2">
                  <Key size={16} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">账号详情</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    token.provider === 'Google' ? 'bg-red-100 text-red-600' : 
                    token.provider === 'Github' ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {token.provider || '未知'}
                  </span>
                  {showTokens ? <EyeOff size={14} className="text-gray-400" /> : <Eye size={14} className="text-gray-400" />}
                </div>
              </div>
              
              {showTokens && (
                <div className="p-4 space-y-3 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">订阅类型</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      token.subscription_type?.includes('PRO+') ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' :
                      token.subscription_type?.includes('PRO') ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {token.subscription_type || 'Free'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">添加时间</span>
                    <span className="text-gray-700 font-medium">{token.created_at}</span>
                  </div>
                  
                  <div className="pt-2 space-y-2">
                    <div className="group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">AccessToken</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(token.access_token || '', 'access')}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copied === 'access' ? 
                            <Check size={14} className="text-green-500" /> : 
                            <Copy size={14} className="text-gray-400 hover:text-gray-600" />
                          }
                        </button>
                      </div>
                      <div className="text-xs font-mono bg-gray-50 px-3 py-2 rounded-lg text-gray-500 break-all select-all">
                        {maskToken(token.access_token)}
                      </div>
                    </div>
                    <div className="group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">RefreshToken</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(token.refresh_token || '', 'refresh')}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copied === 'refresh' ? 
                            <Check size={14} className="text-green-500" /> : 
                            <Copy size={14} className="text-gray-400 hover:text-gray-600" />
                          }
                        </button>
                      </div>
                      <div className="text-xs font-mono bg-gray-50 px-3 py-2 rounded-lg text-gray-500 break-all select-all">
                        {maskToken(token.refresh_token)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-white hover:border-gray-300 transition-all"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-500/25"
            >
              {loading ? '保存中...' : '保存更改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditTokenModal

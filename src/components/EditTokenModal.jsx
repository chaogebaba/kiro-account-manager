import { useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { X, Copy, Check, RefreshCw, User, CreditCard, Key, Clock, ChevronDown, ChevronUp, Shield } from 'lucide-react'

function EditTokenModal({ token, onClose, onSuccess }) {
  const [form, setForm] = useState({
    email: token.email,
    label: token.label,
    quota: token.quota,
    used: token.used,
    status: token.status,
    access_token: token.access_token || '',
    refresh_token: token.refresh_token || '',
  })
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied] = useState(null)
  const [showTokens, setShowTokens] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)

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
        status: form.status,
        accessToken: form.access_token || null,
        refreshToken: form.refresh_token || null,
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
      setForm(prev => ({ ...prev, quota: updated.quota, used: updated.used, status: updated.status }))
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

  const totalQuota = form.quota + (token.free_trial_quota || 0) + (token.bonus_quota || 0)
  const totalUsed = form.used + (token.free_trial_used || 0) + (token.bonus_used || 0)
  const totalPercent = totalQuota > 0 ? Math.min(100, (totalUsed / totalQuota) * 100) : 0

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-50 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${token.provider === 'Google' ? 'bg-red-100' : token.provider === 'Github' ? 'bg-gray-200' : 'bg-blue-100'}`}>
              <User size={24} className={token.provider === 'Google' ? 'text-red-600' : token.provider === 'Github' ? 'text-gray-700' : 'text-blue-600'} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-800">{token.email}</h2>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${token.subscription_type?.includes('PRO+') ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : token.subscription_type?.includes('PRO') ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {token.subscription_type || 'Free'}
                </span>
              </div>
              <p className="text-sm text-gray-500">{token.provider || '未知'} · 添加于 {token.created_at?.split(' ')[0]}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
            <X size={20} className="text-gray-400" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* 配额总览 */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CreditCard size={18} className="text-gray-400" />
                  <span className="font-medium text-gray-700">配额总览</span>
                </div>
                <button type="button" onClick={handleRefresh} disabled={refreshing} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50">
                  <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                  {refreshing ? '同步中...' : '同步配额'}
                </button>
              </div>
              
              <div className="mb-4">
                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <span className="text-3xl font-bold text-gray-800">{totalUsed}</span>
                    <span className="text-gray-400 ml-1">/ {totalQuota}</span>
                  </div>
                  <span className={`text-sm font-medium ${totalPercent > 80 ? 'text-red-500' : totalPercent > 50 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {totalPercent.toFixed(0)}% 已使用
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${totalPercent > 80 ? 'bg-gradient-to-r from-red-400 to-red-500' : totalPercent > 50 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-gradient-to-r from-green-400 to-emerald-500'}`} style={{ width: `${totalPercent}%` }} />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-xs text-gray-500">主配额</span>
                  </div>
                  <div className="text-lg font-semibold text-gray-800">{form.used} / {form.quota}</div>
                  {token.reset_date && <div className="text-xs text-gray-400 mt-1">{token.reset_date} 重置{token.days_until_reset > 0 && ` (${token.days_until_reset}天)`}</div>}
                </div>
                
                <div className={`rounded-lg p-3 ${token.free_trial_quota && token.free_trial_status === 'ACTIVE' ? 'bg-cyan-50' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-2 h-2 rounded-full ${token.free_trial_status === 'ACTIVE' ? 'bg-cyan-500' : 'bg-gray-300'}`}></div>
                    <span className="text-xs text-gray-500">免费试用</span>
                  </div>
                  <div className="text-lg font-semibold text-gray-800">{token.free_trial_quota ? `${token.free_trial_used || 0} / ${token.free_trial_quota}` : '-'}</div>
                  {token.free_trial_expiry && <div className="text-xs text-gray-400 mt-1">{token.free_trial_expiry} 过期</div>}
                </div>
                
                <div className={`rounded-lg p-3 ${token.bonus_quota && token.bonus_status === 'ACTIVE' ? 'bg-purple-50' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-2 h-2 rounded-full ${token.bonus_status === 'ACTIVE' ? 'bg-purple-500' : 'bg-gray-300'}`}></div>
                    <span className="text-xs text-gray-500 truncate">{token.bonus_name || '奖励'}</span>
                  </div>
                  <div className="text-lg font-semibold text-gray-800">{token.bonus_quota ? `${token.bonus_used || 0} / ${token.bonus_quota}` : '-'}</div>
                  {token.bonus_expiry && <div className="text-xs text-gray-400 mt-1">{token.bonus_expiry} 过期</div>}
                </div>
              </div>
            </div>

            {/* 基本信息 */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <User size={18} className="text-gray-400" />
                <span className="font-medium text-gray-700">基本信息</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">邮箱地址</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">备注标签</label>
                  <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="可选" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 cursor-pointer" onClick={() => setShowAdvanced(!showAdvanced)}>
                <span className="text-xs text-gray-400">手动调整配额</span>
                {showAdvanced ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </div>
              
              {showAdvanced && (
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">总额度</label>
                    <input type="number" value={form.quota} onChange={(e) => setForm({ ...form, quota: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20" min={0} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">已使用</label>
                    <input type="number" value={form.used} onChange={(e) => setForm({ ...form, used: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20" min={0} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">状态</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
                      <option value="正常">正常</option>
                      <option value="有效">有效</option>
                      <option value="已失效">已失效</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Token */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setShowTokens(!showTokens)}>
                <div className="flex items-center gap-2">
                  <Key size={18} className="text-gray-400" />
                  <span className="font-medium text-gray-700">Token 凭证</span>
                </div>
                <div className="flex items-center gap-3">
                  {token.expires_at && <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12} />{token.expires_at}</span>}
                  {showTokens ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </div>
              
              {showTokens && (
                <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm pb-4 border-b border-gray-100">
                    <div className="flex justify-between"><span className="text-gray-400">订阅计划</span><span className="text-gray-600 font-mono text-xs">{token.subscription_plan || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">用户 ID</span><span className="text-gray-600 font-mono text-xs truncate max-w-[150px]" title={token.user_id}>{token.user_id?.slice(-12) || '-'}</span></div>
                    {token.overage_capable && (
                      <>
                        <div className="flex justify-between"><span className="text-gray-400">超额费率</span><span className="text-gray-600">${token.overage_rate}/次</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">超额上限</span><span className="text-gray-600">{token.overage_cap}</span></div>
                      </>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-gray-500">Access Token</span>
                        <button type="button" onClick={() => handleCopy(form.access_token, 'access')} className="text-xs text-gray-400 hover:text-blue-500 flex items-center gap-1">
                          {copied === 'access' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                          {copied === 'access' ? '已复制' : '复制'}
                        </button>
                      </div>
                      <textarea value={form.access_token} onChange={(e) => setForm({ ...form, access_token: e.target.value })} placeholder="aoa 开头" className="w-full px-3 py-2 text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg resize-none h-14 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-gray-500">Refresh Token</span>
                        <button type="button" onClick={() => handleCopy(form.refresh_token, 'refresh')} className="text-xs text-gray-400 hover:text-blue-500 flex items-center gap-1">
                          {copied === 'refresh' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                          {copied === 'refresh' ? '已复制' : '复制'}
                        </button>
                      </div>
                      <textarea value={form.refresh_token} onChange={(e) => setForm({ ...form, refresh_token: e.target.value })} placeholder="aor 开头" className="w-full px-3 py-2 text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg resize-none h-14 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center px-6 py-4 bg-white border-t">
            <div className="text-xs text-gray-400">
              {token.status === '正常' ? <span className="flex items-center gap-1 text-green-600"><Shield size={12} />账号正常</span> : <span className="flex items-center gap-1 text-red-500"><Shield size={12} />{token.status}</span>}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-5 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">取消</button>
              <button type="submit" disabled={loading} className="px-5 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2">
                {loading && <RefreshCw size={14} className="animate-spin" />}
                {loading ? '保存中...' : '保存更改'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditTokenModal

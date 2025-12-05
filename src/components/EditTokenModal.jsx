import { useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { X, Copy, Check, RefreshCw, User, CreditCard, Key, Clock, ChevronDown, ChevronUp, Shield } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

function EditTokenModal({ token, onClose, onSuccess }) {
  const { theme, colors } = useTheme()
  const isDark = theme === 'dark'
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
      <div className={`${isDark ? 'bg-[#1a1a2e]' : 'bg-gray-50'} rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 ${colors.card} border-b ${colors.cardBorder}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${token.provider === 'Google' ? (isDark ? 'bg-red-500/20' : 'bg-red-100') : token.provider === 'Github' ? (isDark ? 'bg-gray-600' : 'bg-gray-200') : (isDark ? 'bg-blue-500/20' : 'bg-blue-100')}`}>
              <User size={24} className={token.provider === 'Google' ? (isDark ? 'text-red-400' : 'text-red-600') : token.provider === 'Github' ? (isDark ? 'text-gray-300' : 'text-gray-700') : (isDark ? 'text-blue-400' : 'text-blue-600')} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-lg font-semibold ${colors.text}`}>{token.email}</h2>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${(token.subscription_type?.includes('PRO+') || token.subscription_plan?.includes('PRO+')) ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : (token.subscription_type?.includes('PRO') || token.subscription_plan?.includes('PRO')) ? 'bg-blue-500 text-white' : (isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600')}`}>
                  {token.subscription_plan || token.subscription_type || 'Free'}
                </span>
              </div>
              <p className={`text-sm ${colors.textMuted}`}>{token.provider || '未知'} · 添加于 {token.created_at?.split(' ')[0]}</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} rounded-xl transition-all`}>
            <X size={20} className={colors.textMuted} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* 配额总览 */}
            <div className={`${colors.card} rounded-xl p-5 shadow-sm`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CreditCard size={18} className={colors.textMuted} />
                  <span className={`font-medium ${colors.text}`}>配额总览</span>
                </div>
                <button type="button" onClick={handleRefresh} disabled={refreshing} className={`p-2 ${isDark ? 'bg-blue-500/20 hover:bg-blue-500/30' : 'bg-blue-50 hover:bg-blue-100'} rounded-lg transition-colors disabled:opacity-50`} title="同步配额">
                  <RefreshCw size={16} className={`text-blue-500 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              <div className="mb-4">
                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <span className={`text-3xl font-bold ${colors.text}`}>{totalUsed}</span>
                    <span className={`${colors.textMuted} ml-1`}>/ {totalQuota}</span>
                  </div>
                  <span className={`text-sm font-medium ${totalPercent > 80 ? 'text-red-500' : totalPercent > 50 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {totalPercent.toFixed(0)}% 已使用
                  </span>
                </div>
                <div className={`h-3 ${isDark ? 'bg-white/10' : 'bg-gray-100'} rounded-full overflow-hidden`}>
                  <div className={`h-full rounded-full transition-all duration-500 ${totalPercent > 80 ? 'bg-gradient-to-r from-red-400 to-red-500' : totalPercent > 50 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-gradient-to-r from-green-400 to-emerald-500'}`} style={{ width: `${totalPercent}%` }} />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className={`${isDark ? 'bg-white/5' : 'bg-gray-50'} rounded-lg p-3`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className={`text-xs ${colors.textMuted}`}>主配额</span>
                  </div>
                  <div className={`text-lg font-semibold ${colors.text}`} title={token.used_with_precision != null ? `精确: ${token.used_with_precision} / ${token.quota_with_precision}` : undefined}>{form.used} / {form.quota}</div>
                  {token.reset_date && <div className={`text-xs ${colors.textMuted} mt-1`}>{token.reset_date} 重置{token.days_until_reset > 0 && ` (${token.days_until_reset}天)`}</div>}
                </div>
                
                <div className={`rounded-lg p-3 ${token.free_trial_quota && token.free_trial_status === 'ACTIVE' ? (isDark ? 'bg-cyan-500/20' : 'bg-cyan-50') : (isDark ? 'bg-white/5' : 'bg-gray-50')}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-2 h-2 rounded-full ${token.free_trial_status === 'ACTIVE' ? 'bg-cyan-500' : 'bg-gray-300'}`}></div>
                    <span className={`text-xs ${colors.textMuted}`}>免费试用</span>
                    {token.free_trial_status && <span className={`text-xs ${token.free_trial_status === 'ACTIVE' ? 'text-cyan-500' : colors.textMuted}`}>({token.free_trial_status})</span>}
                  </div>
                  <div className={`text-lg font-semibold ${colors.text}`} title={token.free_trial_used_with_precision != null ? `精确: ${token.free_trial_used_with_precision} / ${token.free_trial_quota_with_precision}` : undefined}>{token.free_trial_quota ? `${token.free_trial_used || 0} / ${token.free_trial_quota}` : '-'}</div>
                  {token.free_trial_expiry && <div className={`text-xs ${colors.textMuted} mt-1`}>{token.free_trial_expiry} 过期</div>}
                </div>
                
                <div className={`rounded-lg p-3 ${token.bonus_quota ? (isDark ? 'bg-purple-500/20' : 'bg-purple-50') : (isDark ? 'bg-white/5' : 'bg-gray-50')}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-2 h-2 rounded-full ${token.bonus_quota ? 'bg-purple-500' : 'bg-gray-300'}`}></div>
                    <span className={`text-xs ${colors.textMuted}`}>奖励总计</span>
                  </div>
                  <div className={`text-lg font-semibold ${colors.text}`}>{token.bonus_quota ? `${token.bonus_used || 0} / ${token.bonus_quota}` : '-'}</div>
                  {token.bonuses?.length > 0 && <div className={`text-xs ${colors.textMuted} mt-1`}>{token.bonuses.length} 个奖励</div>}
                </div>
              </div>
              
              {/* Bonuses 列表 */}
              {token.bonuses?.length > 0 && (
                <div className={`mt-4 pt-4 border-t ${colors.cardBorder}`}>
                  <div className={`text-xs font-medium ${colors.textMuted} mb-2`}>奖励详情</div>
                  <div className="space-y-2">
                    {token.bonuses.map((bonus, idx) => (
                      <div key={idx} className={`flex items-center justify-between p-2.5 rounded-lg ${bonus.status === 'ACTIVE' ? (isDark ? 'bg-purple-500/10' : 'bg-purple-50') : bonus.status === 'EXHAUSTED' ? (isDark ? 'bg-gray-500/10' : 'bg-gray-100') : (isDark ? 'bg-white/5' : 'bg-gray-50')}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${colors.text}`}>{bonus.display_name || bonus.bonus_code}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${bonus.status === 'ACTIVE' ? 'bg-green-500/20 text-green-500' : bonus.status === 'EXHAUSTED' ? 'bg-gray-500/20 text-gray-500' : 'bg-yellow-500/20 text-yellow-600'}`}>{bonus.status}</span>
                          </div>
                          <div className={`text-xs ${colors.textMuted} mt-0.5`}>
                            {bonus.description && <span>{bonus.description} · </span>}
                            {bonus.redeemed_at && <span>兑换: {bonus.redeemed_at} · </span>}
                            {bonus.expires_at && <span>过期: {bonus.expires_at}</span>}
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          <div className={`text-sm font-semibold ${colors.text}`}>{bonus.current_usage || 0} / {bonus.usage_limit || 0}</div>
                          <div className={`text-xs ${colors.textMuted}`}>{bonus.bonus_code}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 基本信息 */}
            <div className={`${colors.card} rounded-xl p-5 shadow-sm`}>
              <div className="flex items-center gap-2 mb-4">
                <User size={18} className={colors.textMuted} />
                <span className={`font-medium ${colors.text}`}>基本信息</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>邮箱地址</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`w-full px-3 py-2 border ${colors.cardBorder} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${colors.input} ${colors.text}`} required />
                </div>
                <div>
                  <label className={`block text-xs font-medium ${colors.textMuted} mb-1.5`}>备注标签</label>
                  <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="可选" className={`w-full px-3 py-2 border ${colors.cardBorder} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${colors.input} ${colors.text}`} />
                </div>
              </div>
              
              <div className={`flex items-center justify-between mt-4 pt-4 border-t ${colors.cardBorder} cursor-pointer`} onClick={() => setShowAdvanced(!showAdvanced)}>
                <span className={`text-xs ${colors.textMuted}`}>手动调整配额</span>
                {showAdvanced ? <ChevronUp size={14} className={colors.textMuted} /> : <ChevronDown size={14} className={colors.textMuted} />}
              </div>
              
              {showAdvanced && (
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className={`block text-xs ${colors.textMuted} mb-1`}>总额度</label>
                    <input type="number" value={form.quota} onChange={(e) => setForm({ ...form, quota: Number(e.target.value) })} className={`w-full px-3 py-2 border ${colors.cardBorder} rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${colors.input} ${colors.text}`} min={0} />
                  </div>
                  <div>
                    <label className={`block text-xs ${colors.textMuted} mb-1`}>已使用</label>
                    <input type="number" value={form.used} onChange={(e) => setForm({ ...form, used: Number(e.target.value) })} className={`w-full px-3 py-2 border ${colors.cardBorder} rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${colors.input} ${colors.text}`} min={0} />
                  </div>
                  <div>
                    <label className={`block text-xs ${colors.textMuted} mb-1`}>状态</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={`w-full px-3 py-2 border ${colors.cardBorder} rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${colors.input} ${colors.text}`}>
                      <option value="正常">正常</option>
                      <option value="有效">有效</option>
                      <option value="已失效">已失效</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Token */}
            <div className={`${colors.card} rounded-xl shadow-sm overflow-hidden`}>
              <div className={`flex items-center justify-between px-5 py-4 cursor-pointer ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'} transition-colors`} onClick={() => setShowTokens(!showTokens)}>
                <div className="flex items-center gap-2">
                  <Key size={18} className={colors.textMuted} />
                  <span className={`font-medium ${colors.text}`}>Token 凭证</span>
                </div>
                <div className="flex items-center gap-3">
                  {token.expires_at && <span className={`text-xs ${colors.textMuted} flex items-center gap-1`}><Clock size={12} />{token.expires_at}</span>}
                  {showTokens ? <ChevronUp size={16} className={colors.textMuted} /> : <ChevronDown size={16} className={colors.textMuted} />}
                </div>
              </div>
              
              {showTokens && (
                <div className={`px-5 pb-5 space-y-4 border-t ${colors.cardBorder} pt-4`}>
                  <div className={`grid grid-cols-2 gap-x-6 gap-y-2 text-sm pb-4 border-b ${colors.cardBorder}`}>
                    <div className="flex justify-between"><span className={colors.textMuted}>订阅计划</span><span className={`${colors.text} font-mono text-xs`}>{token.subscription_plan || '-'}</span></div>
                    <div className="flex justify-between"><span className={colors.textMuted}>订阅类型</span><span className={`${colors.text} font-mono text-xs truncate max-w-[180px]`} title={token.subscription_type}>{token.subscription_type || '-'}</span></div>
                    <div className="flex justify-between"><span className={colors.textMuted}>用户 ID</span><span className={`${colors.text} font-mono text-xs truncate max-w-[150px]`} title={token.user_id}>{token.user_id?.slice(-12) || '-'}</span></div>
                    <div className="flex justify-between"><span className={colors.textMuted}>可升级</span><span className={colors.text}>{token.upgrade_capable ? '是' : '否'}</span></div>
                    {token.overage_capable && (
                      <>
                        <div className="flex justify-between"><span className={colors.textMuted}>超额费率</span><span className={colors.text}>${token.overage_rate}/{token.unit || '次'}</span></div>
                        <div className="flex justify-between"><span className={colors.textMuted}>超额上限</span><span className={colors.text} title={token.overage_cap_with_precision != null ? `精确: ${token.overage_cap_with_precision}` : undefined}>{token.overage_cap}</span></div>
                        {(token.current_overages > 0 || token.current_overages_with_precision > 0) && <div className="flex justify-between"><span className={colors.textMuted}>当前超额</span><span className={colors.text} title={token.current_overages_with_precision != null ? `精确: ${token.current_overages_with_precision}` : undefined}>{token.current_overages}</span></div>}
                        {token.overage_charges > 0 && <div className="flex justify-between"><span className={colors.textMuted}>超额费用</span><span className={colors.text}>${token.overage_charges?.toFixed(2)}</span></div>}
                      </>
                    )}
                    {token.provider === 'BuilderId' && (
                      <>
                        {token.display_name && <div className="flex justify-between"><span className={colors.textMuted}>资源名称</span><span className={colors.text}>{token.display_name}{token.display_name_plural && ` (${token.display_name_plural})`}</span></div>}
                        {token.resource_type && <div className="flex justify-between"><span className={colors.textMuted}>资源类型</span><span className={`${colors.text} font-mono text-xs`}>{token.resource_type}</span></div>}
                        {token.currency && <div className="flex justify-between"><span className={colors.textMuted}>货币</span><span className={colors.text}>{token.currency}</span></div>}
                        {token.overage_status && <div className="flex justify-between"><span className={colors.textMuted}>超额状态</span><span className={`${colors.text} ${token.overage_status === 'ENABLED' ? 'text-green-500' : ''}`}>{token.overage_status}</span></div>}
                        {token.subscription_management_target && <div className="flex justify-between"><span className={colors.textMuted}>订阅管理</span><span className={colors.text}>{token.subscription_management_target}</span></div>}
                      </>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-medium ${colors.textMuted}`}>Access Token</span>
                        <button type="button" onClick={() => handleCopy(form.access_token, 'access')} className={`text-xs ${colors.textMuted} hover:text-blue-500 flex items-center gap-1`}>
                          {copied === 'access' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                          {copied === 'access' ? '已复制' : '复制'}
                        </button>
                      </div>
                      <textarea value={form.access_token} onChange={(e) => setForm({ ...form, access_token: e.target.value })} placeholder={token.provider === 'BuilderId' ? 'aoa 开头' : 'eyJ 开头'} className={`w-full px-3 py-2 text-xs font-mono ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${colors.cardBorder} rounded-lg resize-none h-14 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${colors.text}`} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-medium ${colors.textMuted}`}>Refresh Token</span>
                        <button type="button" onClick={() => handleCopy(form.refresh_token, 'refresh')} className={`text-xs ${colors.textMuted} hover:text-blue-500 flex items-center gap-1`}>
                          {copied === 'refresh' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                          {copied === 'refresh' ? '已复制' : '复制'}
                        </button>
                      </div>
                      <textarea value={form.refresh_token} onChange={(e) => setForm({ ...form, refresh_token: e.target.value })} placeholder={token.provider === 'BuilderId' ? 'aor 开头' : 'refresh token'} className={`w-full px-3 py-2 text-xs font-mono ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${colors.cardBorder} rounded-lg resize-none h-14 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${colors.text}`} />
                    </div>
                    
                    {/* IdC (BuilderId) 专用字段 */}
                    {token.provider === 'BuilderId' && (
                      <div className={`pt-3 border-t ${colors.cardBorder} space-y-3`}>
                        <div className={`text-xs font-medium ${colors.textMuted} flex items-center gap-1`}>
                          <Shield size={12} />
                          AWS SSO OIDC 凭证
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className={`text-xs ${colors.textMuted}`}>Client ID Hash</label>
                            <button type="button" onClick={() => handleCopy(token.client_id_hash, 'client_id_hash')} className={`text-xs ${colors.textMuted} hover:text-blue-500 flex items-center gap-1`}>
                              {copied === 'client_id_hash' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                            </button>
                          </div>
                          <input type="text" value={token.client_id_hash || '-'} readOnly className={`w-full px-3 py-2 text-xs font-mono ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${colors.cardBorder} rounded-lg ${colors.text} opacity-60`} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={`block text-xs ${colors.textMuted} mb-1`}>Region</label>
                            <input type="text" value={token.sso_region || 'us-east-1'} readOnly className={`w-full px-3 py-2 text-xs font-mono ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${colors.cardBorder} rounded-lg ${colors.text} opacity-60`} />
                          </div>
                          <div>
                            <label className={`block text-xs ${colors.textMuted} mb-1`}>Session ID</label>
                            <input type="text" value={token.sso_session_id || '-'} readOnly className={`w-full px-3 py-2 text-xs font-mono ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${colors.cardBorder} rounded-lg ${colors.text} opacity-60 truncate`} />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className={`text-xs ${colors.textMuted}`}>Client ID</label>
                            <button type="button" onClick={() => handleCopy(token.sso_client_id, 'client_id')} className={`text-xs ${colors.textMuted} hover:text-blue-500 flex items-center gap-1`}>
                              {copied === 'client_id' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                            </button>
                          </div>
                          <input type="text" value={token.sso_client_id || ''} readOnly className={`w-full px-3 py-2 text-xs font-mono ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${colors.cardBorder} rounded-lg ${colors.text} opacity-60`} />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className={`text-xs ${colors.textMuted}`}>Client Secret</label>
                            <button type="button" onClick={() => handleCopy(token.sso_client_secret, 'client_secret')} className={`text-xs ${colors.textMuted} hover:text-blue-500 flex items-center gap-1`}>
                              {copied === 'client_secret' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                            </button>
                          </div>
                          <textarea value={token.sso_client_secret || ''} readOnly className={`w-full px-3 py-2 text-xs font-mono ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${colors.cardBorder} rounded-lg resize-none h-14 ${colors.text} opacity-60`} />
                        </div>
                      </div>
                    )}
                    
                    {/* Social 专用字段 */}
                    {(token.provider === 'Google' || token.provider === 'Github') && (
                      <div className={`pt-3 border-t ${colors.cardBorder} space-y-3`}>
                        {token.profile_arn && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className={`text-xs ${colors.textMuted}`}>Profile ARN</label>
                              <button type="button" onClick={() => handleCopy(token.profile_arn, 'profile_arn')} className={`text-xs ${colors.textMuted} hover:text-blue-500 flex items-center gap-1`}>
                                {copied === 'profile_arn' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                              </button>
                            </div>
                            <input type="text" value={token.profile_arn} readOnly className={`w-full px-3 py-2 text-xs font-mono ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${colors.cardBorder} rounded-lg ${colors.text} opacity-60`} />
                          </div>
                        )}
                        {token.csrf_token && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className={`text-xs ${colors.textMuted}`}>CSRF Token</label>
                              <button type="button" onClick={() => handleCopy(token.csrf_token, 'csrf_token')} className={`text-xs ${colors.textMuted} hover:text-blue-500 flex items-center gap-1`}>
                                {copied === 'csrf_token' ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                              </button>
                            </div>
                            <input type="text" value={token.csrf_token} readOnly className={`w-full px-3 py-2 text-xs font-mono ${isDark ? 'bg-white/5' : 'bg-gray-50'} border ${colors.cardBorder} rounded-lg ${colors.text} opacity-60`} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className={`flex justify-between items-center px-6 py-4 ${colors.card} border-t ${colors.cardBorder}`}>
            <div className={`text-xs ${colors.textMuted}`}>
              {token.status === '正常' ? <span className="flex items-center gap-1 text-green-500"><Shield size={12} />账号正常</span> : <span className="flex items-center gap-1 text-red-500"><Shield size={12} />{token.status}</span>}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className={`px-5 py-2 border ${colors.cardBorder} rounded-lg text-sm font-medium ${colors.textMuted} ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>取消</button>
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

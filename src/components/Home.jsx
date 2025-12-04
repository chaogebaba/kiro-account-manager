import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { RefreshCw, Users, Zap, Shield, Clock, TrendingUp, ArrowRight, Sparkles } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

function Home({ onNavigate }) {
  const { theme, colors } = useTheme()
  const [tokens, setTokens] = useState([])
  const [localToken, setLocalToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [tokensData, localData] = await Promise.all([
        invoke('get_tokens'),
        invoke('get_kiro_local_token').catch(() => null)
      ])
      setTokens(tokensData)
      setLocalToken(localData)
    } catch (e) { console.error('Failed to load data:', e) }
    setLoading(false)
  }

  const stats = {
    total: tokens.length,
    active: tokens.filter(t => t.status === '正常' || t.status === '有效').length,
    totalQuota: tokens.reduce((sum, t) => sum + (t.quota || 0), 0),
    totalUsed: tokens.reduce((sum, t) => sum + (t.used || 0), 0),
    proPlus: tokens.filter(t => t.subscription_type?.includes('PRO+')).length,
    pro: tokens.filter(t => t.subscription_type?.includes('PRO') && !t.subscription_type?.includes('PRO+')).length,
  }
  const usagePercent = stats.totalQuota > 0 ? (stats.totalUsed / stats.totalQuota * 100).toFixed(1) : 0

  const isDark = theme === 'dark'

  if (loading) {
    return (
      <div className={`h-full flex items-center justify-center ${colors.main}`}>
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-blue-500" size={32} />
          <span className={colors.textMuted}>加载中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-full overflow-auto ${colors.main}`}>
      <div className="max-w-5xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Sparkles size={24} className="text-white" />
            </div>
            <h1 className={`text-2xl font-bold ${colors.text}`}>Kiro Token Manager</h1>
          </div>
          <p className={colors.textMuted}>管理你的 Kiro IDE 账号，智能切换，配额监控</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className={`${colors.card} rounded-2xl p-5 shadow-sm border ${colors.cardBorder} hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-12 h-12 ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'} rounded-xl flex items-center justify-center`}>
                <Users size={22} className="text-blue-600" />
              </div>
              <span className={`text-3xl font-bold ${colors.text}`}>{stats.total}</span>
            </div>
            <div className={`text-sm ${colors.textMuted}`}>总账号数</div>
          </div>
          
          <div className={`${colors.card} rounded-2xl p-5 shadow-sm border ${colors.cardBorder} hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-12 h-12 ${isDark ? 'bg-green-500/20' : 'bg-green-100'} rounded-xl flex items-center justify-center`}>
                <Shield size={22} className="text-green-600" />
              </div>
              <span className={`text-3xl font-bold ${colors.text}`}>{stats.active}</span>
            </div>
            <div className={`text-sm ${colors.textMuted}`}>正常账号</div>
          </div>
          
          <div className={`${colors.card} rounded-2xl p-5 shadow-sm border ${colors.cardBorder} hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-12 h-12 ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'} rounded-xl flex items-center justify-center`}>
                <Zap size={22} className="text-purple-600" />
              </div>
              <span className={`text-3xl font-bold ${colors.text}`}>{stats.proPlus + stats.pro}</span>
            </div>
            <div className={`text-sm ${colors.textMuted}`}>PRO 账号</div>
          </div>
          
          <div className={`${colors.card} rounded-2xl p-5 shadow-sm border ${colors.cardBorder} hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-12 h-12 ${isDark ? 'bg-orange-500/20' : 'bg-orange-100'} rounded-xl flex items-center justify-center`}>
                <TrendingUp size={22} className="text-orange-600" />
              </div>
              <span className={`text-3xl font-bold ${colors.text}`}>{usagePercent}%</span>
            </div>
            <div className={`text-sm ${colors.textMuted}`}>配额使用率</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* 本地 Kiro 账号 */}
          <div className={`${colors.card} rounded-2xl shadow-sm border ${colors.cardBorder} overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${colors.cardBorder} flex items-center justify-between`}>
              <h2 className={`font-semibold ${colors.text}`}>当前登录账号</h2>
              <button onClick={loadData} className={`p-2 ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} rounded-xl transition-colors`}>
                <RefreshCw size={16} className={colors.textMuted} />
              </button>
            </div>
            <div className="p-6">
              {localToken ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg ${
                      localToken.provider === 'Google' ? 'bg-gradient-to-br from-red-500 to-orange-500 shadow-red-500/25' :
                      localToken.provider === 'Github' ? 'bg-gradient-to-br from-gray-700 to-gray-900 shadow-gray-500/25' :
                      'bg-gradient-to-br from-blue-500 to-purple-600 shadow-blue-500/25'
                    }`}>
                      {localToken.provider?.[0] || 'K'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${colors.text} text-lg`}>{localToken.provider || '未知'}</span>
                        <span className={`px-2.5 py-1 ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'} rounded-full text-xs font-medium`}>已登录</span>
                      </div>
                      <div className={`text-sm ${colors.textMuted} mt-1`}>{localToken.authMethod || 'social'}</div>
                    </div>
                  </div>
                  
                  <div className={`${isDark ? 'bg-white/5' : 'bg-gray-50'} rounded-xl p-4 space-y-3`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className={colors.textMuted}>Access Token</span>
                      <span title={localToken.accessToken} className={`font-mono text-xs ${colors.textMuted} truncate max-w-[180px] cursor-help`}>
                        {localToken.accessToken?.substring(0, 20)}...
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className={colors.textMuted}>Refresh Token</span>
                      <span title={localToken.refreshToken} className={`font-mono text-xs ${colors.textMuted} truncate max-w-[180px] cursor-help`}>
                        {localToken.refreshToken?.substring(0, 20)}...
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className={colors.textMuted}>Profile ARN</span>
                      <span title={localToken.profileArn} className={`font-mono text-xs ${colors.textMuted} truncate max-w-[180px] cursor-help`}>
                        {localToken.profileArn || '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className={colors.textMuted}>过期时间</span>
                      <span className={`${colors.text} flex items-center gap-1`}>
                        <Clock size={12} />
                        {localToken.expiresAt ? new Date(localToken.expiresAt).toLocaleString() : '未知'}
                      </span>
                    </div>
                  </div>
                  

                </div>
              ) : (
                <div className="text-center py-10">
                  <div className={`w-20 h-20 ${isDark ? 'bg-white/10' : 'bg-gray-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <Users size={32} className={colors.textMuted} />
                  </div>
                  <div className={`${colors.textMuted} mb-1 font-medium`}>Kiro IDE 未登录</div>
                  <div className={`text-sm ${colors.textMuted}`}>在账号管理中点击"切换"</div>
                </div>
              )}
            </div>
          </div>

          {/* 配额总览 */}
          <div className={`${colors.card} rounded-2xl shadow-sm border ${colors.cardBorder} overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${colors.cardBorder}`}>
              <h2 className={`font-semibold ${colors.text}`}>配额总览</h2>
            </div>
            <div className="p-6">
              <div className="mb-5">
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <span className={`text-4xl font-bold ${colors.text}`}>{stats.totalUsed}</span>
                    <span className={`${colors.textMuted} ml-2 text-lg`}>/ {stats.totalQuota}</span>
                  </div>
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                    usagePercent > 80 
                      ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600') 
                      : usagePercent > 50 
                        ? (isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700') 
                        : (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600')
                  }`}>
                    {usagePercent}%
                  </span>
                </div>
                <div className={`h-4 ${isDark ? 'bg-white/10' : 'bg-gray-100'} rounded-full overflow-hidden`}>
                  <div 
                    className={`h-full rounded-full transition-all ${
                      usagePercent > 80 ? 'bg-gradient-to-r from-red-400 to-red-500' : 
                      usagePercent > 50 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 
                      'bg-gradient-to-r from-green-400 to-emerald-500'
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className={`${isDark ? 'bg-white/5' : 'bg-gray-50'} rounded-xl p-4 text-center`}>
                  <div className={`text-2xl font-bold ${colors.text}`}>{stats.totalQuota - stats.totalUsed}</div>
                  <div className={`text-xs ${colors.textMuted} mt-1`}>剩余配额</div>
                </div>
                <div className={`${isDark ? 'bg-purple-500/20' : 'bg-purple-50'} rounded-xl p-4 text-center`}>
                  <div className="text-2xl font-bold text-purple-500">{stats.proPlus}</div>
                  <div className="text-xs text-purple-500 mt-1">PRO+</div>
                </div>
                <div className={`${isDark ? 'bg-blue-500/20' : 'bg-blue-50'} rounded-xl p-4 text-center`}>
                  <div className="text-2xl font-bold text-blue-500">{stats.pro}</div>
                  <div className="text-xs text-blue-500 mt-1">PRO</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 最近账号 */}
        <div className={`${colors.card} rounded-2xl shadow-sm border ${colors.cardBorder} overflow-hidden mt-6`}>
          <div className={`px-6 py-4 border-b ${colors.cardBorder} flex items-center justify-between`}>
            <h2 className={`font-semibold ${colors.text}`}>最近账号</h2>
            <button onClick={() => onNavigate?.('token')} className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1 font-medium">
              查看全部 <ArrowRight size={14} />
            </button>
          </div>
          <div className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-100'}`}>
            {tokens.length === 0 ? (
              <div className={`text-center py-16 ${colors.textMuted}`}>
                <Users size={48} className="mx-auto mb-4 opacity-50" />
                <div className="font-medium">暂无账号</div>
                <div className="text-sm mt-1">点击添加按钮开始</div>
              </div>
            ) : tokens.slice(0, 5).map(token => {
              const percent = token.quota > 0 ? (token.used / token.quota * 100) : 0
              return (
                <div key={token.id} className={`flex items-center gap-4 px-6 py-4 ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'} transition-colors`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-semibold ${
                    token.provider === 'Google' ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600') :
                    token.provider === 'Github' ? (isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700') : 
                    (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600')
                  }`}>
                    {token.email?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${colors.text} truncate`}>{token.email}</span>
                      {token.subscription_type?.includes('PRO') && (
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                          token.subscription_type.includes('PRO+') ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-blue-500 text-white'
                        }`}>
                          {token.subscription_type.includes('PRO+') ? 'PRO+' : 'PRO'}
                        </span>
                      )}
                    </div>
                    <div className={`text-xs ${colors.textMuted} mt-0.5`}>{token.provider} · {token.label || '无标签'}</div>
                  </div>
                  <div className="w-28">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className={`${colors.textMuted} font-medium`}>{token.used}/{token.quota}</span>
                      <span className={`font-semibold ${percent > 80 ? 'text-red-500' : percent > 50 ? 'text-yellow-500' : 'text-green-500'}`}>{Math.round(percent)}%</span>
                    </div>
                    <div className={`h-2 ${isDark ? 'bg-white/10' : 'bg-gray-100'} rounded-full overflow-hidden`}>
                      <div className={`h-full rounded-full ${percent > 80 ? 'bg-red-500' : percent > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <span className={`px-3 py-1.5 rounded-xl text-xs font-medium ${
                    token.status === '正常' || token.status === '有效' 
                      ? (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700') 
                      : (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600')
                  }`}>
                    {token.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home

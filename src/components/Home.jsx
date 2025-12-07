import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { RefreshCw, Users, Zap, Shield, Clock, TrendingUp, ArrowRight, Sparkles, Play, RotateCcw } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useDialog } from '../contexts/DialogContext'
import { calcAccountStats, getQuota, getUsed, getSubType, getSubPlan } from '../utils/accountStats'

// 骨架屏组件
function Skeleton({ className }) {
  return <div className={`skeleton ${className}`} />
}

// 骨架屏加载状态
function LoadingSkeleton({ isDark, colors }) {
  return (
    <div className={`h-full overflow-auto ${colors.main}`}>
      {/* 背景装饰 */}
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />
      
      <div className="max-w-5xl mx-auto p-8 relative">
        {/* Header 骨架 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <Skeleton className="w-64 h-8 rounded-lg" />
          </div>
          <Skeleton className="w-80 h-5 rounded-lg mt-3" />
        </div>

        {/* 统计卡片骨架 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${colors.card} rounded-2xl p-5 border ${colors.cardBorder}`}>
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <Skeleton className="w-12 h-10 rounded-lg" />
              </div>
              <Skeleton className="w-20 h-4 rounded" />
            </div>
          ))}
        </div>

        {/* 主内容骨架 */}
        <div className="grid grid-cols-2 gap-6">
          <div className={`${colors.card} rounded-2xl border ${colors.cardBorder} overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${colors.cardBorder}`}>
              <Skeleton className="w-32 h-5 rounded" />
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-16 h-16 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="w-24 h-5 rounded" />
                  <Skeleton className="w-16 h-4 rounded" />
                </div>
              </div>
              <Skeleton className="w-full h-24 rounded-xl" />
            </div>
          </div>
          
          <div className={`${colors.card} rounded-2xl border ${colors.cardBorder} overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${colors.cardBorder}`}>
              <Skeleton className="w-24 h-5 rounded" />
            </div>
            <div className="p-6 space-y-4">
              <Skeleton className="w-full h-16 rounded-xl" />
              <div className="grid grid-cols-3 gap-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 统计卡片组件
function StatCard({ icon: Icon, iconBg, value, label, delay, isDark }) {
  return (
    <div 
      className={`card-glow rounded-2xl p-5 shadow-sm border animate-scale-in ${delay}`}
      style={{ 
        background: isDark ? 'rgba(30, 30, 50, 0.8)' : 'white',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center transition-transform hover:scale-110`}>
          <Icon size={22} className={isDark ? 'text-current' : ''} />
        </div>
        <span className={`text-3xl font-bold stat-number ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</span>
      </div>
      <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</div>
    </div>
  )
}

function Home({ onNavigate }) {
  const { theme, colors } = useTheme()
  const { showError } = useDialog()
  const [tokens, setTokens] = useState([])
  const [localToken, setLocalToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [tokensData, localData] = await Promise.all([
        invoke('get_accounts'),
        invoke('get_kiro_local_token').catch(() => null)
      ])
      setTokens(tokensData)
      setLocalToken(localData)
    } catch (e) { 
      console.error('Failed to load data:', e)
      showError('加载失败', '加载数据失败: ' + e)
    }
    setLoading(false)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setTimeout(() => setRefreshing(false), 500)
  }

  const stats = calcAccountStats(tokens)
  const isDark = theme === 'dark'

  if (loading) {
    return <LoadingSkeleton isDark={isDark} colors={colors} />
  }

  const statCards = [
    { icon: Users, iconBg: isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600', value: stats.total, label: '总账号数', delay: 'delay-100' },
    { icon: Shield, iconBg: isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600', value: stats.active, label: '正常账号', delay: 'delay-200' },
    { icon: Zap, iconBg: isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600', value: stats.proPlus + stats.pro, label: 'PRO 账号', delay: 'delay-300' },
    { icon: TrendingUp, iconBg: isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600', value: `${stats.usagePercent}%`, label: '配额使用率', delay: 'delay-400' },
  ]

  return (
    <div className={`h-full overflow-auto ${colors.main}`}>
      {/* 背景装饰光晕 */}
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />
      
      <div className="max-w-5xl mx-auto p-8 relative">
        {/* Header */}
        <div className="mb-8 animate-bounce-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25 animate-float">
              <Sparkles size={24} className="text-white" />
            </div>
            <h1 className={`text-2xl font-bold ${colors.text}`}>Kiro Account Manager</h1>
          </div>
          <p className={colors.textMuted}>管理你的 Kiro IDE 账号，智能切换，配额监控</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {statCards.map((card, index) => (
            <StatCard key={index} {...card} isDark={isDark} />
          ))}
        </div>

        {/* 快捷操作区 */}
        <div className={`mb-6 animate-blur-in delay-500`}>
          <div className={`${colors.card} rounded-2xl p-4 border ${colors.cardBorder} flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <span className={`font-medium ${colors.text}`}>快捷操作</span>
              <span className={`text-sm ${colors.textMuted}`}>一键管理所有账号</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate?.('token')}
                className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all
                  ${isDark ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
              >
                <Play size={14} />
                切换账号
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className={`btn-icon px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all
                  ${refreshing ? 'spinning' : ''}
                  ${isDark ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-600 hover:bg-purple-200'}`}
              >
                <RotateCcw size={14} className={refreshing ? 'animate-spin' : ''} />
                刷新配额
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* 本地 Kiro 账号 */}
          <div className={`card-glow ${colors.card} rounded-2xl shadow-sm border ${colors.cardBorder} overflow-hidden animate-scale-in delay-300`}>
            <div className={`px-6 py-4 border-b ${colors.cardBorder} flex items-center justify-between`}>
              <h2 className={`font-semibold ${colors.text}`}>当前登录账号</h2>
              <button 
                onClick={handleRefresh} 
                className={`btn-icon p-2 ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} rounded-xl ${refreshing ? 'spinning' : ''}`}
              >
                <RefreshCw size={16} className={`${colors.textMuted} ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="p-6">
              {localToken ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg transition-transform hover:scale-105 ${
                      localToken.provider === 'Google' ? 'bg-gradient-to-br from-red-500 to-orange-500 shadow-red-500/25' :
                      localToken.provider === 'Github' ? 'bg-gradient-to-br from-gray-700 to-gray-900 shadow-gray-500/25' :
                      'bg-gradient-to-br from-blue-500 to-purple-600 shadow-blue-500/25'
                    }`}>
                      {localToken.provider?.[0] || 'K'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${colors.text} text-lg`}>{localToken.provider || '未知'}</span>
                        <span className={`px-2.5 py-1 ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'} rounded-full text-xs font-medium pulse-ring`}>已登录</span>
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
                    {localToken.authMethod === 'IdC' ? (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className={colors.textMuted}>Client ID Hash</span>
                          <span title={localToken.clientIdHash} className={`font-mono text-xs ${colors.textMuted} truncate max-w-[180px] cursor-help`}>
                            {localToken.clientIdHash || '-'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className={colors.textMuted}>Region</span>
                          <span className={`font-mono text-xs ${colors.textMuted}`}>
                            {localToken.region || '-'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between text-sm">
                        <span className={colors.textMuted}>Profile ARN</span>
                        <span title={localToken.profileArn} className={`font-mono text-xs ${colors.textMuted} truncate max-w-[180px] cursor-help`}>
                          {localToken.profileArn || '-'}
                        </span>
                      </div>
                    )}
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
                  <div className={`w-20 h-20 ${isDark ? 'bg-white/10' : 'bg-gray-100'} rounded-full flex items-center justify-center mx-auto mb-4 animate-float`}>
                    <Users size={32} className={colors.textMuted} />
                  </div>
                  <div className={`${colors.textMuted} mb-1 font-medium`}>Kiro IDE 未登录</div>
                  <div className={`text-sm ${colors.textMuted}`}>在账号管理中点击"切换"</div>
                </div>
              )}
            </div>
          </div>

          {/* 配额总览 */}
          <div className={`card-glow ${colors.card} rounded-2xl shadow-sm border ${colors.cardBorder} overflow-hidden animate-scale-in delay-400`}>
            <div className={`px-6 py-4 border-b ${colors.cardBorder}`}>
              <h2 className={`font-semibold ${colors.text}`}>配额总览</h2>
            </div>
            <div className="p-6">
              <div className="mb-5">
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <span className={`text-4xl font-bold stat-number ${colors.text}`}>{stats.totalUsed}</span>
                    <span className={`${colors.textMuted} ml-2 text-lg`}>/ {stats.totalQuota}</span>
                  </div>
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full transition-all ${
                    stats.usagePercent > 80 
                      ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600') 
                      : stats.usagePercent > 50 
                        ? (isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700') 
                        : (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600')
                  }`}>
                    {stats.usagePercent}%
                  </span>
                </div>
                <div className={`h-4 ${isDark ? 'bg-white/10' : 'bg-gray-100'} rounded-full overflow-hidden`}>
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      stats.usagePercent > 80 ? 'bg-gradient-to-r from-red-400 to-red-500' : 
                      stats.usagePercent > 50 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 
                      'bg-gradient-to-r from-green-400 to-emerald-500'
                    }`}
                    style={{ width: `${stats.usagePercent}%` }}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className={`${isDark ? 'bg-white/5' : 'bg-gray-50'} rounded-xl p-4 text-center transition-transform hover:scale-105`}>
                  <div className={`text-2xl font-bold stat-number ${colors.text}`}>{stats.totalQuota - stats.totalUsed}</div>
                  <div className={`text-xs ${colors.textMuted} mt-1`}>剩余配额</div>
                </div>
                <div className={`${isDark ? 'bg-purple-500/20' : 'bg-purple-50'} rounded-xl p-4 text-center transition-transform hover:scale-105`}>
                  <div className="text-2xl font-bold text-purple-500 stat-number">{stats.proPlus}</div>
                  <div className="text-xs text-purple-500 mt-1">PRO+</div>
                </div>
                <div className={`${isDark ? 'bg-blue-500/20' : 'bg-blue-50'} rounded-xl p-4 text-center transition-transform hover:scale-105`}>
                  <div className="text-2xl font-bold text-blue-500 stat-number">{stats.pro}</div>
                  <div className="text-xs text-blue-500 mt-1">PRO</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 最近账号 */}
        <div className={`card-glow ${colors.card} rounded-2xl shadow-sm border ${colors.cardBorder} overflow-hidden mt-6 animate-slide-up delay-500`}>
          <div className={`px-6 py-4 border-b ${colors.cardBorder} flex items-center justify-between`}>
            <h2 className={`font-semibold ${colors.text}`}>最近账号</h2>
            <button onClick={() => onNavigate?.('token')} className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1 font-medium group">
              查看全部 <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </button>
          </div>
          <div className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-100'}`}>
            {tokens.length === 0 ? (
              <div className={`text-center py-16 ${colors.textMuted}`}>
                <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center animate-float"
                  style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
                  <Users size={32} className="opacity-50" />
                </div>
                <div className="font-medium">暂无账号</div>
                <div className="text-sm mt-1">点击添加按钮开始</div>
                <button
                  onClick={() => onNavigate?.('token')}
                  className={`mt-4 px-6 py-2 rounded-xl text-sm font-medium transition-all
                    ${isDark ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                >
                  添加账号
                </button>
              </div>
            ) : tokens.slice(0, 5).map((token, index) => {
              const quota = getQuota(token)
              const used = getUsed(token)
              const percent = quota > 0 ? (used / quota * 100) : 0
              const subType = getSubType(token)
              const subPlan = getSubPlan(token)
              const isPro = subType.includes('PRO') || subPlan.includes('PRO')
              const isProPlus = subType.includes('PRO+') || subPlan.includes('PRO+')
              return (
                <div 
                  key={token.id} 
                  className={`flex items-center gap-4 px-6 py-4 transition-all cursor-pointer
                    ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}
                    animate-slide-in-left`}
                  style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                  onClick={() => onNavigate?.('token')}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-semibold transition-transform hover:scale-110 ${
                    token.provider === 'Google' ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600') :
                    token.provider === 'Github' ? (isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700') : 
                    (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600')
                  }`}>
                    {token.email?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${colors.text} truncate`}>{token.email}</span>
                      {isPro && (
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                          isProPlus ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-blue-500 text-white'
                        }`}>
                          {isProPlus ? 'PRO+' : 'PRO'}
                        </span>
                      )}
                    </div>
                    <div className={`text-xs ${colors.textMuted} mt-0.5`}>{token.provider} · {token.label || '无标签'}</div>
                  </div>
                  <div className="w-28">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className={`${colors.textMuted} font-medium`}>{used}/{quota}</span>
                      <span className={`font-semibold ${percent > 80 ? 'text-red-500' : percent > 50 ? 'text-yellow-500' : 'text-green-500'}`}>{Math.round(percent)}%</span>
                    </div>
                    <div className={`h-2 ${isDark ? 'bg-white/10' : 'bg-gray-100'} rounded-full overflow-hidden`}>
                      <div className={`h-full rounded-full transition-all ${percent > 80 ? 'bg-red-500' : percent > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${percent}%` }} />
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

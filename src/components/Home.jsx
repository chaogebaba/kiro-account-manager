import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { Users, CheckCircle, XCircle, TrendingUp, RefreshCw } from 'lucide-react'

function Home() {
  const [tokens, setTokens] = useState([])
  const [localToken, setLocalToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [tokensData, localData] = await Promise.all([
        invoke('get_tokens'),
        invoke('get_kiro_local_token').catch(() => null)
      ])
      setTokens(tokensData)
      setLocalToken(localData)
    } catch (e) {
      console.error('Failed to load data:', e)
    }
    setLoading(false)
  }

  const stats = {
    total: tokens.length,
    active: tokens.filter(t => t.status === '正常' || t.status === '有效').length,
    expired: tokens.filter(t => t.status === '已失效').length,
    totalQuota: tokens.reduce((sum, t) => sum + t.quota, 0),
    totalUsed: tokens.reduce((sum, t) => sum + t.used, 0),
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <RefreshCw className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  return (
    <div className="h-full p-6 overflow-auto bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">欢迎使用 Kiro Token Manager</h1>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users size={20} className="text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
                <div className="text-xs text-gray-500">总账号数</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle size={20} className="text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{stats.active}</div>
                <div className="text-xs text-gray-500">正常账号</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <XCircle size={20} className="text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{stats.expired}</div>
                <div className="text-xs text-gray-500">已失效</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <TrendingUp size={20} className="text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{stats.totalUsed}/{stats.totalQuota}</div>
                <div className="text-xs text-gray-500">总配额使用</div>
              </div>
            </div>
          </div>
        </div>

        {/* 当前 Kiro IDE 账号 */}
        <div className="bg-white rounded-xl p-5 shadow-sm border mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">当前 Kiro IDE 登录状态</h2>
          {localToken ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                  {localToken.provider?.[0] || 'K'}
                </div>
                <div className="flex-1">
                  <div className="text-lg font-medium text-gray-800">{localToken.provider || '未知'} 账号</div>
                  <div className="text-sm text-gray-500">认证方式: {localToken.authMethod || 'social'}</div>
                </div>
                <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  已登录
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Access Token</div>
                  <div className="text-sm font-mono text-gray-700 truncate bg-gray-50 px-2 py-1 rounded">
                    {localToken.accessToken ? localToken.accessToken.substring(0, 30) + '...' : '无'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">过期时间</div>
                  <div className="text-sm text-gray-700">
                    {localToken.expiresAt ? new Date(localToken.expiresAt).toLocaleString() : '未知'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <div className="mb-2">Kiro IDE 未登录</div>
              <div className="text-sm">请在账号管理中添加账号并点击"切号"</div>
            </div>
          )}
        </div>

        {/* 最近账号 */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">最近添加的账号</h2>
            <button onClick={loadData} className="text-sm text-blue-600 hover:text-blue-700">
              刷新
            </button>
          </div>
          {tokens.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              暂无账号，点击左侧"添加账号"按钮添加
            </div>
          ) : (
            <div className="space-y-3">
              {tokens.slice(0, 5).map(token => (
                <div key={token.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm">
                    {token.email?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{token.email}</div>
                    <div className="text-xs text-gray-500">{token.label}</div>
                  </div>
                  <div className="text-xs text-gray-500">{token.used}/{token.quota}</div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    token.status === '正常' || token.status === '有效' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-600'
                  }`}>
                    {token.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Home

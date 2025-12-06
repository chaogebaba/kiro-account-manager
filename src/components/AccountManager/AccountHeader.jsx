import { Search, Download, RefreshCw, Trash2, Plus, Users, Zap, Shield } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

function AccountHeader({
  stats,
  searchTerm,
  onSearchChange,
  selectedCount,
  onBatchDelete,
  onAdd,
  onExport,
  onRefreshAll,
  autoRefreshing,
  lastRefreshTime,
  refreshProgress,
}) {
  const { theme, colors } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className={`${colors.card} border-b ${colors.cardBorder} px-6 py-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <h1 className={`text-xl font-bold ${colors.text}`}>账号管理</h1>
            <p className={`text-sm ${colors.textMuted} mt-0.5`}>管理你的 Kiro 账号和配额</p>
          </div>
          <div className="flex gap-3 ml-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 ${isDark ? 'bg-blue-500/20' : 'bg-blue-50'} rounded-xl`}>
              <Users size={16} className="text-blue-500" />
              <span className={`text-sm font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{stats.total} 账号</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 ${isDark ? 'bg-green-500/20' : 'bg-green-50'} rounded-xl`}>
              <Shield size={16} className="text-green-500" />
              <span className={`text-sm font-medium ${isDark ? 'text-green-300' : 'text-green-700'}`}>{stats.active} 正常</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 ${isDark ? 'bg-purple-500/20' : 'bg-purple-50'} rounded-xl`}>
              <Zap size={16} className="text-purple-500" />
              <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{stats.totalUsed}/{stats.totalQuota}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshTime && !autoRefreshing && (
            <span className={`text-xs ${colors.textMuted}`}>上次刷新: {lastRefreshTime}</span>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="搜索..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className={`pl-9 pr-4 py-2 ${isDark ? 'bg-white/5' : 'bg-gray-50'} border-0 rounded-xl text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${colors.text}`}
            />
          </div>
          {selectedCount > 0 && (
            <button onClick={onBatchDelete} className="px-3 py-2 bg-red-500 text-white rounded-xl text-sm hover:bg-red-600 flex items-center gap-1">
              <Trash2 size={14} />删除 ({selectedCount})
            </button>
          )}
          <button onClick={onAdd} className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 flex items-center gap-1.5 shadow-sm">
            <Plus size={16} />添加
          </button>
          <button onClick={onExport} className={`p-2 ${colors.card} border ${colors.cardBorder} rounded-xl ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`} title="导出">
            <Download size={18} className={colors.textMuted} />
          </button>
          <button onClick={onRefreshAll} disabled={autoRefreshing} className={`p-2 ${colors.card} border ${colors.cardBorder} rounded-xl ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'} disabled:opacity-50`} title="刷新全部">
            <RefreshCw size={18} className={`${colors.textMuted} ${autoRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      {autoRefreshing && refreshProgress.total > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(refreshProgress.current / refreshProgress.total) * 100}%` }} />
          </div>
          <span className="text-xs text-blue-600 font-medium">{refreshProgress.current}/{refreshProgress.total}</span>
        </div>
      )}
    </div>
  )
}

export default AccountHeader

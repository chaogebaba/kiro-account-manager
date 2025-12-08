import { Search, Download, Upload, RefreshCw, Trash2, Plus, Users, Zap, Shield, Sparkles } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

function AccountHeader({
  stats,
  searchTerm,
  onSearchChange,
  selectedCount,
  onBatchDelete,
  onAdd,
  onImport,
  onExport,
  onRefreshAll,
  autoRefreshing,
  lastRefreshTime,
  refreshProgress,
}) {
  const { theme, colors } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className={`${colors.card} border-b ${colors.cardBorder} px-6 py-4 relative overflow-hidden`}>
      {/* 背景装饰 */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      
      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-6">
          <div className="animate-slide-in-right">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 animate-float">
                <Sparkles size={20} className="text-white" />
              </div>
              <h1 className={`text-xl font-bold ${colors.text}`}>账号管理</h1>
            </div>
            <p className={`text-sm ${colors.textMuted}`}>管理你的 Kiro 账号和配额</p>
          </div>
          <div className="flex gap-3 ml-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 ${isDark ? 'bg-blue-500/20' : 'bg-blue-50'} rounded-xl animate-scale-in delay-100 transition-transform hover:scale-105`}>
              <Users size={16} className="text-blue-500" />
              <span className={`text-sm font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{stats.total} 账号</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 ${isDark ? 'bg-green-500/20' : 'bg-green-50'} rounded-xl animate-scale-in delay-200 transition-transform hover:scale-105`}>
              <Shield size={16} className="text-green-500" />
              <span className={`text-sm font-medium ${isDark ? 'text-green-300' : 'text-green-700'}`}>{stats.active} 正常</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 ${isDark ? 'bg-purple-500/20' : 'bg-purple-50'} rounded-xl animate-scale-in delay-300 transition-transform hover:scale-105`}>
              <Zap size={16} className="text-purple-500" />
              <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{stats.totalUsed}/{stats.totalQuota}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 animate-fade-in delay-400">
          {lastRefreshTime && !autoRefreshing && (
            <span className={`text-xs ${colors.textMuted}`}>上次刷新: {lastRefreshTime}</span>
          )}
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-500" size={16} />
            <input
              type="text"
              placeholder="搜索..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className={`pl-9 pr-4 py-2 ${isDark ? 'bg-white/5' : 'bg-gray-50'} border-0 rounded-xl text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${colors.text} transition-all focus:w-56`}
            />
          </div>
          {selectedCount > 0 && (
            <button 
              onClick={onBatchDelete} 
              className="btn-icon px-3 py-2 bg-red-500 text-white rounded-xl text-sm hover:bg-red-600 flex items-center gap-1 animate-scale-in"
            >
              <Trash2 size={14} />删除 ({selectedCount})
            </button>
          )}
          <button 
            onClick={onAdd} 
            className="btn-icon px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-blue-700 flex items-center gap-1.5 shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40"
          >
            <Plus size={16} />添加
          </button>
          <button 
            onClick={onImport} 
            className={`btn-icon px-3 py-2 ${colors.card} border ${colors.cardBorder} rounded-xl ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'} transition-all flex items-center gap-1.5`} 
            title="导入"
          >
            <Upload size={16} className={colors.textMuted} />
            <span className={`text-sm ${colors.textMuted}`}>导入</span>
          </button>
          <button 
            onClick={onExport} 
            className={`btn-icon px-3 py-2 ${colors.card} border ${colors.cardBorder} rounded-xl ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'} transition-all flex items-center gap-1.5`} 
            title="导出"
          >
            <Download size={16} className={colors.textMuted} />
            <span className={`text-sm ${colors.textMuted}`}>导出</span>
          </button>
          <button 
            onClick={onRefreshAll} 
            disabled={autoRefreshing} 
            className={`btn-icon p-2 ${colors.card} border ${colors.cardBorder} rounded-xl ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'} disabled:opacity-50 transition-all`} 
            title="刷新全部"
          >
            <RefreshCw size={18} className={`${colors.textMuted} ${autoRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      {autoRefreshing && refreshProgress.total > 0 && (
        <div className="mt-3 flex items-center gap-3 animate-fade-in">
          <div className={`flex-1 h-1.5 ${isDark ? 'bg-white/10' : 'bg-gray-200'} rounded-full overflow-hidden`}>
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300" 
              style={{ width: `${(refreshProgress.current / refreshProgress.total) * 100}%` }} 
            />
          </div>
          <span className="text-xs text-blue-600 font-medium">{refreshProgress.current}/{refreshProgress.total}</span>
        </div>
      )}
    </div>
  )
}

export default AccountHeader

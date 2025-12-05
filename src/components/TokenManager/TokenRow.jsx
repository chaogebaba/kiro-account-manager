import { RefreshCw, Edit2, Trash2, Copy, Check, Clock, Repeat } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { getUsagePercent, getProgressBarColor } from './hooks/useTokenStats'

function TokenRow({
  token,
  isSelected,
  onSelect,
  copiedId,
  onCopy,
  onSwitch,
  onRefresh,
  onEdit,
  onDelete,
  refreshingId,
  switchingId,
}) {
  const { theme, colors } = useTheme()
  const isDark = theme === 'dark'
  const percent = getUsagePercent(token.used, token.quota)
  const isExpired = token.expires_at && new Date(token.expires_at.replace(/\//g, '-')) < new Date()

  return (
    <tr className={`${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50/50'} transition-colors group`}>
      <td className="px-4 py-3">
        <input type="checkbox" checked={isSelected} onChange={(e) => onSelect(e.target.checked)} className="rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-medium shadow-sm ${
            token.provider === 'Google' ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600') :
            token.provider === 'Github' ? (isDark ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700') :
            (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600')
          }`}>
            {token.email[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-medium ${colors.text} text-sm`}>{token.email}</span>
              <button onClick={() => onCopy(token.email, token.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                {copiedId === token.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-400" />}
              </button>
            </div>
            <div className={`text-xs ${colors.textMuted}`}>{token.provider || '未知'} · {token.label || '无标签'}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium ${
          (token.subscription_type?.includes('PRO+') || token.subscription_plan?.includes('PRO+'))
            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm'
            : (token.subscription_type?.includes('PRO') || token.subscription_plan?.includes('PRO'))
              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm'
              : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
        }`}>
          {token.subscription_plan || token.subscription_type || 'Free'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{token.used}/{token.quota}</span>
              <span className={`${isDark ? 'text-gray-500' : 'text-gray-400'}`}>剩余 {token.quota - token.used}</span>
            </div>
            <span className={`font-semibold ${percent > 80 ? 'text-red-500' : percent > 50 ? 'text-yellow-500' : 'text-green-500'}`}>{Math.round(percent)}%</span>
          </div>
          <div className={`h-2 ${isDark ? 'bg-white/10' : 'bg-gray-100'} rounded-full overflow-hidden`}>
            <div className={`h-full rounded-full transition-all ${getProgressBarColor(percent)}`} style={{ width: `${percent}%` }} />
          </div>
          {token.reset_date && (
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {token.reset_date} 重置{token.days_until_reset > 0 && <span className="ml-1">({token.days_until_reset}天后)</span>}
            </div>
          )}
          {/* 试用和奖励配额 */}
          {(token.free_trial_quota || token.bonuses?.length > 0 || token.bonus_quota) && (
            <div className="flex flex-col gap-1 pt-0.5">
              {token.free_trial_quota && (
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full w-fit ${
                  token.free_trial_status === 'ACTIVE'
                    ? (isDark ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-cyan-50 text-cyan-600 border border-cyan-200')
                    : (isDark ? 'bg-gray-700/50 text-gray-500' : 'bg-gray-100 text-gray-400')
                }`} title={`过期: ${token.free_trial_expiry || '未知'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${token.free_trial_status === 'ACTIVE' ? 'bg-cyan-500' : 'bg-gray-400'}`}></span>
                  试用 {token.free_trial_used || 0}/{token.free_trial_quota}
                </span>
              )}
              {token.bonuses?.length > 0 ? (
                token.bonuses.map((bonus, idx) => (
                  <span key={idx} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full w-fit ${
                    bonus.status === 'ACTIVE'
                      ? (isDark ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-purple-50 text-purple-600 border border-purple-200')
                      : (isDark ? 'bg-gray-700/50 text-gray-500' : 'bg-gray-100 text-gray-400')
                  }`} title={`${bonus.description || bonus.bonus_code} 过期: ${bonus.expires_at || '未知'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${bonus.status === 'ACTIVE' ? 'bg-purple-500' : 'bg-gray-400'}`}></span>
                    {bonus.display_name || '奖励'} {bonus.current_usage || 0}/{bonus.usage_limit || 0}
                  </span>
                ))
              ) : token.bonus_quota && (
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full w-fit ${
                  token.bonus_status === 'ACTIVE'
                    ? (isDark ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-purple-50 text-purple-600 border border-purple-200')
                    : (isDark ? 'bg-gray-700/50 text-gray-500' : 'bg-gray-100 text-gray-400')
                }`} title={`${token.bonus_name || '奖励'} 过期: ${token.bonus_expiry || '未知'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${token.bonus_status === 'ACTIVE' ? 'bg-purple-500' : 'bg-gray-400'}`}></span>
                  {token.bonus_name || '奖励'} {token.bonus_used || 0}/{token.bonus_quota}
                </span>
              )}
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium ${
          token.status === '正常' || token.status === '有效'
            ? (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700')
            : (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600')
        }`}>{token.status}</span>
      </td>
      <td className="px-4 py-3">
        {token.expires_at ? (
          <div className={`text-xs ${isExpired ? 'text-red-500' : colors.textMuted}`}>
            <div className="flex items-center gap-1"><Clock size={12} />{token.expires_at.split(' ')[1]}</div>
            <div className={`${isDark ? 'text-gray-500' : 'text-gray-400'} mt-0.5`}>{token.expires_at.split(' ')[0]}</div>
          </div>
        ) : <span className={`text-xs ${colors.textMuted}`}>-</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => onSwitch(token)} disabled={switchingId === token.id} className={`p-1.5 ${isDark ? 'bg-blue-500/20 hover:bg-blue-500/30' : 'bg-blue-50 hover:bg-blue-100'} rounded-lg disabled:opacity-50`} title="切换账号">
            <Repeat size={14} className={`text-blue-500 ${switchingId === token.id ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => onRefresh(token.id)} disabled={refreshingId === token.id} className={`p-1.5 ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} rounded-lg`} title="刷新">
            <RefreshCw size={14} className={`${colors.textMuted} ${refreshingId === token.id ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => onEdit(token)} className={`p-1.5 ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} rounded-lg`} title="编辑">
            <Edit2 size={14} className={colors.textMuted} />
          </button>
          <button onClick={() => onDelete(token.id)} className={`p-1.5 ${isDark ? 'hover:bg-red-500/20' : 'hover:bg-red-50'} rounded-lg`} title="删除">
            <Trash2 size={14} className="text-red-400" />
          </button>
        </div>
      </td>
    </tr>
  )
}

export default TokenRow

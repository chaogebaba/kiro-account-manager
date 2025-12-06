import { RefreshCw, Edit2, Trash2, Copy, Check, Clock, Repeat } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { getUsagePercent, getProgressBarColor } from './hooks/useAccountStats'
import { getQuota, getUsed, getSubType, getSubPlan } from '../../utils/accountStats'

function AccountRow({
  account,
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
  
  // 从 usage_data 读取配额信息
  const quota = getQuota(account)
  const used = getUsed(account)
  const subType = getSubType(account)
  const subPlan = getSubPlan(account)
  const breakdown = account.usage_data?.usageBreakdownList?.[0]
  const percent = getUsagePercent(used, quota)
  const isExpired = account.expires_at && new Date(account.expires_at.replace(/\//g, '-')) < new Date()

  return (
    <tr className={`${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50/50'} transition-colors group`}>
      <td className="px-4 py-3">
        <input type="checkbox" checked={isSelected} onChange={(e) => onSelect(e.target.checked)} className="rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-medium shadow-sm ${
            account.provider === 'Google' ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600') :
            account.provider === 'Github' ? (isDark ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700') :
            (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600')
          }`}>
            {account.email[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-medium ${colors.text} text-sm`}>{account.email}</span>
              <button onClick={() => onCopy(account.email, account.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                {copiedId === account.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-400" />}
              </button>
            </div>
            <div className={`text-xs ${colors.textMuted}`}>{account.provider || '未知'} · {account.label || '无标签'}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium ${
          (subType.includes('PRO+') || subPlan.includes('PRO+'))
            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm'
            : (subType.includes('PRO') || subPlan.includes('PRO'))
              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm'
              : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
        }`}>
          {subPlan || 'Free'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{used}/{quota}</span>
              <span className={`${isDark ? 'text-gray-500' : 'text-gray-400'}`}>剩余 {quota - used}</span>
            </div>
            <span className={`font-semibold ${percent > 80 ? 'text-red-500' : percent > 50 ? 'text-yellow-500' : 'text-green-500'}`}>{Math.round(percent)}%</span>
          </div>
          <div className={`h-2 ${isDark ? 'bg-white/10' : 'bg-gray-100'} rounded-full overflow-hidden`}>
            <div className={`h-full rounded-full transition-all ${getProgressBarColor(percent)}`} style={{ width: `${percent}%` }} />
          </div>
          {breakdown?.nextDateReset && (
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {new Date(breakdown.nextDateReset * 1000).toLocaleDateString()} 重置
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium ${
          account.status === '正常' || account.status === '有效'
            ? (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700')
            : (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600')
        }`}>{account.status}</span>
      </td>
      <td className="px-4 py-3">
        {account.expires_at ? (
          <div className={`text-xs ${isExpired ? 'text-red-500' : colors.textMuted}`}>
            <div className="flex items-center gap-1"><Clock size={12} />{account.expires_at.split(' ')[1]}</div>
            <div className={`${isDark ? 'text-gray-500' : 'text-gray-400'} mt-0.5`}>{account.expires_at.split(' ')[0]}</div>
          </div>
        ) : <span className={`text-xs ${colors.textMuted}`}>-</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => onSwitch(account)} disabled={switchingId === account.id} className={`p-1.5 ${isDark ? 'bg-blue-500/20 hover:bg-blue-500/30' : 'bg-blue-50 hover:bg-blue-100'} rounded-lg disabled:opacity-50`} title="切换账号">
            <Repeat size={14} className={`text-blue-500 ${switchingId === account.id ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => onRefresh(account.id)} disabled={refreshingId === account.id} className={`p-1.5 ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} rounded-lg`} title="刷新">
            <RefreshCw size={14} className={`${colors.textMuted} ${refreshingId === account.id ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => onEdit(account)} className={`p-1.5 ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} rounded-lg`} title="编辑">
            <Edit2 size={14} className={colors.textMuted} />
          </button>
          <button onClick={() => onDelete(account.id)} className={`p-1.5 ${isDark ? 'hover:bg-red-500/20' : 'hover:bg-red-50'} rounded-lg`} title="删除">
            <Trash2 size={14} className="text-red-400" />
          </button>
        </div>
      </td>
    </tr>
  )
}

export default AccountRow

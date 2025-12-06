import { Users, Plus } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import AccountRow from './AccountRow'

function AccountTable({
  accounts,
  filteredAccounts,
  selectedIds,
  onSelectAll,
  onSelectOne,
  copiedId,
  onCopy,
  onSwitch,
  onRefresh,
  onEdit,
  onDelete,
  onAdd,
  refreshingId,
  switchingId,
}) {
  const { theme, colors } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className={`card-glow ${colors.card} rounded-2xl shadow-sm overflow-hidden max-w-6xl border ${colors.cardBorder}`}>
        <table className="w-full table-fixed">
          <thead>
            <tr className={`${isDark ? 'bg-white/5' : 'bg-gray-50'} border-b ${colors.cardBorder} text-left text-xs font-medium ${colors.textMuted} uppercase tracking-wider`}>
              <th className="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredAccounts.length && filteredAccounts.length > 0}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="rounded transition-transform hover:scale-110"
                />
              </th>
              <th className="px-3 py-3 w-[200px]">账号</th>
              <th className="px-3 py-3 w-[70px]">订阅</th>
              <th className="px-3 py-3 w-[200px]">配额</th>
              <th className="px-3 py-3 w-[50px]">状态</th>
              <th className="px-3 py-3 w-[100px]">Token</th>
              <th className="px-3 py-3 w-[130px] text-right">操作</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-100'}`}>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-20 text-center">
                  <div className={`flex flex-col items-center gap-4 ${colors.textMuted}`}>
                    <div className={`w-20 h-20 rounded-full ${isDark ? 'bg-white/5' : 'bg-gray-100'} flex items-center justify-center animate-float`}>
                      <Users size={40} strokeWidth={1} className="opacity-50" />
                    </div>
                    <div>
                      <p className="font-medium mb-1">暂无账号</p>
                      <p className="text-sm opacity-75">添加你的第一个 Kiro 账号开始管理</p>
                    </div>
                    <button 
                      onClick={onAdd} 
                      className="btn-icon px-5 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-blue-700 flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
                    >
                      <Plus size={16} />
                      添加账号
                    </button>
                  </div>
                </td>
              </tr>
            ) : accounts.map((account, index) => (
              <AccountRow
                key={account.id}
                account={account}
                index={index}
                isSelected={selectedIds.includes(account.id)}
                onSelect={(checked) => onSelectOne(account.id, checked)}
                copiedId={copiedId}
                onCopy={onCopy}
                onSwitch={onSwitch}
                onRefresh={onRefresh}
                onEdit={onEdit}
                onDelete={onDelete}
                refreshingId={refreshingId}
                switchingId={switchingId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AccountTable

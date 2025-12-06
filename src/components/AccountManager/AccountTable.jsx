import { Users } from 'lucide-react'
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
      <div className={`${colors.card} rounded-2xl shadow-sm overflow-hidden max-w-6xl`}>
        <table className="w-full table-fixed">
          <thead>
            <tr className={`${isDark ? 'bg-white/5' : 'bg-gray-50'} border-b ${colors.cardBorder} text-left text-xs font-medium ${colors.textMuted} uppercase tracking-wider`}>
              <th className="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredAccounts.length && filteredAccounts.length > 0}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="rounded"
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
                  <div className={`flex flex-col items-center gap-3 ${colors.textMuted}`}>
                    <Users size={48} strokeWidth={1} />
                    <p>暂无账号</p>
                    <button onClick={onAdd} className="text-blue-500 hover:underline text-sm">添加第一个账号</button>
                  </div>
                </td>
              </tr>
            ) : accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
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

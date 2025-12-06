import { useState, useCallback, useMemo } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAccounts } from './hooks/useAccounts'
import { useAccountStats } from './hooks/useAccountStats'
import AccountHeader from './AccountHeader'
import AccountTable from './AccountTable'
import AccountPagination from './AccountPagination'
import AddAccountModal from './AddAccountModal'
import RefreshProgressModal from './RefreshProgressModal'
import EditAccountModal from '../EditAccountModal'

function AccountManager() {
  const { colors } = useTheme()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [editingAccount, setEditingAccount] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  const {
    accounts,
    loadAccounts,
    autoRefreshing,
    refreshProgress,
    lastRefreshTime,
    refreshingId,
    switchingId,
    autoRefreshAll,
    handleDelete,
    handleBatchDelete,
    handleRefreshStatus,
    handleExport,
    handleSwitchAccount,
  } = useAccounts()

  const stats = useAccountStats(accounts)

  const filteredAccounts = useMemo(() =>
    accounts.filter(a =>
      a.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.label.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [accounts, searchTerm]
  )

  const totalPages = Math.ceil(filteredAccounts.length / pageSize) || 1
  const paginatedAccounts = useMemo(() =>
    filteredAccounts.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredAccounts, currentPage, pageSize]
  )

  const handleSearchChange = useCallback((term) => { setSearchTerm(term); setCurrentPage(1) }, [])
  const handlePageSizeChange = useCallback((size) => { setPageSize(size); setCurrentPage(1) }, [])
  const handleSelectAll = useCallback((checked) => { setSelectedIds(checked ? filteredAccounts.map(a => a.id) : []) }, [filteredAccounts])
  const handleSelectOne = useCallback((id, checked) => { setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id)) }, [])
  const handleCopy = useCallback((text, id) => { navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 1500) }, [])
  const onBatchDelete = useCallback(() => { handleBatchDelete(selectedIds, setSelectedIds) }, [selectedIds, handleBatchDelete])

  return (
    <div className={`h-full flex flex-col ${colors.main}`}>
      <AccountHeader
        stats={stats}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        selectedCount={selectedIds.length}
        onBatchDelete={onBatchDelete}
        onAdd={() => setShowAddModal(true)}
        onExport={handleExport}
        onRefreshAll={() => autoRefreshAll(accounts, true)}
        autoRefreshing={autoRefreshing}
        lastRefreshTime={lastRefreshTime}
        refreshProgress={refreshProgress}
      />
      <AccountTable
        accounts={paginatedAccounts}
        filteredAccounts={filteredAccounts}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectOne={handleSelectOne}
        copiedId={copiedId}
        onCopy={handleCopy}
        onSwitch={handleSwitchAccount}
        onRefresh={handleRefreshStatus}
        onEdit={setEditingAccount}
        onDelete={handleDelete}
        onAdd={() => setShowAddModal(true)}
        refreshingId={refreshingId}
        switchingId={switchingId}
      />
      <AccountPagination
        totalCount={filteredAccounts.length}
        pageSize={pageSize}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageSizeChange={handlePageSizeChange}
        onPageChange={setCurrentPage}
      />
      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSuccess={() => { setEditingAccount(null); loadAccounts() }}
        />
      )}
      {showAddModal && (<AddAccountModal onClose={() => setShowAddModal(false)} onSuccess={loadAccounts} />)}
      {autoRefreshing && (<RefreshProgressModal refreshProgress={refreshProgress} />)}
    </div>
  )
}

export default AccountManager

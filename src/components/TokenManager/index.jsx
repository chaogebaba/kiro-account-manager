import { useState, useCallback, useMemo } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { useTokens } from './hooks/useTokens'
import { useTokenStats } from './hooks/useTokenStats'
import TokenHeader from './TokenHeader'
import TokenTable from './TokenTable'
import TokenPagination from './TokenPagination'
import AddTokenModal from './AddTokenModal'
import RefreshProgressModal from './RefreshProgressModal'
import EditTokenModal from '../EditTokenModal'

function TokenManager() {
  const { colors } = useTheme()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [editingToken, setEditingToken] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  const {
    tokens,
    loadTokens,
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
  } = useTokens()

  const stats = useTokenStats(tokens)

  // 过滤和分页
  const filteredTokens = useMemo(() =>
    tokens.filter(t =>
      t.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.label.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [tokens, searchTerm]
  )

  const totalPages = Math.ceil(filteredTokens.length / pageSize) || 1
  const paginatedTokens = useMemo(() =>
    filteredTokens.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredTokens, currentPage, pageSize]
  )

  // 事件处理
  const handleSearchChange = useCallback((term) => {
    setSearchTerm(term)
    setCurrentPage(1)
  }, [])

  const handlePageSizeChange = useCallback((size) => {
    setPageSize(size)
    setCurrentPage(1)
  }, [])

  const handleSelectAll = useCallback((checked) => {
    setSelectedIds(checked ? filteredTokens.map(t => t.id) : [])
  }, [filteredTokens])

  const handleSelectOne = useCallback((id, checked) => {
    setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id))
  }, [])

  const handleCopy = useCallback((text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }, [])

  const onBatchDelete = useCallback(() => {
    handleBatchDelete(selectedIds, setSelectedIds)
  }, [selectedIds, handleBatchDelete])

  return (
    <div className={`h-full flex flex-col ${colors.main}`}>
      <TokenHeader
        stats={stats}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        selectedCount={selectedIds.length}
        onBatchDelete={onBatchDelete}
        onAdd={() => setShowAddModal(true)}
        onExport={handleExport}
        onRefreshAll={() => autoRefreshAll(tokens, true)}
        autoRefreshing={autoRefreshing}
        lastRefreshTime={lastRefreshTime}
        refreshProgress={refreshProgress}
      />

      <TokenTable
        tokens={paginatedTokens}
        filteredTokens={filteredTokens}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectOne={handleSelectOne}
        copiedId={copiedId}
        onCopy={handleCopy}
        onSwitch={handleSwitchAccount}
        onRefresh={handleRefreshStatus}
        onEdit={setEditingToken}
        onDelete={handleDelete}
        onAdd={() => setShowAddModal(true)}
        refreshingId={refreshingId}
        switchingId={switchingId}
      />

      <TokenPagination
        totalCount={filteredTokens.length}
        pageSize={pageSize}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageSizeChange={handlePageSizeChange}
        onPageChange={setCurrentPage}
      />

      {/* Modals */}
      {editingToken && (
        <EditTokenModal
          token={editingToken}
          onClose={() => setEditingToken(null)}
          onSuccess={() => { setEditingToken(null); loadTokens() }}
        />
      )}

      {showAddModal && (
        <AddTokenModal
          onClose={() => setShowAddModal(false)}
          onSuccess={loadTokens}
        />
      )}

      {autoRefreshing && (
        <RefreshProgressModal refreshProgress={refreshProgress} />
      )}
    </div>
  )
}

export default TokenManager

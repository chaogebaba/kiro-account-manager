import { useState, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useTheme } from '../../contexts/ThemeContext'
import { useDialog } from '../../contexts/DialogContext'
import { useAccounts } from './hooks/useAccounts'
import { useAccountStats } from './hooks/useAccountStats'
import AccountHeader from './AccountHeader'
import AccountTable from './AccountTable'
import AccountPagination from './AccountPagination'
import AddAccountModal from './AddAccountModal'
import RefreshProgressModal from './RefreshProgressModal'
import EditAccountModal from '../EditAccountModal'
import ConfirmDialog from './ConfirmDialog'

function AccountManager() {
  const { colors } = useTheme()
  const { showConfirm } = useDialog()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [editingAccount, setEditingAccount] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  
  // 切换账号弹窗状态
  const [switchDialog, setSwitchDialog] = useState(null) // { type, title, message, account }

  const {
    accounts,
    loadAccounts,
    autoRefreshing,
    refreshProgress,
    lastRefreshTime,
    refreshingId,
    switchingId,
    setSwitchingId,
    autoRefreshAll,
    handleRefreshStatus,
    handleExport,
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
  
  // 删除单个账号
  const handleDelete = useCallback(async (id) => {
    const confirmed = await showConfirm('删除账号', '确定删除该账号？')
    if (confirmed) {
      await invoke('delete_account', { id })
      loadAccounts()
    }
  }, [showConfirm, loadAccounts])

  // 批量删除
  const onBatchDelete = useCallback(async () => {
    if (selectedIds.length === 0) return
    const confirmed = await showConfirm('批量删除', `确定删除 ${selectedIds.length} 个账号？`)
    if (confirmed) {
      await invoke('delete_accounts', { ids: selectedIds })
      setSelectedIds([])
      loadAccounts()
    }
  }, [selectedIds, showConfirm, loadAccounts])

  // 切换账号 - 显示确认弹窗
  const handleSwitchAccount = useCallback((account) => {
    if (!account.accessToken || !account.refreshToken) {
      setSwitchDialog({ type: 'error', title: '切换失败', message: '缺少认证信息', account: null })
      return
    }
    setSwitchDialog({
      type: 'confirm',
      title: '切换账号',
      message: `确定切换到 ${account.email}？`,
      account,
    })
  }, [])

  // 确认切换
  const confirmSwitch = useCallback(async () => {
    const account = switchDialog?.account
    if (!account) return
    
    setSwitchDialog(null)
    setSwitchingId(account.id)
    
    try {
      // verify_account 会刷新 token 并返回新的 token
      const verifyResult = await invoke('verify_account', {
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        csrfToken: account.csrfToken || null,
        provider: account.provider || 'Google'
      })
      
      const isIdC = account.provider === 'BuilderId' || account.provider === 'Enterprise' || account.clientIdHash
      const authMethod = isIdC ? 'IdC' : 'social'
      
      // 使用刷新后的新 token 进行切换
      const params = {
        accessToken: verifyResult.accessToken,
        refreshToken: verifyResult.refreshToken,
        provider: account.provider || 'Google',
        authMethod,
        resetMachineId: false,
        autoRestart: false
      }
      
      if (isIdC) {
        params.clientIdHash = account.clientIdHash || null
        params.region = account.ssoRegion || 'us-east-1'
        params.clientId = account.ssoClientId || null
        params.clientSecret = account.ssoClientSecret || null
      } else {
        params.profileArn = account.profileArn || 'arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK'
      }
      
      await invoke('switch_kiro_account', { params })
      
      const usage = verifyResult
      
      const used = usage.currentUsage || 0
      const limit = usage.usageLimit || 50
      const remaining = limit - used
      const provider = account.provider || 'Unknown'
      setSwitchDialog({
        type: 'success',
        title: '切换成功',
        message: `${account.email}\n\n📊 配额: ${used}/${limit} (剩余 ${remaining})\n🏷️ 类型: ${provider}`,
        account: null,
      })
    } catch (e) {
      setSwitchDialog({
        type: 'error',
        title: '切换失败',
        message: String(e),
        account: null,
      })
    } finally {
      setSwitchingId(null)
    }
  }, [switchDialog, setSwitchingId])

  return (
    <div className={`h-full flex flex-col ${colors.main}`}>
      <AccountHeader
        stats={stats}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        selectedCount={selectedIds.length}
        onBatchDelete={onBatchDelete}
        onAdd={() => setShowAddModal(true)}
        onImport={() => {/* TODO: 打开导入弹窗 */}}
        onExport={() => handleExport(selectedIds)}
        onRefreshAll={() => autoRefreshAll(accounts, true)}
        autoRefreshing={autoRefreshing}
        lastRefreshTime={lastRefreshTime}
        refreshProgress={refreshProgress}
      />
      <div className="flex-1 overflow-hidden">
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
      </div>
      <div className="animate-slide-in-right delay-200">
      <AccountPagination
        totalCount={filteredAccounts.length}
        pageSize={pageSize}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageSizeChange={handlePageSizeChange}
        onPageChange={setCurrentPage}
      />
      </div>
      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSuccess={() => { setEditingAccount(null); loadAccounts() }}
        />
      )}
      {showAddModal && (<AddAccountModal onClose={() => setShowAddModal(false)} onSuccess={loadAccounts} />)}
      {autoRefreshing && (<RefreshProgressModal refreshProgress={refreshProgress} />)}
      
      {/* 切换账号弹窗 */}
      {switchDialog && (
        <ConfirmDialog
          type={switchDialog.type}
          title={switchDialog.title}
          message={switchDialog.message}
          onConfirm={switchDialog.type === 'confirm' ? confirmSwitch : () => setSwitchDialog(null)}
          onCancel={() => setSwitchDialog(null)}
          confirmText={switchDialog.type === 'confirm' ? '确定切换' : '确定'}
        />
      )}
    </div>
  )
}

export default AccountManager


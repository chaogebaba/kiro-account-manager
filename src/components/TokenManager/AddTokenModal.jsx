import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { X, Download } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

function AddTokenModal({ onClose, onSuccess }) {
  const { theme, colors } = useTheme()
  const isDark = theme === 'dark'
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [addType, setAddType] = useState('social')
  const [refreshToken, setRefreshToken] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')

  const handleSaveLocal = async () => {
    setAddLoading(true)
    setAddError('')
    try {
      await invoke('add_local_kiro_account')
      onSuccess()
      onClose()
    } catch (e) {
      setAddError(e.toString())
    } finally {
      setAddLoading(false)
    }
  }

  const handleAddManual = async () => {
    if (!refreshToken) {
      setAddError('请输入 Refresh Token')
      return
    }
    if (!refreshToken.startsWith('aor')) {
      setAddError('Token 格式错误，应以 aor 开头')
      return
    }
    setAddLoading(true)
    setAddError('')
    try {
      if (addType === 'idc') {
        if (!clientId || !clientSecret) {
          setAddError('请输入 Client ID 和 Client Secret')
          setAddLoading(false)
          return
        }
        await invoke('add_account_by_idc', { refreshToken, clientId, clientSecret })
      } else {
        await invoke('add_account_by_social', { refreshToken })
      }
      onSuccess()
      onClose()
    } catch (e) {
      setAddError(e.toString())
    } finally {
      setAddLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className={`${colors.card} rounded-2xl w-[400px] shadow-2xl`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${colors.cardBorder}`}>
          <h2 className={`text-lg font-semibold ${colors.text}`}>添加账号</h2>
          <button onClick={onClose} className={`p-1.5 hover:opacity-70 rounded-xl`}>
            <X size={18} className={colors.textMuted} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {/* 保存本地账号 */}
          <button
            onClick={handleSaveLocal}
            disabled={addLoading}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 ${colors.loginBtn} border hover:border-green-500 rounded-lg transition-all disabled:opacity-50`}
          >
            <Download size={18} className="text-green-500" />
            <span className={`${colors.text} font-medium`}>保存本地账号</span>
          </button>

          {/* 分隔线 */}
          <div className="flex items-center gap-3">
            <div className={`flex-1 h-px ${colors.cardBorder}`}></div>
            <span className={`text-xs ${colors.textMuted}`}>或手动输入</span>
            <div className={`flex-1 h-px ${colors.cardBorder}`}></div>
          </div>

          {/* 账号类型切换 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAddType('social')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${addType === 'social' ? 'bg-blue-500 text-white' : `${colors.loginBtn} ${colors.text}`}`}
            >
              Social
            </button>
            <button
              type="button"
              onClick={() => setAddType('idc')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${addType === 'idc' ? 'bg-blue-500 text-white' : `${colors.loginBtn} ${colors.text}`}`}
            >
              BuilderId
            </button>
          </div>

          {/* 手动输入表单 */}
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Refresh Token (aor 开头)"
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              className={`w-full px-4 py-2.5 border rounded-xl text-sm ${colors.text} ${colors.input} focus:outline-none focus:ring-2 ${colors.inputFocus}`}
            />
            {addType === 'idc' && (
              <>
                <input
                  type="text"
                  placeholder="Client ID"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm ${colors.text} ${colors.input} focus:outline-none focus:ring-2 ${colors.inputFocus}`}
                />
                <input
                  type="text"
                  placeholder="Client Secret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm ${colors.text} ${colors.input} focus:outline-none focus:ring-2 ${colors.inputFocus}`}
                />
              </>
            )}
            <button
              onClick={handleAddManual}
              disabled={addLoading}
              className={`w-full px-4 py-2.5 ${colors.loginBtn} border rounded-xl text-sm font-medium ${colors.text} transition-colors disabled:opacity-50`}
            >
              {addLoading ? '验证中...' : '添加账号'}
            </button>
          </div>

          {addError && (
            <div className={`text-sm text-red-500 ${isDark ? 'bg-red-500/20' : 'bg-red-50'} px-3 py-2 rounded-xl text-center`}>
              {addError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AddTokenModal

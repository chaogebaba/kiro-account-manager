import { useState, useEffect } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { Download, RefreshCw, X } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useDialog } from '../contexts/DialogContext'

function UpdateChecker() {
  const { theme, colors } = useTheme()
  const { showError } = useDialog()
  const isDark = theme === 'dark'
  const [updateInfo, setUpdateInfo] = useState(null)
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [update, setUpdate] = useState(null)

  const checkForUpdate = async () => {
    setChecking(true)
    try {
      const updateResult = await check()
      if (updateResult) {
        setUpdate(updateResult)
        setUpdateInfo({
          version: updateResult.version,
          body: updateResult.body
        })
        setDismissed(false)
      }
    } catch {
      // 静默处理 - 没有发布 release 或网络问题时忽略
    }
    setChecking(false)
  }

  const doUpdate = async () => {
    if (!update) return
    setInstalling(true)
    try {
      await update.downloadAndInstall()
      await relaunch()
    } catch (e) {
      console.error('安装更新失败:', e)
      showError('更新失败', '安装更新失败: ' + e)
      setInstalling(false)
    }
  }

  useEffect(() => {
    // 启动时检查更新
    checkForUpdate()
  }, [])

  if (!updateInfo || dismissed) return null

  return (
    <div 
      className={`fixed bottom-4 right-4 ${colors.card} rounded-2xl shadow-lg border ${colors.cardBorder} p-4 w-80 z-50`}
      style={{ animation: 'slideInFromBottom 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'} rounded-lg flex items-center justify-center`}>
            <Download size={16} className="text-blue-500" />
          </div>
          <div>
            <div className={`font-medium ${colors.text}`}>发现新版本</div>
            <div className={`text-xs ${colors.textMuted}`}>v{updateInfo.version}</div>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className={`p-1 ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} rounded-lg`}>
          <X size={16} className={colors.textMuted} />
        </button>
      </div>
      
      {updateInfo.body && (
        <div className={`text-xs ${colors.textMuted} mb-3 max-h-20 overflow-y-auto`}>
          {updateInfo.body}
        </div>
      )}
      
      <div className="flex gap-2">
        <button
          onClick={() => setDismissed(true)}
          className={`flex-1 px-3 py-2 ${isDark ? 'bg-white/10 hover:bg-white/15' : 'bg-gray-100 hover:bg-gray-200'} rounded-xl text-sm ${colors.text}`}
        >
          稍后
        </button>
        <button
          onClick={doUpdate}
          disabled={installing}
          className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
        >
          {installing ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
          {installing ? '更新中...' : '立即更新'}
        </button>
      </div>
    </div>
  )
}

export default UpdateChecker

// 添加动画样式
const style = document.createElement('style')
style.textContent = `
  @keyframes slideInFromBottom {
    from {
      opacity: 0;
      transform: translateY(30px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`
if (!document.querySelector('#update-checker-styles')) {
  style.id = 'update-checker-styles'
  document.head.appendChild(style)
}

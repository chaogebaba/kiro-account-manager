import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Loader, Globe, ClipboardPaste } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

function WebOAuthLogin({ onLogin }) {
  const { colors } = useTheme()
  const [step, setStep] = useState('idle') // idle, webview, completing
  const [currentProvider, setCurrentProvider] = useState(null)
  const [callbackUrl, setCallbackUrl] = useState('')
  const [error, setError] = useState('')
  const [windowLabel, setWindowLabel] = useState(null)

  useEffect(() => {
    // 监听登录成功事件
    const unlistenSuccess = listen('login-success', (event) => {
      console.log('Web OAuth login success:', event.payload)
      setStep('idle')
      setCurrentProvider(null)
      setCallbackUrl('')
      setWindowLabel(null)
      onLogin?.(event.payload)
    })

    // 监听 WebView 自动捕获的回调 URL (Tauri v2 on_navigation)
    const unlistenCallback = listen('web-oauth-callback', async (event) => {
      console.log('========== web-oauth-callback EVENT ==========')
      console.log('Callback URL:', event.payload)
      
      setStep('completing')
      try {
        await invoke('web_oauth_complete', { callbackUrl: event.payload })
        // login-success 事件会处理后续
      } catch (e) {
        console.error('Auto complete failed:', e)
        setError(typeof e === 'string' ? e : e.message || '自动登录失败')
        setCallbackUrl(event.payload) // 填入 URL 让用户手动重试
        setStep('webview')
      }
    })

    return () => {
      unlistenSuccess.then(fn => fn())
      unlistenCallback.then(fn => fn())
    }
  }, [onLogin])

  // 一键登录：使用 WebView 窗口
  const handleLogin = async (provider) => {
    console.log('========== FRONTEND: handleLogin START ==========')
    console.log('Provider:', provider)
    
    setCurrentProvider(provider)
    setError('')
    setStep('webview')
    
    try {
      console.log('Calling web_oauth_login...')
      const result = await invoke('web_oauth_login', { provider })
      console.log('WebView login result:', result)
      setWindowLabel(result.window_label)
      console.log('========== FRONTEND: handleLogin SUCCESS ==========')
    } catch (e) {
      console.error('========== FRONTEND: handleLogin FAILED ==========')
      console.error('Web OAuth login error:', e)
      setError(typeof e === 'string' ? e : e.message || '发起登录失败')
      setStep('idle')
      setCurrentProvider(null)
    }
  }

  // 手动完成登录（备用）
  const handleComplete = async () => {
    if (!callbackUrl.trim()) {
      setError('请粘贴回调 URL')
      return
    }
    setStep('completing')
    setError('')
    
    // 关闭 WebView 窗口（如果有）
    if (windowLabel) {
      try {
        await invoke('web_oauth_close_window', { windowLabel })
      } catch (e) {
        console.log('Close window error (ignored):', e)
      }
    }
    
    try {
      await invoke('web_oauth_complete', { callbackUrl: callbackUrl.trim() })
    } catch (e) {
      console.error('Web OAuth complete error:', e)
      setError(typeof e === 'string' ? e : e.message || '完成登录失败')
      setStep('webview')
    }
  }

  // 取消登录
  const handleCancel = async () => {
    if (windowLabel) {
      try {
        await invoke('web_oauth_close_window', { windowLabel })
      } catch (e) {
        console.log('Close window error (ignored):', e)
      }
    }
    setStep('idle')
    setCurrentProvider(null)
    setCallbackUrl('')
    setWindowLabel(null)
    setError('')
  }

  // 从剪贴板粘贴
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setCallbackUrl(text)
    } catch (e) {
      console.error('Paste error:', e)
    }
  }

  return (
    <div className={`h-full flex flex-col items-center justify-center ${colors.main}`}>
      {/* Logo */}
      <div className="flex items-center gap-2 mb-6">
        <Globe size={32} className="text-purple-500" />
        <span className={`${colors.text} text-xl font-semibold`}>Web OAuth</span>
      </div>

      {/* 说明 */}
      <div className={`mb-6 text-center max-w-sm`}>
        <p className={`${colors.textMuted} text-sm`}>
          通过 Cognito + KiroWebPortalService 登录
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border-red-200 text-red-600 border rounded-lg text-sm text-center max-w-md">
          {error}
        </div>
      )}

      {/* 选择登录方式 */}
      {step === 'idle' && (
        <div className="flex flex-col gap-4 w-80">
          <div className="flex gap-3">
            <button
              onClick={() => handleLogin('Google')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff"/>
              </svg>
              <span className="font-medium">Google</span>
            </button>
            <button
              onClick={() => handleLogin('GitHub')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span className="font-medium">GitHub</span>
            </button>
          </div>
        </div>
      )}

      {/* WebView 登录中 */}
      {step === 'webview' && (
        <div className="flex flex-col gap-4 w-96">
          <div className={`p-4 ${colors.card} rounded-lg border ${colors.cardBorder}`}>
            <div className="flex items-center gap-3 mb-4">
              <Loader size={20} className="animate-spin text-purple-500" />
              <p className={`${colors.text} font-medium`}>正在 {currentProvider} 登录...</p>
            </div>
            <p className={`${colors.textMuted} text-sm`}>
              请在弹出的窗口中完成授权，授权后会自动登录
            </p>
          </div>

          {/* 备用：手动粘贴 URL */}
          <div className={`p-3 ${colors.card} rounded-lg border ${colors.cardBorder}`}>
            <p className={`${colors.textMuted} text-xs mb-2`}>如果自动登录失败，请手动粘贴回调 URL：</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={callbackUrl}
                onChange={(e) => setCallbackUrl(e.target.value)}
                placeholder="https://app.kiro.dev/signin/oauth?code=..."
                className={`flex-1 px-3 py-2 ${colors.input} border ${colors.inputBorder} rounded-lg text-xs`}
              />
              <button
                onClick={handlePaste}
                className={`px-2 py-2 ${colors.loginBtn} border rounded-lg hover:border-purple-500 transition-all`}
              >
                <ClipboardPaste size={16} />
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className={`flex-1 px-4 py-2 ${colors.loginBtn} border rounded-lg hover:border-gray-400 transition-all`}
            >
              取消
            </button>
            <button
              onClick={handleComplete}
              disabled={!callbackUrl.trim()}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all disabled:opacity-50"
            >
              手动完成
            </button>
          </div>
        </div>
      )}

      {/* 完成中 */}
      {step === 'completing' && (
        <div className={`p-6 ${colors.card} rounded-lg border ${colors.cardBorder}`}>
          <div className="flex items-center gap-3">
            <Loader size={24} className="animate-spin text-purple-500" />
            <p className={`${colors.text} font-medium`}>正在完成登录...</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default WebOAuthLogin

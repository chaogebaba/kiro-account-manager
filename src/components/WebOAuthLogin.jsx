import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/api/shell'
import { Loader, Globe, ClipboardPaste, ExternalLink, Zap } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

function WebOAuthLogin({ onLogin }) {
  const { colors } = useTheme()
  const [step, setStep] = useState('idle') // idle, webview, waiting, completing
  const [currentProvider, setCurrentProvider] = useState(null)
  const [callbackUrl, setCallbackUrl] = useState('')
  const [error, setError] = useState('')
  const [windowLabel, setWindowLabel] = useState(null)

  useEffect(() => {
    const unlistenSuccess = listen('login-success', (event) => {
      console.log('Web OAuth login success:', event.payload)
      setStep('idle')
      setCurrentProvider(null)
      setCallbackUrl('')
      setWindowLabel(null)
      onLogin?.(event.payload)
    })
    return () => { unlistenSuccess.then(fn => fn()) }
  }, [onLogin])

  // 一键登录：使用 WebView 窗口
  const handleWebViewLogin = async (provider) => {
    console.log('========== FRONTEND: handleWebViewLogin START ==========')
    console.log('Provider:', provider)
    
    setCurrentProvider(provider)
    setError('')
    setStep('webview')
    
    try {
      console.log('Calling web_oauth_login...')
      const result = await invoke('web_oauth_login', { provider })
      console.log('WebView login result:', result)
      setWindowLabel(result.window_label)
      
      // 开始轮询检查窗口是否关闭，或者等待回调
      pollForCallback(result.window_label)
      
      console.log('========== FRONTEND: handleWebViewLogin SUCCESS ==========')
    } catch (e) {
      console.error('========== FRONTEND: handleWebViewLogin FAILED ==========')
      console.error('Web OAuth login error:', e)
      setError(typeof e === 'string' ? e : e.message || '发起登录失败')
      setStep('idle')
      setCurrentProvider(null)
    }
  }

  // 轮询检查 - 由于 WebView 无法直接监听 URL 变化，用户需要手动操作
  // 这里提供一个输入框让用户粘贴 URL（如果自动捕获失败）
  const pollForCallback = (label) => {
    // WebView 模式下，用户完成授权后页面会跳转到 app.kiro.dev/signin/oauth
    // 由于配置了 dangerousRemoteDomainIpcAccess，页面可以调用 Tauri API
    // 但实际上 app.kiro.dev 的页面不会主动调用我们的 API
    // 所以还是需要用户手动复制 URL
    console.log('WebView opened, waiting for user to complete auth...')
  }

  // 手动模式：打开浏览器
  const handleManualLogin = async (provider) => {
    console.log('========== FRONTEND: handleManualLogin START ==========')
    console.log('Provider:', provider)
    
    setCurrentProvider(provider)
    setError('')
    setStep('waiting')
    
    try {
      console.log('Calling web_oauth_initiate...')
      const result = await invoke('web_oauth_initiate', { provider })
      console.log('Initiate result:', result)
      
      // 打开浏览器
      console.log('Opening browser...')
      await open(result.authorize_url)
      console.log('========== FRONTEND: handleManualLogin SUCCESS ==========')
    } catch (e) {
      console.error('========== FRONTEND: handleManualLogin FAILED ==========')
      console.error('Web OAuth initiate error:', e)
      setError(typeof e === 'string' ? e : e.message || '发起登录失败')
      setStep('idle')
      setCurrentProvider(null)
    }
  }

  // 完成登录
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
      setStep('waiting')
    }
  }

  // 取消登录
  const handleCancel = async () => {
    // 关闭 WebView 窗口（如果有）
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
          通过 Cognito + KiroWebPortalService (CBOR) 登录
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border-red-200 text-red-600 border rounded-lg text-sm text-center max-w-md">
          {error}
        </div>
      )}

      {/* Step 1: 选择登录方式 */}
      {step === 'idle' && (
        <div className="flex flex-col gap-4 w-80">
          {/* 一键登录按钮 */}
          <div className={`p-3 ${colors.card} rounded-lg border ${colors.cardBorder} mb-2`}>
            <p className={`${colors.textMuted} text-xs mb-3 text-center`}>
              <Zap size={12} className="inline mr-1" />
              推荐：应用内登录（自动捕获）
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleWebViewLogin('Google')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff"/>
                </svg>
                <span className="text-sm font-medium">Google</span>
              </button>
              <button
                onClick={() => handleWebViewLogin('GitHub')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-all`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span className="text-sm font-medium">GitHub</span>
              </button>
            </div>
          </div>

          {/* 分隔线 */}
          <div className="flex items-center gap-3">
            <div className={`flex-1 h-px ${colors.cardBorder}`}></div>
            <span className={`${colors.textMuted} text-xs`}>或</span>
            <div className={`flex-1 h-px ${colors.cardBorder}`}></div>
          </div>

          {/* 手动模式按钮 */}
          <button
            onClick={() => handleManualLogin('Google')}
            className={`group w-full relative flex items-center justify-center gap-3 px-6 py-3 ${colors.loginBtn} border hover:border-purple-500 rounded-lg transition-all`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className={`${colors.text} text-sm`}>Google (浏览器)</span>
            <ExternalLink size={12} className={`${colors.textMuted} absolute right-4`} />
          </button>

          <button
            onClick={() => handleManualLogin('GitHub')}
            className={`group w-full relative flex items-center justify-center gap-3 px-6 py-3 ${colors.loginBtn} border hover:border-purple-500 rounded-lg transition-all`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            <span className={`${colors.text} text-sm`}>GitHub (浏览器)</span>
            <ExternalLink size={12} className={`${colors.textMuted} absolute right-4`} />
          </button>
        </div>
      )}


      {/* Step 2: WebView 模式 - 等待用户在应用内窗口完成授权 */}
      {step === 'webview' && (
        <div className="flex flex-col gap-4 w-96">
          <div className={`p-4 ${colors.card} rounded-lg border ${colors.cardBorder}`}>
            <div className="flex items-center gap-3 mb-4">
              <Loader size={20} className="animate-spin text-purple-500" />
              <p className={`${colors.text} font-medium`}>正在 {currentProvider} 登录...</p>
            </div>
            <div className="space-y-2 text-sm">
              <p className={`${colors.textMuted}`}>
                1. 在弹出的窗口中完成 {currentProvider} 授权
              </p>
              <p className={`${colors.textMuted}`}>
                2. 授权完成后，复制地址栏 URL 粘贴到下方
              </p>
            </div>
          </div>

          <div className={`p-3 ${colors.card} rounded-lg border ${colors.cardBorder}`}>
            <p className={`${colors.textMuted} text-xs mb-2`}>URL 格式示例:</p>
            <code className={`${colors.textMuted} text-xs break-all`}>
              https://app.kiro.dev/signin/oauth?code=xxx&state=xxx
            </code>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
              placeholder="粘贴回调 URL..."
              className={`flex-1 px-3 py-2 ${colors.input} border ${colors.inputBorder} rounded-lg text-sm`}
            />
            <button
              onClick={handlePaste}
              className={`px-3 py-2 ${colors.loginBtn} border rounded-lg hover:border-purple-500 transition-all`}
              title="从剪贴板粘贴"
            >
              <ClipboardPaste size={18} />
            </button>
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
              完成登录
            </button>
          </div>
        </div>
      )}

      {/* Step 2: 手动模式 - 等待用户完成浏览器授权 */}
      {(step === 'waiting' || step === 'completing') && (
        <div className="flex flex-col gap-4 w-96">
          <div className={`p-4 ${colors.card} rounded-lg border ${colors.cardBorder}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">1</div>
              <p className={`${colors.text} text-sm`}>已打开浏览器，请完成 {currentProvider} 授权</p>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">2</div>
              <p className={`${colors.text} text-sm`}>授权后会显示错误页面，这是正常的</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">3</div>
              <p className={`${colors.text} text-sm`}>复制地址栏 URL 粘贴到下方</p>
            </div>
          </div>

          <div className={`p-3 ${colors.card} rounded-lg border ${colors.cardBorder}`}>
            <p className={`${colors.textMuted} text-xs mb-2`}>URL 格式示例:</p>
            <code className={`${colors.textMuted} text-xs break-all`}>
              https://app.kiro.dev/signin/oauth?code=xxx&state=xxx
            </code>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
              placeholder="粘贴回调 URL..."
              className={`flex-1 px-3 py-2 ${colors.input} border ${colors.inputBorder} rounded-lg text-sm`}
              disabled={step === 'completing'}
            />
            <button
              onClick={handlePaste}
              disabled={step === 'completing'}
              className={`px-3 py-2 ${colors.loginBtn} border rounded-lg hover:border-purple-500 transition-all disabled:opacity-50`}
              title="从剪贴板粘贴"
            >
              <ClipboardPaste size={18} />
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={step === 'completing'}
              className={`flex-1 px-4 py-2 ${colors.loginBtn} border rounded-lg hover:border-gray-400 transition-all disabled:opacity-50`}
            >
              取消
            </button>
            <button
              onClick={handleComplete}
              disabled={step === 'completing' || !callbackUrl.trim()}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {step === 'completing' ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  处理中...
                </>
              ) : (
                '完成登录'
              )}
            </button>
          </div>
        </div>
      )}

      {/* 技术说明 */}
      {step === 'idle' && (
        <div className={`mt-8 p-4 ${colors.card} rounded-lg border ${colors.cardBorder} max-w-sm`}>
          <p className={`${colors.textMuted} text-xs`}>
            <strong>技术细节：</strong><br/>
            • 授权: KiroWebPortalService InitiateLogin<br/>
            • Token: ExchangeToken (CBOR)<br/>
            • 刷新: RefreshToken (csrfToken)
          </p>
        </div>
      )}
    </div>
  )
}

export default WebOAuthLogin

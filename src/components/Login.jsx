import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { listen } from '@tauri-apps/api/event'
import { Github, Loader, CheckCircle } from 'lucide-react'

function Login({ onLogin, onCancel }) {
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState('')
  const [waitingForLogin, setWaitingForLogin] = useState(false)
  const [currentProvider, setCurrentProvider] = useState('')

  // 监听登录成功和窗口关闭事件
  useEffect(() => {
    const unlistenSuccess = listen('login-success', (event) => {
      console.log('Login success event:', event.payload)
      onLogin?.(event.payload)
    })

    const unlistenClosed = listen('auth-window-closed', async () => {
      console.log('Auth window closed')
      // 检查是否有登录成功的用户
      const user = await invoke('get_current_user')
      if (user) {
        onLogin?.(user)
      } else {
        setWaitingForLogin(false)
        setCurrentProvider('')
      }
    })

    return () => {
      unlistenSuccess.then(fn => fn())
      unlistenClosed.then(fn => fn())
    }
  }, [onLogin])

  const handleLogin = async (provider) => {
    setLoading(provider)
    setError('')
    setCurrentProvider(provider)
    try {
      // 使用 Kiro API 获取正确的 OAuth URL（包含签名的 state）
      await invoke(`login_with_${provider.toLowerCase()}`)
      // 内置浏览器窗口已打开，等待用户完成登录
      setWaitingForLogin(true)
    } catch (e) {
      console.error(`${provider} login error:`, e)
      setError(typeof e === 'string' ? e : e.message || '登录失败')
    } finally {
      setLoading(null)
    }
  }



  const handleLoginComplete = async () => {
    // 用户确认已完成登录
    try {
      // 简单起见，让用户输入邮箱或直接模拟登录成功
      const email = prompt('请输入你的登录邮箱:')
      if (email) {
        const user = await invoke('manual_login', { email, provider: currentProvider })
        await invoke('close_auth_window')
        onLogin?.(user)
      }
    } catch (e) {
      setError('登录确认失败: ' + e)
    }
  }

  const handleCancel = async () => {
    try {
      await invoke('close_auth_window')
    } catch (e) {
      // ignore
    }
    setWaitingForLogin(false)
    setCurrentProvider('')
  }

  if (waitingForLogin) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="w-full max-w-md bg-[#1a1a24] rounded-lg p-6 border border-[#2a2a3c] text-center">
          <div className="mb-4">
            <Loader size={40} className="animate-spin text-purple-500 mx-auto" />
          </div>
          <h2 className="text-white text-lg font-medium mb-2">正在登录...</h2>
          <p className="text-gray-400 text-sm mb-6">
            请在弹出的窗口中完成 {currentProvider} 登录，<br/>
            登录成功后点击下方按钮确认。
          </p>

          <div className="space-y-3">
            <button
              onClick={handleLoginComplete}
              className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} />
              我已完成登录
            </button>
            <button
              onClick={handleCancel}
              className="w-full px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1a1a24] rounded-xl p-8 border border-[#2a2a3c] max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill="white"/>
            </svg>
            <span className="text-white text-lg font-semibold">添加账号</span>
          </div>
          {onCancel && (
            <button onClick={onCancel} className="text-gray-400 hover:text-white text-xl">×</button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Login Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleLogin('Google')}
            disabled={loading !== null}
            className="w-full flex items-center gap-3 px-4 py-3 bg-[#2a2a3c] hover:bg-[#353548] rounded-lg border border-[#3a3a4c] transition-colors disabled:opacity-50"
          >
            {loading === 'Google' ? (
              <Loader size={20} className="animate-spin text-white" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            <span className="text-white font-medium">使用 Google 登录</span>
          </button>

          <button
            onClick={() => handleLogin('GitHub')}
            disabled={loading !== null}
            className="w-full flex items-center gap-3 px-4 py-3 bg-[#2a2a3c] hover:bg-[#353548] rounded-lg border border-[#3a3a4c] transition-colors disabled:opacity-50"
          >
            {loading === 'GitHub' ? (
              <Loader size={20} className="animate-spin text-white" />
            ) : (
              <Github size={20} className="text-white" />
            )}
            <span className="text-white font-medium">使用 GitHub 登录</span>
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-500 text-center">
          登录即表示同意 AWS 服务条款和隐私政策
        </p>
      </div>
    </div>
  )
}

export default Login

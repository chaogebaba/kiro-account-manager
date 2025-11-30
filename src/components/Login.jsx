import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { listen } from '@tauri-apps/api/event'
import { Loader } from 'lucide-react'

function Login({ onLogin }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const unlistenSuccess = listen('login-success', (event) => {
      console.log('Login success event:', event.payload)
      onLogin?.(event.payload)
    })

    return () => {
      unlistenSuccess.then(fn => fn())
    }
  }, [onLogin])

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      await invoke('login_with_google')
    } catch (e) {
      console.error('Login error:', e)
      setError(typeof e === 'string' ? e : e.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl p-8 shadow-lg border max-w-md w-full mx-4">
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-2">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill="#4361ee"/>
            </svg>
            <span className="text-gray-800 text-xl font-semibold">登录 Kiro 账号</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader size={20} className="animate-spin text-white" />
            ) : (
              <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
                <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill="white"/>
              </svg>
            )}
            <span className="text-white font-medium text-lg">
              {loading ? '正在打开登录页面...' : '登录 Kiro 账号'}
            </span>
          </button>

          <p className="text-center text-gray-500 text-sm">
            将打开 Kiro 官方登录页面，登录成功后自动获取账号信息
          </p>
        </div>

        <p className="mt-6 text-xs text-gray-400 text-center">
          登录即表示同意 AWS 服务条款和隐私政策
        </p>
      </div>
    </div>
  )
}

export default Login

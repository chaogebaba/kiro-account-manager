import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { listen } from '@tauri-apps/api/event'
import { Loader } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

function Login({ onLogin }) {
  const { theme, colors } = useTheme()
  const isDark = theme === 'dark'
  const [loadingProvider, setLoadingProvider] = useState(null)
  const [hoveredProvider, setHoveredProvider] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const unlistenSuccess = listen('login-success', (event) => {
      console.log('Login success event:', event.payload)
      onLogin?.(event.payload)
    })
    return () => { unlistenSuccess.then(fn => fn()) }
  }, [onLogin])

  const handleLogin = async (provider) => {
    setLoadingProvider(provider)
    setError('')
    try {
      await invoke('kiro_social_login', { provider })
    } catch (e) {
      console.error('Login error:', e)
      setError(typeof e === 'string' ? e : e.message || '登录失败')
    } finally {
      setLoadingProvider(null)
    }
  }

  return (
    <div className={`h-full flex items-center justify-center ${colors.main}`}>
      <div className={`${colors.card} rounded-2xl p-8 shadow-lg border ${colors.cardBorder} max-w-md w-full mx-4`}>
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
                <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill="white"/>
              </svg>
            </div>
            <span className={`${colors.text} text-xl font-bold`}>登录 Kiro 账号</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => handleLogin('Google')}
            disabled={!!loadingProvider}
            onMouseEnter={() => setHoveredProvider('Google')}
            onMouseLeave={() => setHoveredProvider(null)}
            className="relative w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl transition-all disabled:opacity-50 shadow-sm"
          >
            <div className="flex items-center gap-3">
              {loadingProvider === 'Google' ? (
                <Loader size={20} className="animate-spin text-white" />
              ) : (
                <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
                  <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill="white"/>
                </svg>
              )}
              <span className="text-white font-medium text-base">
                {loadingProvider === 'Google' ? '正在打开登录页面...' : '使用 Google 登录'}
              </span>
            </div>
            {hoveredProvider === 'Google' && !loadingProvider && (
              <span className="absolute right-4 text-white text-sm opacity-80">→</span>
            )}
          </button>

          <button
            onClick={() => handleLogin('Github')}
            disabled={!!loadingProvider}
            onMouseEnter={() => setHoveredProvider('Github')}
            onMouseLeave={() => setHoveredProvider(null)}
            className="relative w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black rounded-xl transition-all disabled:opacity-50 shadow-sm"
          >
            <div className="flex items-center gap-3">
              {loadingProvider === 'Github' ? (
                <Loader size={20} className="animate-spin text-white" />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              )}
              <span className="text-white font-medium text-base">使用 GitHub 登录</span>
            </div>
            {hoveredProvider === 'Github' && !loadingProvider && (
              <span className="absolute right-4 text-white text-sm opacity-80">→</span>
            )}
          </button>

          <button
            disabled
            className={`w-full flex items-center justify-center gap-3 px-4 py-3.5 ${isDark ? 'bg-gray-800' : 'bg-gray-200'} rounded-xl opacity-50 cursor-not-allowed`}
          >
            <svg width="28" height="20" viewBox="0 0 64 32" fill="none">
              <text x="0" y="16" fill={isDark ? 'white' : '#333'} fontSize="14" fontFamily="system-ui">aws</text>
              <path d="M4 22c6 4 13 6 20 6 7 0 14-2 20-6" stroke="#FF9900" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className={`${colors.text} font-medium text-base`}>BuilderId (即将支持)</span>
          </button>

          <p className={`text-center ${colors.textMuted} text-sm pt-2`}>
            将打开 Kiro 官方登录页面，登录成功后自动获取账号信息
          </p>
        </div>

        <p className={`mt-6 text-xs ${colors.textMuted} text-center`}>
          登录即表示同意 AWS 服务条款和隐私政策
        </p>
      </div>
    </div>
  )
}

export default Login

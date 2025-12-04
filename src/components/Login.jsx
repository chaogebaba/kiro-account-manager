import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { listen } from '@tauri-apps/api/event'
import { Loader } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

function Login({ onLogin }) {
  const { theme, colors } = useTheme()
  // 深色主题判断
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
      await invoke('kiro_login', { provider })
    } catch (e) {
      console.error('Login error:', e)
      setError(typeof e === 'string' ? e : e.message || '登录失败')
    } finally {
      setLoadingProvider(null)
    }
  }

  const handleBuilderIdLogin = async () => {
    setLoadingProvider('BuilderId')
    setError('')
    try {
      await invoke('kiro_login', { provider: 'BuilderId' })
    } catch (e) {
      console.error('BuilderId login error:', e)
      setError(typeof e === 'string' ? e : e.message || '登录失败')
    } finally {
      setLoadingProvider(null)
    }
  }

  // 根据主题获取按钮样式 - 深浅主题用完全不同的风格
  const getGoogleButtonStyle = () => {
    if (isDark) {
      // 深色主题：半透明玻璃风格 + 边框
      return 'bg-blue-500/20 hover:bg-blue-500/30 border-2 border-blue-500/50 hover:border-blue-400'
    }
    // 浅色主题：蓝紫渐变 + 更强的阴影和 hover 效果
    return 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 shadow-lg shadow-blue-500/25'
  }

  const getGithubButtonStyle = () => {
    if (isDark) {
      // 深色主题：半透明玻璃风格 + 边框
      return 'bg-white/10 hover:bg-white/20 border-2 border-white/30 hover:border-white/50'
    }
    // 浅色主题：实心黑色渐变
    return 'bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800'
  }

  // 文字颜色
  const getGoogleTextColor = () => isDark ? 'text-blue-300' : 'text-white'
  const getGithubTextColor = () => isDark ? 'text-gray-200' : 'text-white'

  return (
    <div className={`h-full flex items-center justify-center ${colors.main}`}>
      <div className={`${colors.card} rounded-2xl p-8 shadow-xl border ${colors.cardBorder} max-w-md w-full mx-4`}>
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 ${isDark ? 'bg-gradient-to-br from-blue-600 to-purple-700' : 'bg-gradient-to-br from-blue-500 to-purple-600'} rounded-xl flex items-center justify-center shadow-lg`}>
              <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
                <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill="white"/>
              </svg>
            </div>
            <span className={`${colors.text} text-xl font-bold`}>登录 Kiro 账号</span>
          </div>
        </div>

        {error && (
          <div className={`mb-4 px-4 py-3 ${isDark ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'} border rounded-xl text-sm text-center`}>
            {error}
          </div>
        )}

        <div className="space-y-3">
          {/* Google 登录按钮 */}
          <button
            onClick={() => handleLogin('Google')}
            disabled={!!loadingProvider}
            onMouseEnter={() => setHoveredProvider('Google')}
            onMouseLeave={() => setHoveredProvider(null)}
            className={`relative w-full flex items-center justify-center gap-3 px-4 py-3.5 ${getGoogleButtonStyle()} hover:shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02] rounded-xl transition-all duration-200 disabled:opacity-50 shadow-md`}
          >
            <div className="flex items-center gap-3">
              {loadingProvider === 'Google' ? (
                <Loader size={20} className={`animate-spin ${getGoogleTextColor()}`} />
              ) : (
                <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
                  <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill={isDark ? '#93c5fd' : 'white'}/>
                </svg>
              )}
              <span className={`${getGoogleTextColor()} font-medium text-base`}>
                {loadingProvider === 'Google' ? '正在打开登录页面...' : '使用 Google 登录'}
              </span>
            </div>
            {hoveredProvider === 'Google' && !loadingProvider && (
              <span className={`absolute right-4 ${getGoogleTextColor()} text-sm font-medium`}>Sign in →</span>
            )}
          </button>

          {/* GitHub 登录按钮 */}
          <button
            onClick={() => handleLogin('Github')}
            disabled={!!loadingProvider}
            onMouseEnter={() => setHoveredProvider('Github')}
            onMouseLeave={() => setHoveredProvider(null)}
            className={`relative w-full flex items-center justify-center gap-3 px-4 py-3.5 ${getGithubButtonStyle()} hover:shadow-lg hover:shadow-gray-500/30 hover:scale-[1.02] rounded-xl transition-all duration-200 disabled:opacity-50 shadow-md`}
          >
            <div className="flex items-center gap-3">
              {loadingProvider === 'Github' ? (
                <Loader size={20} className={`animate-spin ${getGithubTextColor()}`} />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill={isDark ? '#e5e7eb' : 'white'}>
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              )}
              <span className={`${getGithubTextColor()} font-medium text-base`}>使用 GitHub 登录</span>
            </div>
            {hoveredProvider === 'Github' && !loadingProvider && (
              <span className={`absolute right-4 ${getGithubTextColor()} text-sm font-medium`}>Sign in →</span>
            )}
          </button>

          {/* AWS Builder ID 登录按钮 */}
          <button
            onClick={() => handleBuilderIdLogin()}
            disabled={!!loadingProvider}
            onMouseEnter={() => setHoveredProvider('BuilderId')}
            onMouseLeave={() => setHoveredProvider(null)}
            className={`relative w-full flex items-center justify-center gap-3 px-4 py-3.5 ${isDark ? 'bg-orange-500/20 hover:bg-orange-500/30 border-2 border-orange-500/50 hover:border-orange-400' : 'bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:via-amber-600 hover:to-yellow-600 shadow-lg shadow-orange-500/25'} hover:shadow-lg hover:shadow-orange-500/30 hover:scale-[1.02] rounded-xl transition-all duration-200 disabled:opacity-50 shadow-md`}
          >
            <div className="flex items-center gap-3">
              {loadingProvider === 'BuilderId' ? (
                <Loader size={20} className={`animate-spin ${isDark ? 'text-orange-300' : 'text-white'}`} />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={isDark ? '#fdba74' : 'white'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              <span className={`${isDark ? 'text-orange-300' : 'text-white'} font-medium text-base`}>
                {loadingProvider === 'BuilderId' ? '正在打开登录页面...' : '使用 AWS Builder ID 登录'}
              </span>
            </div>
            {hoveredProvider === 'BuilderId' && !loadingProvider && (
              <span className={`absolute right-4 ${isDark ? 'text-orange-300' : 'text-white'} text-sm font-medium`}>Sign in →</span>
            )}
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

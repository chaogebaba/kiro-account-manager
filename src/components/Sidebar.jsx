import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { Home, Key, Settings, Info, User, LogIn, Sun, Moon, Palette } from 'lucide-react'
import { useTheme, themes } from '../contexts/ThemeContext'

const VERSION = '1.0.0'

const menuItems = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'token', label: '账号管理', icon: Key },
  { id: 'login', label: '登录', icon: LogIn },
  { id: 'settings', label: '设置', icon: Settings },
  { id: 'about', label: '关于', icon: Info },
]

function Sidebar({ activeMenu, onMenuChange, user }) {
  const [localToken, setLocalToken] = useState(null)
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const { theme, setTheme, colors } = useTheme()

  useEffect(() => {
    invoke('get_kiro_local_token').then(setLocalToken).catch(() => {})
  }, [])

  const themeIcons = { light: Sun, dark: Moon, purple: Palette, green: Palette }
  const ThemeIcon = themeIcons[theme] || Sun

  return (
    <div className={`w-56 ${colors.sidebar} ${colors.sidebarText} flex flex-col relative`}>
      {/* Logo */}
      <div className="p-5 pb-4">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
              <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill="white"/>
            </svg>
          </div>
          <div>
            <span className="font-bold text-lg tracking-wide">KIRO</span>
            <p className={`text-xs ${colors.sidebarMuted}`}>Token Manager</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activeMenu === item.id
          return (
            <button
              key={item.id}
              onClick={() => onMenuChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all rounded-xl ${
                isActive ? `${colors.sidebarActive} font-medium shadow-sm` : `${colors.sidebarText} ${colors.sidebarHover}`
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-sm">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* 当前账号状态 - 合并显示 */}
      {(user?.email?.includes('@') || localToken) && (
        <div className={`mx-3 mb-3 ${colors.sidebarCard} rounded-xl p-3`}>
          <div className={`text-xs ${colors.sidebarMuted} mb-2 flex items-center gap-1.5`}>
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
            {localToken ? 'Kiro IDE 已连接' : '已登录'}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-sm font-medium text-green-300">
              {user?.email?.[0]?.toUpperCase() || <User size={14} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{user?.email || localToken?.provider}</div>
              <div className={`text-xs ${colors.sidebarMuted}`}>
                {user?.provider || (localToken?.expiresAt ? new Date(localToken.expiresAt).toLocaleTimeString() : '')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Theme & Version */}
      <div className={`px-3 pb-3 flex items-center justify-between`}>
        <div className="relative">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 ${colors.sidebarCard} rounded-lg text-xs ${colors.sidebarMuted} hover:text-white transition-colors`}
          >
            <ThemeIcon size={14} />
            <span>{themes[theme].name}</span>
          </button>
          
          {showThemeMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowThemeMenu(false)} />
              <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[100px] z-50">
                {Object.entries(themes).map(([key, t]) => {
                  const TIcon = themeIcons[key] || Sun
                  return (
                    <button
                      key={key}
                      onClick={() => { setTheme(key); setShowThemeMenu(false) }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                        theme === key ? 'text-blue-600 font-medium' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <TIcon size={14} />
                      {t.name}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
        
        <span className={`text-xs ${colors.sidebarMuted}`}>v{VERSION}</span>
      </div>
    </div>
  )
}

export default Sidebar

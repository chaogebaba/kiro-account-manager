import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { Key, Settings, Info, LogOut, Plus, User } from 'lucide-react'

const menuItems = [
  { id: 'token', label: '账号管理', icon: Key },
  { id: 'settings', label: '设置', icon: Settings },
  { id: 'about', label: '关于', icon: Info },
]

function Sidebar({ activeMenu, onMenuChange, user, onLogout, onAddAccount }) {
  const [localToken, setLocalToken] = useState(null)

  useEffect(() => {
    // 读取本地 Kiro IDE 的登录信息
    invoke('get_kiro_local_token').then(token => {
      setLocalToken(token)
    }).catch(() => {})
  }, [])
  return (
    <div className="w-52 bg-gradient-to-b from-[#4361ee] to-[#3651de] text-white flex flex-col">
      {/* Logo */}
      <div className="p-5 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
            <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill="white"/>
          </svg>
          <span className="font-bold text-xl tracking-wide">KIRO</span>
        </div>
        <p className="text-xs text-blue-200/80">Token Manager</p>
      </div>

      {/* Add Account Button */}
      <div className="px-4 pb-4">
        <button
          onClick={onAddAccount}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          添加账号
        </button>
      </div>

      {/* Menu */}
      <nav className="flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activeMenu === item.id
          return (
            <button
              key={item.id}
              onClick={() => onMenuChange(item.id)}
              className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-all ${
                isActive
                  ? 'bg-white text-[#4361ee] font-medium'
                  : 'text-white/90 hover:bg-white/10'
              }`}
            >
              <Icon size={18} />
              <span className="text-sm">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Kiro IDE Local Token */}
      {localToken && (
        <div className="px-4 py-3 border-t border-white/20">
          <div className="text-xs text-blue-200/60 mb-2">Kiro IDE 当前账号</div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
              <User size={14} className="text-green-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white/90">{localToken.provider}</div>
              <div className="text-xs text-blue-200/60 truncate">
                {localToken.expiresAt ? new Date(localToken.expiresAt).toLocaleString() : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Info & Logout */}
      <div className="p-4 border-t border-white/20">
        {user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-medium">
                {user.name?.[0] || user.email?.[0] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user.email}</div>
                <div className="text-xs text-blue-200/80">{user.provider}</div>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 text-sm text-white/70 hover:text-white w-full transition-colors"
            >
              <LogOut size={14} />
              <span>退出登录</span>
            </button>
          </div>
        ) : (
          <p className="text-xs text-blue-200/60 text-center">未登录</p>
        )}
      </div>
    </div>
  )
}

export default Sidebar

import { Key, Settings, Wifi, Info, Monitor } from 'lucide-react'

const menuItems = [
  { id: 'token', label: 'Token 管理', icon: Key, badge: 5 },
  { id: 'settings', label: 'Kiro 设置', icon: Settings },
  { id: 'network', label: '网络检测', icon: Wifi },
  { id: 'about', label: '关于', icon: Info },
]

function Sidebar({ activeMenu, onMenuChange }) {
  return (
    <div className="w-44 bg-[#4361ee] text-white flex flex-col">
      {/* Logo */}
      <div className="p-4 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <Monitor size={20} />
          <span className="font-semibold text-lg">Kiro Token</span>
        </div>
        <div className="font-semibold text-lg mb-1">Manager</div>
        <p className="text-xs text-blue-200 opacity-80">管理你的 Kiro 访问令牌</p>
      </div>

      {/* Menu */}
      <nav className="flex-1 mt-4">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activeMenu === item.id
          return (
            <button
              key={item.id}
              onClick={() => onMenuChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                isActive
                  ? 'bg-white text-[#4361ee]'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <Icon size={18} />
              <span className="text-sm">{item.label}</span>
              {item.badge && (
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-[#4361ee] text-white' : 'bg-white/20'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/20">
        <button className="flex items-center gap-2 text-sm text-white/80 hover:text-white">
          <Monitor size={16} />
          <span>原始系统</span>
        </button>
      </div>
    </div>
  )
}

export default Sidebar

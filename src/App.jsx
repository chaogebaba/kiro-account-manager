import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/api/shell'
import Sidebar from './components/Sidebar'
import Home from './components/Home'
import TokenManager from './components/TokenManager'
import Settings from './components/Settings'
import About from './components/About'
import Login from './components/Login'
import AuthCallback from './components/AuthCallback'
import { useTheme } from './contexts/ThemeContext'

const CURRENT_VERSION = '1.0.1'
const GITHUB_REPO = 'hj01857655/kiro-token-manager'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeMenu, setActiveMenu] = useState('home')
  const [updateInfo, setUpdateInfo] = useState(null)
  const { colors } = useTheme()

  // 检查更新
  const checkForUpdates = async () => {
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
      if (!res.ok) return
      const data = await res.json()
      const latestVersion = data.tag_name.replace('v', '')
      if (latestVersion !== CURRENT_VERSION && compareVersions(latestVersion, CURRENT_VERSION) > 0) {
        setUpdateInfo({ version: latestVersion, url: data.html_url })
      }
    } catch (e) {
      console.log('Check update failed:', e)
    }
  }

  // 版本比较
  const compareVersions = (a, b) => {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) > (pb[i] || 0)) return 1
      if ((pa[i] || 0) < (pb[i] || 0)) return -1
    }
    return 0
  }

  useEffect(() => {
    checkAuth()
    checkForUpdates()
    
    // 检查是否是回调页面
    const url = new URL(window.location.href)
    if (url.pathname === '/callback' && (url.searchParams.has('code') || url.searchParams.has('state'))) {
      // 显示回调页面
      setActiveMenu('callback')
      return
    }
    
    // 监听登录成功事件
    const unlisten = listen('login-success', (event) => {
      console.log('Login success in App:', event.payload)
      checkAuth()
      setActiveMenu('token')
    })
    
    return () => { unlisten.then(fn => fn()) }
  }, [])

  const checkAuth = async () => {
    try {
      const currentUser = await invoke('get_current_user')
      setUser(currentUser)
    } catch (e) {
      console.error('Auth check failed:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = (loggedInUser) => {
    if (loggedInUser) {
      setUser(loggedInUser)
    }
    checkAuth()
  }

  const handleLogout = async () => {
    await invoke('logout')
    setUser(null)
  }

  const renderContent = () => {
    switch (activeMenu) {
      case 'home': return <Home onNavigate={setActiveMenu} />
      case 'token': return <TokenManager />
      case 'login': return <Login onLogin={(user) => { handleLogin(user); setActiveMenu('token'); }} />
      case 'callback': return <AuthCallback />
      case 'settings': return <Settings />
      case 'about': return <About />
      default: return <Home />
    }
  }

  if (loading) {
    return (
      <div className="h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="text-white">加载中...</div>
      </div>
    )
  }

  return (
    <div className={`flex h-screen ${colors.main}`}>
      <Sidebar 
        activeMenu={activeMenu} 
        onMenuChange={setActiveMenu}
        user={user}
        onLogout={handleLogout}
      />
      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>
      
      {/* 更新提示 */}
      {updateInfo && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50">
          <div>
            <div className="font-medium">发现新版本 v{updateInfo.version}</div>
            <div className="text-sm text-blue-200">当前版本 v{CURRENT_VERSION}</div>
          </div>
          <button
            onClick={() => open(updateInfo.url)}
            className="bg-white text-blue-600 px-3 py-1 rounded-lg text-sm font-medium hover:bg-blue-50"
          >
            去下载
          </button>
          <button
            onClick={() => setUpdateInfo(null)}
            className="text-blue-200 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

export default App

import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { listen } from '@tauri-apps/api/event'
import Sidebar from './components/Sidebar'
import TokenManager from './components/TokenManager'
import Settings from './components/Settings'
import About from './components/About'
import Login from './components/Login'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeMenu, setActiveMenu] = useState('token')
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    checkAuth()
    
    // 监听登录成功事件
    const unlisten = listen('login-success', (event) => {
      console.log('Login success in App:', event.payload)
      setShowLogin(false)
      checkAuth()
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
    setUser(loggedInUser)
    setShowLogin(false)
  }

  const handleLogout = async () => {
    await invoke('logout')
    setUser(null)
  }

  const handleAddAccount = () => {
    setShowLogin(true)
  }

  const renderContent = () => {
    switch (activeMenu) {
      case 'token': return <TokenManager />
      case 'settings': return <Settings />
      case 'about': return <About />
      default: return <TokenManager />
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
    <div className="flex h-screen bg-gray-100">
      <Sidebar 
        activeMenu={activeMenu} 
        onMenuChange={setActiveMenu}
        user={user}
        onLogout={handleLogout}
        onAddAccount={handleAddAccount}
      />
      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>
      
      {/* 登录弹窗 - 用于添加账号 */}
      {showLogin && (
        <Login onLogin={handleLogin} onCancel={() => setShowLogin(false)} />
      )}
    </div>
  )
}

export default App

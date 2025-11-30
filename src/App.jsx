import { useState } from 'react'
import Sidebar from './components/Sidebar'
import TokenManager from './components/TokenManager'
import Settings from './components/Settings'
import NetworkTest from './components/NetworkTest'
import About from './components/About'
import Login from './components/Login'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [activeMenu, setActiveMenu] = useState('token')

  const handleLogin = (provider) => {
    console.log('Login with:', provider)
    // 这里可以接入实际的 OAuth 逻辑
    setIsLoggedIn(true)
  }

  const renderContent = () => {
    switch (activeMenu) {
      case 'token':
        return <TokenManager />
      case 'settings':
        return <Settings />
      case 'network':
        return <NetworkTest />
      case 'about':
        return <About />
      default:
        return <TokenManager />
    }
  }

  // 未登录显示登录页
  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activeMenu={activeMenu} onMenuChange={setActiveMenu} />
      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>
    </div>
  )
}

export default App

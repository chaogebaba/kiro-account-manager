import React from 'react'
import ReactDOM from 'react-dom/client'
import { getCurrentWindow } from '@tauri-apps/api/window'
import App from './App.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { DialogProvider } from './contexts/DialogContext.jsx'
import './index.css'

// 生产环境禁用开发者工具
if (import.meta.env.PROD) {
  // 禁用 F12、Ctrl+Shift+I、Ctrl+Shift+J、Ctrl+U
  document.addEventListener('keydown', (e) => {
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
      (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) ||
      (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
    ) {
      e.preventDefault()
      e.stopPropagation()
      return false
    }
  })
  
  // 禁用右键菜单
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    return false
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <DialogProvider>
        <App />
      </DialogProvider>
    </ThemeProvider>
  </React.StrictMode>,
)

// 页面加载完成后显示窗口
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    getCurrentWindow().show()
  }, 100)
})

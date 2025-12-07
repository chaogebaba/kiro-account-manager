import React from 'react'
import ReactDOM from 'react-dom/client'
import { getCurrentWindow } from '@tauri-apps/api/window'
import App from './App.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { DialogProvider } from './contexts/DialogContext.jsx'
import './index.css'

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

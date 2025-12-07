import { useState, useEffect } from 'react'
import { Github, Heart, Coffee, ExternalLink, Sparkles, Code2, Palette, Cpu, RefreshCw } from 'lucide-react'
import { open } from '@tauri-apps/plugin-shell'
import { getVersion } from '@tauri-apps/api/app'
import { useTheme } from '../contexts/ThemeContext'
import alipayQR from '../assets/donate/alipay.jpg'
import wechatQR from '../assets/donate/wechat.jpg'

const GITHUB_REPO = 'hj01857655/kiro-account-manager'

// 版本比较：a > b 返回 1，a < b 返回 -1，相等返回 0
const compareVersions = (a, b) => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1
    if ((pa[i] || 0) < (pb[i] || 0)) return -1
  }
  return 0
}

function About() {
  const { theme, colors } = useTheme()
  const isDark = theme === 'dark'
  const [version, setVersion] = useState('')
  const [checking, setChecking] = useState(false)
  const [updateStatus, setUpdateStatus] = useState(null)

  useEffect(() => {
    getVersion().then(setVersion)
  }, [])

  const checkUpdate = async () => {
    if (!version) return
    setChecking(true)
    setUpdateStatus(null)
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
      if (!res.ok) throw new Error('请求失败')
      const data = await res.json()
      const latest = data.tag_name.replace('v', '')
      const cmp = compareVersions(latest, version)
      if (cmp > 0) {
        setUpdateStatus({ type: 'update', message: `发现新版本 v${latest}`, url: data.html_url })
      } else {
        setUpdateStatus({ type: 'latest', message: '已是最新版本' })
      }
    } catch (e) {
      setUpdateStatus({ type: 'error', message: '检查失败，请稀后重试' })
    }
    setChecking(false)
  }

  const techStack = [
    { icon: Code2, label: '前端', value: 'React 18 + Vite', color: 'text-cyan-500' },
    { icon: Palette, label: 'UI', value: 'TailwindCSS', color: 'text-pink-500' },
    { icon: Cpu, label: '后端', value: 'Tauri + Rust', color: 'text-orange-500' },
  ]

  return (
    <div className={`h-full ${colors.main} p-6 flex items-center justify-center`}>
      {/* 背景装饰 */}
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />
      
      <div className={`card-glow ${colors.card} rounded-3xl p-8 shadow-2xl border ${colors.cardBorder} text-center max-w-md w-full opacity-0 animate-scale-in relative`}>
        {/* Logo */}
        <div className="flex justify-center mb-5">
          <div className="relative group">
            <div className={`absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity`} />
            <div className="relative w-20 h-20 bg-gradient-to-br from-[#4361ee] to-[#7c3aed] rounded-3xl flex items-center justify-center shadow-lg transform group-hover:scale-105 group-hover:rotate-3 transition-all animate-float">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill="white"/>
              </svg>
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center shadow-md animate-pulse">
              <Sparkles size={14} className="text-white" />
            </div>
          </div>
        </div>

        {/* 标题 */}
        <h1 className={`text-xl font-bold ${colors.text} mb-1.5 opacity-0 animate-pop-up delay-100`}>Kiro Account Manager</h1>
        <div className="flex items-center justify-center gap-2 mb-3 opacity-0 animate-pop-up delay-200">
          <span className={`px-2.5 py-0.5 ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'} rounded-full text-xs font-medium`}>
            v{version || '...'}
          </span>
          <button
            onClick={checkUpdate}
            disabled={checking}
            className={`btn-icon px-2.5 py-0.5 ${isDark ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-green-100 text-green-600 hover:bg-green-200'} rounded-full text-xs font-medium flex items-center gap-1 transition-colors`}
          >
            <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
            {checking ? '检查中' : '检查更新'}
          </button>
        </div>
        {updateStatus && (
          <div className={`mb-3 px-3 py-2 rounded-lg text-xs opacity-0 animate-fade-in ${
            updateStatus.type === 'latest' ? (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600') :
            updateStatus.type === 'update' ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600') :
            (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600')
          }`}>
            {updateStatus.message}
            {updateStatus.url && (
              <button onClick={() => open(updateStatus.url)} className="ml-2 underline">去下载</button>
            )}
          </div>
        )}
        <p className={`${colors.textMuted} text-sm mb-5 opacity-0 animate-blur-in delay-300`}>智能管理 Kiro 访问令牌，一键切换，配额监控</p>

        {/* 技术栈卡片 */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {techStack.map(({ icon: Icon, label, value, color }, index) => (
            <div 
              key={label} 
              className={`${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'} rounded-xl p-3 transition-all hover:scale-105 opacity-0 animate-fade-in-up`}
              style={{ animationDelay: `${0.3 + index * 0.1}s` }}
            >
              <Icon size={20} className={`${color} mx-auto mb-1.5 transition-transform group-hover:scale-110`} />
              <div className={`text-xs ${colors.textMuted}`}>{label}</div>
              <div className={`text-xs font-medium ${colors.text} truncate`}>{value}</div>
            </div>
          ))}
        </div>

        {/* 链接按钮 */}
        <div className="space-y-2 mb-5">
          <a 
            href="https://github.com/hj01857655/kiro-account-manager" 
            target="_blank" 
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-3 ${isDark ? 'bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600' : 'bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700'} rounded-xl p-3 transition-all group hover:scale-[1.02] hover:shadow-lg opacity-0 animate-fade-in-up delay-400`}
          >
            <Github size={18} className="text-white transition-transform group-hover:scale-110" />
            <span className="text-white font-medium text-sm">Github</span>
            <ExternalLink size={14} className="text-white/60 group-hover:text-white transition-colors" />
          </a>
          <a 
            href="https://qm.qq.com/q/Vh7mUrNpa8" 
            target="_blank" 
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-3 ${isDark ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400' : 'bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500'} rounded-xl p-3 transition-all group hover:scale-[1.02] hover:shadow-lg opacity-0 animate-fade-in-up delay-500`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white" className="transition-transform group-hover:scale-110">
              <path d="M12.003 2c-2.265 0-6.29 1.364-6.29 7.325v1.195S3.55 14.96 3.55 17.474c0 .665.17 1.025.281 1.025.114 0 .902-.484 1.748-2.072 0 0-.18 2.197 1.904 3.967 0 0-1.77.495-1.77 1.182 0 .686 4.078.43 6.29.43 2.213 0 6.29.256 6.29-.43 0-.687-1.77-1.182-1.77-1.182 2.085-1.77 1.905-3.967 1.905-3.967.845 1.588 1.634 2.072 1.746 2.072.111 0 .283-.36.283-1.025 0-2.514-2.166-6.954-2.166-6.954V9.325C18.29 3.364 14.268 2 12.003 2z"/>
            </svg>
            <span className="text-white font-medium text-sm">QQ群: 1020204332</span>
            <ExternalLink size={14} className="text-white/60 group-hover:text-white transition-colors" />
          </a>
        </div>

        {/* 请作者喝杯咖啡 */}
        <div className={`${isDark ? 'bg-white/5' : 'bg-gray-50'} rounded-xl p-4 mb-5 opacity-0 animate-fade-in-up delay-500`}>
          <div className="flex items-center justify-center gap-2 mb-3">
            <Coffee size={16} className="text-amber-500" />
            <span className={`text-sm font-medium ${colors.text}`}>请作者喝杯咖啡</span>
          </div>
          <div className="flex justify-center gap-4">
            {/* 支付宝 */}
            <div className="text-center">
              <img src={alipayQR} alt="支付宝" className="w-24 h-24 rounded-lg object-cover mb-1" />
              <span className={`text-xs ${colors.textMuted}`}>支付宝</span>
            </div>
            {/* 微信 */}
            <div className="text-center">
              <img src={wechatQR} alt="微信" className="w-24 h-24 rounded-lg object-cover mb-1" />
              <span className={`text-xs ${colors.textMuted}`}>微信支付</span>
            </div>
          </div>
        </div>

        {/* 底部 */}
        <div className={`flex items-center justify-center gap-1.5 text-xs ${colors.textMuted} opacity-0 animate-fade-in delay-600`}>
          <span>Made with</span>
          <Heart size={12} className="text-red-500 fill-red-500 animate-pulse" />
          <span>by hj01857655</span>
          <span className="mx-1">·</span>
          <Coffee size={12} className="text-amber-500" />
          <span>© 2025</span>
        </div>
      </div>
    </div>
  )
}

export default About

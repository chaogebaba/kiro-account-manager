import { Github, Heart, Coffee, Star, ExternalLink, Sparkles, Code2, Palette, Cpu } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

function About() {
  const { theme, colors } = useTheme()
  const isDark = theme === 'dark'

  const techStack = [
    { icon: Code2, label: '前端', value: 'React 18 + Vite', color: 'text-cyan-500' },
    { icon: Palette, label: 'UI', value: 'TailwindCSS', color: 'text-pink-500' },
    { icon: Cpu, label: '后端', value: 'Tauri + Rust', color: 'text-orange-500' },
  ]

  return (
    <div className={`h-full ${colors.main} p-6 flex items-center justify-center`}>
      <div className={`${colors.card} rounded-3xl p-8 shadow-2xl border ${colors.cardBorder} text-center max-w-md w-full`}>
        {/* Logo */}
        <div className="flex justify-center mb-5">
          <div className="relative group">
            <div className={`absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity`} />
            <div className="relative w-20 h-20 bg-gradient-to-br from-[#4361ee] to-[#7c3aed] rounded-3xl flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill="white"/>
              </svg>
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center shadow-md">
              <Sparkles size={14} className="text-white" />
            </div>
          </div>
        </div>

        {/* 标题 */}
        <h1 className={`text-xl font-bold ${colors.text} mb-1.5`}>Kiro Token Manager</h1>
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className={`px-2.5 py-0.5 ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'} rounded-full text-xs font-medium`}>
            v1.0.0
          </span>
        </div>
        <p className={`${colors.textMuted} text-sm mb-5`}>智能管理 Kiro 访问令牌，一键切换，配额监控</p>

        {/* 技术栈卡片 */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {techStack.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className={`${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'} rounded-xl p-3 transition-colors`}>
              <Icon size={20} className={`${color} mx-auto mb-1.5`} />
              <div className={`text-xs ${colors.textMuted}`}>{label}</div>
              <div className={`text-xs font-medium ${colors.text} truncate`}>{value}</div>
            </div>
          ))}
        </div>

        {/* 链接按钮 */}
        <div className="space-y-2 mb-5">
          <a 
            href="https://github.com/hj01857655/kiro-token-manager" 
            target="_blank" 
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-3 ${isDark ? 'bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600' : 'bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700'} rounded-xl p-3 transition-all group`}
          >
            <Github size={18} className="text-white" />
            <span className="text-white font-medium text-sm">GitHub</span>
            <ExternalLink size={14} className="text-white/60 group-hover:text-white transition-colors" />
          </a>
          <a 
            href="https://qm.qq.com/q/Vh7mUrNpa8" 
            target="_blank" 
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-3 ${isDark ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400' : 'bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500'} rounded-xl p-3 transition-all group`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12.003 2c-2.265 0-6.29 1.364-6.29 7.325v1.195S3.55 14.96 3.55 17.474c0 .665.17 1.025.281 1.025.114 0 .902-.484 1.748-2.072 0 0-.18 2.197 1.904 3.967 0 0-1.77.495-1.77 1.182 0 .686 4.078.43 6.29.43 2.213 0 6.29.256 6.29-.43 0-.687-1.77-1.182-1.77-1.182 2.085-1.77 1.905-3.967 1.905-3.967.845 1.588 1.634 2.072 1.746 2.072.111 0 .283-.36.283-1.025 0-2.514-2.166-6.954-2.166-6.954V9.325C18.29 3.364 14.268 2 12.003 2z"/>
            </svg>
            <span className="text-white font-medium text-sm">QQ群: 1020204332</span>
            <ExternalLink size={14} className="text-white/60 group-hover:text-white transition-colors" />
          </a>
        </div>

        {/* 底部 */}
        <div className={`flex items-center justify-center gap-1.5 text-xs ${colors.textMuted}`}>
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

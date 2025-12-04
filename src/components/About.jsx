import { Monitor, Github, Heart, Coffee, Star, ExternalLink } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

function About() {
  const { theme, colors } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className={`h-full ${colors.main} p-6 flex items-center justify-center`}>
      <div className={`${colors.card} rounded-3xl p-10 shadow-xl border ${colors.cardBorder} text-center max-w-lg`}>
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-br from-[#4361ee] to-[#7c3aed] rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/30 transform hover:scale-105 transition-transform">
              <Monitor size={48} className="text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-md">
              <Star size={16} className="text-white" />
            </div>
          </div>
        </div>

        {/* 标题 */}
        <h1 className={`text-2xl font-bold ${colors.text} mb-2`}>Kiro Token Manager</h1>
        <div className={`inline-flex px-3 py-1 ${isDark ? 'bg-blue-500/20' : 'bg-blue-50'} text-blue-500 rounded-full text-sm font-medium mb-3`}>
          v1.0.0
        </div>
        <p className={`${colors.textMuted} mb-6`}>管理你的 Kiro 访问令牌，智能切换，配额监控</p>

        {/* 作者信息 */}
        <div className={`${isDark ? 'bg-gradient-to-r from-purple-500/10 to-blue-500/10' : 'bg-gradient-to-r from-purple-50 to-blue-50'} rounded-2xl p-4 mb-5`}>
          <div className="flex items-center justify-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-white'} shadow-sm flex items-center justify-center`}>
              <Github size={24} className={isDark ? 'text-gray-300' : 'text-gray-700'} />
            </div>
            <div className="text-left">
              <div className={`font-semibold ${colors.text}`}>hj01857655</div>
              <a 
                href="https://github.com/hj01857655/kiro-token-manager" 
                target="_blank" 
                rel="noopener noreferrer"
                className={`text-sm ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-500 hover:text-blue-600'} flex items-center gap-1`}
              >
                kiro-token-manager <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
        
        {/* 技术栈 */}
        <div className={`${isDark ? 'bg-white/5' : 'bg-gray-50'} rounded-2xl p-5 space-y-3 mb-5`}>
          <div className="flex items-center justify-between text-sm">
            <span className={colors.textMuted}>技术栈</span>
            <span className={`${colors.text} font-medium`}>Tauri 1.x + React 18</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={colors.textMuted}>UI 框架</span>
            <span className={`${colors.text} font-medium`}>TailwindCSS + Lucide</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={colors.textMuted}>后端</span>
            <span className={`${colors.text} font-medium`}>Rust</span>
          </div>
        </div>

        {/* 底部 */}
        <div className={`flex items-center justify-center gap-2 text-sm ${colors.textMuted}`}>
          <span>Made with</span>
          <Heart size={14} className="text-red-500 fill-red-500" />
          <span>and</span>
          <Coffee size={14} className="text-amber-500" />
          <span>© 2025</span>
        </div>
      </div>
    </div>
  )
}

export default About

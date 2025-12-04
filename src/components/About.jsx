import { Monitor } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

function About() {
  const { theme, colors } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className={`h-full ${colors.main} p-6 flex items-center justify-center`}>
      <div className={`${colors.card} rounded-3xl p-10 shadow-sm border ${colors.cardBorder} text-center max-w-md`}>
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-gradient-to-br from-[#4361ee] to-[#3651de] rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Monitor size={48} className="text-white" />
          </div>
        </div>
        <h1 className={`text-2xl font-bold ${colors.text} mb-2`}>Kiro Token Manager</h1>
        <div className={`inline-flex px-3 py-1 ${isDark ? 'bg-blue-500/20' : 'bg-blue-50'} text-blue-500 rounded-full text-sm font-medium mb-4`}>
          版本 1.0.0
        </div>
        <p className={`${colors.textMuted} mb-8`}>管理你的 Kiro 访问令牌，智能切换，配额监控</p>
        
        <div className={`${isDark ? 'bg-white/5' : 'bg-gray-50'} rounded-2xl p-5 space-y-3`}>
          <div className="flex items-center justify-between text-sm">
            <span className={colors.textMuted}>技术栈</span>
            <span className={`${colors.text} font-medium`}>Tauri + React</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={colors.textMuted}>UI 框架</span>
            <span className={`${colors.text} font-medium`}>TailwindCSS</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={colors.textMuted}>版权</span>
            <span className={`${colors.text} font-medium`}>© 2025</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default About

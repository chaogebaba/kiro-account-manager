import { useState } from 'react'
import { Lock, Copy, Sun, Moon, Palette, Check } from 'lucide-react'
import { useTheme, themes } from '../contexts/ThemeContext'

function Settings() {
  const { theme, setTheme, colors } = useTheme()
  const isDark = theme === 'dark'
  
  const [aiModel, setAiModel] = useState('Claude Opus 4.5')
  const [lockModel, setLockModel] = useState(true)
  const [httpProxy, setHttpProxy] = useState('http://127.0.0.1:7897')
  const [machineId, setMachineId] = useState('ec088295c978e50c9080aca58282f5ed79db948966213d8da4e86101f2d3a0ff')

  const handleApplyProxy = () => {
    console.log('Apply proxy:', httpProxy)
  }

  const handleResetMachineId = () => {
    const newId = Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('')
    setMachineId(newId)
  }

  const themeOptions = [
    { key: 'light', name: '浅色', icon: Sun, color: 'from-blue-400 to-blue-600' },
    { key: 'dark', name: '深色', icon: Moon, color: 'from-gray-700 to-gray-900' },
    { key: 'purple', name: '紫色', icon: Palette, color: 'from-purple-500 to-purple-700' },
    { key: 'green', name: '绿色', icon: Palette, color: 'from-emerald-500 to-emerald-700' },
  ]

  return (
    <div className={`h-full ${colors.main} p-8 overflow-auto`}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold ${colors.text} mb-2`}>Kiro 设置</h1>
          <p className={colors.textMuted}>配置 Kiro IDE 的模型、代理等设置，修改后即时生效</p>
        </div>

        {/* 主题设置 */}
        <section className={`${colors.card} rounded-2xl p-6 shadow-sm border ${colors.cardBorder} mb-6`}>
          <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>主题设置</h2>
          <p className={`text-sm ${colors.textMuted} mb-5`}>选择你喜欢的界面主题</p>
          
          <div className="grid grid-cols-4 gap-3">
            {themeOptions.map(opt => {
              const Icon = opt.icon
              const isActive = theme === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => setTheme(opt.key)}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    isActive 
                      ? 'border-blue-500 shadow-lg shadow-blue-500/20' 
                      : `${isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'}`
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${opt.color} flex items-center justify-center mx-auto mb-2`}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <div className={`text-sm font-medium ${colors.text}`}>{opt.name}</div>
                  {isActive && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* 模型设置 */}
        <section className={`${colors.card} rounded-2xl p-6 shadow-sm border ${colors.cardBorder} mb-6`}>
          <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>模型设置</h2>
          <p className={`text-sm ${colors.textMuted} mb-5`}>选择默认使用的 AI 模型，并可选择锁定模型防止被修改</p>
          
          <div className="mb-5">
            <label className={`block text-sm ${colors.textMuted} mb-2`}>AI 模型</label>
            <div className="relative">
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 appearance-none cursor-pointer`}
              >
                <option value="Claude Sonnet 4.5">Claude Sonnet 4.5 (⭐ 推荐)</option>
                <option value="Claude Opus 4.5">Claude Opus 4.5</option>
                <option value="Claude Sonnet 4">Claude Sonnet 4</option>
                <option value="Claude Haiku 4.5">Claude Haiku 4.5</option>
                <option value="Auto">Auto</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 4.5L6 8L9.5 4.5" stroke={isDark ? '#888' : '#666'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

          <label className={`flex items-start gap-3 cursor-pointer ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'} rounded-xl p-4 transition-colors`}>
            <input
              type="checkbox"
              checked={lockModel}
              onChange={(e) => setLockModel(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded-lg border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <div className="flex items-center gap-2">
              <Lock size={16} className={colors.textMuted} />
              <div>
                <span className={`text-sm font-medium ${colors.text}`}>锁定模型</span>
                <p className={`text-xs ${colors.textMuted} mt-0.5`}>启用后，将自动监控并恢复 Kiro 配置中的模型设置，防止被其他操作修改</p>
              </div>
            </div>
          </label>
        </section>

        {/* 代理设置 */}
        <section className={`${colors.card} rounded-2xl p-6 shadow-sm border ${colors.cardBorder} mb-6`}>
          <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>代理设置</h2>
          <p className={`text-sm ${colors.textMuted} mb-5`}>
            配置 Kiro IDE 的 HTTP 代理（与 settings.json 中的 http.proxy 同步）
          </p>
          
          <div className="mb-3">
            <label className={`block text-sm ${colors.textMuted} mb-2`}>HTTP 代理</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={httpProxy}
                onChange={(e) => setHttpProxy(e.target.value)}
                placeholder="http://127.0.0.1:7897"
                className={`flex-1 px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2`}
              />
              <button
                onClick={handleApplyProxy}
                className="px-5 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 flex items-center gap-2 font-medium shadow-sm"
              >
                <Copy size={16} />
                应用
              </button>
              <button className={`px-4 py-3 border rounded-xl ${isDark ? 'border-gray-700 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-50'} ${colors.textMuted}`}>
                ↻
              </button>
            </div>
          </div>
          <p className={`text-xs ${colors.textMuted}`}>
            留空表示不使用代理。格式: http://host:port 或 https://host:port。修改后点击"应用"按钮生效
          </p>
        </section>

        {/* Kiro 高级设置 */}
        <section className={`${colors.card} rounded-2xl p-6 shadow-sm border ${colors.cardBorder}`}>
          <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>Kiro 高级设置</h2>
          <div className={`flex items-center gap-2 mt-4 ${isDark ? 'bg-white/5' : 'bg-gray-50'} rounded-xl p-4`}>
            <span className={`text-sm ${colors.textMuted}`}>机器 ID：</span>
            <code className={`text-xs ${isDark ? 'bg-gray-700' : 'bg-gray-200'} px-2 py-1 rounded-lg font-mono ${colors.text}`}>{machineId.slice(0, 16)}...</code>
            <button onClick={handleResetMachineId} className="ml-auto text-sm text-blue-500 hover:underline font-medium">重置</button>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Settings

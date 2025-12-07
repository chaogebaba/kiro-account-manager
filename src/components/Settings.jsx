import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Lock, Copy, Sun, Moon, Palette, Check, RefreshCw, Database, Settings as SettingsIcon, Clock } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useDialog } from '../contexts/DialogContext'

function Settings() {
  const { theme, setTheme, colors } = useTheme()
  const { showConfirm, showError, showSuccess } = useDialog()
  const isDark = theme === 'dark'
  
  const [aiModel, setAiModel] = useState('claude-sonnet-4.5')
  const [lockModel, setLockModel] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [httpProxy, setHttpProxy] = useState('')
  const [originalProxy, setOriginalProxy] = useState('') // 原始代理值，用于判断是否修改
  const [savingProxy, setSavingProxy] = useState(false)
  const [savingModel, setSavingModel] = useState(false)
  
  // Kiro IDE 信息
  const [telemetryInfo, setTelemetryInfo] = useState(null)
  const [loading, setLoading] = useState(false)

  // 加载设置
  const loadSettings = async () => {
    setLoading(true)
    try {
      const [telemetry, kiroSettings, appSettings] = await Promise.all([
        invoke('get_kiro_telemetry_info').catch(() => null),
        invoke('get_kiro_settings').catch(() => null),
        invoke('get_app_settings').catch(() => null)
      ])
      setTelemetryInfo(telemetry)
      // 从 Kiro IDE 设置读取
      if (kiroSettings) {
        const proxy = kiroSettings.httpProxy || ''
        setHttpProxy(proxy)
        setOriginalProxy(proxy)
        setAiModel(kiroSettings.modelSelection || 'claude-sonnet-4.5')
      }
      // 从应用设置读取
      if (appSettings) {
        setLockModel(appSettings.lockModel ?? true)
        setAutoRefresh(appSettings.autoRefresh ?? true)
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
      await showError('加载失败', '加载设置失败: ' + err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  // 保存应用设置
  const saveAppSettings = async (updates) => {
    try {
      const current = await invoke('get_app_settings').catch(() => ({}))
      await invoke('save_app_settings', { settings: { ...current, ...updates } })
    } catch (err) {
      console.error('Failed to save app settings:', err)
      await showError('保存失败', '保存设置失败: ' + err)
    }
  }

  const handleApplyProxy = async () => {
    setSavingProxy(true)
    try {
      await invoke('set_kiro_proxy', { proxy: httpProxy })
      setOriginalProxy(httpProxy) // 保存成功后更新原始值
      await showSuccess('保存成功', httpProxy ? '代理设置已应用' : '代理已清除')
    } catch (err) {
      await showError('保存失败', '保存代理设置失败: ' + err)
    } finally {
      setSavingProxy(false)
    }
  }
  
  // 代理是否有修改
  const proxyChanged = httpProxy !== originalProxy

  const handleApplyModel = async (model) => {
    setAiModel(model)
    setSavingModel(true)
    try {
      await invoke('set_kiro_model', { model })
      // 如果锁定模型，保存到应用设置
      if (lockModel) {
        await saveAppSettings({ locked_model: model })
      }
    } catch (err) {
      await showError('保存失败', '保存模型设置失败: ' + err)
    } finally {
      setSavingModel(false)
    }
  }

  const handleLockModelChange = async (checked) => {
    setLockModel(checked)
    await saveAppSettings({ lock_model: checked, locked_model: checked ? aiModel : null })
  }

  const handleAutoRefreshChange = async (checked) => {
    setAutoRefresh(checked)
    await saveAppSettings({ autoRefresh: checked })
  }

  const [resetting, setResetting] = useState(false)
  const [kiroRunning, setKiroRunning] = useState(false)

  // 检查 Kiro IDE 运行状态
  const checkKiroStatus = async () => {
    try {
      const running = await invoke('is_kiro_ide_running')
      setKiroRunning(running)
    } catch (err) {
      console.error('Failed to check Kiro status:', err)
    }
  }

  useEffect(() => {
    checkKiroStatus()
    // 每30秒检查一次，页面不可见时跳过
    const interval = setInterval(() => {
      if (!document.hidden) checkKiroStatus()
    }, 30000)
    return () => clearInterval(interval)
  }, [])
  
  const handleResetMachineId = async () => {
    // 检查 Kiro IDE 是否运行
    const running = await invoke('is_kiro_ide_running')
    if (running) {
      const confirmed = await showConfirm('关闭 Kiro IDE', '检测到 Kiro IDE 正在运行，需要先关闭才能重置机器 ID。\n\n是否关闭 Kiro IDE 并继续？', { confirmText: '关闭并继续', cancelText: '取消' })
      if (!confirmed) return
      // 关闭 Kiro IDE
      try {
        await invoke('close_kiro_ide')
        // 等待进程完全退出
        await new Promise(r => setTimeout(r, 1000))
      } catch (err) {
        await showError('操作失败', '关闭 Kiro IDE 失败: ' + err)
        return
      }
    } else {
      const confirmed = await showConfirm('重置机器 ID', '确定要重置所有机器 ID 吗？')
      if (!confirmed) return
    }
    
    setResetting(true)
    try {
      const newInfo = await invoke('reset_kiro_machine_id')
      setTelemetryInfo(newInfo)
      
      // 询问是否重新启动
      const shouldStart = await showConfirm('重置成功', '机器 ID 已重置！\n\n是否立即启动 Kiro IDE？', { confirmText: '启动', cancelText: '稍后' })
      if (shouldStart) {
        await invoke('start_kiro_ide')
      }
    } catch (err) {
      console.error('Failed to reset machine ID:', err)
      await showError('重置失败', '重置机器 ID 失败: ' + err)
    } finally {
      setResetting(false)
      checkKiroStatus()
    }
  }

  // 手动关闭/启动 Kiro IDE
  const handleToggleKiro = async () => {
    try {
      if (kiroRunning) {
        await invoke('close_kiro_ide')
      } else {
        await invoke('start_kiro_ide')
      }
      await new Promise(r => setTimeout(r, 500))
      checkKiroStatus()
    } catch (err) {
      await showError('操作失败', err.toString())
    }
  }

  // 格式化时间戳
  const formatTimestamp = (ts) => {
    if (!ts) return '-'
    const date = new Date(ts * 1000)
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  const themeOptions = [
    { key: 'light', name: '浅色', icon: Sun, color: 'from-blue-400 to-blue-600' },
    { key: 'dark', name: '深色', icon: Moon, color: 'from-gray-700 to-gray-900' },
    { key: 'purple', name: '紫色', icon: Palette, color: 'from-purple-500 to-purple-700' },
    { key: 'green', name: '绿色', icon: Palette, color: 'from-emerald-500 to-emerald-700' },
  ]

  // 复制到剪贴板
  const [copiedField, setCopiedField] = useState(null)
  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 1500)
  }

  // 信息项组件
  const InfoItem = ({ label, value, copyable = false, fieldKey }) => (
    <div className={`flex items-center justify-between py-2 ${isDark ? 'border-white/5' : 'border-gray-100'} border-b last:border-0`}>
      <span className={`text-sm ${colors.textMuted}`}>{label}</span>
      <div className="flex items-center gap-2">
        <code className={`text-xs ${isDark ? 'bg-white/10' : 'bg-gray-100'} px-2 py-1 rounded-lg font-mono ${colors.text} max-w-[200px] truncate`}>
          {value || '-'}
        </code>
        {copyable && value && (
          <button 
            onClick={() => copyToClipboard(value, fieldKey)}
            className={`btn-icon p-1 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} transition-colors`}
          >
            {copiedField === fieldKey ? (
              <Check size={14} className="text-green-500" />
            ) : (
              <Copy size={14} className={colors.textMuted} />
            )}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className={`h-full ${colors.main} p-8 overflow-auto`}>
      {/* 背景装饰 */}
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />
      
      <div className="max-w-3xl mx-auto relative">
        {/* Header */}
        <div className="mb-8 opacity-0 animate-slide-in-left">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-500 to-gray-700 rounded-2xl flex items-center justify-center shadow-lg animate-float">
              <SettingsIcon size={24} className="text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${colors.text}`}>Kiro 设置</h1>
              <p className={colors.textMuted}>配置 Kiro IDE 的模型、代理等设置，修改后即时生效</p>
            </div>
          </div>
        </div>

        {/* 主题设置 */}
        <section className={`card-glow ${colors.card} rounded-2xl p-6 shadow-sm border ${colors.cardBorder} mb-6 opacity-0 animate-slide-in-left delay-100`}>
          <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>主题设置</h2>
          <p className={`text-sm ${colors.textMuted} mb-5`}>选择你喜欢的界面主题</p>
          
          <div className="grid grid-cols-4 gap-3">
            {themeOptions.map((opt, index) => {
              const Icon = opt.icon
              const isActive = theme === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => setTheme(opt.key)}
                  className={`relative p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                    isActive 
                      ? 'border-blue-500 shadow-lg shadow-blue-500/20' 
                      : `${isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'}`
                  }`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${opt.color} flex items-center justify-center mx-auto mb-2 transition-transform group-hover:scale-110`}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <div className={`text-sm font-medium ${colors.text}`}>{opt.name}</div>
                  {isActive && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center animate-scale-in">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* 模型设置 */}
        <section className={`card-glow ${colors.card} rounded-2xl p-6 shadow-sm border ${colors.cardBorder} mb-6 opacity-0 animate-slide-in-left delay-200`}>
          <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>模型设置</h2>
          <p className={`text-sm ${colors.textMuted} mb-5`}>选择默认使用的 AI 模型，并可选择锁定模型防止被修改</p>
          
          <div className="mb-5">
            <label className={`block text-sm ${colors.textMuted} mb-2`}>AI 模型 {savingModel && <span className="text-blue-500 text-xs ml-2">保存中...</span>}</label>
            <div className="relative">
              <select
                value={aiModel}
                onChange={(e) => handleApplyModel(e.target.value)}
                disabled={savingModel}
                className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 appearance-none cursor-pointer disabled:opacity-50 transition-all`}
              >
                <option value="claude-sonnet-4.5">Claude Sonnet 4.5 - 1.3x (⭐ 推荐)</option>
                <option value="claude-sonnet-4">Claude Sonnet 4 - 1.3x</option>
                <option value="claude-haiku-4.5">Claude Haiku 4.5 - 0.4x</option>
                <option value="claude-opus-4.5">Claude Opus 4.5 - 2.2x</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 4.5L6 8L9.5 4.5" stroke={isDark ? '#888' : '#666'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

          <label className={`flex items-start gap-3 cursor-pointer ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'} rounded-xl p-4 transition-all hover:scale-[1.01]`}>
            <input
              type="checkbox"
              checked={lockModel}
              onChange={(e) => handleLockModelChange(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded-lg border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <Lock size={16} className={`${colors.textMuted} mt-0.5 flex-shrink-0`} />
            <div>
              <span className={`text-sm font-medium ${colors.text}`}>锁定模型</span>
              <p className={`text-xs ${colors.textMuted} mt-0.5`}>启用后，将自动监控并恢复 Kiro 配置中的模型设置，防止被其他操作修改</p>
            </div>
          </label>
        </section>

        {/* 账号设置 */}
        <section className={`card-glow ${colors.card} rounded-2xl p-6 shadow-sm border ${colors.cardBorder} mb-6 opacity-0 animate-slide-in-left delay-300`}>
          <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>账号设置</h2>
          <p className={`text-sm ${colors.textMuted} mb-5`}>配置账号自动刷新等功能</p>
          
          <label className={`flex items-start gap-3 cursor-pointer ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'} rounded-xl p-4 transition-all hover:scale-[1.01]`}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => handleAutoRefreshChange(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded-lg border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <Clock size={16} className={`${colors.textMuted} mt-0.5 flex-shrink-0`} />
            <div>
              <span className={`text-sm font-medium ${colors.text}`}>自动刷新 Token</span>
              <p className={`text-xs ${colors.textMuted} mt-0.5`}>每 50 分钟自动刷新所有账号的 Token，保持账号始终有效</p>
            </div>
          </label>
        </section>

        {/* 代理设置 */}
        <section className={`card-glow ${colors.card} rounded-2xl p-6 shadow-sm border ${colors.cardBorder} mb-6 opacity-0 animate-slide-in-left delay-400`}>
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
                className={`flex-1 px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
              />
              <button
                onClick={handleApplyProxy}
                disabled={savingProxy || !proxyChanged}
                className={`btn-icon px-5 py-3 rounded-xl flex items-center gap-2 font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                  proxyChanged 
                    ? 'bg-blue-500 text-white hover:bg-blue-600' 
                    : `${isDark ? 'bg-white/10 text-white/50' : 'bg-gray-200 text-gray-400'}`
                }`}
              >
                {savingProxy ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                {savingProxy ? '保存中...' : '应用'}
              </button>
              <button 
                onClick={loadSettings}
                className={`btn-icon px-4 py-3 border rounded-xl ${isDark ? 'border-gray-700 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-50'} ${colors.textMuted} transition-all`}
              >
                ↻
              </button>
            </div>
          </div>
          <p className={`text-xs ${colors.textMuted}`}>
            留空表示不使用代理。格式: http://host:port 或 https://host:port。修改后点击"应用"按钮生效
          </p>
        </section>

        {/* Kiro IDE 信息 */}
        <section className={`card-glow ${colors.card} rounded-2xl p-6 shadow-sm border ${colors.cardBorder} mb-6 opacity-0 animate-slide-in-left delay-500`}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>Kiro IDE 信息</h2>
              <p className={`text-sm ${colors.textMuted}`}>从本地 Kiro IDE 读取的设备和会话信息</p>
            </div>
            <button
              onClick={loadSettings}
              disabled={loading}
              className={`btn-icon p-2 rounded-xl ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} transition-colors`}
            >
              <RefreshCw size={18} className={`${colors.textMuted} ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* 设备标识 */}
          <div className={`${isDark ? 'bg-white/5' : 'bg-gray-50'} rounded-xl p-4 mb-4`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-blue-500" />
                <span className={`text-sm font-medium ${colors.text}`}>设备标识</span>
              </div>
              <button 
                onClick={handleResetMachineId} 
                disabled={resetting}
                className="btn-icon text-xs text-red-500 hover:underline font-medium disabled:opacity-50 transition-all"
              >
                {resetting ? '重置中...' : '重置全部'}
              </button>
            </div>
            <InfoItem label="Machine ID" value={telemetryInfo?.machineId} copyable fieldKey="machineId" />
            <InfoItem label="SQM ID" value={telemetryInfo?.sqmId} copyable fieldKey="sqmId" />
            <InfoItem label="Dev Device ID" value={telemetryInfo?.devDeviceId} copyable fieldKey="devDeviceId" />
            <InfoItem label="Service Machine ID" value={telemetryInfo?.serviceMachineId} copyable fieldKey="serviceMachineId" />
          </div>

          {/* Kiro IDE 状态 */}
          <div className={`flex items-center justify-between ${isDark ? 'bg-white/5' : 'bg-gray-50'} rounded-xl p-4`}>
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${kiroRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className={`text-sm ${colors.text}`}>Kiro IDE</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                kiroRunning 
                  ? 'bg-green-500/20 text-green-500' 
                  : `${isDark ? 'bg-white/10 text-gray-400' : 'bg-gray-200 text-gray-500'}`
              }`}>
                {kiroRunning ? '运行中' : '未运行'}
              </span>
            </div>
            <button
              onClick={handleToggleKiro}
              className={`btn-icon px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                kiroRunning
                  ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                  : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
              }`}
            >
              {kiroRunning ? '关闭' : '启动'}
            </button>
          </div>
          <p className={`text-xs ${colors.textMuted} mt-2`}>
            重置设备标识需要先关闭 Kiro IDE
          </p>
        </section>
      </div>
    </div>
  )
}

export default Settings

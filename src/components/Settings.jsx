import { useState } from 'react'
import { Lock, Copy } from 'lucide-react'

function Settings() {
  const [aiModel, setAiModel] = useState('Claude Opus 4.5')
  const [lockModel, setLockModel] = useState(true)
  const [httpProxy, setHttpProxy] = useState('http://127.0.0.1:7897')
  const [machineId, setMachineId] = useState('ec088295c978e50c9080aca58282f5ed79db948966213d8da4e86101f2d3a0ff')

  const handleApplyProxy = () => {
    // 应用代理设置
    console.log('Apply proxy:', httpProxy)
  }

  const handleResetMachineId = () => {
    // 重置机器ID
    const newId = Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('')
    setMachineId(newId)
  }

  return (
    <div className="h-full bg-white p-8 overflow-auto">
      <div className="max-w-3xl">
        {/* Header */}
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">Kiro 设置</h1>
        <p className="text-gray-500 mb-8">配置 Kiro IDE 的模型、代理等设置，修改后即时生效</p>

        {/* 模型设置 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">模型设置</h2>
          <p className="text-sm text-gray-500 mb-4">选择默认使用的 AI 模型，并可选择锁定模型防止被修改</p>
          
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-2">AI 模型</label>
            <div className="relative">
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-800 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="Claude Sonnet 4.5">Claude Sonnet 4.5 (⭐ 推荐)</option>
                <option value="Claude Opus 4.5">Claude Opus 4.5</option>
                <option value="Claude Sonnet 4">Claude Sonnet 4</option>
                <option value="Claude Haiku 4.5">Claude Haiku 4.5</option>
                <option value="Auto">Auto</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={lockModel}
              onChange={(e) => setLockModel(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-[#4361ee] focus:ring-[#4361ee]"
            />
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-gray-500" />
              <div>
                <span className="text-sm font-medium text-gray-700">锁定模型</span>
                <p className="text-xs text-gray-500">启用后，将自动监控并恢复 Kiro 配置中的模型设置，防止被其他操作修改</p>
              </div>
            </div>
          </label>
        </section>

        {/* 代理设置 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">代理设置</h2>
          <p className="text-sm text-gray-500 mb-4">
            配置 Kiro IDE 的 HTTP 代理（与 settings.json 中的 http.proxy 同步）
          </p>
          
          <div className="mb-2">
            <label className="block text-sm text-gray-600 mb-2">HTTP 代理</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={httpProxy}
                onChange={(e) => setHttpProxy(e.target.value)}
                placeholder="http://127.0.0.1:7897"
                className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleApplyProxy}
                className="px-5 py-3 bg-[#4361ee] text-white rounded-lg hover:bg-[#3651de] flex items-center gap-2"
              >
                <Copy size={16} />
                应用
              </button>
              <button className="px-3 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500">
                ↻
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            留空表示不使用代理。格式: http://host:port 或 https://host:port。修改后点击"应用"按钮生效
          </p>
        </section>

        {/* Kiro 高级设置 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Kiro 高级设置</h2>
          <p className="text-sm text-gray-500 mb-4">
            机器 ID：<button onClick={handleResetMachineId} className="text-[#4361ee] hover:underline">重置机器并启动新功能</button>
          </p>
        </section>
      </div>
    </div>
  )
}

export default Settings

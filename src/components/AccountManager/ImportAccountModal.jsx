import { useState, useRef } from 'react'
import { X, Upload, FileJson, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useTheme } from '../../contexts/ThemeContext'

// 校验单条账号数据
function validateAccount(item, index) {
  const errors = []
  
  if (!item.refreshToken) {
    errors.push(`第${index + 1}条: 缺少 refreshToken`)
    return { valid: false, errors, type: null }
  }
  
  if (!item.provider) {
    errors.push(`第${index + 1}条: 缺少 provider`)
    return { valid: false, errors, type: null }
  }
  
  const validProviders = ['Google', 'GitHub', 'BuilderId', 'Enterprise']
  if (!validProviders.includes(item.provider)) {
    errors.push(`第${index + 1}条: provider 必须是 ${validProviders.join('/')}`)
    return { valid: false, errors, type: null }
  }
  
  const token = item.refreshToken
  const isSocial = token.startsWith('aor')
  const isIdC = token.startsWith('eyJ')
  
  if (!isSocial && !isIdC) {
    errors.push(`第${index + 1}条: refreshToken 格式无效（应以 aor 或 eyJ 开头）`)
    return { valid: false, errors, type: null }
  }
  
  // 校验 provider 与 token 格式匹配
  if (isSocial && !['Google', 'GitHub'].includes(item.provider)) {
    errors.push(`第${index + 1}条: Social token 的 provider 应为 Google/GitHub`)
    return { valid: false, errors, type: null }
  }
  
  if (isIdC && !['BuilderId', 'Enterprise'].includes(item.provider)) {
    errors.push(`第${index + 1}条: IdC token 的 provider 应为 BuilderId/Enterprise`)
    return { valid: false, errors, type: null }
  }
  
  // IdC 账号需要 clientId 和 clientSecret
  if (isIdC) {
    if (!item.clientId) {
      errors.push(`第${index + 1}条: IdC 账号缺少 clientId`)
      return { valid: false, errors, type: null }
    }
    if (!item.clientSecret) {
      errors.push(`第${index + 1}条: IdC 账号缺少 clientSecret`)
      return { valid: false, errors, type: null }
    }
  }
  
  return { valid: true, errors: [], type: isSocial ? 'social' : 'idc' }
}


function ImportAccountModal({ onClose, onSuccess }) {
  const { theme, colors } = useTheme()
  const isDark = theme === 'dark'
  const fileInputRef = useRef(null)
  
  const [jsonText, setJsonText] = useState('')
  const [parseResult, setParseResult] = useState(null) // { valid: [], invalid: [], errors: [] }
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, currentEmail: '' })
  const [importResult, setImportResult] = useState(null) // { success: [], failed: [] }

  // 解析 JSON
  const parseJson = (text) => {
    if (!text.trim()) {
      setParseResult(null)
      return
    }
    
    try {
      let data = JSON.parse(text)
      // 支持单个对象或数组
      if (!Array.isArray(data)) {
        data = [data]
      }
      
      const valid = []
      const invalid = []
      const errors = []
      
      data.forEach((item, index) => {
        const result = validateAccount(item, index)
        if (result.valid) {
          valid.push({ ...item, _type: result.type, _index: index })
        } else {
          invalid.push({ ...item, _index: index })
          errors.push(...result.errors)
        }
      })
      
      setParseResult({ valid, invalid, errors })
    } catch (e) {
      setParseResult({ valid: [], invalid: [], errors: [`JSON 解析失败: ${e.message}`] })
    }
  }

  // 选择文件
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const text = await file.text()
    setJsonText(text)
    parseJson(text)
  }

  // 输入框变化
  const handleTextChange = (e) => {
    const text = e.target.value
    setJsonText(text)
    parseJson(text)
  }


  // 执行导入
  const handleImport = async () => {
    if (!parseResult?.valid.length) return
    
    setImporting(true)
    setImportProgress({ current: 0, total: parseResult.valid.length, currentEmail: '' })
    
    const success = []
    const failed = []
    
    for (let i = 0; i < parseResult.valid.length; i++) {
      const item = parseResult.valid[i]
      setImportProgress({ 
        current: i, 
        total: parseResult.valid.length, 
        currentEmail: item.refreshToken.slice(0, 20) + '...' 
      })
      
      try {
        let account
        if (item._type === 'social') {
          account = await invoke('add_account_by_social', {
            refreshToken: item.refreshToken,
            provider: item.provider
          })
        } else {
          account = await invoke('add_account_by_idc', {
            refreshToken: item.refreshToken,
            clientId: item.clientId,
            clientSecret: item.clientSecret,
            region: item.region || null
          })
        }
        success.push({ index: item._index + 1, email: account.email })
      } catch (e) {
        failed.push({ index: item._index + 1, error: String(e).slice(0, 50) })
      }
      
      // 间隔 500ms 避免请求过快
      if (i < parseResult.valid.length - 1) {
        await new Promise(r => setTimeout(r, 500))
      }
    }
    
    setImportProgress({ current: parseResult.valid.length, total: parseResult.valid.length, currentEmail: '' })
    setImportResult({ success, failed })
    setImporting(false)
    
    if (success.length > 0) {
      onSuccess?.()
    }
  }

  // 关闭弹窗
  const handleClose = () => {
    if (importing) return
    onClose()
  }


  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
      <div 
        className={`${colors.card} rounded-2xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${colors.cardBorder}`}>
          <h2 className={`text-lg font-semibold ${colors.text}`}>批量导入账号</h2>
          <button 
            onClick={handleClose}
            disabled={importing}
            className={`p-1 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} transition-colors disabled:opacity-50`}
          >
            <X size={20} className={colors.textMuted} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* 导入结果显示 */}
          {importResult ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl ${isDark ? 'bg-green-500/20' : 'bg-green-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={20} className="text-green-500" />
                  <span className={`font-medium ${isDark ? 'text-green-300' : 'text-green-700'}`}>
                    成功导入 {importResult.success.length} 个账号
                  </span>
                </div>
                {importResult.success.length > 0 && (
                  <div className={`text-sm ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    {importResult.success.map(s => s.email).join(', ')}
                  </div>
                )}
              </div>
              
              {importResult.failed.length > 0 && (
                <div className={`p-4 rounded-xl ${isDark ? 'bg-red-500/20' : 'bg-red-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={20} className="text-red-500" />
                    <span className={`font-medium ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                      失败 {importResult.failed.length} 个
                    </span>
                  </div>
                  <div className={`text-sm space-y-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                    {importResult.failed.map((f, i) => (
                      <div key={i}>第{f.index}条: {f.error}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : importing ? (
            /* 导入进度 */
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 size={20} className="text-blue-500 animate-spin" />
                <span className={colors.text}>正在导入...</span>
              </div>
              <div className={`h-2 ${isDark ? 'bg-white/10' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
              <div className={`text-sm ${colors.textMuted}`}>
                {importProgress.current}/{importProgress.total} - {importProgress.currentEmail}
              </div>
            </div>
          ) : (
            /* 输入区域 */
            <>
              {/* 选择文件按钮 */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center gap-2 px-4 py-2 ${isDark ? 'bg-white/10 hover:bg-white/15' : 'bg-gray-100 hover:bg-gray-200'} rounded-xl transition-colors`}
                >
                  <FileJson size={18} className={colors.textMuted} />
                  <span className={colors.text}>选择 JSON 文件</span>
                </button>
              </div>

              {/* JSON 输入框 */}
              <div>
                <label className={`block text-sm font-medium ${colors.text} mb-1`}>
                  或粘贴 JSON 内容
                </label>
                <textarea
                  value={jsonText}
                  onChange={handleTextChange}
                  rows={8}
                  placeholder={`[
  {
    "refreshToken": "aor_xxxxxxxx",
    "provider": "Google"
  },
  {
    "refreshToken": "aor_xxxxxxxx",
    "provider": "GitHub"
  },
  {
    "refreshToken": "eyJxxxxxxxx",
    "clientId": "xxxxxxxx",
    "clientSecret": "xxxxxxxx",
    "region": "us-east-1",
    "provider": "BuilderId"
  }
]`}
                  className={`w-full px-3 py-2 rounded-xl border ${colors.cardBorder} ${isDark ? 'bg-white/5' : 'bg-gray-50'} ${colors.text} text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none`}
                />
              </div>

              {/* 解析结果 */}
              {parseResult && (
                <div className="space-y-2">
                  {parseResult.valid.length > 0 && (
                    <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                      <CheckCircle size={16} />
                      <span>解析成功: {parseResult.valid.length} 条有效记录</span>
                    </div>
                  )}
                  {parseResult.errors.length > 0 && (
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle size={16} className="text-red-500" />
                        <span className={`text-sm font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                          校验错误
                        </span>
                      </div>
                      <div className={`text-xs space-y-0.5 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                        {parseResult.errors.slice(0, 5).map((err, i) => (
                          <div key={i}>{err}</div>
                        ))}
                        {parseResult.errors.length > 5 && (
                          <div>...还有 {parseResult.errors.length - 5} 个错误</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部按钮 */}
        <div className={`flex justify-end gap-3 px-6 py-4 border-t ${colors.cardBorder}`}>
          {importResult ? (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium"
            >
              完成
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={importing}
                className={`px-4 py-2 rounded-xl ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} ${colors.text} disabled:opacity-50`}
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !parseResult?.valid.length}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Upload size={16} />
                导入 {parseResult?.valid.length ? `(${parseResult.valid.length})` : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImportAccountModal

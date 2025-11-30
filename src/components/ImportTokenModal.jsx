import { useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { X, Upload, FileText } from 'lucide-react'

function ImportTokenModal({ onClose, onSuccess }) {
  const [jsonText, setJsonText] = useState('')
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)

  const handleImport = async () => {
    if (!jsonText.trim()) {
      setError('请输入 JSON 数据')
      return
    }

    setImporting(true)
    setError('')

    try {
      const count = await invoke('import_tokens', { tokensJson: jsonText })
      alert(`成功导入 ${count} 个 Token`)
      onSuccess()
    } catch (e) {
      setError(typeof e === 'string' ? e : '导入失败，请检查 JSON 格式')
    } finally {
      setImporting(false)
    }
  }

  const handleFileSelect = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (file) {
        const text = await file.text()
        setJsonText(text)
      }
    }
    input.click()
  }

  const templateJson = JSON.stringify([
    {
      email: "example@gmail.com",
      label: "示例账号",
      quota: 50,
      used: 0,
      status: "正常"
    }
  ], null, 2)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[550px] shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">导入 Token</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-auto space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleFileSelect}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm"
            >
              <Upload size={16} />
              选择文件
            </button>
            <button
              onClick={() => setJsonText(templateJson)}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm"
            >
              <FileText size={16} />
              使用模板
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              JSON 数据
            </label>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder={`粘贴 JSON 数组，格式如：\n${templateJson}`}
              className="w-full h-64 px-3 py-2 border rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-4 py-2 bg-[#4361ee] text-white rounded-lg hover:bg-[#3651de] disabled:opacity-50"
          >
            {importing ? '导入中...' : '导入'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ImportTokenModal

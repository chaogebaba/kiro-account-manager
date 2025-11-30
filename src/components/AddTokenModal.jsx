import { useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { X } from 'lucide-react'

function AddTokenModal({ onClose, onSuccess }) {
  const [email, setEmail] = useState('')
  const [label, setLabel] = useState('')
  const [quota, setQuota] = useState(2500)

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await invoke('add_token', { email, label, quota })
      onSuccess()
    } catch (err) {
      console.error('Failed to add token:', err)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[450px] shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">添加 Token</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">标签</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">额度</label>
            <input
              type="number"
              value={quota}
              onChange={(e) => setQuota(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#4361ee] text-white rounded-lg hover:bg-[#3651de]"
            >
              添加
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddTokenModal

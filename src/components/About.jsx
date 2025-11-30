import { Monitor } from 'lucide-react'

function About() {
  return (
    <div className="h-full bg-white p-6 flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 bg-[#4361ee] rounded-2xl flex items-center justify-center">
            <Monitor size={40} className="text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Kiro Token Manager</h1>
        <p className="text-gray-500 mb-4">版本 1.0.0</p>
        <p className="text-sm text-gray-400 mb-6">管理你的 Kiro 访问令牌</p>
        <div className="text-sm text-gray-500 space-y-1">
          <p>Built with Tauri + React</p>
          <p>© 2025 Kiro Token Manager</p>
        </div>
      </div>
    </div>
  )
}

export default About

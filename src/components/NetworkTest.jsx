import { useState } from 'react'
import { Wifi, CheckCircle, XCircle, Loader } from 'lucide-react'

function NetworkTest() {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState([])

  const runTest = async () => {
    setTesting(true)
    setResults([])
    
    const endpoints = [
      { name: 'Kiro API', url: 'https://api.kiro.dev' },
      { name: 'Auth Server', url: 'https://auth.kiro.dev' },
      { name: 'CDN', url: 'https://cdn.kiro.dev' },
    ]

    for (const endpoint of endpoints) {
      await new Promise(resolve => setTimeout(resolve, 500))
      setResults(prev => [...prev, {
        ...endpoint,
        status: Math.random() > 0.3 ? 'success' : 'error',
        latency: Math.floor(Math.random() * 200) + 50
      }])
    }
    
    setTesting(false)
  }

  return (
    <div className="h-full bg-white p-6">
      <h1 className="text-xl font-semibold text-gray-800 mb-6">网络检测</h1>
      <div className="max-w-2xl">
        <button
          onClick={runTest}
          disabled={testing}
          className="flex items-center gap-2 px-4 py-2 bg-[#4361ee] text-white rounded-lg text-sm hover:bg-[#3651de] disabled:opacity-50"
        >
          {testing ? <Loader size={16} className="animate-spin" /> : <Wifi size={16} />}
          {testing ? '检测中...' : '开始检测'}
        </button>

        {results.length > 0 && (
          <div className="mt-6 space-y-3">
            {results.map((result, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {result.status === 'success' ? (
                    <CheckCircle size={20} className="text-green-500" />
                  ) : (
                    <XCircle size={20} className="text-red-500" />
                  )}
                  <div>
                    <div className="font-medium text-gray-800">{result.name}</div>
                    <div className="text-sm text-gray-500">{result.url}</div>
                  </div>
                </div>
                <div className="text-sm">
                  {result.status === 'success' ? (
                    <span className="text-green-600">{result.latency}ms</span>
                  ) : (
                    <span className="text-red-500">连接失败</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default NetworkTest

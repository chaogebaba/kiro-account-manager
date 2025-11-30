import { useState } from 'react'
import { Wifi, CheckCircle, XCircle, Loader } from 'lucide-react'

function NetworkTest() {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState(null)

  const runTest = async () => {
    setTesting(true)
    setResults(null)
    
    const endpoints = [
      { name: 'Kiro API', url: 'https://app.kiro.dev' },
      { name: 'AWS Cognito', url: 'https://kiro-prod-us-east-1.auth.us-east-1.amazoncognito.com' },
      { name: 'GitHub', url: 'https://github.com' },
      { name: 'Google', url: 'https://accounts.google.com' },
    ]

    const testResults = []
    for (const endpoint of endpoints) {
      try {
        const start = Date.now()
        await fetch(endpoint.url, { mode: 'no-cors', cache: 'no-store' })
        const latency = Date.now() - start
        testResults.push({ ...endpoint, success: true, latency })
      } catch (e) {
        testResults.push({ ...endpoint, success: false, error: e.message })
      }
    }

    setResults(testResults)
    setTesting(false)
  }

  return (
    <div className="h-full bg-white p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-800 mb-6">网络检测</h1>
        
        <button
          onClick={runTest}
          disabled={testing}
          className="px-4 py-2 bg-[#4361ee] text-white rounded-lg hover:bg-[#3651de] disabled:opacity-50 flex items-center gap-2"
        >
          {testing ? (
            <>
              <Loader size={18} className="animate-spin" />
              检测中...
            </>
          ) : (
            <>
              <Wifi size={18} />
              开始检测
            </>
          )}
        </button>

        {results && (
          <div className="mt-6 space-y-3">
            {results.map((result, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {result.success ? (
                    <CheckCircle size={20} className="text-green-500" />
                  ) : (
                    <XCircle size={20} className="text-red-500" />
                  )}
                  <span className="font-medium">{result.name}</span>
                </div>
                <div className="text-sm text-gray-500">
                  {result.success ? `${result.latency}ms` : result.error}
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

import { Github } from 'lucide-react'

function Login({ onLogin }) {
  const handleGoogleLogin = () => {
    // 触发 Google OAuth 登录
    console.log('Google login')
    onLogin?.('google')
  }

  const handleGithubLogin = () => {
    // 触发 GitHub OAuth 登录
    console.log('GitHub login')
    onLogin?.('github')
  }

  const handleBuilderIdLogin = () => {
    // 触发 AWS Builder ID 登录
    console.log('Builder ID login')
    onLogin?.('builder-id')
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-12">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 4C12 4 6 10 6 18C6 22 8 25 8 25C8 25 7 28 7 30C7 32 8 34 10 34C11 34 12 33 13 32C14 33 16 34 20 34C24 34 26 33 27 32C28 33 29 34 30 34C32 34 33 32 33 30C33 28 32 25 32 25C32 25 34 22 34 18C34 10 28 4 20 4ZM14 20C12.5 20 11 18.5 11 17C11 15.5 12.5 14 14 14C15.5 14 17 15.5 17 17C17 18.5 15.5 20 14 20ZM26 20C24.5 20 23 18.5 23 17C23 15.5 24.5 14 26 14C27.5 14 29 15.5 29 17C29 18.5 27.5 20 26 20Z" fill="white"/>
        </svg>
        <span className="text-white text-3xl font-semibold tracking-wide">KIRO</span>
      </div>

      {/* Title */}
      <h1 className="text-white text-xl mb-8">Choose a way to sign in/sign up</h1>

      {/* Login Buttons */}
      <div className="w-full max-w-md space-y-4">
        {/* Google */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#2a2a3c] hover:bg-[#353548] rounded-lg border border-[#3a3a4c] transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span className="text-white font-medium">Google</span>
          <span className="text-gray-400 ml-auto">Sign in →</span>
        </button>

        {/* GitHub */}
        <button
          onClick={handleGithubLogin}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#1a1a24] hover:bg-[#252530] rounded-lg border border-[#2a2a3c] transition-colors"
        >
          <Github size={20} className="text-white" />
          <span className="text-white font-medium">GitHub</span>
        </button>

        {/* AWS Builder ID */}
        <button
          onClick={handleBuilderIdLogin}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#1a1a24] hover:bg-[#252530] rounded-lg border border-[#2a2a3c] transition-colors"
        >
          <svg width="36" height="20" viewBox="0 0 36 20" fill="none">
            <text x="0" y="15" fill="white" fontSize="12" fontFamily="Arial">aws</text>
          </svg>
          <span className="text-white font-medium">Builder ID</span>
        </button>
      </div>

      {/* Footer */}
      <p className="mt-12 text-sm text-gray-500 text-center max-w-md leading-relaxed">
        By signing in and using Kiro, you agree to the{' '}
        <a href="#" className="text-purple-400 hover:underline">AWS Customer Agreement</a>
        {' '}(or other agreement with us governing your use of AWS services),{' '}
        <a href="#" className="text-purple-400 hover:underline">Service Terms</a>,{' '}
        <a href="#" className="text-purple-400 hover:underline">Privacy Notice</a>, and{' '}
        <a href="#" className="text-purple-400 hover:underline">AWS Intellectual Property License</a>.
      </p>
    </div>
  )
}

export default Login

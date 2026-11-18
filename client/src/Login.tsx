import { useState } from 'react'
import { api } from './api'
import { INP } from './fields'

export default function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  
  const submit = async (e: any) => {
    e.preventDefault()
    try {
      const { token } = await api('/auth/login', 'POST', { email, password })
      localStorage.setItem('token', token)
      localStorage.setItem('email', email)
      onDone()
    } catch (x: any) {
      setErr(x.message)
    }
  }

  return (
    <div className="relative grid h-full place-items-center bg-ink font-sans overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 bg-pattern"></div>
      
      {/* Decorative floating circles */}
      <div className="deco-circle w-64 h-64 -top-20 -left-20 animate-float" style={{animationDelay: '0s'}}></div>
      <div className="deco-circle w-48 h-48 bottom-10 right-10 animate-float" style={{animationDelay: '1s'}}></div>
      <div className="deco-circle w-32 h-32 top-1/2 left-1/4 animate-float" style={{animationDelay: '2s'}}></div>

      {/* Main container */}
      <div className="relative z-10 flex w-full max-w-4xl gap-8 px-6">
        {/* Left side - Branding */}
        <div className="hidden lg:flex flex-col justify-center items-start w-1/2 animate-fadeInLeft">
          <h1 className="font-serif text-5xl font-bold text-brass mb-4 leading-tight">
            Kisah<br/>Kekal
          </h1>
          <p className="text-xl text-mute mb-8">Photobooth Pipeline</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-mute">
              <div className="w-2 h-2 bg-brass rounded-full animate-pulse"></div>
              <span>Cerita tak terlupakan</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-mute">
              <div className="w-2 h-2 bg-brass rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
              <span>Momen berharga</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-mute">
              <div className="w-2 h-2 bg-brass rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
              <span>Kenangan abadi</span>
            </div>
          </div>
        </div>

        {/* Right side - Login Form */}
        <div className="w-full lg:w-1/2">
          <form 
            onSubmit={submit} 
            className="space-y-5 rounded-2xl border border-line bg-panel/90 backdrop-blur-sm p-8 shadow-2xl animate-fadeInUp"
          >
            {/* Mobile branding */}
            <div className="lg:hidden text-center mb-6">
              <h1 className="font-serif text-3xl font-bold text-brass mb-2">Kisah Kekal</h1>
              <p className="text-sm text-mute">Photobooth Pipeline</p>
            </div>

            {/* Desktop branding */}
            <div className="hidden lg:block mb-6">
              <h2 className="font-serif text-2xl font-semibold text-brass">Selamat Datang</h2>
              <p className="text-sm text-mute mt-1">Masuk untuk melanjutkan</p>
            </div>

            {/* Email Input */}
            <div className="input-wrapper">
              <svg 
                className="input-icon w-5 h-5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
              <input 
                className={`${INP} input-field`}
                type="email" 
                autoComplete="username" 
                placeholder="Email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
              />
            </div>

            {/* Password Input */}
            <div className="input-wrapper">
              <svg 
                className="input-icon w-5 h-5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <input 
                className={`${INP} input-field`}
                type="password" 
                autoComplete="current-password" 
                placeholder="Password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
              />
            </div>

            {/* Error Message */}
            {err && (
              <div className="flex items-center gap-2 text-sm text-bad animate-fadeInUp">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{err}</span>
              </div>
            )}

            {/* Submit Button */}
            <button 
              type="submit" 
              className="btn-submit w-full rounded-lg bg-brass py-3 text-sm font-semibold text-ink animate-pulse-glow"
            >
              Masuk
            </button>

            {/* Footer decoration */}
            <div className="flex justify-center gap-1 pt-2">
              <div className="w-1.5 h-1.5 bg-brass rounded-full opacity-60"></div>
              <div className="w-1.5 h-1.5 bg-brass rounded-full opacity-40"></div>
              <div className="w-1.5 h-1.5 bg-brass rounded-full opacity-20"></div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
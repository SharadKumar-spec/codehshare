import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth, BACKEND_URL } from '../context/AuthContext'
import './LoginPage.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  const reset = () => { setError(''); }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password.trim()) { setError('Please fill in all fields.'); return }
    if (mode === 'signup' && !username.trim()) { setError('Please enter a username.'); return }

    setLoading(true)
    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login'
      const body = mode === 'signup'
        ? { email, username, password }
        : { email, password }

      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) { setError(data.error || 'Something went wrong.'); return }

      login(data.token, data.user)

      // If plan not yet chosen → go to pricing
      if (!data.user.planChosen) {
        navigate('/pricing')
      } else {
        navigate('/')
      }
    } catch {
      setError('Could not connect to server. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />
      <div className="login-blob login-blob-3" />

      <div className="login-container fade-in">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <span>CodeShare</span>
        </div>

        <div className="login-card">
          {/* Tab switcher */}
          <div className="login-tabs">
            <button
              className={`login-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); reset() }}
            >Sign In</button>
            <button
              className={`login-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => { setMode('signup'); reset() }}
            >Sign Up</button>
          </div>

          <div className="login-header">
            <h1>{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
            <p>{mode === 'login'
              ? 'Sign in to access your plan & saved sessions'
              : 'Join free and unlock more collaboration features'
            }</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div className="lf-group">
                <label className="lf-label">Username</label>
                <div className="lf-input-wrap">
                  <IconUser />
                  <input
                    id="signup-username"
                    className="lf-input"
                    type="text"
                    placeholder="e.g. Alice"
                    value={username}
                    onChange={e => { setUsername(e.target.value); reset() }}
                    maxLength={24}
                  />
                </div>
              </div>
            )}

            <div className="lf-group">
              <label className="lf-label">Email</label>
              <div className="lf-input-wrap">
                <IconMail />
                <input
                  id="login-email"
                  className="lf-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); reset() }}
                />
              </div>
            </div>

            <div className="lf-group">
              <label className="lf-label">Password</label>
              <div className="lf-input-wrap">
                <IconLock />
                <input
                  id="login-password"
                  className="lf-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); reset() }}
                />
                <button type="button" className="lf-eye" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                  {showPass ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>

            {error && (
              <div className="lf-error">
                <IconAlertCircle /> {error}
              </div>
            )}

            <button
              id="login-submit-btn"
              type="submit"
              className="lf-submit-btn"
              disabled={loading}
            >
              {loading
                ? <span className="lf-spinner" />
                : mode === 'login' ? 'Sign In' : 'Create Account'
              }
            </button>
          </form>

          <div className="login-divider"><span>or</span></div>

          {/* Guest escape hatch */}
          <button
            id="continue-as-guest-btn"
            className="lf-guest-btn"
            onClick={() => navigate('/')}
          >
            <IconArrow /> Continue as Guest
          </button>

          <p className="login-hint">
            Guests can create and join rooms freely.
            <br />Sign in to unlock PRO &amp; PREMIUM features.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Inline Icons ──────────────────────────────────────────────────────────────
function IconUser() {
  return <svg className="lf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
function IconMail() {
  return <svg className="lf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
}
function IconLock() {
  return <svg className="lf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
}
function IconEye() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
}
function IconEyeOff() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
}
function IconAlertCircle() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
}
function IconArrow() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
}

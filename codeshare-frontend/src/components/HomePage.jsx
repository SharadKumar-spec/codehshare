import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, BACKEND_URL } from '../context/AuthContext'
import './HomePage.css'

const PLAN_LIMITS = {
  GUEST: { maxCodeshares: null }, // guests can't "save" — just use rooms
  FREE:  { maxCodeshares: 3 },
  PRO:   { maxCodeshares: Infinity },
  PREMIUM: { maxCodeshares: Infinity },
}

const PLAN_META = {
  GUEST:   { label: 'Guest',   color: '#6b7280' },
  FREE:    { label: 'Free',    color: '#6b7280' },
  PRO:     { label: 'Pro',     color: '#6c63ff' },
  PREMIUM: { label: 'Premium', color: '#f59e0b' },
}

export default function HomePage() {
  const navigate = useNavigate()
  const { user, isAuthenticated, logout, loading } = useAuth()

  const [username, setUsername] = useState(
    () => user?.username || sessionStorage.getItem('cs_username') || ''
  )
  const [joinRoomId, setJoinRoomId] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const plan = user?.plan || 'GUEST'
  const planMeta = PLAN_META[plan]
  const token = isAuthenticated ? localStorage.getItem('cs_token') : null

  if (loading) {
    return (
      <div className="home-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    )
  }

  async function handleCreate() {
    const name = username.trim()
    if (!name) { setError('Please enter your name first.'); return }

    // Check codeshare limit for logged-in users
    if (isAuthenticated && plan === 'FREE' && user.codeshareCount >= 3) {
      setShowUpgradeModal(true)
      return
    }

    setCreating(true); setError('')
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`${BACKEND_URL}/api/rooms`, { method: 'POST', headers })
      const { roomId, ownerToken } = await res.json()

      if (res.status === 403) {
        setShowUpgradeModal(true)
        return
      }

      sessionStorage.setItem('cs_username', name)
      if (ownerToken) {
        localStorage.setItem(`cs_owner_${roomId}`, ownerToken)
      }
      navigate(`/room/${roomId}`)
    } catch {
      setError('Could not reach the server. Make sure the backend is running.')
    } finally { setCreating(false) }
  }

  async function handleJoin() {
    const name = username.trim()
    if (!name) { setError('Please enter your name first.'); return }
    const id = joinRoomId.trim()
    if (!id) { setError('Please enter a Room ID.'); return }
    setJoining(true); setError('')
    try {
      const res = await fetch(`${BACKEND_URL}/api/rooms/${id}`)
      const data = await res.json()
      if (!data.exists) { setError(`Room "${id}" not found.`); setJoining(false); return }
      sessionStorage.setItem('cs_username', name)
      navigate(`/room/${id}`)
    } catch {
      setError('Could not reach the server. Make sure the backend is running.')
    } finally { setJoining(false) }
  }

  return (
    <div className="home-page">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      {/* ── Top auth bar ──────────────────────────────────── */}
      <div className="home-auth-bar">
        {isAuthenticated ? (
          <div className="auth-bar-user">
            <PlanBadge plan={plan} meta={planMeta} />
            <span className="auth-bar-name">{user.username}</span>
            <button className="btn btn-ghost btn-sm" id="pricing-btn" onClick={() => navigate('/pricing')}>
              {plan === 'GUEST' || plan === 'FREE' ? '⬆ Upgrade' : 'Plans'}
            </button>
            <button className="btn btn-ghost btn-sm" id="logout-btn" onClick={logout}>
              <IconLogout /> Logout
            </button>
          </div>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            id="signin-btn"
            onClick={() => navigate('/login')}
          >
            <IconStar /> Sign In / Get More Features
          </button>
        )}
      </div>

      <div className="home-container fade-in">
        {/* Logo */}
        <div className="home-logo">
          <div className="logo-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <span className="logo-text">CodeShare</span>
        </div>

        <h1 className="home-title">Code together,<br /><span className="gradient-text">in real time.</span></h1>
        <p className="home-subtitle">
          Create a room, share the link, and start collaborating instantly.
          {isAuthenticated ? (
            <span> You're on the <strong style={{ color: planMeta.color }}>{planMeta.label}</strong> plan.</span>
          ) : (
            <span> No signup needed to get started.</span>
          )}
        </p>

        {/* Card */}
        <div className="home-card">
          <div className="form-group">
            <label className="form-label">Your Name</label>
            <input
              id="username-input"
              className="input"
              placeholder="e.g. Alice"
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              maxLength={24}
              readOnly={isAuthenticated}
              style={isAuthenticated ? { opacity: 0.75, cursor: 'not-allowed' } : {}}
            />
          </div>

          <button
            id="create-room-btn"
            className="btn btn-primary create-btn"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? <Spinner /> : <IconPlus />}
            {creating ? 'Creating…' : 'Create New Room'}
          </button>

          {isAuthenticated && plan === 'FREE' && (
            <p className="plan-limit-hint">
              🗂 {user.codeshareCount ?? 0}/3 rooms used on Free plan.{' '}
              <span className="upgrade-link" onClick={() => navigate('/pricing')}>Upgrade for unlimited</span>
            </p>
          )}

          <div className="divider-or"><span>or join existing</span></div>

          <div className="join-row">
            <input
              id="room-id-input"
              className="input"
              placeholder="Room ID"
              value={joinRoomId}
              onChange={e => { setJoinRoomId(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            <button
              id="join-room-btn"
              className="btn btn-secondary"
              onClick={handleJoin}
              disabled={joining}
            >
              {joining ? <Spinner /> : 'Join'}
            </button>
          </div>

          {error && <p className="error-msg"><IconWarning /> {error}</p>}
        </div>

        {/* Features row */}
        <div className="features-row">
          <Feature icon="⚡" text="Instant sync" />
          <Feature icon="👥" text="Multi-user" />
          <Feature icon="💬" text="Live chat" />
          <Feature icon="🎨" text="Syntax highlighting" />
        </div>
      </div>

      {/* ── Upgrade modal ───────────────────────────────────── */}
      {showUpgradeModal && (
        <div className="upgrade-modal-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div className="upgrade-modal" onClick={e => e.stopPropagation()}>
            <div className="upgrade-modal-icon">🚀</div>
            <h2>Room Limit Reached</h2>
            <p>Your <strong>Free</strong> plan allows up to <strong>3</strong> saved codeshares. Upgrade to PRO or PREMIUM for unlimited rooms.</p>
            <div className="upgrade-modal-actions">
              <button
                className="btn btn-primary"
                id="upgrade-now-btn"
                onClick={() => navigate('/pricing')}
              >Upgrade Now</button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowUpgradeModal(false)}
              >Maybe Later</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PlanBadge({ plan, meta }) {
  return (
    <span className="home-plan-badge" style={{ '--badge-color': meta.color }}>
      {plan === 'PREMIUM' ? '🌟' : plan === 'PRO' ? '🟣' : ''}
      {meta.label}
    </span>
  )
}

function Feature({ icon, text }) {
  return (
    <div className="feature-chip">
      <span>{icon}</span><span>{text}</span>
    </div>
  )
}
function Spinner() { return <span className="spinner" aria-hidden /> }
function IconPlus() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}
function IconWarning() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
}
function IconLogout() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
}
function IconStar() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
}

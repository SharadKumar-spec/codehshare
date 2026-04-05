import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import Editor from '@monaco-editor/react'
import Sidebar from './Sidebar'
import ChatPanel from './ChatPanel'
import { useAuth, BACKEND_URL } from '../context/AuthContext'
import './EditorPage.css'

const BACKEND = BACKEND_URL

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
]

const PLAN_META = {
  GUEST:   { label: 'Guest',   color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
  FREE:    { label: 'Free',    color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
  PRO:     { label: 'Pro',     color: '#6c63ff', bg: 'rgba(108,99,255,0.15)' },
  PREMIUM: { label: 'Premium', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
}

export default function EditorPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user, token, isAuthenticated } = useAuth()

  const plan = user?.plan || 'GUEST'
  const username = user?.username || sessionStorage.getItem('cs_username') || 'Anonymous'
  const isProOrPremium = ['PRO', 'PREMIUM'].includes(plan)
  const showAds = !isProOrPremium  // GUEST and FREE see ads

  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('javascript')
  const [users, setUsers] = useState([])
  const [chatMessages, setChatMessages] = useState([])
  const [notifications, setNotifications] = useState([])
  const [chatOpen, setChatOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [connected, setConnected] = useState(false)
  const [copied, setCopied] = useState(false)
  const [viewOnly, setViewOnly] = useState(false)
  const [adDismissed, setAdDismissed] = useState(false)
  const [collabLimitInfo, setCollabLimitInfo] = useState(null)
  const [toggling, setToggling] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  const socketRef = useRef(null)
  const isRemoteChange = useRef(false)
  const notifId = useRef(0)

  const pushNotif = useCallback((msg, type = 'info') => {
    const id = ++notifId.current
    setNotifications(n => [...n, { id, msg, type }])
    setTimeout(() => setNotifications(n => n.filter(x => x.id !== id)), 3500)
  }, [])

  // ── Socket setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(BACKEND)
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      const ownerToken = localStorage.getItem(`cs_owner_${roomId}`)
      socket.emit('join-room', { roomId, username, plan, ownerToken })
    })
    socket.on('disconnect', () => setConnected(false))

    socket.on('init-code', ({ code: c, language: lang, viewOnlyMode, isOwner: ownerStatus }) => {
      isRemoteChange.current = true
      setCode(c)
      setLanguage(lang)
      setViewOnly(!!viewOnlyMode)
      setIsOwner(!!ownerStatus)
    })
    socket.on('code-update', ({ code: c }) => {
      isRemoteChange.current = true
      setCode(c)
    })
    socket.on('language-update', ({ language: lang }) => setLanguage(lang))
    socket.on('users-update', userList => setUsers(userList))
    socket.on('user-joined', ({ name }) => pushNotif(`${name} joined the room`, 'join'))
    socket.on('user-left', ({ name }) => pushNotif(`${name} left the room`, 'leave'))
    socket.on('chat-history', msgs => setChatMessages(msgs))
    socket.on('chat-message', msg => {
      setChatMessages(prev => [...prev, msg])
      if (!chatOpen) setUnreadCount(n => n + 1)
    })
    socket.on('view-only-update', ({ enabled }) => setViewOnly(enabled))
    socket.on('collab-limit-reached', (info) => setCollabLimitInfo(info))

    return () => socket.disconnect()
  }, [roomId, username, plan, chatOpen, pushNotif])

  // ── Code change ───────────────────────────────────────────────────────────
  const handleCodeChange = useCallback((value) => {
    if (isRemoteChange.current) { isRemoteChange.current = false; return }
    if (viewOnly) return
    setCode(value)
    socketRef.current?.emit('code-change', { roomId, code: value })
  }, [roomId, viewOnly])

  const handleLanguageChange = useCallback((lang) => {
    setLanguage(lang)
    socketRef.current?.emit('language-change', { roomId, language: lang })
  }, [roomId])

  const handleSendChat = useCallback((text) => {
    socketRef.current?.emit('chat-message', { roomId, message: text })
  }, [roomId])

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openChat = () => { setChatOpen(true); setUnreadCount(0) }

  // ── Toggle view-only mode (PRO/PREMIUM only) ───────────────────────────────
  const toggleViewOnly = async () => {
    if (!isProOrPremium) return
    setToggling(true)
    try {
      const res = await fetch(`${BACKEND}/api/rooms/${roomId}/view-only`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: !viewOnly, ownerToken: localStorage.getItem(`cs_owner_${roomId}`) }),
      })
      const data = await res.json()
      if (res.ok) setViewOnly(data.viewOnlyMode)
    } catch (e) {
      console.error('Toggle view-only failed:', e)
    } finally {
      setToggling(false)
    }
  }

  const planMeta = PLAN_META[plan] || PLAN_META.GUEST

  return (
    <div className="editor-layout">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="editor-header">
        <div className="header-left">
          <button className="btn btn-ghost btn-icon" id="back-btn" onClick={() => navigate('/')} title="Back to home">
            <IconArrowLeft />
          </button>
          <div className="logo-sm">
            <IconCode />
            <span>CodeShare</span>
          </div>
          <div className="room-id-pill">
            <span className="pulse" />
            <code>{roomId}</code>
          </div>
          <span className={`conn-badge ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? 'Live' : 'Reconnecting…'}
          </span>
        </div>

        <div className="header-center">
          <select
            id="language-select"
            className="select"
            value={language}
            onChange={e => handleLanguageChange(e.target.value)}
            disabled={viewOnly}
          >
            {LANGUAGES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        <div className="header-right">
          {/* Plan badge */}
          <span
            className="editor-plan-badge"
            style={{ '--badge-color': planMeta.color }}
            title={`You are on the ${planMeta.label} plan`}
          >
            {plan === 'PREMIUM' ? '🌟' : plan === 'PRO' ? '🟣' : ''}
            {planMeta.label}
          </span>

          {/* View-only toggle — ONLY owner who is PRO/PREMIUM */}
          {isOwner && isProOrPremium && (
            <button
              id="view-only-btn"
              className={`btn btn-sm ${viewOnly ? 'btn-danger' : 'btn-ghost'}`}
              onClick={toggleViewOnly}
              disabled={toggling}
              title={viewOnly ? 'Disable view-only mode' : 'Enable view-only mode'}
            >
              {viewOnly ? <IconEyeOff /> : <IconEye />}
              {viewOnly ? 'View-Only ON' : 'View-Only'}
            </button>
          )}
          {isOwner && !isProOrPremium && (
            <button
              id="view-only-locked-btn"
              className="btn btn-sm btn-ghost"
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
              title="View-only mode requires PRO or PREMIUM plan"
              onClick={() => navigate('/pricing')}
            >
              <IconLock /> View-Only
            </button>
          )}

          <button id="chat-btn" className="btn btn-ghost btn-sm" onClick={openChat} title="Open chat">
            <IconChat />
            Chat
            {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
          </button>
          <button
            id="copy-link-btn"
            className={`btn btn-sm ${copied ? 'btn-success-flash' : 'btn-secondary'}`}
            onClick={copyLink}
          >
            {copied ? <IconCheck /> : <IconLink />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </header>

      {/* ── View-only banner ─────────────────────────────────────── */}
      {viewOnly && (
        <div className="view-only-banner">
          <IconEyeOff /> This room is in <strong>view-only mode</strong> — editing is disabled for all users.
        </div>
      )}

      {/* ── Collaborator limit warning ───────────────────────────── */}
      {collabLimitInfo && (
        <div className="collab-limit-banner">
          <span>⚠️ {collabLimitInfo.message}</span>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/pricing')}>Upgrade</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setCollabLimitInfo(null)}>✕</button>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="editor-body">
        <Sidebar users={users} roomId={roomId} onCopyLink={copyLink} copied={copied} plan={plan} />

        <main className="editor-main" style={{ position: 'relative' }}>
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={handleCodeChange}
            theme="vs-dark"
            options={{
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontLigatures: true,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              padding: { top: 16, bottom: 16 },
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              renderLineHighlight: 'line',
              lineNumbers: 'on',
              glyphMargin: false,
              folding: true,
              automaticLayout: true,
              readOnly: viewOnly,
            }}
          />
          {/* View-only overlay */}
          {viewOnly && (
            <div className="view-only-overlay">
              <div className="view-only-overlay-badge">
                <IconEye /> View Only
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Chat panel ───────────────────────────────────────────── */}
      {chatOpen && (
        <ChatPanel
          messages={chatMessages}
          username={username}
          onSend={handleSendChat}
          onClose={() => setChatOpen(false)}
        />
      )}

      {/* ── Toast notifications ──────────────────────────────────── */}
      <div className="notif-stack">
        {notifications.map(n => (
          <div key={n.id} className={`notif notif-${n.type}`}>
            {n.type === 'join' ? '👋' : n.type === 'leave' ? '👋' : 'ℹ️'} {n.msg}
          </div>
        ))}
      </div>

      {/* ── Ad banner (GUEST & FREE only) ────────────────────────── */}
      {showAds && !adDismissed && (
        <div className="ad-banner">
          <span className="ad-label">AD</span>
          <span className="ad-text">
            🚀 <strong>Upgrade to PRO</strong> — remove ads, unlock unlimited rooms & view-only mode.
          </span>
          <button className="btn btn-primary btn-sm" id="ad-upgrade-btn" onClick={() => navigate('/login')}>
            {isAuthenticated ? 'Upgrade' : 'Sign In'}
          </button>
          <button className="ad-dismiss" onClick={() => setAdDismissed(true)} title="Dismiss">✕</button>
        </div>
      )}
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function IconArrowLeft() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg> }
function IconCode() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> }
function IconLink() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> }
function IconCheck() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> }
function IconChat() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
function IconEye() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }
function IconEyeOff() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> }
function IconLock() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> }

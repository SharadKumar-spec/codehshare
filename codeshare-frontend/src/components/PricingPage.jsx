import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, BACKEND_URL } from '../context/AuthContext'
import './PricingPage.css'

const PLANS = [
  {
    id: 'FREE',
    name: 'Free',
    price: '$0',
    period: 'forever',
    badge: null,
    tagline: 'Perfect for getting started',
    color: 'free',
    features: [
      { text: 'Create & join rooms', included: true },
      { text: 'Up to 3 saved codeshares', included: true },
      { text: 'Up to 3 collaborators per room', included: true },
      { text: 'Live chat in room', included: true },
      { text: 'Syntax highlighting (13+ langs)', included: true },
      { text: 'View-only mode', included: false },
      { text: 'Unlimited codeshares', included: false },
      { text: 'Ad-free experience', included: false },
      { text: 'Priority sync', included: false },
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: '$9',
    period: '/month',
    badge: 'Most Popular',
    tagline: 'For serious collaborators',
    color: 'pro',
    features: [
      { text: 'Everything in Free', included: true },
      { text: 'Unlimited saved codeshares', included: true },
      { text: 'Unlimited collaborators', included: true },
      { text: 'View-only mode toggle', included: true },
      { text: 'Ad-free for you & collaborators', included: true },
      { text: 'Default codeshare settings', included: true },
      { text: 'Priority sync', included: false },
      { text: 'Session history', included: false },
    ],
  },
  {
    id: 'PREMIUM',
    name: 'Premium',
    price: '$19',
    period: '/month',
    badge: 'All Features',
    tagline: 'Maximum power & performance',
    color: 'premium',
    features: [
      { text: 'Everything in Pro', included: true },
      { text: 'Priority performance sync', included: true },
      { text: 'Session history (coming soon)', included: true },
      { text: 'Early access to new features', included: true },
      { text: 'Premium badge in rooms', included: true },
    ],
  },
]

export default function PricingPage() {
  const navigate = useNavigate()
  const { user, token, updatePlan } = useAuth()
  const [selecting, setSelecting] = useState(null)
  const [error, setError] = useState('')

  async function handleSelect(planId) {
    setSelecting(planId)
    setError('')
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/plan`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: planId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not update plan.'); return }

      updatePlan(planId)
      navigate('/')
    } catch {
      setError('Could not connect to server.')
    } finally {
      setSelecting(null)
    }
  }

  const currentPlan = user?.plan

  return (
    <div className="pricing-page">
      <div className="pricing-blob pricing-blob-1" />
      <div className="pricing-blob pricing-blob-2" />

      <div className="pricing-container fade-in">
        {/* Header */}
        <div className="pricing-header">
          <div className="pricing-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <div className="pricing-logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <span>CodeShare</span>
          </div>

          <h1 className="pricing-title">
            Choose your <span className="pricing-gradient">plan</span>
          </h1>
          <p className="pricing-subtitle">
            {user
              ? `Welcome, ${user.username}! Select a plan to unlock features.`
              : 'Select a plan to get started with CodeShare.'}
          </p>
          {error && <div className="pricing-error"><IconAlert /> {error}</div>}
        </div>

        {/* Plan cards */}
        <div className="pricing-cards">
          {PLANS.map(plan => {
            const isActive = currentPlan === plan.id
            const isSelecting = selecting === plan.id

            return (
              <div
                key={plan.id}
                className={`plan-card plan-card--${plan.color} ${isActive ? 'plan-card--active' : ''} ${plan.badge === 'Most Popular' ? 'plan-card--featured' : ''}`}
              >
                {plan.badge && (
                  <div className={`plan-badge plan-badge--${plan.color}`}>{plan.badge}</div>
                )}

                <div className="plan-icon-wrap">
                  <PlanIcon planId={plan.id} />
                </div>

                <div className="plan-name">{plan.name}</div>
                <div className="plan-tagline">{plan.tagline}</div>

                <div className="plan-price">
                  <span className="plan-price-amount">{plan.price}</span>
                  <span className="plan-price-period">{plan.period}</span>
                </div>

                <ul className="plan-features">
                  {plan.features.map((f, i) => (
                    <li key={i} className={`plan-feature ${f.included ? 'included' : 'excluded'}`}>
                      {f.included ? <IconCheck /> : <IconX />}
                      <span>{f.text}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={`plan-cta plan-cta--${plan.color} ${isActive ? 'plan-cta--active' : ''}`}
                  onClick={() => handleSelect(plan.id)}
                  disabled={isSelecting || isActive}
                  id={`select-plan-${plan.id.toLowerCase()}`}
                >
                  {isSelecting
                    ? <span className="plan-spinner" />
                    : isActive
                    ? '✓ Current Plan'
                    : currentPlan
                    ? 'Switch to this Plan'
                    : 'Get Started'
                  }
                </button>
              </div>
            )
          })}
        </div>

        {/* Guest / skip option */}
        <div className="pricing-footer">
          <button
            id="pricing-skip-btn"
            className="pricing-skip-btn"
            onClick={() => navigate('/')}
          >
            Continue as Guest — no plan needed
          </button>
          <p className="pricing-fine-print">
            Plans are for demonstration purposes. No payment is processed.
          </p>
        </div>
      </div>
    </div>
  )
}

function PlanIcon({ planId }) {
  if (planId === 'FREE') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="28" height="28">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
    </svg>
  )
  if (planId === 'PRO') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="28" height="28">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="28" height="28">
      <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
    </svg>
  )
}

function IconCheck() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
}
function IconX() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}
function IconAlert() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
}

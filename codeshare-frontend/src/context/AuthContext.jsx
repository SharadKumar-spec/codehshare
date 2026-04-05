import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // null = guest
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)  // true during initial token validation

  // ── On app load: restore session from localStorage ──────────────────────────
  useEffect(() => {
    const storedToken = localStorage.getItem('cs_token')
    if (!storedToken) { setLoading(false); return }

    // Validate token is still active (within 48h)
    fetch(`${BACKEND}/api/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setToken(storedToken)
          setUser(data.user)
        } else {
          // Token expired or invalid — clear silently, user stays as guest
          localStorage.removeItem('cs_token')
          localStorage.removeItem('cs_user')
        }
      })
      .catch(() => {
        // Network error — keep token for retry later, don't force logout
      })
      .finally(() => setLoading(false))
  }, [])

  // ── Login ───────────────────────────────────────────────────────────────────
  const login = useCallback((tokenValue, userData) => {
    localStorage.setItem('cs_token', tokenValue)
    localStorage.setItem('cs_user', JSON.stringify(userData))
    setToken(tokenValue)
    setUser(userData)
  }, [])

  // ── Logout ──────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('cs_token')
    localStorage.removeItem('cs_user')
    setToken(null)
    setUser(null)
  }, [])

  // ── Update plan after pricing page selection ────────────────────────────────
  const updatePlan = useCallback((plan) => {
    setUser(prev => {
      if (!prev) return prev
      const updated = { ...prev, plan, planChosen: true }
      localStorage.setItem('cs_user', JSON.stringify(updated))
      return updated
    })
  }, [])

  const isAuthenticated = !!user

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, loading, login, logout, updatePlan }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

export const BACKEND_URL = BACKEND

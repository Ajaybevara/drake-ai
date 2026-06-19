import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useStore } from '../store'

export default function LoginPage() {
  const location = useLocation()
  const storedUser = readRegisteredUser()
  const [mode, setMode] = useState<'login' | 'register'>(location.pathname === '/register' ? 'register' : 'login')
  const [fullName, setFullName] = useState(storedUser?.full_name || 'Malleswar Y')
  const [email, setEmail] = useState(storedUser?.email || 'admin@drakeai.com')
  const [password, setPassword] = useState('Drake@2024')
  const setAuth = useStore(s => s.setAuth)
  const navigate = useNavigate()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const displayName = fullName.trim() || email.split('@')[0] || 'User'
    const registeredUser = { email, full_name: displayName }
    localStorage.setItem('drake_registered_user', JSON.stringify(registeredUser))
    setAuth({
      id: 1,
      email,
      full_name: displayName,
      role: 'admin',
      avatar_initials: initialsFor(displayName),
    }, 'ui-only-token')
    toast.success(mode === 'register' ? 'Registration complete' : `Welcome ${displayName}`)
    navigate('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 400, background: '#111827', borderRadius: 16, border: '1px solid #334155', padding: '40px 36px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32, justifyContent: 'center' }}>
          <img src="/logo.png" alt="Drake AI Logo" style={{ width: 240, maxHeight: 92, objectFit: 'contain' }} />
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E2E8F0', marginBottom: 6, textAlign: 'center' }}>{mode === 'register' ? 'Create your account' : 'Sign in to your account'}</h2>
        <p style={{ fontSize: 12, color: '#64748B', textAlign: 'center', marginBottom: 28 }}>Petrophysics Intelligence Platform</p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>Full Name</label>
              <input
                type="text" value={fullName} onChange={e => setFullName(e.target.value)} required
                style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', color: '#E2E8F0', fontSize: 13, outline: 'none' }}
              />
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>Email Address</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', color: '#E2E8F0', fontSize: 13, outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', color: '#E2E8F0', fontSize: 13, outline: 'none' }}
            />
          </div>
          <button
            type="submit"
            style={{ background: 'linear-gradient(135deg,#D32F2F,#388E3C)', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Rajdhani,sans-serif', letterSpacing: 1, marginTop: 8 }}
          >
            {mode === 'register' ? 'Register' : 'Sign In'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            const nextMode = mode === 'login' ? 'register' : 'login'
            setMode(nextMode)
            navigate(nextMode === 'register' ? '/register' : '/login', { replace: true })
          }}
          style={{ width: '100%', marginTop: 14, background: 'transparent', border: 0, color: '#93C5FD', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
        >
          {mode === 'register' ? 'Already registered? Sign in' : 'Need an account? Register'}
        </button>

        <div style={{ marginTop: 20, padding: 12, background: '#1E293B', borderRadius: 8, border: '1px solid #334155' }}>
          <div style={{ fontSize: 10, color: '#64748B', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Demo Credentials</div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>Email: <span style={{ color: '#EF4444' }}>admin@drakeai.com</span></div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>Password: <span style={{ color: '#22C55E' }}>Drake@2024</span></div>
        </div>
      </div>
    </div>
  )
}

function readRegisteredUser() {
  try {
    const raw = localStorage.getItem('drake_registered_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('')
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'
import { useStore } from '../store'

export default function LoginPage() {
  const [email, setEmail] = useState('admin@drakeai.com')
  const [password, setPassword] = useState('Drake@2024')
  const [loading, setLoading] = useState(false)
  const setAuth = useStore(s => s.setAuth)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authApi.login(email, password)
      setAuth(res.data.user, res.data.access_token)
      toast.success('Welcome to Drake AI!')
      navigate('/')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 400, background: '#111827', borderRadius: 16, border: '1px solid #334155', padding: '40px 36px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32, justifyContent: 'center' }}>
          <img src="/logo.png" alt="Drake AI Logo" style={{ width: 240, maxHeight: 92, objectFit: 'contain' }} />
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E2E8F0', marginBottom: 6, textAlign: 'center' }}>Sign in to your account</h2>
        <p style={{ fontSize: 12, color: '#64748B', textAlign: 'center', marginBottom: 28 }}>Petrophysics Intelligence Platform</p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            type="submit" disabled={loading}
            style={{ background: loading ? '#7F1D1D' : 'linear-gradient(135deg,#D32F2F,#388E3C)', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Rajdhani,sans-serif', letterSpacing: 1, marginTop: 8 }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 20, padding: 12, background: '#1E293B', borderRadius: 8, border: '1px solid #334155' }}>
          <div style={{ fontSize: 10, color: '#64748B', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Demo Credentials</div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>Email: <span style={{ color: '#EF4444' }}>admin@drakeai.com</span></div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>Password: <span style={{ color: '#22C55E' }}>Drake@2024</span></div>
        </div>
      </div>
    </div>
  )
}

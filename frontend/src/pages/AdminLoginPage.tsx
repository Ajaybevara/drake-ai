import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useStore } from '../store'
import { ADMIN_USERNAME } from '../utils/accessControl'
import { authApi } from '../services/api'

export default function AdminLoginPage() {
  const [username, setUsername] = useState(ADMIN_USERNAME)
  const [password, setPassword] = useState('')
  const setAuth = useStore(s => s.setAuth)
  const navigate = useNavigate()

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()

    try {
      const { data } = await authApi.login(username.trim(), password)
      const user = data.user
      if (user.role !== 'admin') {
        toast.error('Admin access required')
        return
      }
      setAuth(user, data.access_token)
      toast.success(`Welcome ${user.full_name}`)
      navigate('/admin')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Admin login failed. Please check your credentials.')
    }
  }

  return (
    <div style={page}>
      <div style={shell}>
        <div style={brand}>
          <img src="/logo.png" alt="Drake AI Logo" style={logo} />
          <div style={eyebrow}>Admin Credential Center</div>
          <h1 style={title}>Admin Access</h1>
          <p style={subtitle}>Sign in here to create user credentials and assign module access.</p>
        </div>

        <form onSubmit={handleLogin} style={form}>
          <div style={formHead}>
            <i className="fas fa-user-shield" style={formIcon}></i>
            <div>
              <div style={eyebrow}>Admin Login</div>
              <h2 style={formTitle}>Control Panel</h2>
            </div>
          </div>
          <label style={fieldLabel}>
            Username
            <input value={username} onChange={event => setUsername(event.target.value)} required autoFocus style={input} />
          </label>
          <label style={fieldLabel}>
            Password
            <input type="password" value={password} onChange={event => setPassword(event.target.value)} required style={input} />
          </label>
          <button type="submit" style={submitButton}>Login as Admin</button>
        </form>
      </div>
    </div>
  )
}

const page: React.CSSProperties = { minHeight: '100vh', background: 'linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)', display: 'grid', placeItems: 'center', padding: 24, color: '#F8FAFC' }
const shell: React.CSSProperties = { width: 'min(920px,100%)', display: 'grid', gridTemplateColumns: 'minmax(280px,.9fr) minmax(320px,1fr)', gap: 24, alignItems: 'stretch' }
const brand: React.CSSProperties = { border: '1px solid #26364F', background: 'rgba(15,23,42,.82)', borderRadius: 16, padding: 30, display: 'flex', flexDirection: 'column', justifyContent: 'center' }
const logo: React.CSSProperties = { width: 250, maxWidth: '100%', maxHeight: 110, objectFit: 'contain', marginBottom: 26 }
const eyebrow: React.CSSProperties = { color: '#10B981', letterSpacing: 4, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }
const title: React.CSSProperties = { margin: '10px 0', fontSize: 42, lineHeight: 1.05 }
const subtitle: React.CSSProperties = { margin: 0, color: '#9DB7D8', fontSize: 16, lineHeight: 1.6 }
const form: React.CSSProperties = { border: '1px solid #26364F', background: 'rgba(8,17,31,.96)', borderRadius: 16, padding: 28, display: 'grid', gap: 18, alignContent: 'center' }
const formHead: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }
const formIcon: React.CSSProperties = { color: '#DA2626', fontSize: 30 }
const formTitle: React.CSSProperties = { margin: '5px 0 0', fontSize: 28 }
const fieldLabel: React.CSSProperties = { display: 'grid', gap: 7, color: '#9DB7D8', fontSize: 13, fontWeight: 900 }
const input: React.CSSProperties = { width: '100%', borderRadius: 10, border: '1px solid #26364F', background: '#07111F', color: '#F8FAFC', padding: '13px 14px', outline: 'none', fontSize: 16 }
const submitButton: React.CSSProperties = { border: '1px solid #10B981', background: '#10B981', color: '#00150E', borderRadius: 12, padding: 14, fontWeight: 900, cursor: 'pointer', fontSize: 16 }

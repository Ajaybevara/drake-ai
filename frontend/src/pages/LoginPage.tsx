import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useStore } from '../store'
import { firstAllowedPath } from '../utils/accessControl'
import { authApi } from '../services/api'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const setAuth = useStore(s => s.setAuth)
  const navigate = useNavigate()

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()

    try {
      const { data } = await authApi.login(username.trim(), password)
      const user = data.user
      if (user.role === 'admin') {
        toast.error('Admin credentials cannot be used on the user login page')
        return
      }
      setAuth(user, data.access_token)
      toast.success(`Welcome ${user.full_name}`)
      navigate(firstAllowedPath(user.role, user.accessModules))
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Login failed. Please check your username and password.')
    }
  }

  return (
    <div style={page}>
      <section style={brandPanel}>
        <div style={brandContent}>
          <img src="/logo_light.png" alt="Drake AI Logo" style={logo} />
          <h1 style={title}>Drake AI Well Log Intelligence</h1>
          <p style={subtitle}>Secure production workspace for composite well log digitization, structured extraction, and controlled user access.</p>
        </div>
      </section>

      <section style={formPanel}>
        <form onSubmit={handleLogin} style={form}>
          <div>
            <h2 style={formTitle}>Login</h2>
            <p style={formSubtitle}>Enter your user credentials to continue.</p>
          </div>
          <label style={fieldLabel}>
            Username
            <input value={username} onChange={event => setUsername(event.target.value)} required autoFocus style={input} />
          </label>
          <label style={fieldLabel}>
            Password
            <div style={passwordWrap}>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} required style={{ ...input, paddingRight: 52 }} />
              <button type="button" onClick={() => setShowPassword(current => !current)} title={showPassword ? 'Hide password' : 'Show password'} style={eyeButton}>
                <i className={`fas fa-${showPassword ? 'eye-slash' : 'eye'}`}></i>
              </button>
            </div>
          </label>
          <button type="submit" style={submitButton}>Login</button>
        </form>
      </section>
    </div>
  )
}

const page: React.CSSProperties = { minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0,1.08fr) minmax(460px,.92fr)', background: '#F4F7FB', color: '#07111F', overflow: 'hidden' }
const brandPanel: React.CSSProperties = { position: 'relative', minHeight: '100vh', background: 'linear-gradient(135deg,#11183A 0%,#121C33 58%,#0E1729 100%)', color: '#FFFFFF', display: 'flex', alignItems: 'center', padding: 'clamp(28px,5vw,72px)', clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0 100%)' }
const brandContent: React.CSSProperties = { width: 'min(760px,82%)', display: 'grid', gap: 24 }
const logo: React.CSSProperties = { width: 292, maxWidth: '100%', background: '#FFFFFF', border: '1px solid #E3E8F2', borderRadius: 14, padding: '18px 20px', objectFit: 'contain', boxShadow: '0 18px 42px rgba(0,0,0,.26)' }
const title: React.CSSProperties = { margin: '8px 0 0', fontSize: 'clamp(38px,4.4vw,62px)', lineHeight: 1.08, fontWeight: 900, letterSpacing: 0 }
const subtitle: React.CSSProperties = { margin: 0, width: 'min(760px,88%)', color: '#DCE7FF', fontSize: 'clamp(18px,1.4vw,22px)', lineHeight: 1.55, fontWeight: 500 }
const formPanel: React.CSSProperties = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'clamp(24px,5vw,72px)' }
const form: React.CSSProperties = { width: 'min(524px,100%)', background: '#FFFFFF', border: '1px solid #E3E8F2', borderRadius: 14, padding: 'clamp(28px,3vw,36px)', display: 'grid', gap: 22, boxShadow: '0 30px 80px rgba(15,23,42,.18)' }
const formTitle: React.CSSProperties = { margin: 0, color: '#07111F', fontSize: 30, lineHeight: 1.15, fontWeight: 900 }
const formSubtitle: React.CSSProperties = { margin: '10px 0 0', color: '#41547A', fontSize: 16, lineHeight: 1.45 }
const fieldLabel: React.CSSProperties = { display: 'grid', gap: 9, color: '#405073', fontSize: 14, fontWeight: 900 }
const input: React.CSSProperties = { width: '100%', borderRadius: 10, border: '1px solid #D6DFEF', background: '#EAF1FC', color: '#07111F', padding: '15px 17px', outline: 'none', fontSize: 16, fontWeight: 600 }
const passwordWrap: React.CSSProperties = { position: 'relative', display: 'flex', alignItems: 'center' }
const eyeButton: React.CSSProperties = { position: 'absolute', right: 13, width: 34, height: 34, border: 'none', borderRadius: 8, background: 'transparent', color: '#405073', cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 16 }
const submitButton: React.CSSProperties = { border: 'none', background: 'linear-gradient(135deg,#8F87EA,#B78AEF)', color: '#FFFFFF', borderRadius: 10, padding: '16px 18px', fontWeight: 900, cursor: 'pointer', fontSize: 16, boxShadow: '0 12px 26px rgba(143,135,234,.28)' }

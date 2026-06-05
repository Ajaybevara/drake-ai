import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useStore } from '../../store'

const NAV_ITEMS = [
  { label: 'Petrophysics', path: '/petrophysics/log-visualization' },
  { label: 'Seismic', path: '/seismic/frequency-enhancer' },
  { label: 'Production', path: '/production/optimization' },
  { label: 'CCUS', path: '/ccus/ai-preliminary-screening' },
  { label: 'Drake AI Digitizer', path: '/digitizer/drake-slm-gpt' },
]

export default function TopBar() {
  const { user, logout, theme, toggleTheme } = useStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const isLight = theme === 'light'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const isActive = (item: { label: string; path: string }) => {
    if (item.label === 'Petrophysics') return location.pathname.startsWith('/petrophysics') || location.pathname.includes('/petrophysics') || location.pathname === '/'
    if (item.label === 'Seismic') return location.pathname.startsWith('/seismic')
    if (item.label === 'Production') return location.pathname.startsWith('/production')
    if (item.label === 'CCUS') return location.pathname.startsWith('/ccus')
    if (item.label === 'Drake AI Digitizer') return location.pathname.startsWith('/digitizer')
    return location.pathname === item.path
  }

  return (
    <div style={{ height: 42, background: isLight ? '#FFFFFF' : '#0B111A', borderBottom: `1px solid ${isLight ? '#CBD5E1' : '#1F2A3A'}`, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 0, flexShrink: 0, zIndex: 100, boxShadow: isLight ? '0 1px 0 rgba(15,23,42,.06)' : '0 1px 0 rgba(255,255,255,.03)' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 10px', flex: 1, overflowX: 'auto' }}>
        {NAV_ITEMS.map(item => {
          const active = isActive(item)
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              style={{
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                borderRadius: 5,
                background: active ? 'linear-gradient(180deg,rgba(218,38,38,.35),rgba(218,38,38,.08))' : 'transparent',
                color: active ? (isLight ? '#DA2626' : '#F8FAFC') : isLight ? '#334155' : '#E2E8F0',
                borderBottom: active ? '3px solid #DA2626' : '3px solid transparent',
                transition: 'all .15s',
                whiteSpace: 'nowrap',
                fontFamily: 'DM Sans,sans-serif',
              }}
            >
              {item.label}
            </button>
          )
        })}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: isLight ? '#F8FAFC' : '#070B12', border: `1px solid ${isLight ? '#CBD5E1' : '#223047'}`, borderRadius: 6, padding: '8px 14px', width: 280 }}>
          <i className="fas fa-search" style={{ color: isLight ? '#64748B' : '#E2E8F0', fontSize: 14 }}></i>
          <input type="text" placeholder="Search wells, projects..." onKeyDown={e => { if (e.key === 'Enter') toast.success(`Searching for "${e.currentTarget.value}"`) }} style={{ background: 'none', border: 'none', outline: 'none', color: isLight ? '#0F172A' : '#E2E8F0', fontSize: 14, width: '100%' }} />
        </div>
        <button onClick={toggleTheme} title="Toggle theme" style={{ width: 30, height: 30, borderRadius: 6, background: isLight ? '#F1F5F9' : '#0E1622', border: `1px solid ${isLight ? '#CBD5E1' : '#223047'}`, color: isLight ? '#0F172A' : '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <i className="fas fa-circle-half-stroke" style={{ fontSize: 12 }}></i>
        </button>
        <button onClick={() => toast('Help center coming soon')} style={{ width: 30, height: 30, borderRadius: 6, background: isLight ? '#F1F5F9' : '#0E1622', border: `1px solid ${isLight ? '#CBD5E1' : '#223047'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <i className="fas fa-question-circle" style={{ color: isLight ? '#334155' : '#94A3B8', fontSize: 12 }}></i>
        </button>
        <div ref={profileRef} style={{ position: 'relative' }}>
          <div onClick={() => setProfileOpen((current) => !current)} title="Profile" style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'transparent', border: '1px solid transparent', borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}>
            <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#FF4B4B,#DA2626)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>{user?.avatar_initials || 'U'}</div>
            <div>
              <div style={{ fontSize: 12, color: isLight ? '#0F172A' : '#E2E8F0', fontWeight: 700, lineHeight: 1.2 }}>{user?.full_name}</div>
              <div style={{ fontSize: 10, color: '#64748B' }}>Drake AI Admin</div>
            </div>
            <i className="fas fa-chevron-down" style={{ color: '#64748B', fontSize: 11 }}></i>
          </div>
          {profileOpen && (
            <div style={{ position: 'absolute', top: 44, right: 0, minWidth: 150, borderRadius: 10, background: isLight ? '#FFFFFF' : '#0B111A', border: `1px solid ${isLight ? '#E2E8F0' : '#223047'}`, boxShadow: '0 10px 30px rgba(0,0,0,.25)', zIndex: 200, overflow: 'hidden' }}>
              <button onClick={handleLogout} style={{ width: '100%', padding: '10px 14px', textAlign: 'left', background: 'transparent', border: 'none', color: isLight ? '#0F172A' : '#E2E8F0', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Log out</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

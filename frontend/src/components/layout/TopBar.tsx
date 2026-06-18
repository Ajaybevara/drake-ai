import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useStore } from '../../store'
import { saveProjectFile } from '../../utils/drakeProjectFile'

const NAV_ITEMS = [
  { label: 'Petrophysics', path: '/petrophysics/log-visualization' },
  { label: 'Seismic', path: '/seismic/frequency-enhancer' },
  { label: 'Production', path: '/production/intelligence' },
  { label: 'CCUS', path: '/ccus/ai-preliminary-screening' },
  { label: 'Geothermal', path: '/geothermal/log-based-screening' },
  { label: 'Drake AI Digitizer', path: '/digitizer/drake-slm-gpt' },
]

export default function TopBar() {
  const { user, logout, theme, toggleTheme, activeLocalProject, activeProjectFileHandle, setActiveProjectFileHandle, markProjectSaved, projectDirty, enterpriseProject } = useStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const profileRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const isLight = theme === 'light'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleSaveProject = async () => {
    if (enterpriseProject) {
      toast.success('Project state is saved automatically in project.json')
      navigate('/dashboard')
      return
    }
    if (!activeLocalProject) {
      toast.error('Create or open a project first')
      navigate('/')
      return
    }
    try {
      const result = await saveProjectFile(activeLocalProject, activeProjectFileHandle)
      setActiveProjectFileHandle(result.handle, result.fileName)
      markProjectSaved()
      toast.success(result.usedFallback ? 'Project downloaded as .drake file' : 'Project saved to local disk')
    } catch (error: any) {
      if (error?.name !== 'AbortError') toast.error(error?.message || 'Project save failed')
    }
  }

  const submitSearch = () => {
    const query = searchTerm.trim()
    if (!query) {
      setSearchOpen(true)
      setTimeout(() => searchRef.current?.focus(), 0)
      return
    }
    localStorage.setItem('drake_global_search_query', query)
    navigate(`/projects?search=${encodeURIComponent(query)}`)
    toast.success(`Searching for "${query}"`)
  }

  const toggleSearch = () => {
    if (searchOpen) {
      setSearchOpen(false)
      setSearchTerm('')
      return
    }
    setSearchOpen(true)
    setTimeout(() => searchRef.current?.focus(), 0)
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
    if (item.label === 'Geothermal') return location.pathname.startsWith('/geothermal')
    if (item.label === 'Drake AI Digitizer') return location.pathname.startsWith('/digitizer')
    return location.pathname === item.path
  }

  return (
    <div style={{ height: 42, background: isLight ? '#FFFFFF' : '#0B111A', borderBottom: `1px solid ${isLight ? '#CBD5E1' : '#1F2A3A'}`, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 0, flexShrink: 0, zIndex: 100, overflow: 'visible', boxShadow: isLight ? '0 1px 0 rgba(15,23,42,.06)' : '0 1px 0 rgba(255,255,255,.03)' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 6px', flex: '1 1 auto', minWidth: 0, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none' }}>
        {NAV_ITEMS.map(item => {
          const active = isActive(item)
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              style={{
                padding: '10px 12px',
                fontSize: 13,
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8, flexShrink: 0 }}>
        {enterpriseProject && (
          <button onClick={() => navigate('/dashboard')} title={enterpriseProject.project_path} style={{ height: 30, maxWidth: 210, borderRadius: 6, background: isLight ? '#ECFDF5' : 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.45)', color: isLight ? '#047857' : '#A7F3D0', padding: '0 10px', cursor: 'pointer', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <i className="fas fa-folder-open" style={{ fontSize: 12, marginRight: 7 }}></i>
            {enterpriseProject.project_name}
          </button>
        )}
        <button onClick={handleSaveProject} title="Save Project to Local Disk" style={{ height: 30, borderRadius: 6, background: projectDirty ? 'linear-gradient(135deg,#EF4444,#DA2626)' : isLight ? '#F1F5F9' : '#0E1622', border: `1px solid ${projectDirty ? '#EF4444' : isLight ? '#CBD5E1' : '#223047'}`, color: projectDirty ? '#FFFFFF' : isLight ? '#0F172A' : '#F8FAFC', display: 'flex', alignItems: 'center', gap: 7, padding: '0 12px', cursor: 'pointer', fontWeight: 800, whiteSpace: 'nowrap' }}>
          <i className="fas fa-save" style={{ fontSize: 12 }}></i>
          Save Project
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {searchOpen && (
            <input
              ref={searchRef}
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') submitSearch()
                if (event.key === 'Escape') setSearchOpen(false)
              }}
              placeholder="Search..."
              style={{ width: 180, height: 30, borderRadius: 6, border: `1px solid ${isLight ? '#CBD5E1' : '#223047'}`, background: isLight ? '#F8FAFC' : '#070B12', color: isLight ? '#0F172A' : '#F8FAFC', outline: 'none', padding: '0 10px', fontSize: 13 }}
            />
          )}
          <button onClick={toggleSearch} title={searchOpen ? 'Close search' : 'Search wells and projects'} style={{ width: 30, height: 30, borderRadius: 6, background: isLight ? '#F1F5F9' : '#0E1622', border: `1px solid ${isLight ? '#CBD5E1' : '#223047'}`, color: isLight ? '#0F172A' : '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <i className={`fas ${searchOpen ? 'fa-xmark' : 'fa-search'}`} style={{ fontSize: 12 }}></i>
          </button>
        </div>
        <button onClick={toggleTheme} title="Toggle theme" style={{ width: 30, height: 30, borderRadius: 6, background: isLight ? '#F1F5F9' : '#0E1622', border: `1px solid ${isLight ? '#CBD5E1' : '#223047'}`, color: isLight ? '#0F172A' : '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <i className="fas fa-circle-half-stroke" style={{ fontSize: 12 }}></i>
        </button>
        <button onClick={() => toast('Help center coming soon')} style={{ width: 30, height: 30, borderRadius: 6, background: isLight ? '#F1F5F9' : '#0E1622', border: `1px solid ${isLight ? '#CBD5E1' : '#223047'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <i className="fas fa-question-circle" style={{ color: isLight ? '#334155' : '#94A3B8', fontSize: 12 }}></i>
        </button>
        <div ref={profileRef} style={{ position: 'relative' }}>
          <button type="button" onClick={() => setProfileOpen((current) => !current)} title="Profile menu" style={{ display: 'flex', alignItems: 'center', gap: 7, background: profileOpen ? (isLight ? '#F1F5F9' : '#0E1622') : 'transparent', border: `1px solid ${profileOpen ? (isLight ? '#CBD5E1' : '#223047') : 'transparent'}`, borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}>
            <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#FF4B4B,#DA2626)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>{user?.avatar_initials || 'U'}</div>
            <div>
              <div style={{ fontSize: 12, color: isLight ? '#0F172A' : '#E2E8F0', fontWeight: 700, lineHeight: 1.2 }}>User</div>
              <div style={{ fontSize: 10, color: '#64748B' }}>Drake AI Admin</div>
            </div>
            <i className="fas fa-chevron-down" style={{ color: '#64748B', fontSize: 11 }}></i>
          </button>
          {profileOpen && (
            <div style={{ position: 'absolute', top: 46, right: 0, minWidth: 220, borderRadius: 10, background: isLight ? '#FFFFFF' : '#0B111A', border: `1px solid ${isLight ? '#E2E8F0' : '#223047'}`, boxShadow: '0 18px 48px rgba(0,0,0,.32)', zIndex: 10000, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${isLight ? '#E2E8F0' : '#1E293B'}` }}>
                <div style={{ color: isLight ? '#0F172A' : '#F8FAFC', fontSize: 13, fontWeight: 900 }}>User</div>
                <div style={{ color: '#64748B', fontSize: 11, marginTop: 3 }}>{user?.email || 'Signed in'}</div>
              </div>
              <button type="button" onClick={handleLogout} style={{ width: '100%', height: 44, padding: '0 14px', textAlign: 'left', background: 'transparent', border: 'none', color: isLight ? '#B91C1C' : '#FCA5A5', cursor: 'pointer', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="fas fa-right-from-bracket" style={{ width: 16, textAlign: 'center' }}></i>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

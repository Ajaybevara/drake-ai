import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useStore } from '../../store'
import { ACCESS_MODULES, accessDeniedMessage, canAccessPath } from '../../utils/accessControl'
import { authApi } from '../../services/api'
import { openExternalModule } from '../../utils/externalDigitizer'

const PLATFORM_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: 'fas fa-gauge-high' },
  { label: 'Projects', path: '/projects', icon: 'fas fa-folder' },
]

const GROUP_ORDER = ['Petrophysics', 'Seismic', 'CCUS', 'Geothermal', 'Drake AI Digitizer', 'Production']

function useWindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

export default function TopBar() {
  const { user, logout, theme, toggleTheme, enterpriseProject } = useStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const profileRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const width = useWindowWidth()
  const isLight = theme === 'light'
  const compact = width < 900
  const tiny = width < 620
  const crowded = width < 2100
  const tight = width < 1280
  const huge = width >= 2200
  const displayName = user?.full_name || user?.email?.split('@')[0] || 'User'
  const roleLabel = user?.role ? `Drake AI ${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}` : 'Drake AI User'

  const groups = useMemo(() => {
    const moduleGroups = GROUP_ORDER.map(group => ({
      label: group,
      items: ACCESS_MODULES
        .filter(module => module.group === group)
        .map(module => ({
          label: module.label,
          path: module.path,
          icon: iconForPath(module.path),
          locked: !canAccessPath(user?.role, user?.accessModules, module.path),
        })),
    }))
    return [
      {
        label: 'Platform',
        items: PLATFORM_ITEMS.map(item => ({
          ...item,
          locked: !canAccessPath(user?.role, user?.accessModules, item.path),
        })),
      },
      ...moduleGroups,
    ]
  }, [user?.accessModules, user?.role])

  const navGroups = useMemo(() => {
    if (!tight) return groups
    return [{
      label: 'Modules',
      items: groups.flatMap(group => group.items.map(item => ({
        ...item,
        label: group.label === 'Platform' ? item.label : `${group.label}: ${item.label}`,
      }))),
    }]
  }, [groups, tight])

  const activeGroup = useMemo(() => {
    if (location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/projects')) return 'Platform'
    const activeModule = ACCESS_MODULES.find(module => location.pathname.startsWith(module.path))
    if (activeModule) return activeModule.group
    if (location.pathname.startsWith('/digitizer')) return 'Drake AI Digitizer'
    if (location.pathname.startsWith('/petrophysics')) return 'Petrophysics'
    return 'Platform'
  }, [location.pathname])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false)
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleLogout = async () => {
    setProfileOpen(false)
    await new Promise<void>(resolve => {
      window.addEventListener('drake:logout-feedback-complete', () => resolve(), { once: true })
      window.dispatchEvent(new Event('drake:require-logout-feedback'))
    })
    try {
      await authApi.logout()
    } catch {
      undefined
    }
    logout()
    navigate('/login')
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

  const openItem = (item: { label: string; path: string; locked: boolean }) => {
    if (item.locked) {
      setOpenMenu(null)
      navigate(item.path)
      return
    }
    setOpenMenu(null)
    if (openExternalModule(item.path)) return
    navigate(item.path)
  }

  const palette = {
    bg: isLight ? '#FFFFFF' : '#0B111A',
    border: isLight ? '#CBD5E1' : '#1F2A3A',
    panel: isLight ? '#FFFFFF' : '#0B111A',
    soft: isLight ? '#F1F5F9' : '#0E1622',
    text: isLight ? '#0F172A' : '#F8FAFC',
    muted: isLight ? '#64748B' : '#94A3B8',
  }

  return (
    <header style={{ ...topbar, minHeight: compact ? 84 : huge ? 88 : 76, background: palette.bg, borderBottom: `1px solid ${palette.border}`, padding: compact ? '10px 12px 10px 0' : huge ? '0 30px 0 0' : '0 20px 0 0' }}>
      <button onClick={() => navigate('/dashboard')} title="Dashboard" style={{ ...logoButton, width: tiny ? 166 : compact ? 206 : huge ? 330 : crowded ? 246 : 286 }}>
        <img src={isLight ? '/logo_light.png' : '/logo.png'} alt="Drake AI Logo" style={{ width: '100%', maxHeight: compact ? 66 : huge ? 78 : 72, objectFit: 'contain' }} />
      </button>

      <nav ref={menuRef} style={{ ...nav, gap: huge ? 12 : crowded ? 5 : 8, overflowX: 'visible', overflowY: 'visible' }}>
        {navGroups.map(group => {
          const active = tight ? true : activeGroup === group.label
          const open = openMenu === group.label
          const hovered = hoveredMenu === group.label
          const availableCount = group.items.filter(item => !item.locked).length
          return (
            <div key={group.label} style={{ position: 'relative', flex: '0 0 auto' }}>
              <button
                type="button"
                onClick={() => setOpenMenu(open ? null : group.label)}
                onMouseEnter={() => setHoveredMenu(group.label)}
                onMouseLeave={() => setHoveredMenu(null)}
                style={{
                  ...navButton,
                  height: huge ? 54 : compact ? 48 : 50,
                  padding: huge ? '0 20px' : compact ? '0 13px' : crowded ? '0 12px' : '0 17px',
                  fontSize: huge ? 18 : compact || crowded ? 15 : 16,
                  background: active
                    ? 'linear-gradient(180deg,rgba(218,38,38,.38),rgba(218,38,38,.10))'
                    : open || hovered
                      ? (isLight ? '#EEF2F7' : 'rgba(148,163,184,.14)')
                      : 'transparent',
                  color: active || hovered ? (isLight ? '#B91C1C' : '#FFFFFF') : palette.text,
                  borderColor: active ? '#DA2626' : hovered ? (isLight ? '#CBD5E1' : '#334155') : 'transparent',
                  boxShadow: hovered || open ? '0 10px 24px rgba(0,0,0,.18)' : 'none',
                  transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
                }}
              >
                <span>{tight ? 'Modules' : group.label}</span>
                {availableCount === 0 && <i className="fas fa-lock" style={{ fontSize: 11, color: '#64748B' }} />}
                <i className={`fas fa-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 10, color: active ? '#FCA5A5' : palette.muted }} />
              </button>
              {open && (
                <div style={{ ...dropdown, right: compact ? 'auto' : undefined, left: 0, minWidth: tiny ? 300 : tight ? 420 : 334, maxWidth: tiny ? 'calc(100vw - 24px)' : tight ? 'min(620px, calc(100vw - 24px))' : 420, maxHeight: compact ? 'calc(100vh - 120px)' : undefined, overflowY: compact ? 'auto' : 'hidden', background: palette.panel, border: `1px solid ${palette.border}` }}>
                  <div style={{ ...dropdownTitle, color: palette.muted }}>{group.label}</div>
                  {group.items.map(item => {
                    const activeItem = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                    const itemHovered = hoveredItem === item.path
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => openItem(item)}
                        onMouseEnter={() => setHoveredItem(item.path)}
                        onMouseLeave={() => setHoveredItem(null)}
                        title={item.locked ? accessDeniedMessage(item.label) : item.label}
                        style={{
                          ...dropdownItem,
                          background: activeItem
                            ? 'linear-gradient(90deg,rgba(218,38,38,.88),rgba(218,38,38,.24))'
                            : itemHovered
                              ? (isLight ? '#EEF2F7' : 'rgba(148,163,184,.12)')
                              : 'transparent',
                          color: activeItem ? '#FFFFFF' : item.locked ? '#64748B' : itemHovered ? (isLight ? '#B91C1C' : '#FFFFFF') : palette.text,
                          fontSize: huge ? 17 : 16,
                          transform: itemHovered ? 'translateX(2px)' : 'translateX(0)',
                        }}
                      >
                        <i className={item.icon} style={{ width: 18, textAlign: 'center' }} />
                        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{item.label}</span>
                        {item.locked && <i className="fas fa-lock" style={{ fontSize: 11 }} />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

        <div style={{ ...actions, gap: huge ? 12 : crowded ? 7 : 9 }}>
        {user?.role === 'admin' && !tight && (
          <button onClick={() => navigate('/admin')} title="Admin panel" style={{ ...pillButton, background: location.pathname.startsWith('/admin') ? 'rgba(218,38,38,.24)' : palette.soft, border: `1px solid ${location.pathname.startsWith('/admin') ? '#DA2626' : palette.border}`, color: palette.text }}>
            <i className="fas fa-user-shield" style={{ fontSize: 15 }} />
            {!crowded && 'Admin'}
          </button>
        )}
        {enterpriseProject && !crowded && (
          <button onClick={() => navigate('/dashboard')} title={enterpriseProject.project_path} style={{ ...projectButton, maxWidth: huge ? 380 : crowded ? 190 : 260 }}>
            <i className="fas fa-folder-open" style={{ fontSize: 15 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{enterpriseProject.project_name}</span>
          </button>
        )}
        {searchOpen && !tiny && (
          <input
            ref={searchRef}
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') submitSearch()
              if (event.key === 'Escape') setSearchOpen(false)
            }}
            placeholder="Search..."
            style={{ ...searchInput, width: compact ? 160 : huge ? 280 : crowded ? 180 : 210, background: isLight ? '#F8FAFC' : '#070B12', color: palette.text, border: `1px solid ${palette.border}` }}
          />
        )}
        <IconButton title={searchOpen ? 'Close search' : 'Search'} icon={searchOpen ? 'fas fa-xmark' : 'fas fa-search'} onClick={toggleSearch} palette={palette} />
        <IconButton title="Toggle theme" icon="fas fa-circle-half-stroke" onClick={toggleTheme} palette={palette} />
        {!tiny && <IconButton title="Help" icon="fas fa-question-circle" onClick={() => toast('Help center coming soon')} palette={palette} />}
        <div ref={profileRef} style={{ position: 'relative' }}>
          <button type="button" onClick={() => setProfileOpen(current => !current)} title="Profile menu" style={{ ...profileButton, background: profileOpen ? palette.soft : 'transparent', border: `1px solid ${profileOpen ? palette.border : 'transparent'}` }}>
            <div style={avatar}>{user?.avatar_initials || 'U'}</div>
            {!compact && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: huge ? 15 : 14, color: palette.text, fontWeight: 800, lineHeight: 1.15, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                <div style={{ fontSize: 12, color: palette.muted, lineHeight: 1.15 }}>{roleLabel}</div>
              </div>
            )}
            {!tiny && <i className="fas fa-chevron-down" style={{ color: palette.muted, fontSize: 11 }} />}
          </button>
          {profileOpen && (
            <div style={{ ...profileMenu, background: palette.panel, border: `1px solid ${palette.border}` }}>
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${palette.border}` }}>
                <div style={{ color: palette.text, fontSize: 14, fontWeight: 900 }}>{displayName}</div>
                <div style={{ color: palette.muted, fontSize: 12, marginTop: 3 }}>{user?.email || 'Signed in'}</div>
              </div>
              {user?.role === 'admin' && (
                <button type="button" onClick={() => { setProfileOpen(false); navigate('/admin') }} style={{ ...menuAction, color: palette.text }}>
                  <i className="fas fa-user-shield" style={{ width: 16, textAlign: 'center' }} />
                  Admin Panel
                </button>
              )}
              <button type="button" onClick={handleLogout} style={{ ...menuAction, color: isLight ? '#B91C1C' : '#FCA5A5' }}>
                <i className="fas fa-right-from-bracket" style={{ width: 16, textAlign: 'center' }} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function IconButton({ title, icon, onClick, palette }: { title: string; icon: string; onClick: () => void; palette: any }) {
  return (
    <button onClick={onClick} title={title} style={{ ...iconButton, background: palette.soft, border: `1px solid ${palette.border}`, color: palette.text }}>
      <i className={icon} style={{ fontSize: 13 }} />
    </button>
  )
}

function iconForPath(path: string) {
  if (path.includes('missing')) return 'fas fa-brain'
  if (path.includes('facies')) return 'fas fa-layer-group'
  if (path.includes('formation')) return 'fas fa-map-signs'
  if (path.includes('parameter')) return 'fas fa-gauge-high'
  if (path.includes('uncertainty')) return 'fas fa-chart-area'
  if (path.includes('auto-splicer')) return 'fas fa-code-branch'
  if (path.includes('seismic')) return 'fas fa-wave-square'
  if (path.includes('production')) return 'fas fa-chart-line'
  if (path.includes('ccus')) return 'fas fa-leaf'
  if (path.includes('geothermal')) return 'fas fa-temperature-high'
  if (path.includes('well-log-digitizer')) return 'fas fa-chart-column'
  if (path.includes('slm-gpt')) return 'fas fa-robot'
  if (path.includes('ocr')) return 'fas fa-file-lines'
  return 'fas fa-chart-line'
}


const topbar: CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, zIndex: 200, overflow: 'visible', boxShadow: '0 1px 0 rgba(255,255,255,.03)' }
const logoButton: CSSProperties = { border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }
const nav: CSSProperties = { display: 'flex', alignItems: 'center', flex: '1 1 auto', minWidth: 0, scrollbarWidth: 'none', padding: '6px 2px' }
const navButton: CSSProperties = { border: '1px solid transparent', borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, cursor: 'pointer', fontWeight: 900, lineHeight: 1.1, whiteSpace: 'nowrap', fontFamily: 'DM Sans,sans-serif', transition: 'all .15s' }
const dropdown: CSSProperties = { position: 'absolute', top: 'calc(100% + 10px)', borderRadius: 10, boxShadow: '0 22px 60px rgba(0,0,0,.42)', zIndex: 10000, padding: 8, overflow: 'hidden' }
const dropdownTitle: CSSProperties = { padding: '10px 12px 11px', textTransform: 'uppercase', letterSpacing: 2.6, fontSize: 12, fontWeight: 900 }
const dropdownItem: CSSProperties = { width: '100%', minHeight: 48, border: 'none', borderRadius: 8, background: 'transparent', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', cursor: 'pointer', textAlign: 'left', fontWeight: 850, lineHeight: 1.25, fontFamily: 'DM Sans,sans-serif' }
const actions: CSSProperties = { display: 'flex', alignItems: 'center', flex: '0 0 auto', minWidth: 0 }
const pillButton: CSSProperties = { height: 42, borderRadius: 8, padding: '0 13px', cursor: 'pointer', fontWeight: 900, whiteSpace: 'nowrap', fontSize: 15, display: 'inline-flex', alignItems: 'center', gap: 8 }
const projectButton: CSSProperties = { height: 42, borderRadius: 8, background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.45)', color: '#A7F3D0', padding: '0 13px', cursor: 'pointer', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', fontSize: 16, lineHeight: 1.2, display: 'inline-flex', alignItems: 'center', gap: 8 }
const searchInput: CSSProperties = { height: 42, borderRadius: 8, outline: 'none', padding: '0 12px', fontSize: 15 }
const iconButton: CSSProperties = { width: 42, height: 42, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }
const profileButton: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, borderRadius: 9, padding: '5px 9px', cursor: 'pointer' }
const avatar: CSSProperties = { width: 42, height: 42, background: 'linear-gradient(135deg,#FF4B4B,#DA2626)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flex: '0 0 auto' }
const profileMenu: CSSProperties = { position: 'absolute', top: 54, right: 0, minWidth: 240, borderRadius: 10, boxShadow: '0 18px 48px rgba(0,0,0,.32)', zIndex: 10000, overflow: 'hidden' }
const menuAction: CSSProperties = { width: '100%', height: 48, padding: '0 16px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 11 }

import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../../store'
import { accessDeniedMessage, canAccessPath } from '../../utils/accessControl'

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: 'fas fa-gauge-high' },
  { label: 'Projects', path: '/projects', icon: 'fas fa-folder' },
]

const PETROPHYSICS_ITEMS = [
  { label: 'Log Visualization', path: '/petrophysics/log-visualization', icon: 'fas fa-chart-line', sub: true },
  { label: 'Missing Log Prediction', path: '/petrophysics/missing-log-prediction', icon: 'fas fa-brain', sub: true },
  { label: 'AI Facies Classification', path: '/petrophysics/ai-facies-classification', icon: 'fas fa-layer-group', sub: true },
  { label: 'AI Formation Tops', path: '/petrophysics/ai-formation-tops', icon: 'fas fa-map-signs', sub: true },
  { label: 'AI Parameter Prediction', path: '/petrophysics/ai-parameter-prediction', icon: 'fas fa-gauge-high', sub: true },
  { label: 'AI Uncertainty', path: '/petrophysics/ai-uncertainty', icon: 'fas fa-chart-area', sub: true },
  { label: 'Auto Splicer', path: '/petrophysics/auto-splicer', icon: 'fas fa-code-branch', sub: true },
]

const SEISMIC_ITEMS = [
  { label: 'Seismic Frequency Enhancer', path: '/seismic/frequency-enhancer', icon: 'fas fa-wave-square', sub: true },
]

const PRODUCTION_ITEMS = [
  { label: 'Production Intelligence', path: '/production/intelligence', icon: 'fas fa-chart-line', sub: true },
]

const CCUS_ITEMS = [
  { label: 'AI Preliminary Screening Using Well Logs', path: '/ccus/ai-preliminary-screening', icon: 'fas fa-leaf', sub: true },
]

const GEOTHERMAL_ITEMS = [
  { label: 'Geothermal Log-Based Screening', path: '/geothermal/log-based-screening', icon: 'fas fa-temperature-high', sub: true },
]

const DRAKE_AI_ITEMS = [
  { label: 'Drake SLM/GPT', path: '/digitizer/drake-slm-gpt', icon: 'fas fa-robot', sub: true },
  { label: 'Drake OCR', path: '/digitizer/drake-ocr', icon: 'fas fa-file-lines', sub: true },
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { sidebarCollapsed, toggleSidebar, theme, user } = useStore()
  const isLight = theme === 'light'

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    wells: true,
    platform: true,
    petrophysics: true,
    seismic: false,
    production: false,
    ccus: false,
    geothermal: false,
    drake_ai: false,
  })

  const toggleSection = (sec: string) => {
    setOpenSections(prev => ({ ...prev, [sec]: !prev[sec] }))
  }

  const [width, setWidth] = useState(268)
  const [isResizing, setIsResizing] = useState(false)
  const [hoveredNav, setHoveredNav] = useState<string | null>(null)
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)

  const NavItem = ({ icon, label, path, sub }: { icon: string; label: string; path: string; sub?: boolean }) => {
    const resolvedPath = resolvePath(label, path)
    const active = location.pathname === resolvedPath || location.pathname.startsWith(resolvedPath + '/')
    const locked = !canAccessPath(user?.role, user?.accessModules, resolvedPath)
    const openItem = () => {
      navigate(resolvedPath)
    }
    return (
      <div onClick={openItem} onMouseEnter={() => setHoveredNav(resolvedPath)} onMouseLeave={() => setHoveredNav(null)} title={locked ? accessDeniedMessage(label) : label} style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: sub ? '7px 12px 7px 26px' : '9px 12px',
        cursor: 'pointer', fontSize: sub ? 14.8 : 15, lineHeight: 1.35, transition: 'all .12s',
        color: active ? '#F8FAFC' : locked ? '#64748B' : isLight ? '#334155' : '#C3CDDC',
        background: active
          ? 'linear-gradient(90deg,rgba(218,38,38,.92),rgba(218,38,38,.28))'
          : hoveredNav === resolvedPath
            ? isLight ? '#E9EEF5' : 'rgba(148,163,184,.12)'
            : 'transparent',
        borderLeft: active ? '2px solid #DA2626' : '2px solid transparent',
        fontWeight: active ? 700 : 600,
      }}>
        <i className={icon} style={{ fontSize: 16, width: 19, textAlign: 'center', lineHeight: 1.35, marginTop: 1 }}></i>
        <span style={{ minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{label}</span>
        {locked && <i className="fas fa-lock" style={{ marginLeft: 'auto', fontSize: 11, lineHeight: 1.7, color: '#64748B' }}></i>}
      </div>
    )
  }

  const resolvePath = (label: string, path: string) => {
    return path
  }

  const SectionHeader = ({ id, label, rightElement }: any) => (
    <div onClick={() => toggleSection(id)} onMouseEnter={() => setHoveredSection(id)} onMouseLeave={() => setHoveredSection(null)} style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: hoveredSection === id ? isLight ? '#E9EEF5' : 'rgba(148,163,184,.10)' : 'transparent', transition: 'background .12s' }}>
      <div style={{ fontSize: 16.2, color: isLight ? '#64748B' : '#64748B', letterSpacing: 1.5, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, lineHeight: 1.25 }}>
        <i className={`fas fa-chevron-${openSections[id] ? 'down' : 'right'}`} style={{ fontSize: 14, width: 15 }}></i> {label}
      </div>
      {rightElement}
    </div>
  )

  const activeTopSection = location.pathname.startsWith('/petrophysics') || location.pathname.includes('/petrophysics') || location.pathname === '/' ? 'petrophysics'
    : location.pathname.startsWith('/seismic') ? 'seismic'
    : location.pathname.startsWith('/production') ? 'production'
    : location.pathname.startsWith('/ccus') ? 'ccus'
    : location.pathname.startsWith('/geothermal') ? 'geothermal'
    : location.pathname.startsWith('/digitizer') ? 'drake_ai'
    : 'petrophysics'

  const platformItems = NAV_ITEMS

  const sectionGroups = [
    { id: 'petrophysics', label: 'Petrophysics', items: PETROPHYSICS_ITEMS },
    { id: 'seismic', label: 'Seismic', items: SEISMIC_ITEMS },
    { id: 'production', label: 'Production', items: PRODUCTION_ITEMS },
    { id: 'ccus', label: 'CCUS', items: CCUS_ITEMS },
    { id: 'geothermal', label: 'Geothermal', items: GEOTHERMAL_ITEMS },
    { id: 'drake_ai', label: 'Drake AI Digitizer', items: DRAKE_AI_ITEMS },
  ].map(section => ({
    ...section,
    items: section.items,
  }))

  const startResizing = (e: React.MouseEvent) => {
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = width

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(230, Math.min(430, startWidth + moveEvent.clientX - startX))
      setWidth(newWidth)
    }

    const onMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  if (sidebarCollapsed) {
    return (
      <div style={{ width: 52, background: isLight ? '#F8FAFC' : '#080D15', borderRight: `1px solid ${isLight ? '#CBD5E1' : '#1E293B'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', flexShrink: 0, overflow: 'hidden' }}>
        <img src={isLight ? "/logo_light.png" : "/logo.png"} alt="Drake AI Logo" style={{ width: 38, height: 38, objectFit: 'contain', flexShrink: 0, marginBottom: 8 }} />
        <button onClick={toggleSidebar} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 8 }}>
          <i className="fas fa-angles-right" style={{ fontSize: 14 }}></i>
        </button>
      </div>
    )
  }

  return (
    <div style={{ width, background: isLight ? '#F8FAFC' : '#080D15', borderRight: `1px solid ${isLight ? '#CBD5E1' : '#1E293B'}`, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
      <div onMouseDown={startResizing} style={{ width: 4, cursor: 'col-resize', position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 10, background: isResizing ? '#DA2626' : 'transparent', transition: 'background .2s' }} />

      <div style={{ height: 120, padding: '14px 10px 12px', borderBottom: `1px solid ${isLight ? '#CBD5E1' : '#1E293B'}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: isLight ? '#F8FAFC' : 'linear-gradient(180deg,#070707,#080D15)', flexShrink: 0, zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <img src={isLight ? "/logo_light.png" : "/logo.png"} alt="Drake AI Logo" style={{ width: 170, height: 'auto', maxHeight: 108, objectFit: 'contain' }} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Navigation */}
        <div style={{ padding: '6px 0', borderBottom: '1px solid #1E293B' }}>
          <SectionHeader id="platform" label="Platform" />
          {openSections.platform && platformItems.map((item) => (
            <NavItem key={item.path} icon={item.icon} label={item.label} path={item.path} />
          ))}
        </div>

        <div style={{ padding: '6px 0' }}>
          {sectionGroups.map(section => (
            <div key={section.id} style={{ padding: '6px 0', borderBottom: '1px solid #1E293B' }}>
              <SectionHeader id={section.id} label={section.label} />
              {(openSections[section.id] || activeTopSection === section.id) && section.items.map((item) => (
                <NavItem key={item.path + item.label} icon={item.icon} label={item.label} path={item.path} sub={item.sub} />
              ))}
            </div>
          ))}
        </div>

        {/* Collapse */}
        <div onClick={toggleSidebar} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', color: '#7B8798', fontSize: 11, borderTop: '1px solid #1E293B', marginTop: 'auto' }}>
          <i className="fas fa-angles-left"></i> Collapse
        </div>
      </div>
    </div>
  )
}

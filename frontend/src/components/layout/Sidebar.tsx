import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../../store'

const STATUS_COLORS: Record<string, string> = {
  'Completed': '#10B981',
  'Active': '#10B981',
  'QC Required': '#F59E0B',
  'Failed': '#EF4444',
}

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: 'fas fa-gauge-high' },
  { label: 'Projects', path: '/projects', icon: 'fas fa-folder' },
  { label: 'Project Data Repository', path: '/data-management', icon: 'fas fa-database' },
  { label: 'Reports / Exports', path: '/analytics/reports', icon: 'fas fa-file-export' },
]

const PETROPHYSICS_ITEMS = [
  { label: 'Log Visualization', path: '/petrophysics/log-visualization', icon: 'fas fa-chart-line', sub: true },
  { label: 'Missing Log Prediction', path: '/petrophysics/missing-log-prediction', icon: 'fas fa-brain', sub: true },
  { label: 'AI Facies Classification', path: '/petrophysics/ai-facies-classification', icon: 'fas fa-layer-group', sub: true },
  { label: 'AI Formation Tops', path: '/petrophysics/ai-formation-tops', icon: 'fas fa-map-signs', sub: true },
  { label: 'AI Parameter Prediction', path: '/petrophysics/ai-parameter-prediction', icon: 'fas fa-gauge-high', sub: true },
  { label: 'AI Uncertainty', path: '/petrophysics/ai-uncertainty', icon: 'fas fa-chart-area', sub: true },
  { label: 'Auto Splicer', path: '/petrophysics/auto-splicer', icon: 'fas fa-code-branch', sub: true },
  { label: 'Crossplot', path: '/petrophysics/crossplot', icon: 'fas fa-project-diagram', sub: true },
  { label: 'Histogram', path: '/petrophysics/histogram', icon: 'fas fa-chart-column', sub: true },
]

const SEISMIC_ITEMS = [
  { label: 'Seismic Frequency Enhancer', path: '/seismic/frequency-enhancer', icon: 'fas fa-wave-square', sub: true },
]

const PRODUCTION_ITEMS = [
  { label: 'Production Optimization', path: '/production/optimization', icon: 'fas fa-chart-line', sub: true },
  { label: 'AI Artificial Lift', path: '/production/ai-artificial-lift', icon: 'fas fa-oil-well', sub: true },
]

const CCUS_ITEMS = [
  { label: 'AI Preliminary Screening Using Well Logs', path: '/ccus/ai-preliminary-screening', icon: 'fas fa-leaf', sub: true },
]

const DRAKE_AI_ITEMS = [
  { label: 'Drake SLM/GPT', path: '/digitizer/drake-slm-gpt', icon: 'fas fa-robot', sub: true },
  { label: 'Drake OCR', path: '/digitizer/drake-ocr', icon: 'fas fa-file-lines', sub: true },
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { activeProject, wells, activeWell, setActiveWell, sidebarCollapsed, toggleSidebar, theme } = useStore()
  const isLight = theme === 'light'

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    wells: true,
    platform: true,
    petrophysics: true,
    seismic: false,
    production: false,
    ccus: false,
    drake_ai: false,
  })

  const toggleSection = (sec: string) => {
    setOpenSections(prev => ({ ...prev, [sec]: !prev[sec] }))
  }

  const [width, setWidth] = useState(224)
  const [isResizing, setIsResizing] = useState(false)
  const [activeListTab, setActiveListTab] = useState<'wells' | 'templates'>('wells')

  const selectWell = (w: any) => {
    setActiveWell(w)
  }

  const NavItem = ({ icon, label, path, sub }: { icon: string; label: string; path: string; sub?: boolean }) => {
    const resolvedPath = resolvePath(label, path)
    const active = location.pathname === resolvedPath || location.pathname.startsWith(resolvedPath + '/')
    return (
      <div onClick={() => navigate(resolvedPath)} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: sub ? '6px 12px 6px 24px' : '8px 12px',
        cursor: 'pointer', fontSize: 9.8, transition: 'all .12s',
        color: active ? '#F8FAFC' : isLight ? '#334155' : '#C3CDDC',
        background: active ? 'linear-gradient(90deg,rgba(218,38,38,.92),rgba(218,38,38,.28))' : 'transparent',
        borderLeft: active ? '2px solid #DA2626' : '2px solid transparent',
        fontWeight: active ? 500 : 400,
      }}>
        <i className={icon} style={{ fontSize: 10.7, width: 15, textAlign: 'center' }}></i>
        {label}
      </div>
    )
  }

  const resolvePath = (label: string, path: string) => {
    return path
  }

  const SectionHeader = ({ id, label, rightElement }: any) => (
    <div onClick={() => toggleSection(id)} style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
      <div style={{ fontSize: 12, color: isLight ? '#64748B' : '#64748B', letterSpacing: 1.2, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
        <i className={`fas fa-chevron-${openSections[id] ? 'down' : 'right'}`} style={{ fontSize: 10, width: 12 }}></i> {label}
      </div>
      {rightElement}
    </div>
  )

  const activeTopSection = location.pathname.startsWith('/petrophysics') || location.pathname.includes('/petrophysics') || location.pathname === '/' ? 'petrophysics'
    : location.pathname.startsWith('/seismic') ? 'seismic'
    : location.pathname.startsWith('/production') ? 'production'
    : location.pathname.startsWith('/ccus') ? 'ccus'
    : location.pathname.startsWith('/digitizer') ? 'drake_ai'
    : 'petrophysics'

  const sectionGroups = [
    { id: 'petrophysics', label: 'Petrophysics', items: PETROPHYSICS_ITEMS },
    { id: 'seismic', label: 'Seismic', items: SEISMIC_ITEMS },
    { id: 'production', label: 'Production', items: PRODUCTION_ITEMS },
    { id: 'ccus', label: 'CCUS', items: CCUS_ITEMS },
    { id: 'drake_ai', label: 'Drake AI Digitizer', items: DRAKE_AI_ITEMS },
  ]

  const startResizing = (e: React.MouseEvent) => {
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = width

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(160, Math.min(400, startWidth + moveEvent.clientX - startX))
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

  const filteredWells = wells

  if (sidebarCollapsed) {
    return (
      <div style={{ width: 42, background: isLight ? '#F8FAFC' : '#080D15', borderRight: `1px solid ${isLight ? '#CBD5E1' : '#1E293B'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0' }}>
        <button onClick={toggleSidebar} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 8 }}>
          <i className="fas fa-angles-right" style={{ fontSize: 14 }}></i>
        </button>
      </div>
    )
  }

  return (
    <div style={{ width, background: isLight ? '#F8FAFC' : '#080D15', borderRight: `1px solid ${isLight ? '#CBD5E1' : '#1E293B'}`, display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', position: 'relative' }}>
      <div onMouseDown={startResizing} style={{ width: 4, cursor: 'col-resize', position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 10, background: isResizing ? '#DA2626' : 'transparent', transition: 'background .2s' }} />

      <div style={{ height: 120, padding: '14px 10px 12px', borderBottom: `1px solid ${isLight ? '#CBD5E1' : '#1E293B'}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: isLight ? 'transparent' : 'linear-gradient(180deg,#070707,#080D15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <img src={isLight ? "/logo_light.png" : "/logo.png"} alt="Drake AI Logo" style={{ width: 170, height: 'auto', maxHeight: 108, objectFit: 'contain' }} />
        </div>
      </div>





      {/* Navigation */}
      <div style={{ padding: '6px 0', borderBottom: '1px solid #1E293B' }}>
        <SectionHeader id="platform" label="Platform" />
        {openSections.platform && NAV_ITEMS.map((item) => (
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
      <div onClick={toggleSidebar} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', color: '#7B8798', fontSize: 9, borderTop: '1px solid #1E293B', marginTop: 'auto' }}>
        <i className="fas fa-angles-left"></i> Collapse
      </div>
    </div>
  )
}

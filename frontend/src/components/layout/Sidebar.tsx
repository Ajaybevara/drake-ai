import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../../store'
import { projectsApi, wellsApi, curvesApi, filesApi, aiApi } from '../../services/api'
import toast from 'react-hot-toast'

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
  { label: 'Upload LAS', path: '/petrophysics/log-viewer', icon: 'fas fa-cloud-upload-alt' },
  { label: 'AI Visualization', path: '/petrophysics/log-qc', icon: 'fas fa-chart-line', sub: true },
  { label: 'Missing Log AI', path: '/petrophysics/missing-log-ai', icon: 'fas fa-brain', sub: true },
  { label: 'Facies Classification', path: '/petrophysics/facies-classification', icon: 'fas fa-layer-group', sub: true },
  { label: 'AI Prediction', path: '/petrophysics/porosity-permeability', icon: 'fas fa-brain', sub: true },
  { label: 'AI Uncertainty', path: '/petrophysics/water-saturation', icon: 'fas fa-chart-area', sub: true },
  { label: 'Auto Splice', path: '/petrophysics/auto-splice', icon: 'fas fa-code-branch', sub: true },
]

const SEISMIC_ITEMS = [
  { label: 'Seismic Overview', path: '/analytics/seismic', icon: 'fas fa-wave-square' },
  { label: 'Seismic QC', path: '/analytics/seismic', icon: 'fas fa-bolt', sub: true },
]

const PRODUCTION_ITEMS = [
  { label: 'Production Overview', path: '/analytics/production', icon: 'fas fa-industry' },
  { label: 'Production Trends', path: '/analytics/production', icon: 'fas fa-chart-line', sub: true },
]

const CCUS_ITEMS = [
  { label: 'CCUS Overview', path: '/analytics/ccus', icon: 'fas fa-leaf' },
  { label: 'Carbon Reports', path: '/analytics/ccus', icon: 'fas fa-file-alt', sub: true },
]

const DRAKE_AI_ITEMS = [
  { label: 'Drake AI Assistant', path: '/analytics/ai-assistant', icon: 'fas fa-robot' },
  { label: 'Digitizer', path: '/analytics/ai-assistant', icon: 'fas fa-magic', sub: true },
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { projects, activeProject, setActiveProject, wells, setWells, activeWell, setActiveWell, setCurves, setFiles, setAIJobs, sidebarCollapsed, toggleSidebar, theme, activeLocalProject } = useStore()
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

  const selectProject = async (p: any) => {
    setActiveProject(p)
    try {
      const res = await wellsApi.list(p.id)
      setWells(res.data)
      if (res.data.length > 0) await selectWell(res.data[0])
      toast.success(`Opened ${p.name}`)
    } catch {
      toast.error('Failed to load project wells')
    }
  }

  const createProject = async () => {
    try {
      const name = `New Study ${projects.length + 1}`
      const res = await projectsApi.create({ name, description: 'Created from Drake AI workspace' })
      setActiveProject(res.data)
      setWells([])
      toast.success(`Created ${name}`)
    } catch {
      toast('New project API is unavailable in this build')
    }
  }

  const selectWell = async (w: any) => {
    setActiveWell(w)
    try {
      const [curves, files, jobs] = await Promise.all([
        curvesApi.list(w.id),
        filesApi.list(w.id),
        aiApi.list(w.id),
      ])
      setCurves(curves.data)
      setFiles(files.data)
      setAIJobs(jobs.data)
    } catch {
      // ignore load errors for now
    }
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
    if (!activeLocalProject) return path
    if (label === 'Project Data Repository') return `/projects/${activeLocalProject.id}/data`
    if (label === 'Reports / Exports') return `/projects/${activeLocalProject.id}/reports`
    if (label === 'Upload LAS') return `/projects/${activeLocalProject.id}/petrophysics/log-viewer`
    if (label === 'AI Visualization') return `/projects/${activeLocalProject.id}/petrophysics/log-qc`
    if (label === 'Missing Log AI') return `/projects/${activeLocalProject.id}/petrophysics/missing-log-prediction`
    if (label === 'Facies Classification') return `/projects/${activeLocalProject.id}/petrophysics/facies-classification`
    if (label === 'AI Prediction') return `/projects/${activeLocalProject.id}/petrophysics/porosity-permeability`
    if (label === 'AI Uncertainty') return `/projects/${activeLocalProject.id}/petrophysics/water-saturation`
    if (label === 'Auto Splice') return `/projects/${activeLocalProject.id}/petrophysics/auto-splice`
    if (path === '/analytics/seismic') return `/projects/${activeLocalProject.id}/seismic`
    if (path === '/analytics/production') return `/projects/${activeLocalProject.id}/production`
    if (path === '/analytics/ccus') return `/projects/${activeLocalProject.id}/ccus`
    if (label === 'Digitizer' || label === 'Drake AI Assistant') return `/projects/${activeLocalProject.id}/digitizer`
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
    : location.pathname.startsWith('/analytics/seismic') || location.pathname.includes('/seismic') ? 'seismic'
    : location.pathname.startsWith('/analytics/production') || location.pathname.includes('/production') ? 'production'
    : location.pathname.startsWith('/analytics/ccus') || location.pathname.includes('/ccus') ? 'ccus'
    : location.pathname.startsWith('/analytics/ai-assistant') || location.pathname.includes('/digitizer') ? 'drake_ai'
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



      {/* Wells */}
      <div style={{ padding: '6px 0', borderBottom: `1px solid ${isLight ? '#CBD5E1' : '#1E293B'}` }}>
        <SectionHeader id="wells" label="Wells" rightElement={<span style={{ fontSize: 7.5, color: '#475569' }}>{activeProject?.name}</span>} />
        {openSections.wells && (
          <div>
            <div style={{ padding: '0 12px 8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 6, marginTop: 4 }}>
                  <button onClick={() => setActiveListTab('wells')} style={{ flex: 1, padding: '6px 0', textAlign: 'center', borderRadius: 6, fontSize: 13, color: activeListTab === 'wells' ? '#F8FAFC' : '#94A3B8', background: activeListTab === 'wells' ? '#142033' : 'transparent', border: activeListTab === 'wells' ? '1px solid #26364F' : '1px solid transparent', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', fontWeight: 700 }}>Wells</button>
                  <button onClick={() => setActiveListTab('templates')} style={{ flex: 1, padding: '6px 0', textAlign: 'center', borderRadius: 6, fontSize: 13, color: activeListTab === 'templates' ? '#F8FAFC' : '#94A3B8', background: activeListTab === 'templates' ? '#142033' : 'transparent', border: activeListTab === 'templates' ? '1px solid #26364F' : '1px solid transparent', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', fontWeight: 700 }}>Templates</button>
                </div>
            </div>
            {activeListTab === 'wells' && filteredWells.map(w => (
              <div key={w.id} onClick={() => selectWell(w)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                color: w.id === activeWell?.id ? '#F8FAFC' : '#AAB6C6',
                background: w.id === activeWell?.id ? '#2b0b0b' : 'transparent',
                borderLeft: w.id === activeWell?.id ? '3px solid #DA2626' : '3px solid transparent',
                fontWeight: w.id === activeWell?.id ? 700 : 600, transition: 'all .12s',
              }}>
                <i className="fas fa-circle-dot" style={{ fontSize: 12 }}></i>
                <span style={{ flex: 1, fontWeight: 700 }}>{w.name}</span>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: STATUS_COLORS[w.status] || '#64748B', flexShrink: 0, boxShadow: STATUS_COLORS[w.status] === '#10B981' ? '0 0 5px #10B981' : 'none' }}></div>
              </div>
            ))}

            {activeListTab === 'templates' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '6px 6px 12px 8px' }}>
                <div style={{ fontSize: 12, color: isLight ? '#334155' : '#CBD5E1', fontWeight: 700 }}>Template History</div>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 6, background: isLight ? '#F8FAFC' : '#07101A', border: `1px solid ${isLight ? '#E2E8F0' : '#223047'}`, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 6, background: 'linear-gradient(135deg,#DA2626,#9B1B1B)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>T</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>Template v{4 - i}</div>
                        <div style={{ fontSize: 11, color: isLight ? '#64748B' : '#95A3B8' }}>By System • {['2h','1d','3d','1w'][i]} ago</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: isLight ? '#0F172A' : '#E2E8F0' }}>Applied • {['3','7','12','20'][i]} wells</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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

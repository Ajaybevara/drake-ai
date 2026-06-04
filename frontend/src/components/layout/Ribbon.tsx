import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useStore } from '../../store'
import { aiApi } from '../../services/api'

const ALL_MODULES = ['missing_log', 'facies', 'formation_tops', 'porosity', 'permeability', 'water_saturation', 'auto_splice']

export default function Ribbon() {
  const { activeWell, upsertAIJob, setActiveTab, theme, projects, activeProject, setActiveProject } = useStore()
  const navigate = useNavigate()
  const isLight = theme === 'light'

  const runAllModules = async () => {
    if (!activeWell) return toast.error('Select a well first')
    toast.success('Running all AI modules...')
    for (const mod of ALL_MODULES) {
      try {
        const res = await aiApi.run(activeWell.id, mod)
        upsertAIJob(res.data)
        pollJob(res.data.id)
      } catch {
        toast.error(`Could not start ${mod.replace(/_/g, ' ')}`)
      }
    }
  }

  const pollJob = async (jobId: number) => {
    const interval = setInterval(async () => {
      try {
        const res = await aiApi.get(jobId)
        upsertAIJob(res.data)
        if (['completed', 'failed'].includes(res.data.status)) {
          clearInterval(interval)
          if (res.data.status === 'completed') toast.success(`${res.data.job_type} completed - ${res.data.accuracy}% accuracy`)
          else toast.error(`${res.data.job_type} failed`)
        }
      } catch {
        clearInterval(interval)
      }
    }, 1500)
  }

  const Dropdown = ({ label, items }: any) => {
    const [open, setOpen] = useState(false)
    const [menuRect, setMenuRect] = useState({ top: 0, left: 0, width: 0 })
    const buttonRef = useRef<HTMLButtonElement>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)

    const closeMenu = () => setOpen(false)

    useEffect(() => {
      const handleClick = (event: MouseEvent) => {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
          closeMenu()
        }
      }
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const toggleMenu = () => {
      if (!open && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect()
        setMenuRect({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX, width: rect.width })
      }
      setOpen((current) => !current)
    }

    return (
      <div ref={wrapperRef} style={{ display: 'inline-block', position: 'relative' }}>
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleMenu}
          style={{ padding: '8px 10px', borderRadius: 6, background: '#0E1622', border: '1px solid #223047', color: '#E2E8F0', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          {label} <i className="fas fa-caret-down" style={{ marginLeft: 8, fontSize: 11 }}></i>
        </button>

        {open && (
          <div
            style={{
              position: 'fixed',
              top: menuRect.top,
              left: menuRect.left,
              minWidth: menuRect.width,
              background: isLight ? '#FFFFFF' : '#0B111A',
              border: `1px solid ${isLight ? '#E2E8F0' : '#223047'}`,
              borderRadius: 8,
              boxShadow: '0 10px 30px rgba(0,0,0,.35)',
              zIndex: 9999,
              padding: '6px 0',
            }}
          >
            {items.map((it: any) => (
              <div
                key={it.label}
                onClick={() => {
                  closeMenu()
                  it.onClick && it.onClick()
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer', color: isLight ? '#0F172A' : '#E2E8F0', fontSize: 13, whiteSpace: 'nowrap' }}
              >
                {it.icon && <i className={it.icon} style={{ width: 18, textAlign: 'center' }}></i>}
                <div>{it.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const RibbonBtn = ({ icon, label, active, onClick, gradient }: any) => (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 5,
        border: '1px solid transparent',
        cursor: 'pointer',
        fontSize: 13,
        minWidth: 54,
        fontFamily: 'DM Sans,sans-serif',
        background: gradient || (active ? (isLight ? '#E2E8F0' : 'rgba(255,255,255,0.06)') : 'transparent'),
        color: gradient ? '#fff' : (active ? (isLight ? '#0F172A' : '#F8FAFC') : (isLight ? '#334155' : '#CBD5E1')),
        transition: 'all .15s',
      }}
      onMouseEnter={e => { if (!active && !gradient) e.currentTarget.style.background = isLight ? '#F1F5F9' : 'rgba(255,255,255,0.04)' }}
      onMouseLeave={e => { if (!active && !gradient) e.currentTarget.style.background = 'transparent' }}
    >
      <i className={icon} style={{ fontSize: 13.1, color: gradient ? '#fff' : (active ? (isLight ? '#0F172A' : '#F8FAFC') : (isLight ? '#475569' : '#94A3B8')) }}></i>
      {label}
    </button>
  )

  return (
    <div style={{ height: 68, background: isLight ? '#FFFFFF' : '#0B111A', borderBottom: `1px solid ${isLight ? '#CBD5E1' : '#1F2A3A'}`, display: 'flex', alignItems: 'center', flexShrink: 0, overflowX: 'auto' }}>
      

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 10 }}>
            <Dropdown label="Project" items={[
              { label: 'New Project', icon: 'fas fa-folder-plus', onClick: () => navigate('/projects') },
              { label: 'Open Project', icon: 'fas fa-folder-open', onClick: () => navigate('/projects') },
              { label: 'Save', icon: 'fas fa-save', onClick: () => toast.success('Workspace saved') },
            ]} />

            <Dropdown label="Data" items={[
              { label: 'Upload / Import Data', icon: 'fas fa-cloud-arrow-up', onClick: () => document.getElementById('global-file-upload')?.click() },
              { label: 'Export', icon: 'fas fa-file-export', onClick: () => toast.success('Exported') },
            ]} />

            <Dropdown label="Well" items={[
              { label: 'Well Info', icon: 'fas fa-info-circle', onClick: () => navigate('/wells') },
              { label: 'Well Logs', icon: 'fas fa-file-lines', onClick: () => { setActiveTab('Log Viewer'); navigate('/petrophysics/log-viewer') } },
            ]} />

            <Dropdown label="Plotting" items={[
              { label: 'Cross Plot', icon: 'fas fa-chart-line', onClick: () => { setActiveTab('Cross Plot'); navigate('/petrophysics/log-viewer') } },
              { label: 'Histograms', icon: 'fas fa-chart-bar', onClick: () => { setActiveTab('Histogram'); navigate('/petrophysics/log-viewer') } },
            ]} />
          </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', paddingRight: 12 }}>
        <RibbonBtn icon="fas fa-robot" label="AI Assistant" onClick={() => navigate('/analytics/ai-assistant')} />
      </div>

      <input type="file" id="global-file-upload" style={{ display: 'none' }} multiple onChange={(e) => {
        if (e.target.files && e.target.files.length > 0) {
          toast.success(`Uploaded ${e.target.files.length} file(s) successfully`)
        }
      }} />

    </div>
  )
}

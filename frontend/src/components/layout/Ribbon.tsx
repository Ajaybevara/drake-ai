import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useStore } from '../../store'

export default function Ribbon() {
  const { setActiveTab, theme } = useStore()
  const navigate = useNavigate()
  const isLight = theme === 'light'
  const [showWellInfo, setShowWellInfo] = useState(false)

  const Dropdown = ({ label, items }: any) => {
    const [open, setOpen] = useState(false)
    const [menuRect, setMenuRect] = useState({ top: 0, left: 0, width: 0 })
    const buttonRef = useRef<HTMLButtonElement>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      const handleClick = (event: MouseEvent) => {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false)
      }
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    return (
      <div ref={wrapperRef} style={{ display: 'inline-block', position: 'relative' }}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            if (!open && buttonRef.current) {
              const rect = buttonRef.current.getBoundingClientRect()
              setMenuRect({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX, width: rect.width })
            }
            setOpen(current => !current)
          }}
          style={{ padding: '8px 10px', borderRadius: 6, background: isLight ? '#F1F5F9' : '#0E1622', border: `1px solid ${isLight ? '#CBD5E1' : '#223047'}`, color: isLight ? '#0F172A' : '#E2E8F0', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          {label} <i className="fas fa-caret-down" style={{ marginLeft: 8, fontSize: 11 }}></i>
        </button>
        {open && (
          <div style={{ position: 'fixed', top: menuRect.top, left: menuRect.left, minWidth: menuRect.width, background: isLight ? '#FFFFFF' : '#0B111A', border: `1px solid ${isLight ? '#E2E8F0' : '#223047'}`, borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,.35)', zIndex: 9999, padding: '6px 0' }}>
            {items.map((it: any) => (
              <div key={it.label} onClick={() => { setOpen(false); it.onClick?.() }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer', color: isLight ? '#0F172A' : '#E2E8F0', fontSize: 13, whiteSpace: 'nowrap' }}>
                {it.icon && <i className={it.icon} style={{ width: 18, textAlign: 'center' }}></i>}
                <div>{it.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const RibbonBtn = ({ icon, label, onClick }: any) => (
    <button onClick={onClick} title={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 5, border: '1px solid transparent', cursor: 'pointer', fontSize: 13, minWidth: 54, fontFamily: 'DM Sans,sans-serif', background: 'transparent', color: isLight ? '#334155' : '#CBD5E1' }}>
      <i className={icon} style={{ fontSize: 13.1, color: isLight ? '#475569' : '#94A3B8' }}></i>
      {label}
    </button>
  )

  return (
    <div style={{ height: 68, background: isLight ? '#FFFFFF' : '#0B111A', borderBottom: `1px solid ${isLight ? '#CBD5E1' : '#1F2A3A'}`, display: 'flex', alignItems: 'center', flexShrink: 0, overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 10 }}>
        <Dropdown label="Project" items={[
          { label: 'New Project', icon: 'fas fa-folder-plus', onClick: () => navigate('/projects') },
          { label: 'Open Project', icon: 'fas fa-folder-open', onClick: () => navigate('/projects') },
          { label: 'Save UI Layout', icon: 'fas fa-save', onClick: () => toast.success('UI layout saved') },
        ]} />
        <Dropdown label="Data" items={[
          { label: 'Upload / Import Data', icon: 'fas fa-cloud-arrow-up', onClick: () => document.getElementById('global-file-upload')?.click() },
          { label: 'Export UI Mockup', icon: 'fas fa-file-export', onClick: () => toast.success('Export panel opened') },
        ]} />
        <Dropdown label="Well" items={[
          { label: 'Well Logs', icon: 'fas fa-file-lines', onClick: () => { setActiveTab('Log Viewer'); navigate('/petrophysics/log-visualization') } },
        ]} />
        <Dropdown label="Plotting" items={[
          { label: 'Crossplot', icon: 'fas fa-chart-line', onClick: () => navigate('/petrophysics/crossplot') },
          { label: 'Histogram', icon: 'fas fa-chart-bar', onClick: () => navigate('/petrophysics/histogram') },
        ]} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', paddingRight: 12 }}>
        <RibbonBtn icon="fas fa-info-circle" label="Well Information" onClick={() => setShowWellInfo(!showWellInfo)} />

        {showWellInfo && (
          <div style={{ position: 'fixed', top: 115, right: 20, zIndex: 9999, background: isLight ? '#FFFFFF' : '#0B111A', borderRadius: 12, border: `1px solid ${isLight ? '#CBD5E1' : '#1F2A3A'}`, width: 350, padding: 20, boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, color: isLight ? '#0F172A' : '#F8FAFC' }}>Well Information</h2>
              <button onClick={() => setShowWellInfo(false)} style={{ background: 'transparent', border: 'none', color: isLight ? '#64748B' : '#94A3B8', cursor: 'pointer', fontSize: 14 }}><i className="fas fa-times"></i></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, color: isLight ? '#334155' : '#CBD5E1', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${isLight ? '#F1F5F9' : '#1E293B'}`, paddingBottom: 6 }}><span>Well Name</span><strong style={{ color: isLight ? '#0F172A' : '#F8FAFC' }}>Volve-15/9-F-1C</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${isLight ? '#F1F5F9' : '#1E293B'}`, paddingBottom: 6 }}><span>Field</span><strong style={{ color: isLight ? '#0F172A' : '#F8FAFC' }}>Volve</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${isLight ? '#F1F5F9' : '#1E293B'}`, paddingBottom: 6 }}><span>Operator</span><strong style={{ color: isLight ? '#0F172A' : '#F8FAFC' }}>Equinor</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${isLight ? '#F1F5F9' : '#1E293B'}`, paddingBottom: 6 }}><span>Status</span><strong style={{ color: isLight ? '#0F172A' : '#F8FAFC' }}>Producing</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${isLight ? '#F1F5F9' : '#1E293B'}`, paddingBottom: 6 }}><span>Total Depth</span><strong style={{ color: isLight ? '#0F172A' : '#F8FAFC' }}>3,540 m</strong></div>
            </div>
          </div>
        )}
      </div>
      <input type="file" id="global-file-upload" style={{ display: 'none' }} multiple onChange={(event) => {
        if (event.target.files?.length) toast.success(`Selected ${event.target.files.length} UI file(s)`)
      }} />
    </div>
  )
}

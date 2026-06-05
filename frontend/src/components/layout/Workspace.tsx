import { Outlet } from 'react-router-dom'
import { useStore } from '../../store'



export default function Workspace() {
  const { activeWell, activeTab, setActiveTab, theme, curves, aiJobs } = useStore()
  const isLight = theme === 'light'
  const panelBg = isLight ? '#FFFFFF' : '#0B111A'
  const pageBg = isLight ? '#EEF2F7' : '#070B12'
  const border = isLight ? '#CBD5E1' : '#1F2A3A'
  const text = isLight ? '#0F172A' : '#F8FAFC'
  const muted = isLight ? '#475569' : '#95A3B8'

  const statusColor = activeWell
    ? activeWell.status === 'Completed'
      ? '#10B981'
      : activeWell.status === 'QC Required'
        ? '#F59E0B'
        : '#10B981'
    : '#CBD5E1'

  return (
    <div style={{ flex: 1, background: pageBg, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, padding: 8, gap: 8 }}>

      {/* Insight cards area (compact, UI-only) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 8, minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
          {!activeWell && (
            <div style={{ flex: 1, background: pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 20 }}>
              <i className="fas fa-circle-dot" style={{ fontSize: 39.4, color: '#CBD5E1' }}></i>
              <p style={{ color: muted, fontSize: 13.1, margin: 0 }}>Select a well from the project explorer to begin</p>
            </div>
          )}
          <Outlet />
        </div>

      </div>
    </div>
  )
}

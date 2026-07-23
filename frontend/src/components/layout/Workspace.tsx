import { Outlet } from 'react-router-dom'
import { useStore } from '../../store'



export default function Workspace() {
  const { activeWell, theme } = useStore()
  const isLight = theme === 'light'
  const pageBg = isLight ? '#EEF2F7' : '#070B12'
  const muted = isLight ? '#475569' : '#95A3B8'

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

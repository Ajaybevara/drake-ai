import { Outlet } from 'react-router-dom'
import { useStore } from '../../store'

const TABS = ['Log Viewer', 'Cross Plot', 'Histogram']

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
      {activeWell && (
        <>
          <div style={{ background: panelBg, border: `1px solid ${border}`, borderRadius: 6, padding: '9px 14px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'Rajdhani,sans-serif', fontSize: 21, fontWeight: 800, color: text, letterSpacing: 1 }}>
                Well: {activeWell.name}
                <div style={{ width: 10, height: 10, background: '#10B981', borderRadius: '50%', boxShadow: '0 0 8px #10B981' }}></div>
              </div>
              <button onClick={() => setActiveTab('Tops')} style={{ padding: '5px 12px', background: isLight ? '#E2E8F0' : '#13243A', border: `1px solid ${isLight ? '#CBD5E1' : '#29415E'}`, borderRadius: 5, fontSize: 9.4, color: isLight ? '#0F172A' : '#E2E8F0', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', fontWeight: 500 }}>
                <i className="fas fa-info-circle" style={{ marginRight: 5 }}></i>Well Information
              </button>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                ['API', activeWell.api_number || 'N/A'],
                ['Operator', 'Drake Energy'],
                ['Field', activeWell.field || 'N/A'],
                ['County', activeWell.county || 'N/A'],
                ['KB', activeWell.kb_elevation ? `${activeWell.kb_elevation.toLocaleString()} ft` : 'N/A'],
                ['Total Depth', activeWell.total_depth ? `${activeWell.total_depth.toLocaleString()} ft` : 'N/A'],
                ['Status', activeWell.status],
              ].map(([label, value]) => (
                <div key={label} style={{ fontSize: 12.4, color: muted }}>
                  {label}: <strong style={{ color: label === 'Status' ? statusColor : text, fontWeight: 600 }}>{value}</strong>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto' }}>
                <div style={{ background: panelBg, border: `1px solid ${border}`, padding: '8px 12px', borderRadius: 8, fontSize: 11.4, color: muted }}>
                  Curves: <strong style={{ color: text, marginLeft: 8 }}>{curves.length}</strong>
                </div>
                <div style={{ background: panelBg, border: `1px solid ${border}`, padding: '8px 12px', borderRadius: 8, fontSize: 11.4, color: muted }}>
                  QC Score: <strong style={{ color: text, marginLeft: 8 }}>{activeWell?.qc_score ?? '—'}</strong>
                </div>
                <div style={{ background: panelBg, border: `1px solid ${border}`, padding: '8px 12px', borderRadius: 8, fontSize: 11.4, color: muted }}>
                  AI Confidence: <strong style={{ color: text, marginLeft: 8 }}>{aiJobs.length > 0 ? `${Math.round(aiJobs.reduce((s,a)=>s+(a.accuracy||0),0)/aiJobs.length)}%` : '—'}</strong>
                </div>
                <div style={{ background: panelBg, border: `1px solid ${border}`, padding: '8px 12px', borderRadius: 8, fontSize: 11.4, color: muted }}>
                  Zones: <strong style={{ color: text, marginLeft: 8 }}>{(activeWell?.reservoir_zones?.length) ?? '—'}</strong>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', border: `1px solid ${border}`, background: panelBg, padding: '0 10px', flexShrink: 0, borderRadius: 6 }}>
            {TABS.map(tab => (
              <div key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: '8px 14px',
                fontSize: 9.8,
                color: activeTab === tab ? (isLight ? '#DA2626' : '#FFEBEE') : muted,
                cursor: 'pointer',
                borderBottom: activeTab === tab ? '2px solid #DA2626' : '2px solid transparent',
                background: activeTab === tab ? 'linear-gradient(180deg,rgba(218,38,38,.16),rgba(218,38,38,.08))' : 'transparent',
                fontWeight: activeTab === tab ? 600 : 400,
                transition: 'all .15s',
                whiteSpace: 'nowrap',
              }}>
                {tab}
              </div>
            ))}
          </div>
        </>
      )}
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

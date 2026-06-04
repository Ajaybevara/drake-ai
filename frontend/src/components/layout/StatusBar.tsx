import { useStore } from '../../store'

export default function StatusBar() {
  const { activeWell, activeProject, aiJobs, curves } = useStore()
  const runningJob = aiJobs.find(j => j.status === 'running')

  return (
    <div style={{ background: '#080D15', borderTop: '1px solid #1F2A3A', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 20, fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: '#9AA8BC', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#22D3EE', fontWeight: 700 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'pulse 1.5s infinite' }}></div>
        <span style={{ color: '#AEE3FF' }}>{runningJob ? `Running: ${runningJob.job_type.replace(/_/g,' ')}...` : 'AI Engine Ready'}</span>
      </div>
      <span style={{ color: '#223047' }}>|</span>
      <span>Well: <span style={{ color: '#D3DAE5', fontWeight: 700 }}>{activeWell?.name || '-'}</span></span>
      <span style={{ color: '#223047' }}>|</span>
      <span>Depth: <span style={{ color: '#D3DAE5', fontWeight: 700 }}>{activeWell ? `${activeWell.top_depth?.toLocaleString() || '-'} - ${activeWell.total_depth?.toLocaleString() || '-'} ft` : '-'}</span></span>
      <span style={{ color: '#223047' }}>|</span>
      <span>Curves: <span style={{ color: '#D3DAE5', fontWeight: 700 }}>{curves.length}</span></span>
      <span style={{ color: '#223047' }}>|</span>
      <span>Project: <span style={{ color: '#D3DAE5', fontWeight: 700 }}>{activeProject?.name || '-'}</span></span>
      <span style={{ color: '#223047' }}>|</span>
      <span style={{ marginLeft: 'auto', color: '#94A3B8' }}>Drake AI v2.4.1 · ML Engine v3</span>
    </div>
  )
}

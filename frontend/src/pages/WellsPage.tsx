import { useStore } from '../store'

export default function WellsPage() {
  const { wells, activeProject } = useStore()

  return (
    <div style={{ padding: 24, minHeight: '100%', overflow: 'auto' }}>
      <h1 style={{ marginBottom: 16, color: '#0F172A' }}>Wells</h1>
      <div style={{ marginBottom: 12, color: '#475569' }}>{activeProject ? `Listing wells for ${activeProject.name}` : 'Select a project to view its wells'}</div>
      <div style={{ display: 'grid', gap: 12 }}>
        {wells.length > 0 ? wells.map((well) => (
          <div key={well.id} style={{ padding: 18, background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{well.name}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{well.state || 'Unknown state'} · {well.county || 'Unknown county'}</div>
          </div>
        )) : (
          <div style={{ padding: 18, background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', color: '#64748B' }}>
            No wells available. Choose a project or upload well data to continue.
          </div>
        )}
      </div>
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import type React from 'react'
import { Database, FolderOpen } from 'lucide-react'
import { useStore } from '../store'

export default function DataManagementPage() {
  const navigate = useNavigate()
  const activeLocalProject = useStore(s => s.activeLocalProject)

  return (
    <div style={{ padding: 28, minHeight: '100%', overflow: 'auto', background: 'linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)', color: '#F8FAFC' }}>
      <section style={{ padding: 24, borderRadius: 20, border: '1px solid #1E293B', background: 'linear-gradient(135deg,rgba(15,23,42,.92),rgba(7,17,31,.82))' }}>
        <div style={{ color: '#38BDF8', letterSpacing: 4, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }}>Project Data Repository</div>
        <h1 style={{ margin: '8px 0', fontSize: 34 }}>Manage project files</h1>
        <p style={{ margin: 0, color: '#94A3B8', lineHeight: 1.55 }}>File uploads are project-specific. Open an active project to upload LAS, PDF, Word, image, Excel, and CSV files once, then reuse them across modules.</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
          <button onClick={() => activeLocalProject ? navigate(`/projects/${activeLocalProject.id}/data`) : navigate('/projects')} style={primaryButton}>
            <Database size={17} /> {activeLocalProject ? 'Open Active Repository' : 'Open Projects'}
          </button>
          <button onClick={() => navigate('/projects')} style={secondaryButton}><FolderOpen size={17} /> Project List</button>
        </div>
      </section>
    </div>
  )
}

const primaryButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(239,68,68,.45)', background: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: '#fff', cursor: 'pointer', fontWeight: 900 }
const secondaryButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderRadius: 10, border: '1px solid #26364F', background: '#0B1220', color: '#CBD5E1', cursor: 'pointer', fontWeight: 900 }

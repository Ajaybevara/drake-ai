import { CalendarDays, Database, FolderOpen } from 'lucide-react'
import type { LocalProject } from '../../store'

export default function ProjectCard({ project, onOpen }: { project: LocalProject; onOpen: () => void }) {
  return (
    <button onClick={onOpen} style={{ textAlign: 'left', padding: 18, borderRadius: 16, border: '1px solid #1E293B', background: 'linear-gradient(180deg,rgba(15,23,42,.94),rgba(7,17,31,.96))', color: '#F8FAFC', cursor: 'pointer', boxShadow: '0 18px 42px rgba(0,0,0,.24)', transition: 'transform .14s, border-color .14s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,rgba(37,99,235,.35),rgba(56,189,248,.12))', border: '1px solid rgba(56,189,248,.35)', display: 'grid', placeItems: 'center', color: '#38BDF8' }}>
          <FolderOpen size={20} />
        </div>
        <span style={{ fontSize: 11, color: '#94A3B8' }}>{project.files.length} files</span>
      </div>
      <h3 style={{ margin: '16px 0 10px', fontSize: 18 }}>{project.name}</h3>
      <div style={{ display: 'grid', gap: 8, color: '#94A3B8', fontSize: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CalendarDays size={14} /> Last opened {new Date(project.lastOpenedAt).toLocaleDateString()}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Database size={14} /> {project.outputs.length} generated outputs</span>
      </div>
    </button>
  )
}

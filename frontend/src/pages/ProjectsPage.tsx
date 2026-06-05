import type React from 'react'
import { FolderOpen } from 'lucide-react'

const MOCK_PROJECTS = ['Permian Basin Study', 'Gulf Coast Carbon Review', 'North Sea Production UI']

export default function ProjectsPage() {
  return (
    <div style={page}>
      <div style={eyebrow}>Project Registry UI</div>
      <h1 style={title}>Projects</h1>
      <p style={muted}>Static UI-only project cards. Create/open/save integrations have been removed.</p>
      <div style={grid}>
        {MOCK_PROJECTS.map((project, index) => (
          <div key={project} style={card}>
            <div style={icon}><FolderOpen size={22} /></div>
            <h3 style={{ margin: '16px 0 8px', fontSize: 20 }}>{project}</h3>
            <p style={muted}>{index + 3} wells · UI mockup · No backend action</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const page: React.CSSProperties = { padding: 28, minHeight: '100%', overflow: 'auto', background: 'linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)', color: '#F8FAFC' }
const eyebrow: React.CSSProperties = { color: '#38BDF8', letterSpacing: 4, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }
const title: React.CSSProperties = { margin: '8px 0', fontSize: 34 }
const muted: React.CSSProperties = { margin: 0, color: '#94A3B8', lineHeight: 1.55 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 16, marginTop: 22 }
const card: React.CSSProperties = { padding: 18, borderRadius: 16, border: '1px solid #1E293B', background: 'linear-gradient(180deg,rgba(15,23,42,.94),rgba(7,17,31,.96))', color: '#F8FAFC' }
const icon: React.CSSProperties = { width: 44, height: 44, borderRadius: 12, background: 'rgba(56,189,248,.14)', border: '1px solid rgba(56,189,248,.35)', display: 'grid', placeItems: 'center', color: '#38BDF8' }

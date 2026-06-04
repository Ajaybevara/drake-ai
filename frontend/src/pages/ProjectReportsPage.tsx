import { useEffect } from 'react'
import type React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FileArchive, FileJson, FileText, ImageDown, Table } from 'lucide-react'
import { useStore } from '../store'

const EXPORTS = [
  { name: 'JSON Project Summary', type: 'json', icon: FileJson },
  { name: 'CSV Output Index', type: 'csv', icon: Table },
  { name: 'PDF Report Placeholder', type: 'pdf', icon: FileText },
  { name: 'PNG Plot Manifest', type: 'png', icon: ImageDown },
  { name: 'Project Package Manifest', type: 'zip', icon: FileArchive },
]

export default function ProjectReportsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { localProjects, activeLocalProject, openLocalProject, addProjectOutput } = useStore()
  const project = localProjects.find(item => item.id === projectId) || activeLocalProject

  useEffect(() => {
    if (projectId) openLocalProject(projectId)
  }, [projectId, openLocalProject])

  if (!project) return <div style={page}><div style={empty}>Project not found.</div></div>

  const download = (type: string, name: string) => {
    const summary = { project, exportType: type, generatedAt: new Date().toISOString() }
    const isCsv = type === 'csv'
    const content = isCsv
      ? ['Name,Type,Module,Created At', ...project.outputs.map(output => `${output.name},${output.type},${output.module},${output.createdAt}`)].join('\n')
      : JSON.stringify(summary, null, 2)
    const url = URL.createObjectURL(new Blob([content], { type: isCsv ? 'text/csv' : 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${project.name}-${name}.${isCsv ? 'csv' : 'json'}`.replace(/\s+/g, '-')
    link.click()
    URL.revokeObjectURL(url)
    addProjectOutput(project.id, { module: 'Reports', name, type: type.toUpperCase() })
  }

  return (
    <div style={page}>
      <button onClick={() => navigate(`/projects/${project.id}`)} style={backButton}><ArrowLeft size={15} /> Back to Workspace</button>
      <section style={hero}>
        <div>
          <div style={eyebrow}>Reports / Exports</div>
          <h1 style={title}>{project.name}</h1>
          <p style={muted}>Download processed LAS metadata, CSV outputs, report manifests, plot manifests and a project package summary.</p>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, marginTop: 22 }}>
        {EXPORTS.map(item => {
          const Icon = item.icon
          return (
            <button key={item.name} onClick={() => download(item.type, item.name)} style={card}>
              <Icon size={24} color="#38BDF8" />
              <div>
                <h3 style={{ margin: '0 0 6px', color: '#F8FAFC' }}>{item.name}</h3>
                <span style={{ color: '#94A3B8', fontSize: 12 }}>Download/export to local system</span>
              </div>
              <Download size={16} color="#CBD5E1" style={{ marginLeft: 'auto' }} />
            </button>
          )
        })}
      </section>

      <section style={panel}>
        <h2 style={{ margin: '0 0 12px', fontSize: 21 }}>Generated Outputs</h2>
        {project.outputs.map(output => (
          <div key={output.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 160px', gap: 12, padding: '11px 0', borderBottom: '1px solid #1E293B', color: '#CBD5E1' }}>
            <strong>{output.name}</strong>
            <span>{output.type}</span>
            <span style={{ color: '#64748B', fontSize: 12 }}>{new Date(output.createdAt).toLocaleString()}</span>
          </div>
        ))}
        {!project.outputs.length && <div style={{ color: '#94A3B8' }}>No generated outputs yet. Run module tools to populate this list.</div>}
      </section>
    </div>
  )
}

const page: React.CSSProperties = { padding: 28, minHeight: '100%', overflow: 'auto', background: 'linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)', color: '#F8FAFC' }
const hero: React.CSSProperties = { padding: 24, borderRadius: 20, border: '1px solid #1E293B', background: 'linear-gradient(135deg,rgba(15,23,42,.92),rgba(7,17,31,.82))' }
const eyebrow: React.CSSProperties = { color: '#38BDF8', letterSpacing: 4, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }
const title: React.CSSProperties = { margin: '8px 0', fontSize: 34, lineHeight: 1.1 }
const muted: React.CSSProperties = { margin: 0, color: '#94A3B8', lineHeight: 1.55 }
const backButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '9px 12px', borderRadius: 9, border: '1px solid #26364F', background: '#0B1220', color: '#CBD5E1', cursor: 'pointer', fontWeight: 800 }
const card: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', padding: 18, borderRadius: 16, border: '1px solid #1E293B', background: 'linear-gradient(180deg,rgba(15,23,42,.94),rgba(7,17,31,.96))', cursor: 'pointer' }
const panel: React.CSSProperties = { marginTop: 22, padding: 20, borderRadius: 18, border: '1px solid #1E293B', background: 'rgba(15,23,42,.82)' }
const empty: React.CSSProperties = { padding: 24, borderRadius: 18, border: '1px solid #1E293B', background: 'rgba(15,23,42,.82)', color: '#94A3B8' }

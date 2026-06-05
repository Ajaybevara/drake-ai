import { useEffect } from 'react'
import type React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Database } from 'lucide-react'
import { useStore } from '../store'
import ProjectFileUploadPanel from '../components/project/ProjectFileUploadPanel'
import FileTable from '../components/project/FileTable'

const GROUPS = [
  { key: 'las', title: 'Well Logs / LAS' },
  { key: 'seismic', title: 'Seismic Inputs / SGY, SEGY, NPY' },
  { key: 'reports', title: 'Reports / PDF & Word' },
  { key: 'images', title: 'Images' },
  { key: 'tables', title: 'Excel / CSV' },
  { key: 'digitizer', title: 'Digitization Inputs' },
] as const

export default function ProjectDataRepositoryPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { localProjects, activeLocalProject, openLocalProject } = useStore()
  const project = localProjects.find(item => item.id === projectId) || activeLocalProject

  useEffect(() => {
    if (projectId) openLocalProject(projectId)
  }, [projectId, openLocalProject])

  if (!project) {
    return <div style={page}><div style={empty}>Project not found.</div></div>
  }

  return (
    <div style={page}>
      <button onClick={() => navigate(`/projects/${project.id}`)} style={backButton}><ArrowLeft size={15} /> Back to Workspace</button>
      <section style={hero}>
        <div>
          <div style={eyebrow}>Project Data Repository</div>
          <h1 style={title}>{project.name}</h1>
          <p style={muted}>Upload project files once. Compatible modules automatically read from this repository.</p>
        </div>
        <div style={{ width: 54, height: 54, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.35)', color: '#38BDF8' }}>
          <Database size={26} />
        </div>
      </section>

      <div style={{ marginTop: 20 }}>
        <ProjectFileUploadPanel projectId={project.id} />
      </div>

      <section style={{ marginTop: 24, display: 'grid', gap: 24 }}>
        {GROUPS.map(group => {
          const files = project.files.filter(file => file.category === group.key)
          return (
            <div key={group.key}>
              <h2 style={{ margin: '0 0 12px', fontSize: 20, color: '#F8FAFC' }}>{group.title}</h2>
              <FileTable projectId={project.id} files={files} />
            </div>
          )
        })}
      </section>
    </div>
  )
}

const page: React.CSSProperties = { padding: 28, minHeight: '100%', overflow: 'auto', background: 'linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)', color: '#F8FAFC' }
const hero: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, padding: 24, borderRadius: 20, border: '1px solid #1E293B', background: 'linear-gradient(135deg,rgba(15,23,42,.92),rgba(7,17,31,.82))' }
const eyebrow: React.CSSProperties = { color: '#38BDF8', letterSpacing: 4, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }
const title: React.CSSProperties = { margin: '8px 0', fontSize: 34, lineHeight: 1.1 }
const muted: React.CSSProperties = { margin: 0, color: '#94A3B8', lineHeight: 1.55 }
const backButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '9px 12px', borderRadius: 9, border: '1px solid #26364F', background: '#0B1220', color: '#CBD5E1', cursor: 'pointer', fontWeight: 800 }
const empty: React.CSSProperties = { padding: 24, borderRadius: 18, border: '1px solid #1E293B', background: 'rgba(15,23,42,.82)', color: '#94A3B8' }

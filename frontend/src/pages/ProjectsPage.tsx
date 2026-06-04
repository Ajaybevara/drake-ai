import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderPlus } from 'lucide-react'
import { useStore } from '../store'
import CreateProjectModal from '../components/project/CreateProjectModal'
import ProjectCard from '../components/project/ProjectCard'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const { localProjects, createLocalProject, openLocalProject } = useStore()

  const createProject = (name: string) => {
    const project = createLocalProject(name)
    setCreateOpen(false)
    navigate(`/projects/${project.id}`)
  }

  return (
    <div style={{ padding: 28, minHeight: '100%', overflow: 'auto', background: 'linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)', color: '#F8FAFC' }}>
      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={createProject} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 22 }}>
        <div>
          <div style={{ color: '#38BDF8', letterSpacing: 4, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }}>Project Registry</div>
          <h1 style={{ margin: '8px 0 0', fontSize: 34 }}>Projects</h1>
          <p style={{ margin: '8px 0 0', color: '#94A3B8' }}>Create, open, and continue Drake AI studies with persistent files and module state.</p>
        </div>
        <button onClick={() => setCreateOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '13px 18px', borderRadius: 10, border: '1px solid rgba(239,68,68,.45)', background: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: '#fff', cursor: 'pointer', fontWeight: 900 }}>
          <FolderPlus size={18} /> Create New Project
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
        {localProjects.map(project => (
          <ProjectCard key={project.id} project={project} onOpen={() => { openLocalProject(project.id); navigate(`/projects/${project.id}`) }} />
        ))}
        {!localProjects.length && (
          <div style={{ padding: 24, borderRadius: 18, border: '1px solid #1E293B', background: 'rgba(15,23,42,.76)', color: '#94A3B8' }}>
            No projects yet. Use Create New Project to start a project-first workflow.
          </div>
        )}
      </div>
    </div>
  )
}

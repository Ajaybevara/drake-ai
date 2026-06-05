import { useState } from 'react'
import type React from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Bot, Database, FolderPlus, Gauge, Layers, Waves } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '../store'
import CreateProjectModal from '../components/project/CreateProjectModal'
import ProjectCard from '../components/project/ProjectCard'
import ModuleCard from '../components/project/ModuleCard'
import { localProjectsApi } from '../services/api'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const { user, localProjects, createLocalProject, openLocalProject } = useStore()
  const totalFiles = localProjects.reduce((sum, project) => sum + project.files.length, 0)
  const totalOutputs = localProjects.reduce((sum, project) => sum + project.outputs.length, 0)

  const createProject = async (name: string, locationKey = 'workspace') => {
    const project = createLocalProject(name)
    try {
      await localProjectsApi.save({ location_key: locationKey, project })
      toast.success(`Created and saved ${name}`)
    } catch {
      toast.success(`Created ${name} in browser project list`)
    }
    setCreateOpen(false)
    navigate(`/projects/${project.id}`)
  }

  return (
    <div style={page}>
      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={createProject} />

      <section style={hero}>
        <div>
          <div style={eyebrow}>Industrial Geological Dashboard</div>
          <h1 style={heroTitle}>Project-first Drake AI workspace</h1>
          <p style={heroText}>Welcome {user?.full_name || 'Engineer'}. Create or open a project to share LAS, reports, images, and tabular files across Petrophysics, Seismic, Production, CCUS, and Digitizer modules.</p>
        </div>
        <button onClick={() => setCreateOpen(true)} style={primaryButton}><FolderPlus size={18} /> Create New Project</button>
      </section>

      <div style={statsGrid}>
        <Stat label="Total Projects" value={localProjects.length} icon={<Database size={18} />} />
        <Stat label="Uploaded Files" value={totalFiles} icon={<Layers size={18} />} />
        <Stat label="Generated Outputs" value={totalOutputs} icon={<Activity size={18} />} />
        <Stat label="AI Modules" value={5} icon={<Bot size={18} />} />
      </div>

      <section style={section}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Recent Projects</h2>
            <p style={muted}>Open a project to continue module work without losing selections or results.</p>
          </div>
          <button onClick={() => navigate('/projects')} style={secondaryButton}>View All Projects</button>
        </div>
        <div style={projectGrid}>
          {localProjects.slice(0, 4).map(project => (
            <ProjectCard key={project.id} project={project} onOpen={() => { openLocalProject(project.id); navigate(`/projects/${project.id}`) }} />
          ))}
          {!localProjects.length && (
            <div style={emptyCard}>No local projects yet. Create your first Drake AI project to begin the workflow.</div>
          )}
        </div>
      </section>

      <section style={section}>
        <h2 style={sectionTitle}>Quick Module Access</h2>
        <div style={moduleGrid}>
          <ModuleCard title="Petrophysics" subtitle="Log visualization, QC, missing log AI, facies, prediction, uncertainty and auto splice." icon={Gauge} accent="#38BDF8" onClick={() => navigate('/projects')} />
          <ModuleCard title="Seismic" subtitle="Seismic viewer, attributes and interpretation support using project repository files." icon={Waves} accent="#8B5CF6" onClick={() => navigate('/projects')} />
          <ModuleCard title="Production" subtitle="Forecasting, production analytics and well performance from Excel or CSV data." icon={Activity} accent="#10B981" onClick={() => navigate('/projects')} />
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div style={statCard}>
      <div style={{ color: '#38BDF8' }}>{icon}</div>
      <div>
        <div style={{ color: '#94A3B8', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.4 }}>{label}</div>
        <div style={{ color: '#F8FAFC', fontSize: 28, fontWeight: 900, marginTop: 4 }}>{value}</div>
      </div>
    </div>
  )
}

const page: React.CSSProperties = { padding: 28, minHeight: '100%', background: 'radial-gradient(circle at top left,rgba(37,99,235,.15),transparent 34%),linear-gradient(135deg,#050B14,#07111F 48%,#0B1628)', color: '#F8FAFC', overflow: 'auto' }
const hero: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 22, padding: 26, borderRadius: 20, border: '1px solid #1E293B', background: 'linear-gradient(135deg,rgba(15,23,42,.9),rgba(7,17,31,.82))', boxShadow: '0 24px 70px rgba(0,0,0,.28)' }
const eyebrow: React.CSSProperties = { color: '#38BDF8', letterSpacing: 5, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }
const heroTitle: React.CSSProperties = { margin: '8px 0', fontSize: 36, lineHeight: 1.08 }
const heroText: React.CSSProperties = { margin: 0, color: '#94A3B8', maxWidth: 850, fontSize: 15, lineHeight: 1.6 }
const primaryButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 9, padding: '13px 18px', borderRadius: 10, border: '1px solid rgba(239,68,68,.45)', background: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: '#fff', cursor: 'pointer', fontWeight: 900, whiteSpace: 'nowrap' }
const secondaryButton: React.CSSProperties = { padding: '10px 14px', borderRadius: 9, border: '1px solid #26364F', background: '#0B1220', color: '#CBD5E1', cursor: 'pointer', fontWeight: 800 }
const statsGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 16, marginTop: 18 }
const statCard: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, padding: 18, borderRadius: 16, border: '1px solid #1E293B', background: 'rgba(15,23,42,.84)' }
const section: React.CSSProperties = { marginTop: 24 }
const sectionHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 14 }
const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 23 }
const muted: React.CSSProperties = { margin: '5px 0 0', color: '#94A3B8', fontSize: 13 }
const projectGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 16 }
const moduleGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginTop: 14 }
const emptyCard: React.CSSProperties = { padding: 22, borderRadius: 16, border: '1px solid #1E293B', background: 'rgba(15,23,42,.72)', color: '#94A3B8' }

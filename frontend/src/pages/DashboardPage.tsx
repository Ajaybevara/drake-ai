import type React from 'react'
import { Activity, Database, FolderOpen, Gauge, Layers, RadioTower, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { createProjectFile, openProjectFile, saveProjectFile } from '../utils/drakeProjectFile'

export default function DashboardPage() {
  const navigate = useNavigate()
  const {
    activeLocalProject,
    activeProjectFileHandle,
    createLocalProject,
    setActiveProjectFileHandle,
    setActiveLocalProjectDocument,
    markProjectSaved,
  } = useStore()

  const createProject = async () => {
    const name = window.prompt('Enter project name')
    if (!name?.trim()) return
    const project = createLocalProject(name.trim())
    try {
      const result = await createProjectFile(project)
      setActiveProjectFileHandle(result.handle, result.fileName)
      markProjectSaved()
      toast.success(result.usedFallback ? 'Project downloaded as .drake file' : 'Project created on local disk')
    } catch (error: any) {
      if (error?.name !== 'AbortError') toast.error(error?.message || 'Project creation failed')
    }
  }

  const openProject = async () => {
    try {
      const result = await openProjectFile()
      setActiveLocalProjectDocument(result.project, result.handle, result.fileName)
      toast.success(`Opened ${result.fileName}`)
      navigate('/projects')
    } catch (error: any) {
      if (error?.name !== 'AbortError') toast.error(error?.message || 'Open project failed')
    }
  }

  const saveProject = async () => {
    if (!activeLocalProject) {
      toast.error('Create or open a .drake project first')
      return
    }
    try {
      const result = await saveProjectFile(activeLocalProject, activeProjectFileHandle)
      setActiveProjectFileHandle(result.handle, result.fileName)
      markProjectSaved()
      toast.success(result.usedFallback ? 'Project downloaded as .drake file' : 'Project saved to local disk')
    } catch (error: any) {
      if (error?.name !== 'AbortError') toast.error(error?.message || 'Save project failed')
    }
  }

  return (
    <div style={page}>
      <section style={hero}>
        <div>
          <div style={eyebrow}>Drake AI Enterprise Platform</div>
          <h1 style={title}>Oil & Gas AI Workspace UI</h1>
          <p style={muted}>Project state is held in memory until you explicitly create, open, or save a local .drake project file.</p>
        </div>
        <div style={actions}>
          <button style={primaryButton} onClick={createProject}><Save size={16} /> Create New Project</button>
          <button style={ghostButton} onClick={openProject}><FolderOpen size={16} /> Open Project File (.drake)</button>
          <button style={alertButton} onClick={saveProject}><Save size={16} /> Save Project to Local Disk</button>
        </div>
      </section>
      <div style={grid}>
        <Stat label="Active Project" value={activeLocalProject ? activeLocalProject.name : 'None'} icon={<FolderOpen size={20} />} />
        <Stat label="Petrophysics Tools" value="9" icon={<Gauge size={20} />} />
        <Stat label="Seismic Tools" value="1" icon={<RadioTower size={20} />} />
        <Stat label="Digitizer Tools" value="2" icon={<Layers size={20} />} />
      </div>
      <section style={panel}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Workspace Overview</h2>
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
          {['Well intelligence', 'Seismic enhancement', 'Production optimization', 'CCUS screening', 'OCR and SLM/GPT'].map(item => (
            <div key={item} style={miniCard}><Database size={17} color="#DA2626" /><span>{item}</span></div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div style={stat}><div style={{ color: '#DA2626' }}>{icon}</div><div><div style={statLabel}>{label}</div><div style={statValue}>{value}</div></div></div>
}

const page: React.CSSProperties = { padding: 28, minHeight: '100%', overflow: 'auto', background: 'linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)', color: '#F8FAFC' }
const hero: React.CSSProperties = { padding: 26, borderRadius: 18, border: '1px solid #1E293B', background: 'linear-gradient(135deg,rgba(15,23,42,.92),rgba(7,17,31,.82))', boxShadow: '0 24px 70px rgba(0,0,0,.28)', display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap' }
const eyebrow: React.CSSProperties = { color: '#DA2626', letterSpacing: 4, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }
const title: React.CSSProperties = { margin: '8px 0', fontSize: 36, lineHeight: 1.08 }
const muted: React.CSSProperties = { margin: 0, color: '#94A3B8', lineHeight: 1.6 }
const actions: React.CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }
const buttonBase: React.CSSProperties = { borderRadius: 12, padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, cursor: 'pointer' }
const primaryButton: React.CSSProperties = { ...buttonBase, border: '1px solid #DA2626', background: 'linear-gradient(135deg,#EF4444,#DA2626)', color: '#FFFFFF' }
const ghostButton: React.CSSProperties = { ...buttonBase, border: '1px solid #26364F', background: '#08111F', color: '#E2E8F0' }
const alertButton: React.CSSProperties = { ...buttonBase, border: '1px solid #F59E0B', background: 'rgba(245,158,11,.16)', color: '#FCD34D' }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 16, marginTop: 18 }
const stat: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, padding: 18, borderRadius: 16, border: '1px solid #1E293B', background: 'rgba(15,23,42,.84)' }
const statLabel: React.CSSProperties = { color: '#94A3B8', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.2 }
const statValue: React.CSSProperties = { color: '#F8FAFC', fontSize: 24, fontWeight: 900, marginTop: 4, wordBreak: 'break-word' }
const panel: React.CSSProperties = { marginTop: 22, padding: 20, borderRadius: 18, border: '1px solid #1E293B', background: 'rgba(15,23,42,.82)' }
const miniCard: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, border: '1px solid #26364F', background: '#08111F', color: '#E2E8F0', fontWeight: 800 }

import type React from 'react'
import { FolderOpen, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '../store'
import { createProjectFile, openProjectFile, saveProjectFile } from '../utils/drakeProjectFile'

export default function ProjectsPage() {
  const {
    localProjects,
    activeLocalProject,
    activeProjectFileHandle,
    activeProjectFileName,
    projectDirty,
    createLocalProject,
    openLocalProject,
    setActiveLocalProjectDocument,
    setActiveProjectFileHandle,
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
      if (error?.name !== 'AbortError') toast.error(error?.message || 'Project save failed')
    }
  }

  return (
    <div style={page}>
      <div style={eyebrow}>Project Registry</div>
      <h1 style={title}>Projects</h1>
      <p style={muted}>Projects are loaded into memory from `.drake` files and saved only when you explicitly write them back to local disk.</p>
      <div style={actions}>
        <button style={primaryButton} onClick={createProject}><Save size={16} /> Create New Project</button>
        <button style={ghostButton} onClick={openProject}><FolderOpen size={16} /> Open Project File (.drake)</button>
        <button style={alertButton} onClick={saveProject}><Save size={16} /> Save Project to Local Disk</button>
      </div>
      {activeLocalProject && (
        <div style={activeBanner}>
          <div><b>Active project:</b> {activeLocalProject.name}</div>
          <div style={{ color: projectDirty ? '#FCD34D' : '#10B981' }}>{projectDirty ? 'Unsaved changes' : 'Saved'} {activeProjectFileName ? `- ${activeProjectFileName}` : ''}</div>
        </div>
      )}
      <div style={grid}>
        {localProjects.map(project => (
          <div key={project.id} style={{ ...card, borderColor: activeLocalProject?.id === project.id ? '#DA2626' : '#1E293B' }} onClick={() => openLocalProject(project.id)}>
            <div style={icon}><FolderOpen size={22} /></div>
            <h3 style={{ margin: '16px 0 8px', fontSize: 20 }}>{project.name}</h3>
            <p style={muted}>{project.files.length} files · {project.outputs.length} outputs</p>
            <p style={{ ...muted, marginTop: 8 }}>Last opened {new Date(project.lastOpenedAt).toLocaleDateString()}</p>
          </div>
        ))}
        {!localProjects.length && (
          <div style={card}>
            <div style={icon}><FolderOpen size={22} /></div>
            <h3 style={{ margin: '16px 0 8px', fontSize: 20 }}>No project loaded</h3>
            <p style={muted}>Create a new `.drake` file or open an existing local project file.</p>
          </div>
        )}
      </div>
    </div>
  )
}

const page: React.CSSProperties = { padding: 28, minHeight: '100%', overflow: 'auto', background: 'linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)', color: '#F8FAFC' }
const eyebrow: React.CSSProperties = { color: '#DA2626', letterSpacing: 4, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }
const title: React.CSSProperties = { margin: '8px 0', fontSize: 34 }
const muted: React.CSSProperties = { margin: 0, color: '#94A3B8', lineHeight: 1.55 }
const actions: React.CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }
const buttonBase: React.CSSProperties = { borderRadius: 12, padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, cursor: 'pointer' }
const primaryButton: React.CSSProperties = { ...buttonBase, border: '1px solid #DA2626', background: 'linear-gradient(135deg,#EF4444,#DA2626)', color: '#FFFFFF' }
const ghostButton: React.CSSProperties = { ...buttonBase, border: '1px solid #26364F', background: '#08111F', color: '#E2E8F0' }
const alertButton: React.CSSProperties = { ...buttonBase, border: '1px solid #F59E0B', background: 'rgba(245,158,11,.16)', color: '#FCD34D' }
const activeBanner: React.CSSProperties = { marginTop: 18, padding: 14, borderRadius: 14, border: '1px solid #26364F', background: 'rgba(15,23,42,.84)', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 16, marginTop: 22 }
const card: React.CSSProperties = { padding: 18, borderRadius: 16, border: '1px solid #1E293B', background: 'linear-gradient(180deg,rgba(15,23,42,.94),rgba(7,17,31,.96))', color: '#F8FAFC', cursor: 'pointer' }
const icon: React.CSSProperties = { width: 44, height: 44, borderRadius: 12, background: 'rgba(218,38,38,.14)', border: '1px solid rgba(218,38,38,.35)', display: 'grid', placeItems: 'center', color: '#DA2626' }

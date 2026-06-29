import type React from 'react'
import { useEffect, useState } from 'react'
import { FolderOpen, Plus, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store'
import { createLocalFolderProject, getCurrentLocalProjectFromFolder, listLocalProjects, openKnownLocalProject, openLocalFolderProject, deleteLocalProject } from '../utils/localProjectStorage'

const PROJECT_TYPES = ['Petrophysics', 'Seismic', 'Production', 'CCUS', 'Geothermal', 'Digitizer', 'Integrated Study', 'Custom']
const STORAGE_LOCATIONS = ['Desktop', 'Documents', 'C Drive', 'D Drive', 'Custom Folder']

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { enterpriseProject, setEnterpriseProject, theme } = useStore()
  const isLight = theme === 'light'
  const palette = projectsPalette(isLight)
  const [projects, setProjects] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    project_name: '',
    description: '',
    project_type: 'Integrated Study',
    storage_location: localStorage.getItem('drake_project_storage_location') || 'Documents',
    custom_folder: '',
  })

  useEffect(() => {
    refreshProjects()
    getCurrentLocalProjectFromFolder().then(current => {
      if (current) setEnterpriseProject(current)
    }).catch(() => undefined)
  }, [setEnterpriseProject])

  useEffect(() => {
    const query = (searchParams.get('search') || '').toLowerCase().trim()
    if (!query) return
    setProjects(prev => prev.filter(project =>
      `${project.project_name} ${project.project_type} ${project.project_path}`.toLowerCase().includes(query)
    ))
  }, [searchParams])

  const refreshProjects = () => {
    setProjects(listLocalProjects())
  }

  const deleteProject = (projectId: string) => {
    if (window.confirm('Are you sure you want to remove this project from the local registry?')) {
      deleteLocalProject(projectId)
      if (enterpriseProject?.project_id === projectId) {
        setEnterpriseProject(null)
      }
      refreshProjects()
      toast.success('Project removed')
    }
  }

  const createProject = async () => {
    if (!form.project_name.trim()) {
      toast.error('Project name is required')
      return
    }
    setBusy(true)
    try {
      localStorage.setItem('drake_project_storage_location', form.storage_location)
      const project = await createLocalFolderProject(form)
      setEnterpriseProject(project)
      refreshProjects()
      toast.success(`Project created in ${project.project_path}`)
      navigate('/dashboard')
    } catch (error: any) {
      if (error?.name !== 'AbortError') toast.error(error?.message || 'Project creation failed')
    } finally {
      setBusy(false)
    }
  }

  const openProjectFolder = async () => {
    setBusy(true)
    try {
      const project = await openLocalFolderProject()
      setEnterpriseProject(project)
      refreshProjects()
      toast.success(`Opened ${project.project_name}`)
      navigate('/dashboard')
    } catch (error: any) {
      if (error?.name !== 'AbortError') toast.error(error?.message || 'Open project failed')
    } finally {
      setBusy(false)
    }
  }

  const reopenKnownProject = async (projectRecord: any) => {
    setBusy(true)
    try {
      const project = await openKnownLocalProject(projectRecord)
      setEnterpriseProject(project)
      refreshProjects()
      toast.success(`Opened ${project.project_name}`)
      navigate('/dashboard')
    } catch (error: any) {
      if (error?.name !== 'AbortError') toast.error(error?.message || 'Open project failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={palette.page}>
      <div style={eyebrow}>Project Registry</div>
      <h1 style={palette.title}>Projects</h1>
      <p style={palette.muted}>Create a folder-backed Drake AI project, open an existing project folder, and keep uploads, results, and exports saved inside that project.</p>

      <div style={actions}>
        <button style={primaryButton} onClick={createProject} disabled={busy}><Plus size={16} /> Create New Project</button>
        <button style={palette.ghostButton} onClick={openProjectFolder} disabled={busy}><FolderOpen size={16} /> Open Project Folder</button>
        <button style={palette.alertButton} onClick={refreshProjects} disabled={busy}><RefreshCw size={16} /> Refresh Projects</button>
      </div>

      <div style={palette.formPanel}>
        <Field label="Project Name" value={form.project_name} onChange={value => setForm({ ...form, project_name: value })} palette={palette} />
        <Field label="Description" value={form.description} onChange={value => setForm({ ...form, description: value })} palette={palette} />
        <Select label="Project Type" value={form.project_type} options={PROJECT_TYPES} onChange={value => setForm({ ...form, project_type: value })} palette={palette} />
        <Select label="Storage Location" value={form.storage_location} options={STORAGE_LOCATIONS} onChange={value => setForm({ ...form, storage_location: value })} palette={palette} />
        {form.storage_location === 'Custom Folder' ? <Field label="Custom Folder Path" value={form.custom_folder} onChange={value => setForm({ ...form, custom_folder: value })} palette={palette} /> : null}
      </div>

      {enterpriseProject && (
        <div style={palette.activeBanner}>
          <div><b>Active project:</b> {enterpriseProject.project_name}</div>
          <div style={{ color: '#10B981' }}>{enterpriseProject.project_path}</div>
        </div>
      )}

      <div style={grid}>
        {projects.map(project => (
          <div key={project.project_id} style={{ position: 'relative' }}>
            <button style={{ ...palette.card, borderColor: enterpriseProject?.project_id === project.project_id ? '#DA2626' : palette.border, width: '100%' }} onClick={() => reopenKnownProject(project)}>
              <div style={icon}><FolderOpen size={22} /></div>
              <h3 style={{ margin: '16px 0 8px', fontSize: 20 }}>{project.project_name}</h3>
              <p style={palette.muted}>{project.project_type} - {(project.uploaded_files || []).length} uploaded files - {(project.exported_files || []).length} exports</p>
              <p style={{ ...palette.muted, marginTop: 8 }}>{project.project_path}</p>
            </button>
            <button onClick={(e) => { e.stopPropagation(); deleteProject(project.project_id) }} style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#EF4444', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', zIndex: 10 }}>Delete</button>
          </div>
        ))}
        {!projects.length && (
          <div style={palette.card}>
            <div style={icon}><FolderOpen size={22} /></div>
            <h3 style={{ margin: '16px 0 8px', fontSize: 20 }}>No projects found</h3>
            <p style={palette.muted}>Create a new project or use Open Project Folder to select an existing Drake AI project folder.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, palette }: { label: string; value: string; onChange: (value: string) => void; palette: ReturnType<typeof projectsPalette> }) {
  return <label style={palette.fieldLabel}>{label}<input value={value} onChange={event => onChange(event.target.value)} style={palette.input} /></label>
}

function Select({ label, value, options, onChange, palette }: { label: string; value: string; options: string[]; onChange: (value: string) => void; palette: ReturnType<typeof projectsPalette> }) {
  return <label style={palette.fieldLabel}>{label}<select value={value} onChange={event => onChange(event.target.value)} style={palette.input}>{options.map(option => <option key={option}>{option}</option>)}</select></label>
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
const formPanel: React.CSSProperties = { marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14, padding: 18, borderRadius: 16, border: '1px solid #26364F', background: 'rgba(15,23,42,.84)' }
const fieldLabel: React.CSSProperties = { display: 'grid', gap: 7, color: '#9DB7D8', fontWeight: 800, fontSize: 13 }
const input: React.CSSProperties = { borderRadius: 10, border: '1px solid #26364F', background: '#08111F', color: '#F8FAFC', padding: '12px 13px', fontSize: 15, outline: 'none' }
const activeBanner: React.CSSProperties = { marginTop: 18, padding: 14, borderRadius: 14, border: '1px solid #26364F', background: 'rgba(15,23,42,.84)', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 16, marginTop: 22 }
const card: React.CSSProperties = { textAlign: 'left', padding: 18, borderRadius: 16, border: '1px solid #1E293B', background: 'linear-gradient(180deg,rgba(15,23,42,.94),rgba(7,17,31,.96))', color: '#F8FAFC', cursor: 'pointer' }
const icon: React.CSSProperties = { width: 44, height: 44, borderRadius: 12, background: 'rgba(218,38,38,.14)', border: '1px solid rgba(218,38,38,.35)', display: 'grid', placeItems: 'center', color: '#DA2626' }

function projectsPalette(isLight: boolean) {
  const border = isLight ? '#D6DEE9' : '#1E293B'
  const formBorder = isLight ? '#CBD5E1' : '#26364F'
  const text = isLight ? '#0F172A' : '#F8FAFC'
  const mutedColor = isLight ? '#64748B' : '#94A3B8'
  return {
    border,
    page: { ...page, background: isLight ? '#F8FAFC' : 'linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)', color: text } as React.CSSProperties,
    title: { ...title, color: text } as React.CSSProperties,
    muted: { ...muted, color: mutedColor } as React.CSSProperties,
    ghostButton: { ...ghostButton, border: `1px solid ${formBorder}`, background: isLight ? '#FFFFFF' : '#08111F', color: text } as React.CSSProperties,
    alertButton: { ...alertButton, background: isLight ? '#FFFBEB' : 'rgba(245,158,11,.16)', color: isLight ? '#92400E' : '#FCD34D' } as React.CSSProperties,
    formPanel: { ...formPanel, border: `1px solid ${formBorder}`, background: isLight ? '#FFFFFF' : 'rgba(15,23,42,.84)' } as React.CSSProperties,
    fieldLabel: { ...fieldLabel, color: isLight ? '#475569' : '#9DB7D8' } as React.CSSProperties,
    input: { ...input, border: `1px solid ${formBorder}`, background: isLight ? '#FFFFFF' : '#08111F', color: text } as React.CSSProperties,
    activeBanner: { ...activeBanner, border: `1px solid ${formBorder}`, background: isLight ? '#FFFFFF' : 'rgba(15,23,42,.84)' } as React.CSSProperties,
    card: { ...card, border: `1px solid ${border}`, background: isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.94),rgba(7,17,31,.96))', color: text } as React.CSSProperties,
  }
}

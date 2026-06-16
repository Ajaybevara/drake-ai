import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { FolderOpen, Plus, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { localProjectsApi } from '../services/api'
import { useStore } from '../store'

const PROJECT_TYPES = ['Petrophysics', 'Seismic', 'Production', 'CCUS', 'Geothermal', 'Digitizer', 'Integrated Study', 'Custom']
const STORAGE_LOCATIONS = ['Desktop', 'Documents', 'C Drive', 'D Drive', 'Custom Folder']

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const directoryInputRef = useRef<HTMLInputElement>(null)
  const { enterpriseProject, setEnterpriseProject } = useStore()
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
    refreshProjects().catch(() => undefined)
    localProjectsApi.current()
      .then(({ data }) => setEnterpriseProject(data))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const query = (searchParams.get('search') || '').toLowerCase().trim()
    if (!query) return
    setProjects(prev => prev.filter(project =>
      `${project.project_name} ${project.project_type} ${project.project_path}`.toLowerCase().includes(query)
    ))
  }, [searchParams])

  const refreshProjects = async () => {
    const { data } = await localProjectsApi.list(form.storage_location)
    setProjects(data.projects || [])
  }

  const createProject = async () => {
    if (!form.project_name.trim()) {
      toast.error('Project name is required')
      return
    }
    setBusy(true)
    try {
      localStorage.setItem('drake_project_storage_location', form.storage_location)
      const { data } = await localProjectsApi.create(form)
      setEnterpriseProject(data)
      await refreshProjects()
      toast.success(`Project created at ${data.project_path}`)
      navigate('/dashboard')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Project creation failed')
    } finally {
      setBusy(false)
    }
  }

  const openProjectPath = async (projectPath: string) => {
    setBusy(true)
    try {
      const { data } = await localProjectsApi.open(projectPath)
      setEnterpriseProject(data)
      toast.success(`Opened ${data.project_name}`)
      navigate('/dashboard')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Open project failed')
    } finally {
      setBusy(false)
    }
  }

  const openProjectFolder = async () => {
    const picker = (window as any).showDirectoryPicker
    if (picker) {
      try {
        const directoryHandle = await picker({ mode: 'read' })
        const projectFile = await directoryHandle.getFileHandle('project.json')
        const file = await projectFile.getFile()
        const project = JSON.parse(await file.text())
        if (!project.project_path) throw new Error('project.json does not contain project_path')
        await openProjectPath(project.project_path)
        return
      } catch (error: any) {
        if (error?.name !== 'AbortError') toast.error(error?.message || 'Selected folder is not a Drake AI project')
        return
      }
    }
    directoryInputRef.current?.click()
  }

  const openPickedDirectory = async (files: FileList | null) => {
    const allFiles = Array.from(files || [])
    const projectJson = allFiles.find(file => file.name === 'project.json')
    if (!projectJson) {
      toast.error('Select a Drake AI project folder that contains project.json')
      return
    }
    try {
      const project = JSON.parse(await projectJson.text())
      if (!project.project_path) throw new Error('project.json does not contain project_path')
      await openProjectPath(project.project_path)
    } catch (error: any) {
      toast.error(error?.message || 'Could not open selected project folder')
    } finally {
      if (directoryInputRef.current) directoryInputRef.current.value = ''
    }
  }

  return (
    <div style={page}>
      <div style={eyebrow}>Project Registry</div>
      <h1 style={title}>Projects</h1>
      <p style={muted}>Create a folder-backed Drake AI project, open an existing project folder, and keep uploads, results, and exports saved inside that project.</p>

      <div style={actions}>
        <button style={primaryButton} onClick={createProject} disabled={busy}><Plus size={16} /> Create New Project</button>
        <button style={ghostButton} onClick={openProjectFolder} disabled={busy}><FolderOpen size={16} /> Open Project Folder</button>
        <button style={alertButton} onClick={() => refreshProjects().catch(() => toast.error('Could not refresh projects'))} disabled={busy}><RefreshCw size={16} /> Refresh Projects</button>
      </div>

      <input
        ref={directoryInputRef}
        type="file"
        style={{ display: 'none' }}
        // @ts-expect-error Chromium folder picker attribute.
        webkitdirectory=""
        onChange={event => openPickedDirectory(event.target.files)}
      />

      <div style={formPanel}>
        <Field label="Project Name" value={form.project_name} onChange={value => setForm({ ...form, project_name: value })} />
        <Field label="Description" value={form.description} onChange={value => setForm({ ...form, description: value })} />
        <Select label="Project Type" value={form.project_type} options={PROJECT_TYPES} onChange={value => setForm({ ...form, project_type: value })} />
        <Select label="Storage Location" value={form.storage_location} options={STORAGE_LOCATIONS} onChange={value => setForm({ ...form, storage_location: value })} />
        {form.storage_location === 'Custom Folder' ? <Field label="Custom Folder Path" value={form.custom_folder} onChange={value => setForm({ ...form, custom_folder: value })} /> : null}
      </div>

      {enterpriseProject && (
        <div style={activeBanner}>
          <div><b>Active project:</b> {enterpriseProject.project_name}</div>
          <div style={{ color: '#10B981' }}>{enterpriseProject.project_path}</div>
        </div>
      )}

      <div style={grid}>
        {projects.map(project => (
          <button key={project.project_id} style={{ ...card, borderColor: enterpriseProject?.project_id === project.project_id ? '#DA2626' : '#1E293B' }} onClick={() => openProjectPath(project.project_path)}>
            <div style={icon}><FolderOpen size={22} /></div>
            <h3 style={{ margin: '16px 0 8px', fontSize: 20 }}>{project.project_name}</h3>
            <p style={muted}>{project.project_type} - {(project.uploaded_files || []).length} uploaded files - {(project.exported_files || []).length} exports</p>
            <p style={{ ...muted, marginTop: 8 }}>{project.project_path}</p>
          </button>
        ))}
        {!projects.length && (
          <div style={card}>
            <div style={icon}><FolderOpen size={22} /></div>
            <h3 style={{ margin: '16px 0 8px', fontSize: 20 }}>No projects found</h3>
            <p style={muted}>Create a new project or use Open Project Folder to select an existing Drake AI project folder.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label style={fieldLabel}>{label}<input value={value} onChange={event => onChange(event.target.value)} style={input} /></label>
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label style={fieldLabel}>{label}<select value={value} onChange={event => onChange(event.target.value)} style={input}>{options.map(option => <option key={option}>{option}</option>)}</select></label>
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

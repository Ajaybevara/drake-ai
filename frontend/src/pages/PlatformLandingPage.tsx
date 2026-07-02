import type React from 'react'
import { useEffect, useState } from 'react'
import { FolderOpen, Plus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useStore } from '../store'
import { createLocalFolderProject, getCurrentLocalProjectFromFolder, listLocalProjects, openKnownLocalProject, openLocalFolderProject } from '../utils/localProjectStorage'

const PROJECT_TYPES = ['Petrophysics', 'Seismic', 'Production', 'CCUS', 'Geothermal', 'Digitizer', 'Integrated Study', 'Custom']
const STORAGE_LOCATIONS = ['Desktop', 'Documents', 'C Drive', 'D Drive', 'Custom Folder']

export default function PlatformLandingPage() {
  const navigate = useNavigate()
  const { setEnterpriseProject, enterpriseProject, theme } = useStore()
  const isLight = theme === 'light'
  const palette = landingPalette(isLight)
  const [mode, setMode] = useState<'create' | 'open' | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [form, setForm] = useState({
    project_name: '',
    description: '',
    project_type: 'Integrated Study',
    storage_location: localStorage.getItem('drake_project_storage_location') || 'Documents',
    custom_folder: '',
  })

  useEffect(() => {
    getCurrentLocalProjectFromFolder().then(current => {
      if (current) setEnterpriseProject(current)
    }).catch(() => undefined)
  }, [setEnterpriseProject])

  const loadRegistry = () => {
    setProjects(listLocalProjects())
  }

  const createProject = async () => {
    if (!form.project_name.trim()) {
      toast.error('Project name is required')
      return
    }
    try {
      localStorage.setItem('drake_project_storage_location', form.storage_location)
      const project = await createLocalFolderProject(form)
      setEnterpriseProject(project)
      setProjects(listLocalProjects())
      toast.success('Project created')
      navigate('/dashboard')
    } catch (error: any) {
      if (error?.name !== 'AbortError') toast.error(error?.message || 'Project creation failed')
    }
  }

  const openProject = async () => {
    try {
      const project = await openLocalFolderProject()
      setEnterpriseProject(project)
      setProjects(listLocalProjects())
      toast.success(`Opened ${project.project_name}`)
      navigate('/dashboard')
    } catch (error: any) {
      if (error?.name !== 'AbortError') toast.error(error?.message || 'Open project failed')
    }
  }

  const openKnownProject = async (projectRecord: any) => {
    try {
      const project = await openKnownLocalProject(projectRecord)
      setEnterpriseProject(project)
      setProjects(listLocalProjects())
      toast.success(`Opened ${project.project_name}`)
      navigate('/dashboard')
    } catch (error: any) {
      if (error?.name !== 'AbortError') toast.error(error?.message || 'Open project failed')
    }
  }

  return (
    <div style={palette.page}>
      <section style={palette.hero}>
        <div>
          <div style={eyebrow}>Drake AI Enterprise Platform</div>
          <h1 style={palette.title}>Project Workspace</h1>
          <p style={palette.muted}>Create a local study workspace or continue previous work. Existing AI modules and processing flows remain unchanged.</p>
          {enterpriseProject ? <button style={continueButton} onClick={() => navigate('/dashboard')}>Continue {enterpriseProject.project_name}</button> : null}
        </div>
      </section>

      <div style={grid}>
        <button style={palette.choiceCard} onClick={() => setMode('create')}>
          <Plus size={24} color="#10B981" />
          <h2 style={palette.cardTitle}>Create Project</h2>
          <p style={palette.muted}>Create a new study workspace</p>
        </button>
        <button style={palette.choiceCard} onClick={() => { setMode('open'); loadRegistry() }}>
          <FolderOpen size={24} color="#60A5FA" />
          <h2 style={palette.cardTitle}>Open Project</h2>
          <p style={palette.muted}>Continue previous work</p>
        </button>
      </div>

      {mode && (
        <div style={overlay}>
          <div style={palette.modal}>
            <button style={palette.closeButton} onClick={() => setMode(null)}><X size={18} /></button>
            {mode === 'create' ? (
              <>
                <div style={eyebrow}>Create Project</div>
                <h2 style={palette.modalTitle}>New Local Project</h2>
                <div style={formGrid}>
                  <Field label="Project Name" value={form.project_name} onChange={value => setForm({ ...form, project_name: value })} palette={palette} />
                  <Field label="Description" value={form.description} onChange={value => setForm({ ...form, description: value })} palette={palette} />
                  <Select label="Project Type" value={form.project_type} options={PROJECT_TYPES} onChange={value => setForm({ ...form, project_type: value })} palette={palette} />
                  <Select label="Storage Location" value={form.storage_location} options={STORAGE_LOCATIONS} onChange={value => setForm({ ...form, storage_location: value })} palette={palette} />
                  {form.storage_location === 'Custom Folder' ? <Field label="Custom Folder" value={form.custom_folder} onChange={value => setForm({ ...form, custom_folder: value })} palette={palette} /> : null}
                </div>
                <button style={primaryButton} onClick={createProject}>Create New Project</button>
              </>
            ) : (
              <>
                <div style={eyebrow}>Open Project</div>
                <h2 style={palette.modalTitle}>Existing Projects</h2>
                <button style={primaryButton} onClick={openProject}>Open Project Folder</button>
                <div style={list}>
                  {projects.map(project => (
                    <button key={project.project_id} style={palette.projectRow} onClick={() => openKnownProject(project)}>
                      <b>{project.project_name}</b>
                      <span>{project.project_type} - {project.project_path}</span>
                    </button>
                  ))}
                  {!projects.length ? <p style={palette.muted}>No projects found in this storage location.</p> : null}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, palette }: { label: string; value: string; onChange: (value: string) => void; palette: ReturnType<typeof landingPalette> }) {
  return <label style={palette.fieldLabel}>{label}<input value={value} onChange={event => onChange(event.target.value)} style={palette.input} /></label>
}

function Select({ label, value, options, onChange, palette }: { label: string; value: string; options: string[]; onChange: (value: string) => void; palette: ReturnType<typeof landingPalette> }) {
  return <label style={palette.fieldLabel}>{label}<select value={value} onChange={event => onChange(event.target.value)} style={palette.input}>{options.map(option => <option key={option}>{option}</option>)}</select></label>
}

const page: React.CSSProperties = { minHeight: '100%', padding: 28, color: '#F8FAFC', background: 'linear-gradient(135deg,#050B14,#07111F 55%,#0B1628)', overflow: 'auto' }
const hero: React.CSSProperties = { padding: 28, borderRadius: 18, border: '1px solid #1E293B', background: 'linear-gradient(135deg,rgba(15,23,42,.95),rgba(7,17,31,.86))' }
const eyebrow: React.CSSProperties = { color: '#DA2626', letterSpacing: 4, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }
const title: React.CSSProperties = { margin: '8px 0', fontSize: 40, lineHeight: 1.08 }
const muted: React.CSSProperties = { margin: 0, color: '#94A3B8', lineHeight: 1.6 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18, marginTop: 20 }
const choiceCard: React.CSSProperties = { textAlign: 'left', padding: 24, minHeight: 190, borderRadius: 16, border: '1px solid #26364F', background: 'linear-gradient(180deg,rgba(15,23,42,.96),rgba(7,17,31,.98))', color: '#F8FAFC', cursor: 'pointer' }
const cardTitle: React.CSSProperties = { margin: '18px 0 8px', fontSize: 24 }
const continueButton: React.CSSProperties = { marginTop: 18, border: '1px solid #10B981', background: '#10B981', color: '#00150E', borderRadius: 10, padding: '11px 14px', fontWeight: 900, cursor: 'pointer' }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.62)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 20 }
const modal: React.CSSProperties = { width: 'min(720px,96vw)', maxHeight: '86vh', overflow: 'auto', position: 'relative', borderRadius: 18, border: '1px solid #26364F', background: '#0B111A', padding: 24, boxShadow: '0 30px 90px rgba(0,0,0,.45)' }
const closeButton: React.CSSProperties = { position: 'absolute', top: 14, right: 14, background: '#111827', color: '#E2E8F0', border: '1px solid #26364F', borderRadius: 8, width: 34, height: 34, display: 'grid', placeItems: 'center', cursor: 'pointer' }
const modalTitle: React.CSSProperties = { margin: '8px 0 18px', fontSize: 28 }
const formGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14 }
const fieldLabel: React.CSSProperties = { display: 'grid', gap: 7, color: '#9DB7D8', fontWeight: 800, fontSize: 13 }
const input: React.CSSProperties = { borderRadius: 10, border: '1px solid #26364F', background: '#08111F', color: '#F8FAFC', padding: '12px 13px', fontSize: 15, outline: 'none' }
const primaryButton: React.CSSProperties = { marginTop: 18, width: '100%', border: '1px solid #10B981', background: '#10B981', color: '#00150E', borderRadius: 12, padding: 14, fontWeight: 900, cursor: 'pointer' }
const list: React.CSSProperties = { display: 'grid', gap: 10 }
const projectRow: React.CSSProperties = { display: 'grid', gap: 5, textAlign: 'left', border: '1px solid #26364F', background: '#08111F', color: '#F8FAFC', padding: 14, borderRadius: 12, cursor: 'pointer' }

function landingPalette(isLight: boolean) {
  const text = isLight ? '#0F172A' : '#F8FAFC'
  const mutedColor = isLight ? '#64748B' : '#94A3B8'
  const border = isLight ? '#D6DEE9' : '#26364F'
  return {
    page: { ...page, color: text, background: isLight ? '#F8FAFC' : 'linear-gradient(135deg,#050B14,#07111F 55%,#0B1628)' } as React.CSSProperties,
    hero: { ...hero, border: `1px solid ${border}`, background: isLight ? '#FFFFFF' : 'linear-gradient(135deg,rgba(15,23,42,.95),rgba(7,17,31,.86))' } as React.CSSProperties,
    title: { ...title, color: text, fontSize: 44 } as React.CSSProperties,
    muted: { ...muted, color: mutedColor, fontSize: 16 } as React.CSSProperties,
    choiceCard: { ...choiceCard, border: `1px solid ${border}`, background: isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.96),rgba(7,17,31,.98))', color: text } as React.CSSProperties,
    cardTitle: { ...cardTitle, color: text, fontSize: 26 } as React.CSSProperties,
    modal: { ...modal, border: `1px solid ${border}`, background: isLight ? '#FFFFFF' : '#0B111A', color: text } as React.CSSProperties,
    closeButton: { ...closeButton, background: isLight ? '#F1F5F9' : '#111827', color: text, border: `1px solid ${border}` } as React.CSSProperties,
    modalTitle: { ...modalTitle, color: text, fontSize: 30 } as React.CSSProperties,
    fieldLabel: { ...fieldLabel, color: isLight ? '#475569' : '#9DB7D8', fontSize: 15 } as React.CSSProperties,
    input: { ...input, border: `1px solid ${border}`, background: isLight ? '#FFFFFF' : '#08111F', color: text, fontSize: 16 } as React.CSSProperties,
    projectRow: { ...projectRow, border: `1px solid ${border}`, background: isLight ? '#FFFFFF' : '#08111F', color: text, fontSize: 15 } as React.CSSProperties,
  }
}

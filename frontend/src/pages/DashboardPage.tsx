import type React from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { Database, Download, FolderOpen, History, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { localProjectsApi } from '../services/api'
import { useStore } from '../store'

const MODULES = [
  { label: 'Log Visualization', path: '/petrophysics/log-visualization' },
  { label: 'Missing Log Prediction', path: '/petrophysics/missing-log-prediction' },
  { label: 'Facies Classification', path: '/petrophysics/ai-facies-classification' },
  { label: 'Formation Tops', path: '/petrophysics/ai-formation-tops' },
  { label: 'AI Parameter Prediction', path: '/petrophysics/ai-parameter-prediction' },
  { label: 'AI Uncertainty', path: '/petrophysics/ai-uncertainty' },
  { label: 'Seismic', path: '/seismic/frequency-enhancer' },
  { label: 'Production', path: '/production/intelligence' },
  { label: 'CCUS', path: '/ccus/ai-preliminary-screening' },
  { label: 'Geothermal', path: '/geothermal/log-based-screening' },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const { enterpriseProject, setEnterpriseProject } = useStore()

  useEffect(() => {
    localProjectsApi.current()
      .then(({ data }) => setEnterpriseProject(data))
      .catch(() => undefined)
  }, [setEnterpriseProject])

  const project = enterpriseProject
  const stats = useMemo(() => ({
    files: project?.uploaded_files?.length || 0,
    results: project?.generated_results?.length || 0,
    exports: project?.exported_files?.length || 0,
    lastActivity: project?.module_history?.[0]?.timestamp || project?.updated_at,
  }), [project])

  const uploadFiles = async (files: FileList | null) => {
    if (!project || !files?.length) return
    try {
      const { data } = await localProjectsApi.uploadFiles(project.project_id, Array.from(files))
      setEnterpriseProject(data.project)
      toast.success(`${data.files.length} file(s) added to project`)
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Project upload failed')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  if (!project) {
    return (
      <div style={page}>
        <section style={empty}>
          <FolderOpen size={34} color="#DA2626" />
          <h1 style={{ margin: '12px 0 6px' }}>No Active Project</h1>
          <p style={muted}>Create or open a local project to start shared file management.</p>
          <button style={primaryButton} onClick={() => navigate('/')}>Open Platform</button>
        </section>
      </div>
    )
  }

  return (
    <div style={page}>
      <section style={hero}>
        <div>
          <div style={eyebrow}>Project Dashboard</div>
          <h1 style={title}>{project.project_name}</h1>
          <p style={muted}>{project.description || 'No description'} - {project.project_type}</p>
          <p style={pathText}>{project.project_path}</p>
        </div>
        <div style={heroActions}>
          <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={event => uploadFiles(event.target.files)} />
          <button style={primaryButton} onClick={() => inputRef.current?.click()}><Upload size={16} /> Upload Project Files</button>
          <button style={ghostButton} onClick={() => navigate('/')}><FolderOpen size={16} /> Switch Project</button>
        </div>
      </section>

      <div style={statsGrid}>
        <Stat label="Uploaded Files" value={String(stats.files)} icon={<Database size={20} />} />
        <Stat label="Generated Results" value={String(stats.results)} icon={<History size={20} />} />
        <Stat label="Exports" value={String(stats.exports)} icon={<Download size={20} />} />
        <Stat label="Last Activity" value={stats.lastActivity ? new Date(stats.lastActivity).toLocaleString() : 'None'} icon={<FolderOpen size={20} />} />
      </div>

      <section style={panel}>
        <div style={sectionHead}>
          <div>
            <div style={eyebrow}>Open Module</div>
            <h2 style={panelTitle}>Run Existing Workflows</h2>
          </div>
        </div>
        <div style={moduleGrid}>
          {MODULES.map(module => <button key={module.path} style={moduleButton} onClick={() => navigate(module.path)}>{module.label}</button>)}
        </div>
      </section>

      <div style={twoCol}>
        <Browser title="Uploaded File List" rows={project.uploaded_files || []} columns={['file_name', 'file_type', 'bucket', 'uploaded_at']} />
        <Browser title="Result List" rows={project.generated_results || []} columns={['file_name', 'module_name', 'created_at']} />
      </div>
      <div style={twoCol}>
        <Browser title="Export List" rows={project.exported_files || []} columns={['file_name', 'module_name', 'export_type', 'created_at']} />
        <Browser title="Project History" rows={project.module_history || []} columns={['timestamp', 'module_name', 'action', 'status']} />
      </div>
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div style={stat}><div style={{ color: '#10B981' }}>{icon}</div><div><div style={statLabel}>{label}</div><div style={statValue}>{value}</div></div></div>
}

function Browser({ title, rows, columns }: { title: string; rows: any[]; columns: string[] }) {
  return (
    <section style={panel}>
      <h2 style={panelTitle}>{title}</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={table}>
          <thead><tr>{columns.map(col => <th key={col} style={th}>{col.replace(/_/g, ' ').toUpperCase()}</th>)}</tr></thead>
          <tbody>
            {rows.slice(0, 12).map((row, index) => <tr key={row.file_id || row.result_id || row.export_id || row.id || index}>{columns.map(col => <td key={col} style={td}>{String(row[col] ?? '-')}</td>)}</tr>)}
            {!rows.length ? <tr><td style={td} colSpan={columns.length}>No records yet</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const page: React.CSSProperties = { padding: 28, minHeight: '100%', overflow: 'auto', background: 'linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)', color: '#F8FAFC' }
const hero: React.CSSProperties = { padding: 24, borderRadius: 18, border: '1px solid #1E293B', background: 'linear-gradient(135deg,rgba(15,23,42,.94),rgba(7,17,31,.86))', display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap' }
const eyebrow: React.CSSProperties = { color: '#DA2626', letterSpacing: 4, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }
const title: React.CSSProperties = { margin: '8px 0', fontSize: 34, lineHeight: 1.1 }
const muted: React.CSSProperties = { margin: 0, color: '#94A3B8', lineHeight: 1.55 }
const pathText: React.CSSProperties = { margin: '10px 0 0', color: '#60A5FA', fontSize: 12, wordBreak: 'break-all' }
const heroActions: React.CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }
const buttonBase: React.CSSProperties = { borderRadius: 10, padding: '12px 15px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 900, cursor: 'pointer' }
const primaryButton: React.CSSProperties = { ...buttonBase, border: '1px solid #10B981', background: '#10B981', color: '#00150E' }
const ghostButton: React.CSSProperties = { ...buttonBase, border: '1px solid #26364F', background: '#08111F', color: '#E2E8F0' }
const statsGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14, marginTop: 18 }
const stat: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, padding: 18, borderRadius: 14, border: '1px solid #1E293B', background: 'rgba(15,23,42,.84)' }
const statLabel: React.CSSProperties = { color: '#94A3B8', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.2 }
const statValue: React.CSSProperties = { color: '#F8FAFC', fontSize: 20, fontWeight: 900, marginTop: 4, wordBreak: 'break-word' }
const panel: React.CSSProperties = { marginTop: 18, padding: 18, borderRadius: 16, border: '1px solid #1E293B', background: 'rgba(15,23,42,.82)' }
const sectionHead: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }
const panelTitle: React.CSSProperties = { margin: '6px 0 14px', fontSize: 22 }
const moduleGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }
const moduleButton: React.CSSProperties = { borderRadius: 10, border: '1px solid #26364F', background: '#08111F', color: '#F8FAFC', padding: 13, cursor: 'pointer', fontWeight: 900, textAlign: 'left' }
const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))', gap: 16 }
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 }
const th: React.CSSProperties = { textAlign: 'left', color: '#93C5FD', padding: '10px 8px', borderBottom: '1px solid #24324A', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { color: '#E2E8F0', padding: '10px 8px', borderBottom: '1px solid #1E293B', whiteSpace: 'nowrap' }
const empty: React.CSSProperties = { minHeight: 360, display: 'grid', placeItems: 'center', alignContent: 'center', textAlign: 'center', gap: 8 }

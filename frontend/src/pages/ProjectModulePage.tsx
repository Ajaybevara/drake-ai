import { useEffect } from 'react'
import type React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, BarChart3, Binary, Brain, Download, Droplets, Gauge, GitBranch, Layers, Leaf, LineChart, ScanLine, ShieldCheck, Waves } from 'lucide-react'
import { useStore } from '../store'
import ModuleCard from '../components/project/ModuleCard'
import StatusBadge from '../components/project/StatusBadge'

const CONFIG: Record<string, { title: string; subtitle: string; files: string[]; tools: Array<{ title: string; path: string; icon: any; accent: string; subtitle: string }> }> = {
  petrophysics: {
    title: 'Petrophysics',
    subtitle: 'Project LAS files power log visualization, QC, missing log prediction, facies, AI prediction, uncertainty and auto splice.',
    files: ['LAS'],
    tools: [
      { title: 'Log Visualization', path: 'log-viewer', icon: BarChart3, accent: '#38BDF8', subtitle: 'Select project LAS curves and visualize depth tracks with hover values.' },
      { title: 'Log QC', path: 'log-qc', icon: ShieldCheck, accent: '#10B981', subtitle: 'Review available logs, ranges, nulls and curve readiness.' },
      { title: 'Missing Log Prediction', path: 'missing-log-prediction', icon: Brain, accent: '#8B5CF6', subtitle: 'Single or multi-well missing curve prediction from project LAS files.' },
      { title: 'Facies Classification', path: 'facies-classification', icon: Layers, accent: '#F59E0B', subtitle: 'AI facies classes and lithology proportions from uploaded logs.' },
      { title: 'Porosity & Permeability', path: 'porosity-permeability', icon: Gauge, accent: '#38BDF8', subtitle: 'AI prediction table and first-five calculated results.' },
      { title: 'Water Saturation', path: 'water-saturation', icon: Droplets, accent: '#EF4444', subtitle: 'P10/P50/P90 uncertainty envelopes and result tables.' },
      { title: 'Auto Splice', path: 'auto-splice', icon: GitBranch, accent: '#10B981', subtitle: 'Splice compatible curves across uploaded well log files.' },
    ],
  },
  seismic: {
    title: 'Seismic',
    subtitle: 'Seismic viewer, attribute analysis and interpretation support connected to repository inputs.',
    files: ['SEGY', 'SGY', 'PDF'],
    tools: [
      { title: 'Seismic Viewer', path: '', icon: Waves, accent: '#8B5CF6', subtitle: 'Professional seismic-style viewer panel ready for SEGY integration.' },
      { title: 'Attribute Analysis', path: '', icon: Binary, accent: '#38BDF8', subtitle: 'Attribute cards, amplitude windows and interpretation outputs.' },
    ],
  },
  production: {
    title: 'Production',
    subtitle: 'Production analytics, forecasting, oil/gas/water rate charts and cumulative production.',
    files: ['CSV', 'XLS', 'XLSX'],
    tools: [
      { title: 'Production Analytics', path: '', icon: LineChart, accent: '#10B981', subtitle: 'Rate and cumulative production charts from Excel or CSV files.' },
      { title: 'Forecasting', path: '', icon: Activity, accent: '#38BDF8', subtitle: 'Decline-style forecasting workspace and well performance ranking.' },
    ],
  },
  ccus: {
    title: 'CCUS',
    subtitle: 'Storage screening, reservoir suitability, CO2 capacity review, risk review and well ranking.',
    files: ['LAS', 'PDF', 'CSV', 'XLS', 'XLSX'],
    tools: [
      { title: 'Storage Screening', path: '', icon: Leaf, accent: '#10B981', subtitle: 'Reservoir candidate cards and suitability status from project data.' },
      { title: 'CO2 Capacity Review', path: '', icon: Gauge, accent: '#F59E0B', subtitle: 'Capacity and risk review placeholder ready for FastAPI models.' },
    ],
  },
  digitizer: {
    title: 'Drake AI Digitizer',
    subtitle: 'Raster log digitization, curve extraction, document OCR and legacy data conversion.',
    files: ['PDF', 'PNG', 'JPG', 'JPEG', 'WEBP', 'TIF', 'TIFF'],
    tools: [
      { title: 'Raster Log Digitization', path: '', icon: ScanLine, accent: '#EF4444', subtitle: 'Select image/PDF, calibrate axes, track curves, export LAS or CSV.' },
      { title: 'Document OCR', path: '', icon: Binary, accent: '#38BDF8', subtitle: 'Extract technical data from scanned reports and legacy documents.' },
    ],
  },
}

export default function ProjectModulePage({ moduleKey }: { moduleKey: keyof typeof CONFIG }) {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { localProjects, activeLocalProject, openLocalProject, addProjectOutput } = useStore()
  const project = localProjects.find(item => item.id === projectId) || activeLocalProject
  const config = CONFIG[moduleKey]

  useEffect(() => {
    if (projectId) openLocalProject(projectId)
  }, [projectId, openLocalProject])

  if (!project) return <div style={page}><div style={empty}>Project not found.</div></div>

  const compatibleFiles = project.files.filter(file => file.compatibility.some(item => item.toLowerCase().includes(moduleKey === 'digitizer' ? 'digitizer' : config.title.toLowerCase())))
  const exportModule = () => {
    addProjectOutput(project.id, { module: config.title, name: `${config.title} module summary`, type: 'JSON' })
    const payload = JSON.stringify({ project: project.name, module: config.title, compatibleFiles, generatedAt: new Date().toISOString() }, null, 2)
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${project.name}-${config.title}-summary.json`.replace(/\s+/g, '-')
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={page}>
      <button onClick={() => navigate(`/projects/${project.id}`)} style={backButton}><ArrowLeft size={15} /> Back to Workspace</button>
      <section style={hero}>
        <div>
          <div style={eyebrow}>Drake AI Domain</div>
          <h1 style={title}>{config.title}</h1>
          <p style={muted}>{config.subtitle}</p>
        </div>
        <button onClick={exportModule} style={primaryButton}><Download size={17} /> Export Module Summary</button>
      </section>

      <section style={panel}>
        <h2 style={{ margin: '0 0 12px', fontSize: 21 }}>Compatible Project Files</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {compatibleFiles.map(file => (
            <div key={file.id} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #26364F', background: '#08111F', color: '#E2E8F0' }}>
              <strong>{file.name}</strong>
              <div style={{ marginTop: 7 }}><StatusBadge status={file.status} /></div>
            </div>
          ))}
          {!compatibleFiles.length && <div style={{ color: '#94A3B8' }}>No compatible files yet. Upload {config.files.join(', ')} files in Project Data Repository.</div>}
        </div>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ margin: '0 0 14px', fontSize: 22 }}>{config.title} Tools</h2>
        <div style={moduleGrid}>
          {config.tools.map(tool => (
            <ModuleCard key={tool.title} title={tool.title} subtitle={tool.subtitle} icon={tool.icon} accent={tool.accent} onClick={() => tool.path ? navigate(`/projects/${project.id}/${moduleKey}/${tool.path}`) : undefined} />
          ))}
        </div>
      </section>
    </div>
  )
}

const page: React.CSSProperties = { padding: 28, minHeight: '100%', overflow: 'auto', background: 'linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)', color: '#F8FAFC' }
const hero: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, padding: 24, borderRadius: 20, border: '1px solid #1E293B', background: 'linear-gradient(135deg,rgba(15,23,42,.92),rgba(7,17,31,.82))' }
const eyebrow: React.CSSProperties = { color: '#38BDF8', letterSpacing: 4, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }
const title: React.CSSProperties = { margin: '8px 0', fontSize: 34, lineHeight: 1.1 }
const muted: React.CSSProperties = { margin: 0, color: '#94A3B8', lineHeight: 1.55 }
const primaryButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(239,68,68,.45)', background: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: '#fff', cursor: 'pointer', fontWeight: 900 }
const backButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '9px 12px', borderRadius: 9, border: '1px solid #26364F', background: '#0B1220', color: '#CBD5E1', cursor: 'pointer', fontWeight: 800 }
const panel: React.CSSProperties = { marginTop: 22, padding: 20, borderRadius: 18, border: '1px solid #1E293B', background: 'rgba(15,23,42,.82)' }
const moduleGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }
const empty: React.CSSProperties = { padding: 24, borderRadius: 18, border: '1px solid #1E293B', background: 'rgba(15,23,42,.82)', color: '#94A3B8' }

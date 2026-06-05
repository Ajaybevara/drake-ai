import { useEffect, useState } from 'react'
import type React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, BarChart3, Binary, Brain, Download, Droplets, Gauge, GitBranch, Layers, Leaf, LineChart, ScanLine, ShieldCheck, Waves } from 'lucide-react'
import { useStore } from '../store'
import { seismicApi } from '../services/api'
import ModuleCard from '../components/project/ModuleCard'
import StatusBadge from '../components/project/StatusBadge'
import toast from 'react-hot-toast'

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
  const [selectedSeismicFile, setSelectedSeismicFile] = useState('')
  const [freqLow, setFreqLow] = useState('0')
  const [freqHigh, setFreqHigh] = useState('10')
  const [gain, setGain] = useState('1.65')
  const [seismicResult, setSeismicResult] = useState<any>(null)
  const [runningSeismic, setRunningSeismic] = useState(false)

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

  const runSeismicEnhancer = async () => {
    const file = compatibleFiles.find(item => item.id === selectedSeismicFile) || compatibleFiles[0]
    if (!file) {
      toast.error('Upload an SGY, SEGY or NPY seismic file in the project repository first')
      return
    }
    setRunningSeismic(true)
    try {
      const response = await seismicApi.lowFrequencyEnhancement({
        file_name: file.name,
        storage_path: file.storagePath,
        freq_low: Number(freqLow),
        freq_high: Number(freqHigh),
        gain: Number(gain),
        sample_interval_ms: 2,
      })
      setSeismicResult(response.data)
      addProjectOutput(project.id, { module: 'Seismic', name: 'AI Low Frequency Enhancement', type: 'JSON' })
      toast.success('Seismic low-frequency enhancement completed')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Seismic enhancement failed')
    } finally {
      setRunningSeismic(false)
    }
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

      {moduleKey === 'seismic' && (
        <section style={panel}>
          <h2 style={{ margin: '0 0 12px', fontSize: 21 }}>Preset AI Low Frequency Enhancer</h2>
          <p style={{ margin: '0 0 16px', color: '#94A3B8' }}>Integrated from the uploaded AI-Low-Frequency-Enhancer backend. Select a project seismic file and run the preset enhancement.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1.4fr) repeat(3,minmax(110px,.5fr)) auto', gap: 12, alignItems: 'end' }}>
            <label style={fieldLabel}>Project seismic file
              <select value={selectedSeismicFile} onChange={event => setSelectedSeismicFile(event.target.value)} style={inputStyle}>
                <option value="">Select SGY / SEGY / NPY</option>
                {compatibleFiles.map(file => <option key={file.id} value={file.id}>{file.name}</option>)}
              </select>
            </label>
            <Field label="Freq Low" value={freqLow} onChange={setFreqLow} />
            <Field label="Freq High" value={freqHigh} onChange={setFreqHigh} />
            <Field label="Gain" value={gain} onChange={setGain} />
            <button onClick={runSeismicEnhancer} disabled={runningSeismic} style={{ ...primaryButton, opacity: runningSeismic ? .7 : 1 }}>
              {runningSeismic ? 'Running...' : 'Run Enhancer'}
            </button>
          </div>

          {seismicResult && (
            <div style={{ marginTop: 18 }}>
              <div style={metricGrid}>
                <Metric label="Traces" value={seismicResult.summary.trace_count} />
                <Metric label="Samples" value={seismicResult.summary.sample_count} />
                <Metric label="RMS Delta" value={`${seismicResult.summary.rms_delta_pct}%`} />
                <Metric label="Correlation" value={seismicResult.summary.correlation} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginTop: 16 }}>
                <Heatmap title="Original Seismic" heatmap={seismicResult.original_heatmap} />
                <Heatmap title="Enhanced Seismic" heatmap={seismicResult.enhanced_heatmap} />
              </div>
              <div style={{ marginTop: 16, overflowX: 'auto', borderRadius: 14, border: '1px solid #1E293B' }}>
                <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', color: '#E2E8F0' }}>
                  <thead><tr>{['Trace', 'Original RMS', 'Enhanced RMS'].map(header => <th key={header} style={th}>{header}</th>)}</tr></thead>
                  <tbody>{seismicResult.preview_rows.map((row: any) => <tr key={row.trace}><td style={td}>{row.trace}</td><td style={td}>{row.original_rms}</td><td style={td}>{row.enhanced_rms}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label style={fieldLabel}>{label}<input value={value} onChange={event => onChange(event.target.value)} style={inputStyle} /></label>
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div style={{ padding: 14, borderRadius: 12, border: '1px solid #26364F', background: '#08111F' }}><div style={{ color: '#94A3B8', fontSize: 11, fontWeight: 900, letterSpacing: 1.2 }}>{label}</div><div style={{ color: '#F8FAFC', fontSize: 22, fontWeight: 900, marginTop: 5 }}>{value}</div></div>
}

function Heatmap({ title, heatmap }: { title: string; heatmap: { z: number[][] } }) {
  const rows = heatmap.z || []
  const maxAbs = Math.max(1e-6, ...rows.flat().map(value => Math.abs(value)))
  return (
    <div style={{ padding: 14, borderRadius: 14, border: '1px solid #26364F', background: '#050B14' }}>
      <h3 style={{ margin: '0 0 10px', color: '#F8FAFC' }}>{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rows.length || 1}, 1fr)`, height: 260, overflow: 'hidden', borderRadius: 10 }}>
        {rows.map((column, x) => (
          <div key={x} style={{ display: 'grid', gridTemplateRows: `repeat(${column.length || 1}, 1fr)` }}>
            {column.map((value, y) => {
              const intensity = Math.min(1, Math.abs(value) / maxAbs)
              const color = value >= 0 ? `rgba(239,68,68,${0.15 + intensity * 0.85})` : `rgba(56,189,248,${0.15 + intensity * 0.85})`
              return <span key={`${x}-${y}`} style={{ background: color }} />
            })}
          </div>
        ))}
      </div>
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
const fieldLabel: React.CSSProperties = { color: '#94A3B8', fontSize: 12, fontWeight: 900 }
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', marginTop: 7, height: 42, borderRadius: 10, border: '1px solid #26364F', background: '#050B14', color: '#F8FAFC', padding: '0 12px', outline: 'none', fontWeight: 800 }
const metricGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }
const th: React.CSSProperties = { textAlign: 'left', padding: 12, borderBottom: '1px solid #26364F', color: '#94A3B8', background: '#08111F' }
const td: React.CSSProperties = { padding: 12, borderBottom: '1px solid #1E293B', color: '#E2E8F0' }

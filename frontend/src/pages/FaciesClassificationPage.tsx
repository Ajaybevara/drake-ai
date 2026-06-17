import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { petrophysicsApi } from '../services/api'
import { useStore } from '../store'
import ProjectFileSelector from '../components/project/ProjectFileSelector'
import { saveExportToLocalProject, saveResultToLocalProject, uploadFilesToLocalProject } from '../utils/localProjectStorage'

const PETRO_SESSION_KEY = 'drake_active_petro_las_session'

const faciesState: {
  meta: any
  depthCol: string
  features: string[]
  algorithm: string
  targetPresent: boolean
  faciesCol: string
  clusters: number
  result: any
} = {
  meta: null,
  depthCol: '',
  features: [],
  algorithm: 'kmeans',
  targetPresent: false,
  faciesCol: '',
  clusters: 5,
  result: null,
}

function PlotlyFigure({ figure }: { figure: any }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ref.current || !figure) return
    let active = true
    import('plotly.js-dist-min').then(({ default: Plotly }) => {
      if (!active || !ref.current) return
      Plotly.react(ref.current, figure.data || [], figure.layout || {}, { responsive: true, displaylogo: false })
    })
    return () => {
      active = false
      import('plotly.js-dist-min').then(({ default: Plotly }) => {
        if (ref.current) Plotly.purge(ref.current)
      })
    }
  }, [figure])

  return <div ref={ref} style={{ width: '100%', minHeight: 650 }} />
}

function downloadCsv(csv: string, name: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
  const project = localStorage.getItem('drake_enterprise_project')
  if (project) {
    saveExportToLocalProject(JSON.parse(project), {
      module_name: 'Facies',
      export_type: 'csv',
      prediction_name: name.replace(/\.[^.]+$/, ''),
      extension: 'csv',
      content: csv,
    }).then(({ data }) => useStore.getState().setEnterpriseProject(data.project)).catch(() => undefined)
  }
}

function readPetroSession() {
  try {
    const raw = localStorage.getItem(PETRO_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

async function uploadFileToActiveProject(file: File) {
  try {
    const project = localStorage.getItem('drake_enterprise_project')
    if (!project) return
    const activeProject = JSON.parse(project)
    const { data } = await uploadFilesToLocalProject(activeProject, [file])
    useStore.getState().setEnterpriseProject(data.project)
  } catch {
    // Classification should continue even if the project copy cannot be saved.
  }
}

async function saveProjectResultCopy(predictionName: string, resultPayload: any) {
  try {
    const project = localStorage.getItem('drake_enterprise_project')
    if (!project) return
    const activeProject = JSON.parse(project)
    const { data } = await saveResultToLocalProject(activeProject, {
      module_name: 'Facies',
      prediction_name: predictionName,
      extension: 'json',
      result_payload: resultPayload,
    })
    useStore.getState().setEnterpriseProject(data.project)
  } catch {
    // Result snapshot failure should not block the module workflow.
  }
}

export default function FaciesClassificationPage() {
  const [busy, setBusy] = useState(false)
  const [meta, setMeta] = useState<any>(() => faciesState.meta)
  const [depthCol, setDepthCol] = useState(() => faciesState.depthCol)
  const [features, setFeatures] = useState<string[]>(() => faciesState.features)
  const [algorithm, setAlgorithm] = useState(() => faciesState.algorithm)
  const [targetPresent, setTargetPresent] = useState(() => faciesState.targetPresent)
  const [faciesCol, setFaciesCol] = useState(() => faciesState.faciesCol)
  const [clusters, setClusters] = useState(() => faciesState.clusters)
  const [result, setResult] = useState<any>(() => faciesState.result)

  useEffect(() => {
    Object.assign(faciesState, { meta, depthCol, features, algorithm, targetPresent, faciesCol, clusters, result })
  }, [meta, depthCol, features, algorithm, targetPresent, faciesCol, clusters, result])

  async function upload(file?: File) {
    if (!file) return
    setBusy(true)
    setResult(null)
    try {
      await uploadFileToActiveProject(file)
      const { data } = await petrophysicsApi.uploadToolboxLog(file)
      setMeta(data)
      setDepthCol(data.depth_guess)
      setFeatures((data.numeric_columns || []).filter((c: string) => c !== data.depth_guess).slice(0, 5))
      toast.success('Well log loaded')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to load file')
    } finally {
      setBusy(false)
    }
  }

  async function loadActiveLas() {
    const active = readPetroSession()
    if (!active?.session_id) return toast.error('Upload LAS in Log Visualization first')
    setBusy(true)
    setResult(null)
    try {
      const { data } = await petrophysicsApi.loadToolboxFromPetroSession(active.session_id)
      setMeta(data)
      setDepthCol(data.depth_guess)
      setFeatures((data.numeric_columns || []).filter((c: string) => c !== data.depth_guess).slice(0, 5))
      toast.success(`Loaded active LAS: ${data.file_name}`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to load active LAS')
    } finally {
      setBusy(false)
    }
  }

  async function run() {
    if (!meta) return toast.error('Upload a well-log file first')
    setBusy(true)
    try {
      const { data } = await petrophysicsApi.runToolboxFacies({
        session_id: meta.session_id,
        depth_col: depthCol,
        features,
        algorithm,
        target_present: targetPresent,
        facies_col: targetPresent ? faciesCol : null,
        n_clusters: clusters,
      })
      setResult(data)
      await saveProjectResultCopy('facies_classification', data)
      toast.success('Facies classification complete')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Classification failed')
    } finally {
      setBusy(false)
    }
  }

  const numeric = (meta?.numeric_columns || []).filter((c: string) => c !== depthCol)
  const browseLas = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.las,.csv,.xlsx,.sgy,.segy'
    input.onchange = event => upload((event.target as HTMLInputElement).files?.[0])
    input.click()
  }

  return (
    <div style={{ padding: 24, minHeight: '100%', overflow: 'auto', background: '#07111F' }}>
      <section style={{ ...card, marginBottom: 18, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
        <div>
          <div style={eyebrow}>AI Facies Classification</div>
          <h1 style={pageTitle}>AI-Powered Facies Classification</h1>
          <p style={pageSubtitle}>Cluster or classify facies from the active LAS session using selected petrophysical curves.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <ProjectFileSelector moduleName="Facies" allowedExtensions={['las', 'csv']} onSelectFile={file => upload(file)} compact />
          <button onClick={browseLas} disabled={busy} style={greenButton}>Upload LAS</button>
        </div>
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 18, alignItems: 'start' }}>
        <section style={card}>
          <div style={eyebrow}>Input Controls</div>
          <h2 style={cardTitle}>Well Log Setup</h2>
          {!meta && <div style={emptyHint}>Select a project file or upload LAS above to start facies classification.</div>}

          {meta && (
            <>
              <div style={metaBox}>{meta.well_name} | {meta.rows.toLocaleString()} rows | {meta.columns.length} columns</div>
              <label style={label}>Depth column</label>
              <select value={depthCol} onChange={e => setDepthCol(e.target.value)} style={control}>
                {meta.columns.map((c: string) => <option key={c}>{c}</option>)}
              </select>

              <label style={label}>Algorithm</label>
              <select value={algorithm} onChange={e => setAlgorithm(e.target.value)} style={control}>
                <option value="kmeans">K-Means (Unsupervised)</option>
                <option value="random_forest">Random Forest (Supervised)</option>
              </select>

              {algorithm === 'kmeans' && (
                <>
                  <label style={label}>K-Means clusters</label>
                  <input type="number" min={2} max={10} value={clusters} onChange={e => setClusters(Number(e.target.value))} style={control} />
                </>
              )}

              <label style={{ ...label, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={targetPresent} onChange={e => setTargetPresent(e.target.checked)} />
                Facies labels included
              </label>

              {targetPresent && (
                <>
                  <label style={label}>Facies label column</label>
                  <select value={faciesCol} onChange={e => setFaciesCol(e.target.value)} style={control}>
                    <option value="">Select label</option>
                    {meta.columns.map((c: string) => <option key={c}>{c}</option>)}
                  </select>
                </>
              )}

              <label style={label}>Predictor curves (3-5)</label>
              <div style={{ display: 'grid', gap: 8, maxHeight: 220, overflow: 'auto' }}>
                {numeric.map((c: string) => (
                  <label key={c} style={{ color: '#CBD5E1', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={features.includes(c)}
                      onChange={e => setFeatures(e.target.checked ? [...features, c].slice(0, 5) : features.filter(x => x !== c))}
                    />{' '}
                    {c}
                  </label>
                ))}
              </div>

              <button onClick={run} disabled={busy || features.length < 3} style={button}>{busy ? 'Running...' : 'Run Classification'}</button>
            </>
          )}
        </section>

        <section style={card}>
          <div style={eyebrow}>Facies Result</div>
          <h2 style={cardTitle}>{result ? 'Classification Output' : 'Waiting for Input'}</h2>
          {result ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#F8FAFC' }}>{result.algorithm}</h2>
                  <p style={{ margin: '6px 0 0', color: '#94A3B8' }}>{result.classified_rows.toLocaleString()} classified rows</p>
                </div>
                <button onClick={() => downloadCsv(result.csv, 'facies_results.csv')} style={secondaryButton}>Download CSV</button>
              </div>
              {result.metrics?.accuracy != null && <pre style={pre}>Accuracy: {(result.metrics.accuracy * 100).toFixed(2)}%{'\n\n'}{result.metrics.classification_report}</pre>}
              <PlotlyFigure figure={result.figure} />
            </>
          ) : (
            <div style={{ minHeight: 520, display: 'grid', placeItems: 'center', color: '#94A3B8' }}>
              Upload a well log, choose depth and predictors, then run classification.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

const card: React.CSSProperties = { padding: 18, background: 'linear-gradient(180deg,rgba(15,23,42,.92),rgba(7,17,31,.96))', borderRadius: 14, border: '1px solid #1E293B', color: '#CBD5E1' }
const eyebrow: React.CSSProperties = { color: '#EF4444', letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }
const pageTitle: React.CSSProperties = { margin: '8px 0 8px', color: '#F8FAFC', fontSize: 38, fontWeight: 500 }
const pageSubtitle: React.CSSProperties = { margin: 0, color: '#9FC5F8', fontSize: 18, lineHeight: 1.45 }
const cardTitle: React.CSSProperties = { margin: '6px 0 14px', color: '#F8FAFC', fontSize: 24, fontWeight: 700 }
const accentTile: React.CSSProperties = { width: 72, height: 72, borderRadius: 18, border: '1px solid rgba(239,68,68,.45)', background: 'linear-gradient(135deg,rgba(239,68,68,.18),rgba(2,8,23,.45))', flex: '0 0 auto' }
const label: React.CSSProperties = { display: 'block', margin: '14px 0 6px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#94A3B8' }
const control: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #26364D', borderRadius: 8, background: '#08111F', color: '#F8FAFC' }
const button: React.CSSProperties = { width: '100%', marginTop: 18, padding: '12px 14px', border: 0, borderRadius: 8, background: '#10B981', color: '#052E16', fontWeight: 900, cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { padding: '10px 12px', border: '1px solid #26364D', borderRadius: 8, background: '#08111F', color: '#F8FAFC', fontWeight: 800, cursor: 'pointer' }
const greenButton: React.CSSProperties = { height: 56, padding: '0 22px', border: 0, borderRadius: 10, background: '#10B981', color: '#06111F', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 15 }
const metaBox: React.CSSProperties = { marginTop: 14, padding: 12, borderRadius: 10, background: '#0E1622', color: '#CBD5E1', fontSize: 13 }
const emptyHint: React.CSSProperties = { marginTop: 14, padding: 14, borderRadius: 12, border: '1px dashed #26364D', background: '#08111F', color: '#94A3B8', lineHeight: 1.5 }
const pre: React.CSSProperties = { maxHeight: 220, overflow: 'auto', padding: 12, borderRadius: 10, background: '#0F172A', color: '#E2E8F0', fontSize: 12 }

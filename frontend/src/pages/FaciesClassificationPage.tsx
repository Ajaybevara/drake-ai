import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { petrophysicsApi } from '../services/api'

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
}

function readPetroSession() {
  try {
    const raw = localStorage.getItem(PETRO_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
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
      toast.success('Facies classification complete')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Classification failed')
    } finally {
      setBusy(false)
    }
  }

  const numeric = (meta?.numeric_columns || []).filter((c: string) => c !== depthCol)

  return (
    <div style={{ padding: 24, minHeight: '100%', overflow: 'auto', background: '#F8FAFC' }}>
      <h1 style={{ margin: '0 0 16px', color: '#0F172A' }}>AI-Powered Facies Classification</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 18, alignItems: 'start' }}>
        <section style={card}>
          <label style={label}>Well-log file</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10, alignItems: 'center' }}>
            <input type="file" accept=".las,.csv,.xlsx,.sgy,.segy" onChange={e => upload(e.target.files?.[0])} />
            <button onClick={loadActiveLas} disabled={busy} style={secondaryButton}>Load LAS</button>
          </div>

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
                  <label key={c} style={{ color: '#334155', fontSize: 13 }}>
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
          {result ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#0F172A' }}>{result.algorithm}</h2>
                  <p style={{ margin: '6px 0 0', color: '#64748B' }}>{result.classified_rows.toLocaleString()} classified rows</p>
                </div>
                <button onClick={() => downloadCsv(result.csv, 'facies_results.csv')} style={secondaryButton}>Download CSV</button>
              </div>
              {result.metrics?.accuracy != null && <pre style={pre}>Accuracy: {(result.metrics.accuracy * 100).toFixed(2)}%{'\n\n'}{result.metrics.classification_report}</pre>}
              <PlotlyFigure figure={result.figure} />
            </>
          ) : (
            <div style={{ minHeight: 520, display: 'grid', placeItems: 'center', color: '#64748B' }}>
              Upload a well log, choose depth and predictors, then run classification.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

const card: React.CSSProperties = { padding: 18, background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', color: '#475569' }
const label: React.CSSProperties = { display: 'block', margin: '14px 0 6px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#334155' }
const control: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: 8, background: '#fff', color: '#0F172A' }
const button: React.CSSProperties = { width: '100%', marginTop: 18, padding: '12px 14px', border: 0, borderRadius: 8, background: '#F59E0B', color: '#111827', fontWeight: 900, cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: 8, background: '#fff', color: '#0F172A', fontWeight: 800, cursor: 'pointer' }
const metaBox: React.CSSProperties = { marginTop: 14, padding: 12, borderRadius: 10, background: '#F1F5F9', color: '#334155', fontSize: 13 }
const pre: React.CSSProperties = { maxHeight: 220, overflow: 'auto', padding: 12, borderRadius: 10, background: '#0F172A', color: '#E2E8F0', fontSize: 12 }

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { petrophysicsApi } from '../services/api'

const PETRO_SESSION_KEY = 'drake_active_petro_las_session'

const formationTopsState: {
  meta: any
  topsMeta: any
  depthCol: string
  curves: string[]
  mode: string
  topsDepthCol: string
  formationCol: string
  sensitivity: number
  minThickness: number
  smoothWindow: number
  manualTopsText: string
  result: any
} = {
  meta: null,
  topsMeta: null,
  depthCol: '',
  curves: [],
  mode: 'unsupervised',
  topsDepthCol: '',
  formationCol: '',
  sensitivity: 18,
  minThickness: 20,
  smoothWindow: 21,
  manualTopsText: '',
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

function parseManualTops(text: string) {
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const parts = line.replace('|', ',').split(',').map(part => part.trim())
    return { formation: parts[0], depth: Number(parts[1]) }
  }).filter(row => row.formation && Number.isFinite(row.depth))
}

export default function FormationTopsPage() {
  const [busy, setBusy] = useState(false)
  const [meta, setMeta] = useState<any>(() => formationTopsState.meta)
  const [topsMeta, setTopsMeta] = useState<any>(() => formationTopsState.topsMeta)
  const [depthCol, setDepthCol] = useState(() => formationTopsState.depthCol)
  const [curves, setCurves] = useState<string[]>(() => formationTopsState.curves)
  const [mode, setMode] = useState(() => formationTopsState.mode)
  const [topsDepthCol, setTopsDepthCol] = useState(() => formationTopsState.topsDepthCol)
  const [formationCol, setFormationCol] = useState(() => formationTopsState.formationCol)
  const [sensitivity, setSensitivity] = useState(() => formationTopsState.sensitivity)
  const [minThickness, setMinThickness] = useState(() => formationTopsState.minThickness)
  const [smoothWindow, setSmoothWindow] = useState(() => formationTopsState.smoothWindow)
  const [manualTopsText, setManualTopsText] = useState(() => formationTopsState.manualTopsText)
  const [result, setResult] = useState<any>(() => formationTopsState.result)

  useEffect(() => {
    Object.assign(formationTopsState, { meta, topsMeta, depthCol, curves, mode, topsDepthCol, formationCol, sensitivity, minThickness, smoothWindow, manualTopsText, result })
  }, [meta, topsMeta, depthCol, curves, mode, topsDepthCol, formationCol, sensitivity, minThickness, smoothWindow, manualTopsText, result])

  async function uploadLog(file?: File) {
    if (!file) return
    setBusy(true)
    setResult(null)
    try {
      const { data } = await petrophysicsApi.uploadToolboxLog(file)
      setMeta(data)
      setDepthCol(data.depth_guess)
      setCurves((data.numeric_columns || []).filter((c: string) => c !== data.depth_guess).slice(0, 4))
      toast.success('Well log loaded')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to load well log')
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
      setCurves((data.numeric_columns || []).filter((c: string) => c !== data.depth_guess).slice(0, 5))
      toast.success(`Loaded active LAS: ${data.file_name}`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to load active LAS')
    } finally {
      setBusy(false)
    }
  }

  async function uploadTops(file?: File) {
    if (!file) return
    setBusy(true)
    try {
      const { data } = await petrophysicsApi.uploadToolboxTops(file)
      setTopsMeta(data)
      setTopsDepthCol(data.numeric_columns?.[0] || data.columns?.[0] || '')
      setFormationCol((data.columns || []).find((c: string) => c !== (data.numeric_columns?.[0] || '')) || '')
      toast.success('Tops file loaded')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to load tops file')
    } finally {
      setBusy(false)
    }
  }

  async function run() {
    if (!meta) return toast.error('Upload a well-log file first')
    setBusy(true)
    try {
      const { data } = await petrophysicsApi.runToolboxFormationTops({
        session_id: meta.session_id,
        depth_col: depthCol,
        curves,
        mode,
        tops_session_id: mode === 'supervised' ? topsMeta?.session_id : null,
        tops_depth_col: mode === 'supervised' ? topsDepthCol : null,
        formation_col: mode === 'supervised' ? formationCol : null,
        sensitivity,
        min_thickness: minThickness,
        smooth_window: smoothWindow,
        manual_tops: parseManualTops(manualTopsText),
      })
      setResult(data)
      toast.success('Formation tops detected')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Formation tops detection failed')
    } finally {
      setBusy(false)
    }
  }

  const numeric = (meta?.numeric_columns || []).filter((c: string) => c !== depthCol)

  return (
    <div style={{ padding: 24, minHeight: '100%', overflow: 'auto', background: '#F8FAFC' }}>
      <h1 style={{ margin: '0 0 16px', color: '#0F172A' }}>Formation Tops Detection</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 18, alignItems: 'start' }}>
        <section style={card}>
          <label style={label}>Well-log file</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10, alignItems: 'center' }}>
            <input type="file" accept=".las,.csv,.xlsx,.sgy,.segy" onChange={e => uploadLog(e.target.files?.[0])} />
            <button onClick={loadActiveLas} disabled={busy} style={secondaryButton}>Load LAS</button>
          </div>

          {meta && (
            <>
              <div style={metaBox}>{meta.well_name} | {meta.rows.toLocaleString()} rows | {meta.columns.length} columns</div>
              <label style={label}>Depth column</label>
              <select value={depthCol} onChange={e => setDepthCol(e.target.value)} style={control}>
                {meta.columns.map((c: string) => <option key={c}>{c}</option>)}
              </select>

              <label style={label}>Detection mode</label>
              <select value={mode} onChange={e => setMode(e.target.value)} style={control}>
                <option value="unsupervised">Unsupervised</option>
                <option value="supervised">Supervised</option>
              </select>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={label}>Sensitivity</label>
                  <input type="number" min={2} max={50} value={sensitivity} onChange={e => setSensitivity(Number(e.target.value))} style={control} />
                </div>
                <div>
                  <label style={label}>Min thickness</label>
                  <input type="number" min={1} value={minThickness} onChange={e => setMinThickness(Number(e.target.value))} style={control} />
                </div>
              </div>
              <label style={label}>Smooth window</label>
              <input type="number" min={5} step={2} value={smoothWindow} onChange={e => setSmoothWindow(Number(e.target.value))} style={control} />

              <label style={label}>Manual tops</label>
              <textarea value={manualTopsText} onChange={e => setManualTopsText(e.target.value)} placeholder="Formation A, 2450&#10;Formation B, 2630" style={{ ...control, minHeight: 74, resize: 'vertical' }} />

              {mode === 'supervised' && (
                <>
                  <label style={label}>Tops CSV/XLSX</label>
                  <input type="file" accept=".csv,.xlsx" onChange={e => uploadTops(e.target.files?.[0])} />
                  {topsMeta && (
                    <>
                      <div style={metaBox}>{topsMeta.file_name} | {topsMeta.rows.toLocaleString()} rows</div>
                      <label style={label}>Depth column in tops file</label>
                      <select value={topsDepthCol} onChange={e => setTopsDepthCol(e.target.value)} style={control}>
                        {topsMeta.columns.map((c: string) => <option key={c}>{c}</option>)}
                      </select>
                      <label style={label}>Formation column</label>
                      <select value={formationCol} onChange={e => setFormationCol(e.target.value)} style={control}>
                        {topsMeta.columns.filter((c: string) => c !== topsDepthCol).map((c: string) => <option key={c}>{c}</option>)}
                      </select>
                    </>
                  )}
                </>
              )}

              <label style={label}>Curves (2-6)</label>
              <div style={{ display: 'grid', gap: 8, maxHeight: 240, overflow: 'auto' }}>
                {numeric.map((c: string) => (
                  <label key={c} style={{ color: '#334155', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={curves.includes(c)}
                      onChange={e => setCurves(e.target.checked ? [...curves, c].slice(0, 6) : curves.filter(x => x !== c))}
                    />{' '}
                    {c}
                  </label>
                ))}
              </div>

              <button onClick={run} disabled={busy || curves.length < 2 || (mode === 'supervised' && !topsMeta)} style={button}>
                {busy ? 'Running...' : 'Detect Tops'}
              </button>
            </>
          )}
        </section>

        <section style={card}>
          {result ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#0F172A' }}>{result.mode} Detection</h2>
                  <p style={{ margin: '6px 0 0', color: '#64748B' }}>{result.tops_count.toLocaleString()} tops detected</p>
                </div>
                <button onClick={() => downloadCsv(result.csv, 'formation_tops.csv')} style={secondaryButton}>Download CSV</button>
              </div>
              {result.mapping && (
                <div style={{ ...metaBox, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {Object.entries(result.mapping).map(([key, value]) => <span key={key}><strong>{key}</strong>: {String(value || 'Missing')}</span>)}
                </div>
              )}
              <div style={{ maxHeight: 260, overflow: 'auto', marginTop: 14 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {result.tops.slice(0, 100).map((row: any, index: number) => (
                      <tr key={index}>
                        {Object.values(row).map((value: any, i) => (
                          <td key={i} style={{ padding: 8, borderBottom: '1px solid #E2E8F0', color: '#334155' }}>{String(value ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PlotlyFigure figure={result.figure} />
            </>
          ) : (
            <div style={{ minHeight: 520, display: 'grid', placeItems: 'center', color: '#64748B' }}>
              Upload a well log, choose depth and curves, then detect formation tops.
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
const button: React.CSSProperties = { width: '100%', marginTop: 18, padding: '12px 14px', border: 0, borderRadius: 8, background: '#10B981', color: '#052E16', fontWeight: 900, cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: 8, background: '#fff', color: '#0F172A', fontWeight: 800, cursor: 'pointer' }
const metaBox: React.CSSProperties = { marginTop: 14, padding: 12, borderRadius: 10, background: '#F1F5F9', color: '#334155', fontSize: 13 }

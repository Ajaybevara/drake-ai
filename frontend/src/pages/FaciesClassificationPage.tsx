import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { petrophysicsApi } from '../services/api'
import { useStore } from '../store'
import ProjectFileSelector from '../components/project/ProjectFileSelector'
import { getCurrentLocalProjectFromFolder, getSavedModuleViewState, saveExportToLocalProject, saveModuleViewStateToLocalProject, saveResultToLocalProject, uploadFilesToLocalProject } from '../utils/localProjectStorage'

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

let faciesStateSaveTimer = 0

function getFaciesProjectState() {
  const project = useStore.getState().enterpriseProject
  return getSavedModuleViewState(project, 'faciesClassification') || (project?.project_id ? {
    meta: null,
    depthCol: '',
    features: [],
    algorithm: 'kmeans',
    targetPresent: false,
    faciesCol: '',
    clusters: 5,
    result: null,
  } : faciesState)
}

function persistFaciesProjectState(state: typeof faciesState) {
  Object.assign(faciesState, state)
  const project = useStore.getState().enterpriseProject
  if (!project?.project_id) return
  if (faciesStateSaveTimer) window.clearTimeout(faciesStateSaveTimer)
  faciesStateSaveTimer = window.setTimeout(() => {
    saveModuleViewStateToLocalProject(project, 'faciesClassification', state)
      .then(updated => useStore.getState().setEnterpriseProject(updated))
      .catch(() => undefined)
  }, 450)
}

function styleToolboxFigure(figure: any, isLight: boolean) {
  if (!figure?.layout) return figure
  const styled = JSON.parse(JSON.stringify(figure))
  const paper = isLight ? '#FFFFFF' : '#06101D'
  const text = isLight ? '#0F172A' : '#F8FAFC'
  const muted = isLight ? '#475569' : '#E2E8F0'
  const grid = isLight ? '#CBD5E1' : 'rgba(226,232,240,.72)'
  styled.layout.paper_bgcolor = paper
  styled.layout.plot_bgcolor = paper
  styled.layout.font = { ...(styled.layout.font || {}), color: text, family: 'Inter, system-ui, sans-serif' }
  styled.layout.margin = { ...(styled.layout.margin || {}), l: 78, r: 28, t: 64, b: 58 }
  styled.layout.annotations = (styled.layout.annotations || []).map((item: any) => ({ ...item, font: { ...(item.font || {}), color: text, size: 15 } }))
  Object.keys(styled.layout).forEach(key => {
    if (key.startsWith('xaxis') || key.startsWith('yaxis')) {
      styled.layout[key] = {
        ...styled.layout[key],
        gridcolor: grid,
        zerolinecolor: grid,
        linecolor: grid,
        tickfont: { color: muted, size: 13 },
        titlefont: { color: text, size: 14 },
        color: text,
      }
    }
  })
  styled.data = (styled.data || []).map((trace: any) => ({
    ...trace,
    line: trace.line ? { ...trace.line, width: Math.max(Number(trace.line.width || 0), 2.4) } : trace.line,
  }))
  return styled
}

function PlotlyFigure({ figure, isLight }: { figure: any; isLight: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ref.current || !figure?.data?.length) return
    let active = true
    import('plotly.js-dist-min').then(({ default: Plotly }) => {
      if (!active || !ref.current) return
      const styled = styleToolboxFigure(figure, isLight)
      Plotly.react(ref.current, styled.data || [], styled.layout || {}, { responsive: true, displaylogo: false })
        .then(() => {
          setError('')
          window.requestAnimationFrame(() => {
            if (ref.current) Plotly.Plots.resize(ref.current)
          })
          window.setTimeout(() => {
            if (ref.current) Plotly.Plots.resize(ref.current)
          }, 250)
        })
        .catch((err: any) => setError(err?.message || 'Unable to render result graph'))
    })
    return () => {
      active = false
      import('plotly.js-dist-min').then(({ default: Plotly }) => {
        if (ref.current) Plotly.purge(ref.current)
      })
    }
  }, [figure, isLight])

  if (!figure?.data?.length) {
    return <div style={{ minHeight: 520, display: 'grid', placeItems: 'center', color: isLight ? '#64748B' : '#94A3B8' }}>Run classification again to generate the result graph.</div>
  }

  return (
    <div style={{ width: '100%', minHeight: 650, borderRadius: 12, overflow: 'hidden', background: isLight ? '#FFFFFF' : '#06101D' }}>
      {error ? <div style={{ padding: 14, color: '#EF4444', fontWeight: 800 }}>{error}</div> : null}
      <div ref={ref} style={{ width: '100%', minHeight: 650 }} />
    </div>
  )
}

function downloadCsv(csv: string, name: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
  const project = useStore.getState().enterpriseProject
  if (project) {
    saveExportToLocalProject(project, {
      module_name: 'Facies',
      export_type: 'csv',
      prediction_name: name.replace(/\.[^.]+$/, ''),
      extension: 'csv',
      content: csv,
    }).then(({ data }) => useStore.getState().setEnterpriseProject(data.project)).catch(() => undefined)
  }
}

async function uploadFileToActiveProject(file: File) {
  try {
    const activeProject = useStore.getState().enterpriseProject
    if (!activeProject) return
    const { data } = await uploadFilesToLocalProject(activeProject, [file])
    useStore.getState().setEnterpriseProject(data.project)
  } catch {
    // Classification should continue even if the project copy cannot be saved.
  }
}

async function saveProjectResultCopy(predictionName: string, resultPayload: any) {
  try {
    const activeProject = useStore.getState().enterpriseProject
    if (!activeProject) return
    const { data } = await saveResultToLocalProject(activeProject, {
      module_name: 'Facies',
      prediction_name: predictionName,
      extension: 'json',
      result_payload: resultPayload,
    })
    useStore.getState().setEnterpriseProject(data.project)
    const projectWithLiveState = await saveModuleViewStateToLocalProject(data.project, 'faciesClassification', {
      ...getFaciesProjectState(),
      result: resultPayload,
      restoredResult: data.result,
      restoredAt: data.result?.created_at || new Date().toISOString(),
    })
    useStore.getState().setEnterpriseProject(projectWithLiveState)
  } catch {
    // Result snapshot failure should not block the module workflow.
  }
}

export default function FaciesClassificationPage() {
  const setEnterpriseProject = useStore(state => state.setEnterpriseProject)
  const [projectHydrated, setProjectHydrated] = useState(false)
  useEffect(() => {
    let active = true
    getCurrentLocalProjectFromFolder()
      .then(project => {
        if (active && project) setEnterpriseProject(project)
      })
      .finally(() => {
        if (active) setProjectHydrated(true)
      })
    return () => { active = false }
  }, [setEnterpriseProject])
  if (!projectHydrated) return null
  return <FaciesClassificationWorkspace />
}

function FaciesClassificationWorkspace() {
  const theme = useStore(state => state.theme)
  const isLight = theme === 'light'
  const saved = getFaciesProjectState()
  const [busy, setBusy] = useState(false)
  const [meta, setMeta] = useState<any>(() => saved.meta)
  const [depthCol, setDepthCol] = useState(() => saved.depthCol)
  const [features, setFeatures] = useState<string[]>(() => saved.features)
  const [algorithm, setAlgorithm] = useState(() => saved.algorithm)
  const [targetPresent, setTargetPresent] = useState(() => saved.targetPresent)
  const [faciesCol, setFaciesCol] = useState(() => saved.faciesCol)
  const [clusters, setClusters] = useState(() => saved.clusters)
  const [result, setResult] = useState<any>(() => saved.result)

  useEffect(() => {
    persistFaciesProjectState({ meta, depthCol, features, algorithm, targetPresent, faciesCol, clusters, result })
  }, [meta, depthCol, features, algorithm, targetPresent, faciesCol, clusters, result])

  async function upload(file?: File) {
    if (!file) return
    setBusy(true)
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
  const palette = pagePalette(isLight)
  const browseLas = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.las,.csv,.xlsx,.sgy,.segy'
    input.onchange = event => upload((event.target as HTMLInputElement).files?.[0])
    input.click()
  }

  return (
    <div style={{ padding: 24, minHeight: '100%', overflow: 'auto', background: palette.page }}>
      <section style={{ ...palette.card, marginBottom: 18, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
        <div>
          <div style={eyebrow}>AI Facies Classification</div>
          <h1 style={{ ...pageTitle, color: palette.text }}>AI-Powered Facies Classification</h1>
          <p style={{ ...pageSubtitle, color: palette.subtitle }}>Cluster or classify facies from the active LAS session using selected petrophysical curves.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <ProjectFileSelector moduleName="Facies" allowedExtensions={['las', 'csv']} onSelectFile={file => upload(file)} compact />
          <button onClick={browseLas} disabled={busy} style={greenButton}>Upload LAS</button>
        </div>
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 18, alignItems: 'start' }}>
        <section style={palette.card}>
          <div style={eyebrow}>Input Controls</div>
          <h2 style={{ ...cardTitle, color: palette.text }}>Well Log Setup</h2>
          {!meta && <div style={palette.emptyHint}>Select a project file or upload LAS above to start facies classification.</div>}

          {meta && (
            <>
              <div style={palette.metaBox}>{meta.well_name} | {meta.rows.toLocaleString()} rows | {meta.columns.length} columns</div>
              <label style={palette.label}>Depth column</label>
              <select value={depthCol} onChange={e => setDepthCol(e.target.value)} style={palette.control}>
                {meta.columns.map((c: string) => <option key={c}>{c}</option>)}
              </select>

              <label style={palette.label}>Algorithm</label>
              <select value={algorithm} onChange={e => setAlgorithm(e.target.value)} style={palette.control}>
                <option value="kmeans">K-Means (Unsupervised)</option>
                <option value="random_forest">Random Forest (Supervised)</option>
              </select>

              {algorithm === 'kmeans' && (
                <>
                  <label style={palette.label}>K-Means clusters</label>
                  <input type="number" min={2} max={10} value={clusters} onChange={e => setClusters(Number(e.target.value))} style={palette.control} />
                </>
              )}

              <label style={{ ...palette.label, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={targetPresent} onChange={e => setTargetPresent(e.target.checked)} />
                Facies labels included
              </label>

              {targetPresent && (
                <>
                  <label style={palette.label}>Facies label column</label>
                  <select value={faciesCol} onChange={e => setFaciesCol(e.target.value)} style={palette.control}>
                    <option value="">Select label</option>
                    {meta.columns.map((c: string) => <option key={c}>{c}</option>)}
                  </select>
                </>
              )}

              <label style={palette.label}>Predictor curves (3-5)</label>
              <div style={{ display: 'grid', gap: 8, maxHeight: 220, overflow: 'auto' }}>
                {numeric.map((c: string) => (
                  <label key={c} style={{ color: palette.text, fontSize: 13 }}>
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

        <section style={palette.card}>
          <div style={eyebrow}>Facies Result</div>
          <h2 style={{ ...cardTitle, color: palette.text }}>{result ? 'Classification Output' : 'Waiting for Input'}</h2>
          {result ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, color: palette.text }}>{result.algorithm}</h2>
                  <p style={{ margin: '6px 0 0', color: palette.muted }}>{result.classified_rows.toLocaleString()} classified rows</p>
                </div>
                <button onClick={() => downloadCsv(result.csv, 'facies_results.csv')} style={secondaryButton}>Download CSV</button>
              </div>
              {result.metrics?.accuracy != null && <pre style={palette.pre}>Accuracy: {(result.metrics.accuracy * 100).toFixed(2)}%{'\n\n'}{result.metrics.classification_report}</pre>}
              <PlotlyFigure figure={result.figure} isLight={isLight} />
            </>
          ) : (
            <div style={{ minHeight: 520, display: 'grid', placeItems: 'center', color: palette.muted }}>
              Upload a well log, choose depth and predictors, then run classification.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

const eyebrow: React.CSSProperties = { color: '#EF4444', letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }
const pageTitle: React.CSSProperties = { margin: '8px 0 8px', color: '#F8FAFC', fontSize: 38, fontWeight: 500 }
const pageSubtitle: React.CSSProperties = { margin: 0, color: '#9FC5F8', fontSize: 18, lineHeight: 1.45 }
const cardTitle: React.CSSProperties = { margin: '6px 0 14px', color: '#F8FAFC', fontSize: 24, fontWeight: 700 }
const label: React.CSSProperties = { display: 'block', margin: '14px 0 6px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#94A3B8' }
const control: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #26364D', borderRadius: 8, background: '#08111F', color: '#F8FAFC' }
const button: React.CSSProperties = { width: '100%', marginTop: 18, padding: '12px 14px', border: 0, borderRadius: 8, background: '#10B981', color: '#052E16', fontWeight: 900, cursor: 'pointer' }
const secondaryButton: React.CSSProperties = { padding: '10px 12px', border: '1px solid #26364D', borderRadius: 8, background: '#08111F', color: '#F8FAFC', fontWeight: 800, cursor: 'pointer' }
const greenButton: React.CSSProperties = { height: 56, padding: '0 22px', border: 0, borderRadius: 10, background: '#10B981', color: '#06111F', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 15 }
const metaBox: React.CSSProperties = { marginTop: 14, padding: 12, borderRadius: 10, background: '#0E1622', color: '#CBD5E1', fontSize: 13 }
const emptyHint: React.CSSProperties = { marginTop: 14, padding: 14, borderRadius: 12, border: '1px dashed #26364D', background: '#08111F', color: '#94A3B8', lineHeight: 1.5 }
const pre: React.CSSProperties = { maxHeight: 220, overflow: 'auto', padding: 12, borderRadius: 10, background: '#0F172A', color: '#E2E8F0', fontSize: 12 }

function pagePalette(isLight: boolean) {
  return {
    page: isLight ? '#F8FAFC' : '#07111F',
    text: isLight ? '#0F172A' : '#F8FAFC',
    muted: isLight ? '#64748B' : '#94A3B8',
    subtitle: isLight ? '#475569' : '#9FC5F8',
    card: {
      padding: 18,
      background: isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.92),rgba(7,17,31,.96))',
      borderRadius: 14,
      border: `1px solid ${isLight ? '#D6DEE9' : '#1E293B'}`,
      color: isLight ? '#0F172A' : '#CBD5E1',
    } as React.CSSProperties,
    label: { ...label, color: isLight ? '#475569' : '#94A3B8' } as React.CSSProperties,
    control: { ...control, border: `1px solid ${isLight ? '#CBD5E1' : '#26364D'}`, background: isLight ? '#FFFFFF' : '#08111F', color: isLight ? '#0F172A' : '#F8FAFC' } as React.CSSProperties,
    metaBox: { ...metaBox, background: isLight ? '#F1F5F9' : '#0E1622', color: isLight ? '#0F172A' : '#CBD5E1' } as React.CSSProperties,
    emptyHint: { ...emptyHint, border: `1px dashed ${isLight ? '#CBD5E1' : '#26364D'}`, background: isLight ? '#F8FAFC' : '#08111F', color: isLight ? '#64748B' : '#94A3B8' } as React.CSSProperties,
    pre: { ...pre, background: isLight ? '#F1F5F9' : '#0F172A', color: isLight ? '#0F172A' : '#E2E8F0' } as React.CSSProperties,
  }
}

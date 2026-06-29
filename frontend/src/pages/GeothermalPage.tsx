import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { geothermalApi } from '../services/api'
import { useStore } from '../store'
import ProjectFileSelector from '../components/project/ProjectFileSelector'
import { getCurrentLocalProjectFromFolder, getSavedModuleViewState, saveExportToLocalProject, saveModuleViewStateToLocalProject, saveResultToLocalProject, uploadFilesToLocalProject } from '../utils/localProjectStorage'

const TRACK_GROUPS: Record<string, string[]> = {
  logs: ['gr_api', 'res_ohmm', 'rhob_gcc', 'nphi_frac', 'dt_usft'],
  geothermal: ['temp_c', 'gradient_c_km', 'heat_flow_mwm2', 'thermal_index'],
  reservoir: ['vsh_frac', 'porosity_frac', 'perm_md', 'rq_score'],
  targets: ['temp_c', 'porosity_frac', 'perm_md', 'rq_score', 'hot_zone_score'],
  all: ['temp_c', 'gradient_c_km', 'gr_api', 'res_ohmm', 'rhob_gcc', 'nphi_frac', 'dt_usft', 'vsh_frac', 'porosity_frac', 'perm_md', 'rq_score', 'hot_zone_score', 'heat_flow_mwm2', 'thermal_index'],
}

const COLORS = ['#EF4444', '#F59E0B', '#16A34A', '#0284C7', '#7C3AED', '#0F766E', '#EA580C', '#C026D3', '#475569']

const geothermalState: {
  sessionId: string
  result: any
  trackMode: string
} = {
  sessionId: '',
  result: null,
  trackMode: 'logs',
}

let geothermalStateSaveTimer = 0

function getGeothermalProjectState() {
  const project = useStore.getState().enterpriseProject
  return getSavedModuleViewState(project, 'geothermal') || (project?.project_id ? {
    sessionId: '',
    result: null,
    trackMode: 'logs',
  } : geothermalState)
}

function persistGeothermalProjectState(state: typeof geothermalState) {
  Object.assign(geothermalState, state)
  const project = useStore.getState().enterpriseProject
  if (!project?.project_id) return
  if (geothermalStateSaveTimer) window.clearTimeout(geothermalStateSaveTimer)
  geothermalStateSaveTimer = window.setTimeout(() => {
    saveModuleViewStateToLocalProject(project, 'geothermal', state)
      .then(updated => useStore.getState().setEnterpriseProject(updated))
      .catch(() => undefined)
  }, 450)
}

function fmt(value: any, digits = 1) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(digits) : '-'
}

function extensionFromUrl(url: string) {
  return url.split('?')[0].split('.').pop()?.toLowerCase() || 'file'
}

async function saveDownloadCopy(url: string, filename: string) {
  try {
    const project = useStore.getState().enterpriseProject
    if (!project) return
    const response = await fetch(url)
    if (!response.ok) return
    const blob = await response.blob()
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = String(reader.result || '').split(',')[1]
      if (!base64) return
      saveExportToLocalProject(project, {
        module_name: 'Geothermal',
        export_type: extensionFromUrl(filename),
        prediction_name: filename.replace(/\.[^.]+$/, ''),
        extension: extensionFromUrl(filename),
        content_base64: base64,
      }).then(({ data }) => useStore.getState().setEnterpriseProject(data.project)).catch(() => undefined)
    }
    reader.readAsDataURL(blob)
  } catch {
    // Browser download still proceeds.
  }
}

function download(url: string, filename = 'geothermal_export.csv') {
  window.open(url, '_blank', 'noopener,noreferrer')
  saveDownloadCopy(url, filename)
}

async function uploadGeothermalFileToProject(file: File, setEnterpriseProject: (project: any) => void) {
  try {
    const activeProject = useStore.getState().enterpriseProject
    if (!activeProject) return
    const { data } = await uploadFilesToLocalProject(activeProject, [file])
    setEnterpriseProject(data.project)
  } catch {
    // Geothermal analysis should continue even if the project copy cannot be saved.
  }
}

async function saveGeothermalResult(resultPayload: any, predictionName: string) {
  try {
    const activeProject = useStore.getState().enterpriseProject
    if (!activeProject || !resultPayload) return
    const { data } = await saveResultToLocalProject(activeProject, {
      module_name: 'Geothermal',
      prediction_name: predictionName,
      extension: 'json',
      result_payload: resultPayload,
    })
    useStore.getState().setEnterpriseProject(data.project)
    const projectWithLiveState = await saveModuleViewStateToLocalProject(data.project, 'geothermal', {
      ...getGeothermalProjectState(),
      result: resultPayload,
      restoredResult: data.result,
      restoredAt: data.result?.created_at || new Date().toISOString(),
    })
    useStore.getState().setEnterpriseProject(projectWithLiveState)
  } catch {
    // Result snapshot failure should not block the module workflow.
  }
}

export default function GeothermalPage() {
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
  return <GeothermalWorkspace />
}

function GeothermalWorkspace() {
  const { theme, setEnterpriseProject } = useStore()
  const isLight = theme === 'light'
  const saved = getGeothermalProjectState()
  const [busy, setBusy] = useState(false)
  const [sessionId, setSessionId] = useState(() => saved.sessionId)
  const [result, setResult] = useState<any>(() => saved.result)
  const [trackMode, setTrackMode] = useState(() => saved.trackMode)

  useEffect(() => {
    persistGeothermalProjectState({ sessionId, result, trackMode })
  }, [sessionId, result, trackMode])

  const palette = {
    page: isLight ? 'radial-gradient(circle at top right,#10B98114,transparent 30%),#F8FAFC' : 'radial-gradient(circle at top right,#10B98116,transparent 30%),linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)',
    panel: isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))',
    border: isLight ? '#E2E8F0' : '#1E293B',
    text: isLight ? '#0F172A' : '#F8FAFC',
    muted: isLight ? '#64748B' : '#94A3B8',
  }

  async function receive(promise: Promise<any>, message: string) {
    setBusy(true)
    try {
      const { data } = await promise
      setSessionId(data.session_id)
      setResult(data.result)
      await saveGeothermalResult(data.result, message.replace(/\s+/g, '_').toLowerCase())
      toast.success(message)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Geothermal analysis failed')
    } finally {
      setBusy(false)
    }
  }

  async function upload(file?: File) {
    if (!file) return
    await uploadGeothermalFileToProject(file, setEnterpriseProject)
    receive(geothermalApi.uploadLas(file), 'Geothermal LAS analysis complete')
  }

  const visibleTracks = useMemo(() => {
    const profile = result?.profile || []
    return (TRACK_GROUPS[trackMode] || TRACK_GROUPS.logs).filter(key => profile.some((row: any) => Number.isFinite(Number(row[key]))))
  }, [result, trackMode])

  return (
    <div style={{ minHeight: '100%', overflow: 'auto', padding: 28, background: palette.page, color: palette.text }}>
      <section style={{ padding: 22, borderRadius: 16, border: `1px solid ${palette.border}`, background: palette.panel, display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#10B981', letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Drake AI Geothermal</div>
          <h1 style={{ margin: '8px 0', fontSize: 32 }}>Geothermal Log-Based Screening</h1>
          <p style={{ margin: 0, color: palette.muted, maxWidth: 820 }}>LAS-based geothermal gradient, hot zone detection, reservoir quality, heat-flow mapping, play ranking, and curve audit.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          <ProjectFileSelector moduleName="Geothermal" allowedExtensions={['las', 'csv', 'xlsx']} onSelectFile={file => upload(file)} compact />
          <label style={primaryButton('#10B981')}>
            {busy ? 'Running...' : 'Upload LAS'}
            <input type="file" accept=".las" hidden onChange={event => upload(event.target.files?.[0])} />
          </label>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14, marginTop: 18 }}>
        <Kpi title="Bottom Hole Temperature" value={result ? `${result.bht_c} degC` : '-'} sub={result ? `${result.td_m} m measured depth` : 'Upload LAS'} isLight={isLight} />
        <Kpi title="Average Gradient" value={result ? `${result.geothermal_gradient_c_km} degC/km` : '-'} sub="Temperature-depth derivative" isLight={isLight} />
        <Kpi title="Best Target" value={result?.summary?.best_target ? fmt(result.summary.best_target.score, 1) : '-'} sub={result?.summary?.best_target ? `${result.summary.best_target.top_m}-${result.summary.best_target.base_m} m` : 'No target yet'} isLight={isLight} />
        <Kpi title="Maximum Heat Flow" value={result ? `${result.summary.max_heat_flow_mwm2} mW/m2` : '-'} sub="Thermal conductivity x gradient" isLight={isLight} />
      </section>

      <section style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(330px,.65fr)', gap: 18, alignItems: 'start' }}>
        <div style={card(palette)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22 }}>Clear Log Visualization</h2>
              <p style={{ margin: '6px 0 0', color: palette.muted, fontSize: 13 }}>{result ? `${result.filename} | ${result.rows.toLocaleString()} rows | ${result.well_name}` : 'Upload LAS to view selected professional log tracks.'}</p>
            </div>
            <select value={trackMode} onChange={event => setTrackMode(event.target.value)} style={field(isLight)}>
              <option value="logs">Basic Logs</option>
              <option value="geothermal">Temperature & Heat</option>
              <option value="reservoir">Reservoir Parameters</option>
              <option value="targets">Target Scores</option>
              <option value="all">All Available</option>
            </select>
          </div>
          {result ? <TrackViewer result={result} tracks={visibleTracks} isLight={isLight} /> : <Empty text="Upload a LAS file or load the included geothermal sample." border={palette.border} muted={palette.muted} />}
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <div style={card(palette)}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Export</h2>
            <p style={{ color: palette.muted, fontSize: 13 }}>Download full results or individual sections.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button disabled={!sessionId} onClick={() => download(geothermalApi.exportCsvUrl(sessionId), 'geothermal_results.csv')} style={secondaryButton(isLight)}>Results CSV</button>
              <button disabled={!sessionId} onClick={() => download(geothermalApi.exportJsonUrl(sessionId), 'geothermal_results.json')} style={secondaryButton(isLight)}>JSON</button>
              <button disabled={!sessionId} onClick={() => download(geothermalApi.exportSectionUrl(sessionId, 'hot_zones', 'csv'), 'geothermal_hot_zones.csv')} style={secondaryButton(isLight)}>Hot Zones CSV</button>
              <button disabled={!sessionId} onClick={() => download(geothermalApi.exportSectionUrl(sessionId, 'play_ranking', 'csv'), 'geothermal_play_ranking.csv')} style={secondaryButton(isLight)}>Ranking CSV</button>
            </div>
          </div>
          <InfoPanel title="Calculated Reservoir Parameters" rows={(result?.curve_display || []).filter((item: any) => ['vsh_frac', 'porosity_frac', 'perm_md', 'rq_score'].includes(item.key))} palette={palette} />
        </div>
      </section>

      {result && (
        <section style={{ display: 'grid', gap: 18, marginTop: 18 }}>
          <DataSection title="Geothermal Gradient" subtitle="Calculated from LAS temperature and measured depth." rows={[
            { label: 'Average gradient', value: `${result.geothermal_gradient_c_km} degC/km` },
            { label: 'Maximum temperature', value: `${result.summary.max_temp_c} degC` },
            { label: 'Temperature source', value: result.summary.temp_note || 'LAS temperature curve' },
          ]} palette={palette} />
          <TableSection title="Hot Zone Detection" subtitle="Intervals where temperature, depth, porosity, permeability, and quality are favorable." rows={result.hot_zones || []} palette={palette} />
          <TableSection title="Reservoir Quality From Logs" subtitle="Ranked intervals using Vsh, porosity, permeability, and resistivity support." rows={result.reservoir_quality_zones || []} palette={palette} />
          <DataSection title="Heat Flow / Thermal Potential" subtitle="Estimated heat flow from calculated gradient and thermal conductivity proxy." rows={[
            { label: 'Average heat flow', value: `${result.summary.avg_heat_flow_mwm2} mW/m2` },
            { label: 'Maximum heat flow', value: `${result.summary.max_heat_flow_mwm2} mW/m2` },
            { label: 'Bottom-hole temperature', value: `${result.bht_c} degC` },
          ]} palette={palette} />
          <div style={card(palette)}>
            <h2 style={{ margin: '0 0 6px', fontSize: 22 }}>Python Heat Flow Map</h2>
            <p style={{ margin: '0 0 14px', color: palette.muted }}>{result.location?.available ? `LAS coordinates: ${fmt(result.location.lat, 5)}, ${fmt(result.location.lon, 5)}` : 'No LAS latitude/longitude found; map shows heat flow versus depth.'}</p>
            <img src={geothermalApi.heatFlowMapUrl(sessionId)} alt="Python generated heat flow map" style={{ width: '100%', maxHeight: 620, objectFit: 'contain', borderRadius: 12, border: `1px solid ${palette.border}`, background: '#07101d' }} />
          </div>
          <TableSection title="Geothermal Play Ranking" subtitle="Targets ranked by heat, reservoir quality, depth, and permeability." rows={result.play_ranking || []} palette={palette} />
          <TableSection title="LAS Curve Audit" subtitle={`${result.well_name} | ${result.filename}`} rows={result.curve_stats || []} palette={palette} />
        </section>
      )}
    </div>
  )
}

function Kpi({ title, value, sub, isLight }: { title: string; value: string; sub: string; isLight: boolean }) {
  return <div style={{ padding: 16, borderRadius: 14, border: `1px solid ${isLight ? '#E2E8F0' : '#1E293B'}`, background: isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))' }}><span style={{ color: isLight ? '#64748B' : '#94A3B8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 900 }}>{title}</span><b style={{ display: 'block', marginTop: 8, color: isLight ? '#0F172A' : '#F8FAFC', fontSize: 24 }}>{value}</b><small style={{ color: isLight ? '#64748B' : '#94A3B8' }}>{sub}</small></div>
}

function TrackViewer({ result, tracks, isLight }: { result: any; tracks: string[]; isLight: boolean }) {
  const rows = result.profile || []
  const minD = Number(rows[0]?.depth_m || 0)
  const maxD = Number(rows[rows.length - 1]?.depth_m || 1)
  const names = Object.fromEntries((result.curve_display || []).map((item: any) => [item.key, item.name]))
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${Math.max(tracks.length, 1)}, minmax(92px,1fr))`, minHeight: 650, border: `1px solid ${isLight ? '#E2E8F0' : '#1E293B'}`, borderRadius: 12, overflow: 'hidden', background: isLight ? '#FFFFFF' : '#07111F' }}>
      <div style={{ padding: 10, borderRight: `1px solid ${isLight ? '#E2E8F0' : '#1E293B'}`, color: isLight ? '#334155' : '#CBD5E1', fontSize: 12, fontWeight: 900 }}>Depth</div>
      {tracks.map((track, index) => <Track key={track} rows={rows} minD={minD} maxD={maxD} track={track} name={names[track] || track} color={COLORS[index % COLORS.length]} result={result} isLight={isLight} />)}
    </div>
  )
}

function Track({ rows, minD, maxD, track, name, color, result, isLight }: any) {
  const values = rows.map((row: any) => Number(row[track])).filter(Number.isFinite)
  const lo = values.length ? Math.min(...values) : 0
  const hi = values.length ? Math.max(...values) : 1
  const x = (value: any) => 8 + ((Number(value) - lo) / Math.max(hi - lo, 1e-9)) * 84
  const y = (depth: any) => 34 + ((Number(depth) - minD) / Math.max(maxD - minD, 1e-9)) * 570
  const points = rows.filter((row: any) => Number.isFinite(Number(row[track]))).map((row: any) => `${x(row[track]).toFixed(2)},${y(row.depth_m).toFixed(2)}`).join(' ')
  const zones = [...(result.hot_zones || []).map((z: any) => ({ ...z, color: '#EF444433' })), ...(result.reservoir_quality_zones || []).map((z: any) => ({ ...z, color: '#10B98124' }))]
  return (
    <div title={name} style={{ position: 'relative', minHeight: 650, borderLeft: `1px solid ${isLight ? '#E2E8F0' : '#1E293B'}` }}>
      <div style={{ height: 34, padding: '8px 10px', fontSize: 12, fontWeight: 900, color: isLight ? '#0F172A' : '#F8FAFC', borderBottom: `1px solid ${isLight ? '#E2E8F0' : '#1E293B'}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
      {zones.map((zone: any, index: number) => <div key={index} style={{ position: 'absolute', left: 0, right: 0, top: y(zone.top_m), height: Math.max(4, y(zone.base_m) - y(zone.top_m)), background: zone.color }} />)}
      <svg viewBox="0 0 100 640" preserveAspectRatio="none" style={{ position: 'absolute', inset: '34px 0 0', width: '100%', height: 616 }}>
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

function Empty({ text, border, muted }: { text: string; border: string; muted: string }) {
  return <div style={{ minHeight: 520, display: 'grid', placeItems: 'center', border: `1px dashed ${border}`, borderRadius: 12, color: muted }}>{text}</div>
}

function InfoPanel({ title, rows, palette }: any) {
  return <div style={card(palette)}><h2 style={{ margin: '0 0 12px', fontSize: 20 }}>{title}</h2><div style={{ display: 'grid', gap: 10 }}>{rows.length ? rows.map((row: any) => <div key={row.key} style={{ padding: 12, borderRadius: 10, border: `1px solid ${palette.border}` }}><b>{row.name}</b><div style={{ color: palette.muted, fontSize: 12 }}>{row.source}</div><p style={{ margin: '6px 0 0', color: palette.muted, fontSize: 12 }}>{row.method}</p></div>) : <span style={{ color: palette.muted }}>Waiting for LAS data.</span>}</div></div>
}

function DataSection({ title, subtitle, rows, palette }: any) {
  return <div style={card(palette)}><h2 style={{ margin: 0, fontSize: 22 }}>{title}</h2><p style={{ margin: '6px 0 14px', color: palette.muted }}>{subtitle}</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>{rows.map((row: any) => <div key={row.label} style={{ padding: 14, borderRadius: 12, border: `1px solid ${palette.border}` }}><b style={{ color: palette.text }}>{row.value}</b><div style={{ color: palette.muted, fontSize: 12, marginTop: 4 }}>{row.label}</div></div>)}</div></div>
}

function TableSection({ title, subtitle, rows, palette }: any) {
  const columns = rows?.length ? Object.keys(rows[0]).slice(0, 10) : []
  return <div style={card(palette)}><h2 style={{ margin: 0, fontSize: 22 }}>{title}</h2><p style={{ margin: '6px 0 14px', color: palette.muted }}>{subtitle}</p>{rows?.length ? <div style={{ overflow: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr>{columns.map(col => <th key={col} style={{ textAlign: 'left', padding: 10, borderBottom: `1px solid ${palette.border}`, color: palette.muted, textTransform: 'uppercase', fontSize: 11 }}>{col.replace(/_/g, ' ')}</th>)}</tr></thead><tbody>{rows.map((row: any, index: number) => <tr key={index}>{columns.map(col => <td key={col} style={{ padding: 10, borderBottom: `1px solid ${palette.border}`, color: palette.text }}>{String(row[col] ?? '')}</td>)}</tr>)}</tbody></table></div> : <div style={{ color: palette.muted }}>No interval met the threshold for this uploaded LAS.</div>}</div>
}

function card(palette: any): React.CSSProperties {
  return { padding: 18, borderRadius: 16, border: `1px solid ${palette.border}`, background: palette.panel, boxShadow: '0 10px 24px rgba(0,0,0,.04)' }
}

function field(isLight: boolean): React.CSSProperties {
  return { height: 42, borderRadius: 9, border: `1px solid ${isLight ? '#CBD5E1' : '#1E293B'}`, background: isLight ? '#FFFFFF' : '#08111F', color: isLight ? '#0F172A' : '#F8FAFC', padding: '0 12px', fontSize: 14, fontWeight: 800 }
}

function primaryButton(color: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: 10, border: 'none', background: color, color: '#052E16', padding: '0 22px', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 15 }
}

function secondaryButton(isLight: boolean): React.CSSProperties {
  return { height: 42, borderRadius: 9, border: `1px solid ${isLight ? '#CBD5E1' : '#1E293B'}`, background: isLight ? '#FFFFFF' : '#0B1220', color: isLight ? '#0F172A' : '#F8FAFC', padding: '0 14px', fontWeight: 900, cursor: 'pointer' }
}

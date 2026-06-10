import { useStore } from '../store'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ccusApi, petrophysicsApi, seismicApi } from '../services/api'

interface Props {
  title: string
  subtitle?: string
  accent?: string
  kind?: 'logs' | 'seismic' | 'production' | 'ccus' | 'digitizer' | 'generic'
}

const DEFAULT_SUBTITLE = 'UI-only Drake AI module screen. Backend integrations have been removed from this prototype view.'

export default function UIOnlyModulePage({ title, subtitle = DEFAULT_SUBTITLE, accent = '#DA2626', kind = 'generic' }: Props) {
  const { theme } = useStore()
  const isLight = theme === 'light'
  const isSeismicEnhancer = kind === 'seismic' && title.toLowerCase().includes('frequency enhancer')
  const isCcusScreening = kind === 'ccus' && title.toLowerCase().includes('preliminary screening')
  const isCrossplot = kind === 'logs' && title.toLowerCase().includes('crossplot')
  const isHistogram = kind === 'logs' && title.toLowerCase().includes('histogram')
  const isLogVisualization = kind === 'logs' && title.toLowerCase().includes('log visualization')
  const isParameterPrediction = kind === 'logs' && title.toLowerCase().includes('parameter prediction')
  const isUncertainty = kind === 'logs' && title.toLowerCase().includes('uncertainty')
  const isAutoSplicer = kind === 'logs' && title.toLowerCase().includes('auto splicer')
  const displaySubtitle = isSeismicEnhancer
    ? 'Fetched from the integrated GitHub seismic backend: SEG-Y 3D low-frequency enhancement with inline/crossline/time visualization.'
    : isCcusScreening
      ? 'Integrated CCUS GitHub screening workflow: LAS parsing, curve mapping, CO2 candidate zones, log viewer, and Excel export.'
      : isCrossplot
        ? 'Integrated petrophysics crossplot workflow: LAS parsing, curve selection, interactive X/Y scatter, hover values, statistics, and plot export.'
        : isHistogram
          ? 'Integrated Drake histogram workflow: LAS parsing, curve distribution, KDE overlay, statistics, AI analytics, and image export.'
          : isLogVisualization
            ? 'Integrated AI log visualization: upload one LAS file, parse well details, select curves, and visualize interactive depth tracks.'
            : isParameterPrediction
              ? 'Integrated Drake AI prediction workflow: uses the active LAS session to calculate porosity, saturation, lithology, confidence, and preview rows.'
              : isUncertainty
                ? 'Integrated uncertainty workflow: P10 / P50 / P90 porosity and water saturation envelopes from the active uploaded LAS file.'
                : isAutoSplicer
                  ? 'Integrated AutoSplice workflow: upload multiple LAS files, validate intervals, splice them, preview merged tracks, and download LAS output.'
    : subtitle

  const cards = kind === 'seismic'
    ? ['Frequency bands', 'Spectral preview', 'Enhanced seismic panel', 'Export controls']
    : kind === 'production'
      ? ['Well performance', 'Optimization candidates', 'Operating envelope', 'Recommendation cards']
      : kind === 'ccus'
        ? ['Well log screening', 'Reservoir suitability', 'Risk flags', 'Ranking summary']
        : kind === 'digitizer'
          ? ['Document input', 'OCR extraction', 'SLM/GPT assistant', 'Exported data']
          : ['Curve selector', 'Depth interval', 'AI result preview', 'Export panel']

  const pageStyle: React.CSSProperties = { padding: 28, minHeight: '100%', overflow: 'auto', background: isLight ? `radial-gradient(circle at top right,${accent}12,transparent 30%),#F8FAFC` : `radial-gradient(circle at top right,${accent}12,transparent 30%),linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)`, color: isLight ? '#0F172A' : '#F8FAFC' }
  const heroStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, padding: 24, borderRadius: 18, border: `1px solid ${isLight ? '#E2E8F0' : '#1E293B'}`, background: isLight ? 'linear-gradient(135deg,#FFFFFF,#F1F5F9)' : 'linear-gradient(135deg,rgba(15,23,42,.92),rgba(7,17,31,.82))', boxShadow: isLight ? '0 10px 30px rgba(0,0,0,.04)' : '0 24px 70px rgba(0,0,0,.28)' }
  const eyebrowStyle: React.CSSProperties = { letterSpacing: 4, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }
  const titleStyle: React.CSSProperties = { margin: '8px 0', fontSize: 34, lineHeight: 1.1 }
  const mutedStyle: React.CSSProperties = { margin: 0, color: isLight ? '#64748B' : '#94A3B8', lineHeight: 1.55 }
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginTop: 22 }
  const panelStyle: React.CSSProperties = { padding: 18, borderRadius: 16, border: `1px solid ${isLight ? '#E2E8F0' : '#1E293B'}`, background: isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))', boxShadow: isLight ? '0 4px 12px rgba(0,0,0,.02)' : '0 18px 42px rgba(0,0,0,.22)' }

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <div style={{ ...eyebrowStyle, color: accent }}>Drake AI UI Prototype</div>
          <h1 style={titleStyle}>{title}</h1>
          <p style={mutedStyle}>{displaySubtitle}</p>
        </div>
        <div style={{ width: 58, height: 58, borderRadius: 16, border: `1px solid ${accent}66`, background: `${accent}18`, boxShadow: `0 0 34px ${accent}18` }} />
      </section>

      {isSeismicEnhancer ? (
        <SeismicEnhancerPanel accent={accent} isLight={isLight} />
      ) : isCcusScreening ? (
        <CcusScreeningPanel accent={accent} isLight={isLight} />
      ) : isCrossplot ? (
        <PetrophysicsCrossplotPanel accent={accent} isLight={isLight} />
      ) : isHistogram ? (
        <PetrophysicsHistogramPanel accent={accent} isLight={isLight} />
      ) : isLogVisualization ? (
        <PetrophysicsLogVisualizationPanel accent={accent} isLight={isLight} />
      ) : isParameterPrediction ? (
        <PetrophysicsPredictionPanel accent={accent} isLight={isLight} />
      ) : isUncertainty ? (
        <PetrophysicsUncertaintyPanel accent={accent} isLight={isLight} />
      ) : isAutoSplicer ? (
        <AutoSplicerPanel accent={accent} isLight={isLight} />
      ) : (

        <section style={gridStyle}>
          {cards.map((card, index) => (
            <div key={card} style={panelStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, color: isLight ? '#1E293B' : '#F8FAFC', fontSize: 18 }}>{card}</h3>
                <span style={{ color: accent, fontWeight: 900 }}>{String(index + 1).padStart(2, '0')}</span>
              </div>
              <div style={{ height: 140, marginTop: 16, borderRadius: 12, border: `1px solid ${isLight ? '#E2E8F0' : '#1E293B'}`, background: visualBackground(kind, accent, isLight), overflow: 'hidden' }}>
                <MiniGraph accent={accent} index={index} isLight={isLight} />
              </div>
              <p style={{ margin: '12px 0 0', color: isLight ? '#64748B' : '#94A3B8', fontSize: 13, lineHeight: 1.55 }}>
                Polished UI placeholder ready for your next backend connection.
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

const PETRO_SESSION_KEY = 'drake_active_petro_las_session'
const transientModuleState: Record<string, any> = {}

function savePetroSession(session: any) {
  try {
    localStorage.setItem(PETRO_SESSION_KEY, JSON.stringify(session))
  } catch {
    // Backend holds parsed LAS data; this only remembers the active session id.
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

function isUserUploadedPetroSession(session: any) {
  if (!session?.session_id) return false
  const fileName = String(session.file_name || '').toLowerCase()
  return !session.is_demo && !fileName.includes('demo')
}

function PetrophysicsLogVisualizationPanel({ accent, isLight }: { accent: string; isLight: boolean }) {
  const saved = transientModuleState.logVisualization || {}
  const [session, setSession] = useState<any>(() => saved.session || readPetroSession())
  const [selected, setSelected] = useState<string[]>(() => saved.selected || [])
  const [result, setResult] = useState<any>(() => saved.result || null)
  const [depthRange, setDepthRange] = useState(() => saved.depthRange || { min: '', max: '', unit: 'Feet (ft)' })
  const [busy, setBusy] = useState(false)
  const border = isLight ? '#E2E8F0' : '#1E293B'
  const text = isLight ? '#0F172A' : '#F8FAFC'
  const muted = isLight ? '#64748B' : '#94A3B8'
  const panelBg = isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))'
  const curves: string[] = session?.curve_names || []
  const activeCurves = selected.filter(curve => curves.includes(curve))

  useEffect(() => {
    transientModuleState.logVisualization = { session, selected, result, depthRange }
  }, [session, selected, result, depthRange])

  const hydrate = (data: any) => {
    const defaults = ['GR', 'ILD', 'RT', 'DRHO', 'RHOB', 'NPHI', 'DT'].filter(name => data.curve_names?.includes(name))
    transientModuleState.prediction = {}
    transientModuleState.uncertainty = {}
    setSession(data)
    savePetroSession(data)
    setSelected(defaults.length ? defaults : (data.curve_names || []).slice(0, 5))
    setDepthRange({ min: data.depth_min ? String(Math.round(Number(data.depth_min))) : '', max: data.depth_max ? String(Math.round(Number(data.depth_max))) : '', unit: 'Feet (ft)' })
    setResult(null)
  }
  const loadDemo = async () => {
    setBusy(true)
    try {
      const response = await petrophysicsApi.loadPetroLasDemo()
      hydrate({ ...response.data, is_demo: true })
      toast.success('Demo LAS loaded')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to load LAS')
    } finally {
      setBusy(false)
    }
  }
  const upload = async (file: File) => {
    setBusy(true)
    try {
      const response = await petrophysicsApi.uploadPetroLas(file)
      hydrate({ ...response.data, is_demo: false })
      toast.success(`LAS "${file.name}" loaded across Petrophysics`)
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'LAS upload failed')
    } finally {
      setBusy(false)
    }
  }
  const visualize = async () => {
    if (!session?.session_id) return toast.error('Upload or load a LAS file first')
    if (!activeCurves.length) return toast.error('Select at least one log track')
    setBusy(true)
    try {
      const response = await petrophysicsApi.generatePetroLogViewer({
        session_id: session.session_id,
        curves: activeCurves,
        depth_min: emptyToNull(depthRange.min),
        depth_max: emptyToNull(depthRange.max),
      })
      setResult({ ...response.data, figure: styleLogViewerFigure(response.data.figure), selected_curves: activeCurves })
      toast.success('AI visualization rendered')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Visualization failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section style={{ marginTop: 22, display: 'grid', gap: 18 }}>
      <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
        <h2 style={{ margin: 0, color: text, fontSize: 24 }}>AI Log Visualization</h2>
        <p style={{ margin: '8px 0 0', color: muted, fontSize: 13 }}>Select logs below. Resistivity logs auto-use logarithmic scale.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(310px,430px) minmax(0,1fr)', gap: 18 }}>
        <LasUploadCard accent={accent} isLight={isLight} busy={busy} session={session} onDemo={loadDemo} onUpload={upload} title="Upload LAS File" />
        <InfoCard accent={accent} isLight={isLight} title={session?.well_name || 'No LAS loaded'} label="Well Details" items={[
          ['File', session?.file_name || 'N/A'],
          ['Company', session?.company || 'N/A'],
          ['Field', session?.field || 'N/A'],
          ['Country', session?.country || 'N/A'],
          ['Depth Range', session ? `${Number(session.depth_min).toFixed(1)} - ${Number(session.depth_max).toFixed(1)}` : '--'],
          ['Curves', session?.num_curves || '--'],
          ['Samples', session?.rows?.toLocaleString?.() || '--'],
          ['Shared Session', session?.session_id ? 'Ready' : 'Waiting'],
        ]} />
      </div>
      <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
        <div style={{ display: 'flex', gap: 12, borderBottom: `1px solid ${border}`, margin: '-18px -18px 16px', padding: '0 18px' }}>
          <button style={{ padding: '13px 18px', border: 'none', borderBottom: `2px solid ${accent}`, background: `${accent}18`, color: text, fontWeight: 900 }}>Log Viewer</button>
          <button style={{ padding: '13px 18px', border: 'none', background: 'transparent', color: muted, fontWeight: 800 }}>Log Ranges & Properties</button>
        </div>
        <p style={{ color: muted, margin: '0 0 14px' }}>Displaying {activeCurves.length || 0} track(s) - {session?.rows?.toLocaleString?.() || 0} depth points.</p>
        <div style={{ color: muted, letterSpacing: 1, textTransform: 'uppercase', fontSize: 12, fontWeight: 900, marginBottom: 8 }}>Available Logs</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <button onClick={() => setSelected(['GR', 'ILD', 'DRHO', 'DT'].filter(name => curves.includes(name)))} disabled={!curves.length} style={smallChip(isLight, '#38BDF8', false)}>+ Add Standard</button>
          <button onClick={() => { setSelected([]); setResult(null) }} disabled={!curves.length} style={smallChip(isLight, '#EF4444', false)}>x Clear All</button>
          {['All', 'GR', 'RES', 'DEN', 'NEU', 'SON', 'CAL', 'SP', 'Other'].map(group => <span key={group} style={smallChip(isLight, groupColor(group), false)}>{group}</span>)}
        </div>
        {curves.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{curves.map(curve => {
          const active = selected.includes(curve)
          const color = curveColor(curve)
          return <button key={curve} onClick={() => setSelected(prev => active ? prev.filter(item => item !== curve) : [...prev, curve])} style={{ padding: '9px 13px', borderRadius: 999, border: `1px solid ${active ? color : border}`, background: active ? `${color}20` : 'transparent', color: active ? color : muted, fontWeight: 900, cursor: 'pointer' }}><span style={{ color }}>{active ? '✓ ' : '● '}</span>{curve}</button>
        })}</div> : <div style={{ color: muted }}>Upload LAS to see available logs.</div>}
        <div style={{ color: muted, letterSpacing: 1, textTransform: 'uppercase', fontSize: 12, fontWeight: 900, margin: '18px 0 8px' }}>Active Tracks <span style={{ color: '#38BDF8' }}>{activeCurves.length}</span></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 12, borderRadius: 12, background: isLight ? '#64748B22' : '#64748B55', marginBottom: 16 }}>
          {activeCurves.length ? activeCurves.map(curve => <span key={curve} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 999, border: `1px solid ${curveColor(curve)}77`, color: curveColor(curve), background: `${curveColor(curve)}18`, fontWeight: 900 }}><span>● {curve}</span><small style={{ color: muted }}>{isResistivityCurve(curve) ? 'LOG' : 'LIN'}</small><button onClick={() => setSelected(prev => prev.filter(item => item !== curve))} style={{ border: 'none', background: 'transparent', color: muted, cursor: 'pointer' }}>×</button></span>) : <span style={{ color: muted }}>No active tracks selected.</span>}
        </div>
        <div style={{ color: muted, letterSpacing: 1, textTransform: 'uppercase', fontSize: 12, fontWeight: 900, marginBottom: 8 }}>Depth Range (Y-Axis)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, alignItems: 'end' }}>
          <Control label="Unit"><select style={field(isLight)} value={depthRange.unit} onChange={event => setDepthRange((prev: any) => ({ ...prev, unit: event.target.value }))}><option>Feet (ft)</option><option>Meters (m)</option></select></Control>
          <Control label="Min Depth"><input style={field(isLight)} value={depthRange.min} onChange={event => setDepthRange((prev: any) => ({ ...prev, min: event.target.value }))} /></Control>
          <Control label="Max Depth"><input style={field(isLight)} value={depthRange.max} onChange={event => setDepthRange((prev: any) => ({ ...prev, max: event.target.value }))} /></Control>
          <button onClick={() => setDepthRange({ min: session?.depth_min ? String(Math.round(Number(session.depth_min))) : '', max: session?.depth_max ? String(Math.round(Number(session.depth_max))) : '', unit: 'Feet (ft)' })} style={smallButton(isLight)}>Reset</button>
          <button onClick={visualize} disabled={busy || !session} style={{ ...primaryButton(accent), width: 180 }}>{busy ? 'Rendering...' : 'Plot Tracks'}</button>
        </div>
      </div>
      <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
        {result?.figure ? <PlotlyFigure figure={result.figure} isLight={isLight} showExport exportName={`${session?.well_name || 'well'}_ai_log_visualization`} /> : <EmptyPlot border={border} muted={muted} text="Upload LAS, choose curves, then plot AI visualization." />}
      </div>
      <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
        <h2 style={{ margin: '0 0 14px', color: text, fontSize: 22 }}>AI Assisted Log Interpretation</h2>
        <LogInterpretation curves={curves} selected={activeCurves} muted={muted} text={text} />
      </div>
    </section>
  )
}

function isResistivityCurve(curve: string) {
  return /^(RT|ILD|ILM|LLD|LLS|MSFL|AT|RDEP|RESD|RES)/i.test(curve)
}

function curveColor(curve: string) {
  if (/^(GR|CGR|SGR|GAM)/i.test(curve)) return '#16A34A'
  if (isResistivityCurve(curve)) return '#B7791F'
  if (/^(RHOB|DRHO|DEN|RHO)/i.test(curve)) return '#2563EB'
  if (/^(NPHI|NEU|NPOR)/i.test(curve)) return '#38BDF8'
  if (/^(DT|DTC|DTS|SON|AC)/i.test(curve)) return '#8B5CF6'
  if (/^(CALI|CAL)/i.test(curve)) return '#EF4444'
  if (/^(SP)/i.test(curve)) return '#EC4899'
  return '#93C5FD'
}

function groupColor(group: string) {
  const map: Record<string, string> = { GR: '#22C55E', RES: '#D97706', DEN: '#2563EB', NEU: '#38BDF8', SON: '#8B5CF6', CAL: '#EF4444', SP: '#EC4899', All: '#38BDF8', Other: '#93C5FD' }
  return map[group] || '#93C5FD'
}

function smallChip(isLight: boolean, color: string, active: boolean): React.CSSProperties {
  return { padding: '7px 11px', borderRadius: 999, border: `1px solid ${color}66`, background: active ? `${color}24` : isLight ? '#F8FAFC' : 'transparent', color, fontWeight: 900, fontSize: 12, cursor: 'pointer' }
}

function styleLogViewerFigure(figure: any) {
  if (!figure?.layout) return figure
  const styled = JSON.parse(JSON.stringify(figure))
  styled.layout.paper_bgcolor = 'rgba(0,0,0,0)'
  styled.layout.plot_bgcolor = '#FFFFFF'
  styled.layout.height = 720
  styled.layout.font = { color: '#1E3A5F', family: 'Inter, system-ui, sans-serif' }
  styled.layout.margin = { l: 70, r: 30, t: 70, b: 70 }
  styled.layout.legend = { orientation: 'h', x: 0, y: -0.12, bgcolor: 'rgba(255,255,255,.85)', bordercolor: '#E2E8F0', borderwidth: 1 }
  styled.data = (styled.data || []).map((trace: any) => {
    const name = String(trace.name || '')
    return { ...trace, line: { ...(trace.line || {}), color: curveColor(name), width: 2.2 }, hoverlabel: { bgcolor: '#F59E0B', font: { color: '#0F172A', size: 14 } } }
  })
  Object.keys(styled.layout).forEach(key => {
    if (key.startsWith('xaxis') || key === 'yaxis') {
      styled.layout[key] = {
        ...styled.layout[key],
        gridcolor: '#E5EAF1',
        zerolinecolor: '#CBD5E1',
        linecolor: '#CBD5E1',
        tickfont: { color: '#1E3A5F', size: 11 },
        titlefont: { color: '#1E3A5F', size: 12 },
        color: '#1E3A5F',
      }
    }
  })
  styled.layout.yaxis = { ...styled.layout.yaxis, title: 'Depth (ft)', autorange: 'reversed' }
  return styled
}

function LogInterpretation({ curves, selected, muted, text }: { curves: string[]; selected: string[]; muted: string; text: string }) {
  const has = (pattern: RegExp) => curves.some(curve => pattern.test(curve))
  const notes = [
    has(/^(GR|CGR|SGR|GAM)/i) ? '✅ Gamma Ray logs detected. Suitable for Vsh calculation and shale volume estimation.' : '⚠️ Gamma Ray log missing from uploaded LAS.',
    has(/^(RT|ILD|ILM|LLD|LLS|MSFL|AT|RDEP|RESD|RES)/i) ? '✅ Resistivity logs detected. Suitable for water saturation calculation.' : '⚠️ Resistivity logs missing from uploaded LAS.',
    has(/^(RHOB|DRHO|DEN|RHO)/i) ? '✅ Density logs detected. Suitable for density porosity calculation.' : '⚠️ Density logs missing from uploaded LAS.',
    has(/^(NPHI|NEU|NPOR)/i) ? '✅ Neutron logs detected. Supports porosity and lithology interpretation.' : '⚠️ Neutron logs missing from uploaded LAS.',
    has(/^(DT|DTC|DTS|SON|AC)/i) ? '✅ Sonic/DT logs detected. Suitable for sonic porosity and rock stiffness interpretation.' : '⚠️ Sonic/DT logs missing from uploaded LAS.',
    selected.length ? `📊 Active interpretation tracks: ${selected.join(', ')}.` : 'Select log tracks to enable visual interpretation.',
    '📌 Note: Interpretations require calibration with core data, formation water salinity, pressure data, and pay intervals before reservoir decisions.',
  ]
  return <div style={{ display: 'grid', gap: 8, color: text }}>{notes.map((note, index) => <div key={index} style={{ color: note.includes('⚠️') ? '#F59E0B' : text, fontSize: 14, lineHeight: 1.45 }}>{note}</div>)}</div>
}

function PetrophysicsPredictionPanel({ accent, isLight }: { accent: string; isLight: boolean }) {
  const saved = transientModuleState.prediction || {}
  const [session, setSession] = useState<any>(() => readPetroSession())
  const [result, setResult] = useState<any>(() => saved.result || null)
  const [busy, setBusy] = useState(false)
  const border = isLight ? '#E2E8F0' : '#1E293B'
  const muted = isLight ? '#64748B' : '#94A3B8'
  const panelBg = isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))'
  const hasUserSession = isUserUploadedPetroSession(session)
  useEffect(() => {
    transientModuleState.prediction = { result }
  }, [result])
  const run = async () => {
    if (!hasUserSession) return toast.error('Upload a real LAS file in Log Visualization first')
    setBusy(true)
    try {
      const response = await petrophysicsApi.generatePetroPrediction(session.session_id)
      setResult(response.data)
      toast.success('AI parameter prediction complete')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'AI prediction failed')
    } finally {
      setBusy(false)
    }
  }
  const cards = result?.summary_cards || {}
  return (
    <section style={{ marginTop: 22, display: 'grid', gap: 18 }}>
      <ActionHeader accent={accent} isLight={isLight} label="AI Parameter Prediction" title={hasUserSession ? session?.well_name : 'Upload User LAS First'} subtitle={hasUserSession ? `${session.file_name} - ${session.rows?.toLocaleString?.()} samples` : 'Prediction uses only the user uploaded LAS from Log Visualization. Demo data is not used here.'} actions={<button onClick={run} disabled={busy || !hasUserSession} style={{ ...primaryButton(accent), width: 210 }}>{busy ? 'Calculating...' : 'Calculate Prediction'}</button>} />
      {result ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
        <Metric label="Avg PHI P50" value={cards.avg_phi_p50 ?? '--'} />
        <Metric label="Avg SW P50" value={cards.avg_sw_p50 ?? '--'} />
        <Metric label="Avg PHI Spread" value={cards.avg_phi_spread ?? '--'} />
        <Metric label="Rows Processed" value={cards.rows?.toLocaleString?.() || '--'} />
      </div> : null}
      <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
        {result?.figure ? <PlotlyFigure figure={result.figure} isLight={isLight} showExport exportName={`${session?.well_name || 'well'}_ai_parameter_prediction`} /> : <EmptyPlot border={border} muted={muted} text="Upload a real LAS in Log Visualization, then run prediction." />}
      </div>
      {result?.records?.length ? <ResultTable title="AI Prediction - First 5 Rows" rows={result.records} isLight={isLight} accent={accent} /> : null}
    </section>
  )
}

function PetrophysicsUncertaintyPanel({ accent, isLight }: { accent: string; isLight: boolean }) {
  const saved = transientModuleState.uncertainty || {}
  const [session, setSession] = useState<any>(() => readPetroSession())
  const [result, setResult] = useState<any>(() => saved.result || null)
  const [busy, setBusy] = useState(false)
  const [params, setParams] = useState(() => saved.params || { phi_unc: 0.03, phi_pct: 0.1, sw_unc: 0.05, sw_pct: 0.1 })
  const border = isLight ? '#E2E8F0' : '#1E293B'
  const muted = isLight ? '#64748B' : '#94A3B8'
  const panelBg = isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))'
  const hasUserSession = isUserUploadedPetroSession(session)
  useEffect(() => {
    transientModuleState.uncertainty = { result, params }
  }, [result, params])
  const run = async () => {
    if (!hasUserSession) return toast.error('Upload a real LAS file in Log Visualization first')
    setBusy(true)
    try {
      const response = await petrophysicsApi.generatePetroUncertainty({ session_id: session.session_id, ...params })
      setResult(response.data)
      toast.success('Uncertainty calculated')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Uncertainty calculation failed')
    } finally {
      setBusy(false)
    }
  }
  const cards = result?.summary_cards || {}
  return (
    <section style={{ marginTop: 22, display: 'grid', gap: 18 }}>
      <ActionHeader accent={accent} isLight={isLight} label="AI Uncertainty" title={hasUserSession ? session?.well_name : 'Upload User LAS First'} subtitle={hasUserSession ? 'P10 / P50 / P90 envelopes are computed from uploaded LAS-derived prediction curves.' : 'Uncertainty uses only the user uploaded LAS from Log Visualization. Demo data is not used here.'} actions={<button onClick={run} disabled={busy || !hasUserSession} style={{ ...primaryButton(accent), width: 220 }}>{busy ? 'Calculating...' : 'Calculate Uncertainty'}</button>} />
      <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <Control label="Porosity Fixed +/-"><input style={field(isLight)} type="number" step="0.01" value={params.phi_unc} onChange={e => setParams((prev: any) => ({ ...prev, phi_unc: Number(e.target.value) }))} /></Control>
        <Control label="Porosity Pct"><input style={field(isLight)} type="number" step="0.01" value={params.phi_pct} onChange={e => setParams((prev: any) => ({ ...prev, phi_pct: Number(e.target.value) }))} /></Control>
        <Control label="Sw Fixed +/-"><input style={field(isLight)} type="number" step="0.01" value={params.sw_unc} onChange={e => setParams((prev: any) => ({ ...prev, sw_unc: Number(e.target.value) }))} /></Control>
        <Control label="Sw Pct"><input style={field(isLight)} type="number" step="0.01" value={params.sw_pct} onChange={e => setParams((prev: any) => ({ ...prev, sw_pct: Number(e.target.value) }))} /></Control>
      </div>
      {result ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
        <Metric label="Avg PHI P50" value={cards.avg_phi_p50 ?? '--'} />
        <Metric label="Avg PHI Spread" value={cards.avg_phi_spread ?? '--'} />
        <Metric label="Avg SW P50" value={cards.avg_sw_p50 ?? '--'} />
        <Metric label="Avg SW Spread" value={cards.avg_sw_spread ?? '--'} />
      </div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(420px,1fr))', gap: 18 }}>
        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>{result?.porosity_figure ? <PlotlyFigure figure={result.porosity_figure} isLight={isLight} showExport exportName="porosity_uncertainty" /> : <EmptyPlot border={border} muted={muted} text="Upload a real LAS in Log Visualization, then run uncertainty." />}</div>
        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>{result?.saturation_figure ? <PlotlyFigure figure={result.saturation_figure} isLight={isLight} showExport exportName="saturation_uncertainty" /> : <EmptyPlot border={border} muted={muted} text="Upload a real LAS in Log Visualization, then run uncertainty." />}</div>
      </div>
      {result?.records?.length ? <ResultTable title="Uncertainty - First 5 Rows" rows={result.records} isLight={isLight} accent={accent} /> : null}
    </section>
  )
}

function AutoSplicerPanel({ accent, isLight }: { accent: string; isLight: boolean }) {
  const saved = transientModuleState.autoSplicer || {}
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState<any>(() => saved.result || null)
  const [busy, setBusy] = useState(false)
  const border = isLight ? '#E2E8F0' : '#1E293B'
  const text = isLight ? '#0F172A' : '#F8FAFC'
  const muted = isLight ? '#64748B' : '#94A3B8'
  const panelBg = isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))'
  useEffect(() => {
    transientModuleState.autoSplicer = { result }
  }, [result])
  const run = async () => {
    if (files.length < 2) return toast.error('Select at least two LAS files')
    setBusy(true)
    try {
      const response = await petrophysicsApi.runAutoSplice(files)
      setResult(response.data)
      toast.success('AutoSplice completed')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'AutoSplice failed')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section style={{ marginTop: 22, display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(310px,430px) minmax(0,1fr)', gap: 18 }}>
        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
          <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Step 01</div>
          <h2 style={{ margin: '6px 0 14px', color: text, fontSize: 24 }}>Upload Multiple LAS Files</h2>
          <div onDrop={event => { event.preventDefault(); setFiles(Array.from(event.dataTransfer.files).filter(file => file.name.toLowerCase().endsWith('.las'))) }} onDragOver={event => event.preventDefault()} style={{ border: `2px dashed ${isLight ? '#CBD5E1' : '#334155'}`, borderRadius: 14, padding: 22, background: isLight ? '#F1F5F9' : '#08111F' }}>
            <div style={{ color: text, fontWeight: 900 }}>Drop LAS files here</div>
            <div style={{ color: muted, marginTop: 8 }}>AutoSplice validates, sorts, merges intervals, and outputs one final LAS.</div>
            <button style={{ ...smallButton(isLight), marginTop: 16 }} onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '.las'
              input.multiple = true
              input.onchange = event => setFiles(Array.from((event.target as HTMLInputElement).files || []))
              input.click()
            }}>Browse LAS Files</button>
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            {files.map(file => <div key={`${file.name}-${file.size}`} style={{ padding: 10, borderRadius: 10, border: `1px solid ${border}`, color: text, display: 'flex', justifyContent: 'space-between' }}><span>{file.name}</span><span style={{ color: muted }}>{(file.size / 1024 / 1024).toFixed(2)} MB</span></div>)}
          </div>
          <button onClick={run} disabled={busy || files.length < 2} style={{ ...primaryButton(accent), marginTop: 16, width: '100%' }}>{busy ? 'Splicing...' : 'Run AutoSplice'}</button>
        </div>
        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
          <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Validation Summary</div>
          <h2 style={{ margin: '6px 0 14px', color: text, fontSize: 24 }}>{result ? 'Validated LAS Files' : 'Waiting for AutoSplice'}</h2>
          {result?.file_summary?.length ? <SimpleTable rows={result.file_summary} columns={['file_name', 'valid', 'depth_min', 'depth_max', 'curve_count', 'rows']} isLight={isLight} /> : <div style={{ color: muted }}>Upload files and run AutoSplice to validate intervals.</div>}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
        <Metric label="Output Curves" value={result?.output?.curve_count ?? '--'} />
        <Metric label="Output Rows" value={result?.output?.rows?.toLocaleString?.() || '--'} />
        <Metric label="Depth From" value={result?.output?.depth_min ?? '--'} />
        <Metric label="Depth To" value={result?.output?.depth_max ?? '--'} />
      </div>
      <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, color: text, fontSize: 22 }}>AutoSplice Output</h2>
            <p style={{ margin: '8px 0 0', color: muted }}>
              {result?.download_url ? 'Merged LAS is ready. Download the final AutoSpliced output file.' : 'Run AutoSplice to generate the downloadable merged LAS file.'}
            </p>
          </div>
          {result?.download_url ? <a href={petrophysicsApi.autospliceDownloadUrl(result.download_url)} style={{ ...primaryButton(accent), textDecoration: 'none', width: 180, textAlign: 'center' }}>Download LAS</a> : null}
        </div>
      </div>
    </section>
  )
}

function LasUploadCard({ accent, isLight, busy, session, onDemo, onUpload, title }: { accent: string; isLight: boolean; busy: boolean; session: any; onDemo: () => void; onUpload: (file: File) => void; title: string }) {
  const border = isLight ? '#E2E8F0' : '#1E293B'
  const text = isLight ? '#0F172A' : '#F8FAFC'
  const muted = isLight ? '#64748B' : '#94A3B8'
  return (
    <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        <div><div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Petrophysics Input</div><h2 style={{ margin: '6px 0 0', color: text, fontSize: 24 }}>{title}</h2></div>
        <button onClick={onDemo} disabled={busy} style={smallButton(isLight)}>{busy ? 'Loading...' : 'Load Demo'}</button>
      </div>
      <div onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) onUpload(file) }} onDragOver={event => event.preventDefault()} style={{ border: `2px dashed ${isLight ? '#CBD5E1' : '#334155'}`, borderRadius: 14, padding: 22, background: isLight ? '#F1F5F9' : '#08111F' }}>
        <div style={{ color: text, fontWeight: 900 }}>Drop LAS here or browse</div>
        <div style={{ color: muted, marginTop: 8 }}>This LAS becomes active for Visualization, Prediction, and Uncertainty.</div>
        <button style={{ ...smallButton(isLight), marginTop: 16 }} onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = '.las'
          input.onchange = event => {
            const file = (event.target as HTMLInputElement).files?.[0]
            if (file) onUpload(file)
          }
          input.click()
        }}>Browse LAS</button>
        <div style={{ color: session ? '#10B981' : muted, marginTop: 14, fontSize: 13 }}>{session ? `Active: ${session.file_name}` : 'No active LAS yet'}</div>
      </div>
    </div>
  )
}

function ActionHeader({ accent, isLight, label, title, subtitle, actions }: { accent: string; isLight: boolean; label: string; title: string; subtitle: string; actions: React.ReactNode }) {
  return <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${isLight ? '#E2E8F0' : '#1E293B'}`, background: isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}><div><div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>{label}</div><h2 style={{ margin: '6px 0', color: isLight ? '#0F172A' : '#F8FAFC', fontSize: 26 }}>{title}</h2><p style={{ margin: 0, color: isLight ? '#64748B' : '#94A3B8' }}>{subtitle}</p></div><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div></div>
}

function InfoCard({ accent, isLight, label, title, items }: { accent: string; isLight: boolean; label: string; title: string; items: any[] }) {
  return <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${isLight ? '#E2E8F0' : '#1E293B'}`, background: isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))' }}><div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>{label}</div><h2 style={{ margin: '6px 0 14px', color: isLight ? '#0F172A' : '#F8FAFC', fontSize: 24 }}>{title}</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 10 }}>{items.map(([itemLabel, value]) => <Metric key={itemLabel} label={itemLabel} value={value} />)}</div></div>
}

function EmptyPlot({ border, muted, text }: { border: string; muted: string; text: string }) {
  return <div style={{ minHeight: 460, display: 'grid', placeItems: 'center', color: muted, border: `1px dashed ${border}`, borderRadius: 14 }}>{text}</div>
}

function SimpleTable({ rows, columns, isLight }: { rows: any[]; columns: string[]; isLight: boolean }) {
  return <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', color: isLight ? '#0F172A' : '#F8FAFC' }}><thead><tr>{columns.map(column => <th key={column} style={tableHead(isLight)}>{column.replace(/_/g, ' ')}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map(column => <td key={column} style={tableCell(isLight)}>{String(row[column] ?? '--')}</td>)}</tr>)}</tbody></table></div>
}

function ResultTable({ title, rows, isLight, accent }: { title: string; rows: any[]; isLight: boolean; accent: string }) {
  const columns = rows.length ? Object.keys(rows[0]).slice(0, 9) : []
  return <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${isLight ? '#E2E8F0' : '#1E293B'}`, background: isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))' }}><div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>{title}</div><SimpleTable rows={rows} columns={columns} isLight={isLight} /></div>
}

function primaryButton(accent: string): React.CSSProperties {
  return { padding: '13px 16px', borderRadius: 12, border: 'none', background: accent, color: '#fff', fontWeight: 900, cursor: 'pointer', boxShadow: `0 12px 34px ${accent}33` }
}

function tableHead(isLight: boolean): React.CSSProperties {
  return { textAlign: 'left', padding: '11px 10px', borderBottom: `1px solid ${isLight ? '#E2E8F0' : '#1E293B'}`, color: isLight ? '#475569' : '#94A3B8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }
}

function tableCell(isLight: boolean): React.CSSProperties {
  return { padding: '11px 10px', borderBottom: `1px solid ${isLight ? '#E2E8F0' : '#1E293B'}`, color: isLight ? '#0F172A' : '#E2E8F0', fontSize: 13 }
}

function PetrophysicsCrossplotPanel({ accent, isLight }: { accent: string; isLight: boolean }) {
  const [session, setSession] = useState<any>(null)
  const [config, setConfig] = useState({
    x_curve: '',
    y_curve: '',
    color_by: 'Depth',
    x_scale: 'Linear',
    y_scale: 'Linear',
    point_size: 6,
    opacity: 0.82,
  })
  const [plotData, setPlotData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const panelBg = isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))'
  const border = isLight ? '#E2E8F0' : '#1E293B'
  const text = isLight ? '#0F172A' : '#F8FAFC'
  const muted = isLight ? '#64748B' : '#94A3B8'
  const curves: string[] = session?.curve_names || []

  const hydrateSession = (data: any) => {
    const names = data.curve_names || []
    const defaultX = names.includes('NPHI') ? 'NPHI' : names.includes('GR') ? 'GR' : names[1] || names[0] || ''
    const defaultY = names.includes('RHOB') ? 'RHOB' : names.includes('DT') ? 'DT' : names.find((name: string) => name !== defaultX) || ''
    setSession(data)
    setConfig(prev => ({
      ...prev,
      x_curve: defaultX,
      y_curve: defaultY,
      color_by: names.includes('GR') ? 'GR' : 'Depth',
    }))
    setPlotData(null)
  }

  const loadDemo = async () => {
    setUploading(true)
    try {
      const response = await petrophysicsApi.loadCrossplotDemo()
      hydrateSession(response.data)
      toast.success('Petrophysics demo LAS loaded')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to load demo LAS')
    } finally {
      setUploading(false)
    }
  }

  const uploadLas = async (file: File) => {
    setUploading(true)
    try {
      const response = await petrophysicsApi.uploadCrossplotLas(file)
      hydrateSession(response.data)
      toast.success(`LAS "${file.name}" loaded`)
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'LAS upload failed')
    } finally {
      setUploading(false)
    }
  }

  const runCrossplot = async () => {
    if (!session?.session_id) {
      toast.error('Upload or load a LAS file first')
      return
    }
    if (!config.x_curve || !config.y_curve || config.x_curve === config.y_curve) {
      toast.error('Select two different curves')
      return
    }
    setLoading(true)
    try {
      const response = await petrophysicsApi.generateCrossplot({ ...config, session_id: session.session_id })
      const data = response.data
      data.figure = applyCrossplotFigureStyle(data.figure, config, isLight, accent)
      setPlotData(data)
      toast.success(`Crossplot generated: ${data.point_count?.toLocaleString()} points`)
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Crossplot generation failed')
    } finally {
      setLoading(false)
    }
  }

  const updateConfig = (key: string, value: any) => setConfig(prev => ({ ...prev, [key]: value }))

  return (
    <section style={{ marginTop: 22, display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,420px) minmax(0,1fr)', gap: 18 }}>
        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Step 01</div>
              <h2 style={{ margin: '6px 0 0', color: text, fontSize: 24 }}>Upload LAS File</h2>
            </div>
            <button onClick={loadDemo} disabled={uploading} style={smallButton(isLight)}>{uploading ? 'Loading...' : 'Load Demo LAS'}</button>
          </div>
          <div
            onDrop={event => {
              event.preventDefault()
              const file = event.dataTransfer.files[0]
              if (file) uploadLas(file)
            }}
            onDragOver={event => event.preventDefault()}
            style={{ border: `2px dashed ${isLight ? '#CBD5E1' : '#334155'}`, borderRadius: 14, padding: 22, background: isLight ? '#F1F5F9' : '#08111F' }}
          >
            <div style={{ color: text, fontWeight: 900 }}>Drop LAS here or click to browse</div>
            <div style={{ color: muted, marginTop: 8 }}>Supports .las files from the petrophysics crossplot workflow</div>
            <button
              style={{ ...smallButton(isLight), marginTop: 16 }}
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = '.las'
                input.onchange = event => {
                  const file = (event.target as HTMLInputElement).files?.[0]
                  if (file) uploadLas(file)
                }
                input.click()
              }}
            >
              Browse LAS
            </button>
            <div style={{ color: session ? '#10B981' : muted, marginTop: 14, fontSize: 13 }}>
              {session ? `Loaded: ${session.file_name || 'LAS file'}` : 'No LAS loaded yet'}
            </div>
          </div>
        </div>

        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
          <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Well Information</div>
          <h2 style={{ margin: '6px 0 14px', color: text, fontSize: 24 }}>{session?.well_name || 'No LAS loaded'}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 10 }}>
            {[
              ['File', session?.file_name || 'N/A'],
              ['Company', session?.company || 'N/A'],
              ['Field', session?.field || 'N/A'],
              ['Country', session?.country || 'N/A'],
              ['Depth Range', session?.depth_min !== undefined ? `${Number(session.depth_min).toFixed(1)} - ${Number(session.depth_max).toFixed(1)}` : '--'],
              ['Curves', session?.num_curves || '--'],
              ['Rows', session?.rows || '--'],
              ['Active Module', 'Crossplot'],
            ].map(([label, value]) => <Metric key={label} label={label} value={value} />)}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,420px) minmax(0,1fr)', gap: 18 }}>
        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
          <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Step 02</div>
          <h2 style={{ margin: '6px 0 12px', color: text, fontSize: 22 }}>Crossplot Settings</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <Control label="X Axis Curve">
              <select style={field(isLight)} value={config.x_curve} onChange={event => updateConfig('x_curve', event.target.value)} disabled={!session}>
                <option value="">Select curve</option>
                {curves.map(curve => <option key={curve} value={curve}>{curve}</option>)}
              </select>
            </Control>
            <Control label="Y Axis Curve">
              <select style={field(isLight)} value={config.y_curve} onChange={event => updateConfig('y_curve', event.target.value)} disabled={!session}>
                <option value="">Select curve</option>
                {curves.map(curve => <option key={curve} value={curve}>{curve}</option>)}
              </select>
            </Control>
            <Control label="Color By">
              <select style={field(isLight)} value={config.color_by} onChange={event => updateConfig('color_by', event.target.value)} disabled={!session}>
                {['Depth', ...curves].map(curve => <option key={curve} value={curve}>{curve}</option>)}
              </select>
            </Control>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Control label="X Scale">
                <select style={field(isLight)} value={config.x_scale} onChange={event => updateConfig('x_scale', event.target.value)}>
                  {['Linear', 'Logarithmic'].map(scale => <option key={scale}>{scale}</option>)}
                </select>
              </Control>
              <Control label="Y Scale">
                <select style={field(isLight)} value={config.y_scale} onChange={event => updateConfig('y_scale', event.target.value)}>
                  {['Linear', 'Logarithmic'].map(scale => <option key={scale}>{scale}</option>)}
                </select>
              </Control>
            </div>
            <SliderLabel label="Point Size" value={config.point_size} min={2} max={12} step={1} onChange={value => updateConfig('point_size', value)} />
            <SliderLabel label="Opacity" value={config.opacity} min={0.2} max={1} step={0.05} onChange={value => updateConfig('opacity', value)} />
            <button onClick={runCrossplot} disabled={loading || !session} style={{ width: '100%', marginTop: 6, padding: '13px 16px', borderRadius: 12, border: 'none', background: accent, color: '#fff', fontWeight: 900, cursor: 'pointer', boxShadow: `0 12px 34px ${accent}33` }}>
              {loading ? 'Generating Crossplot...' : 'Generate Crossplot'}
            </button>
          </div>
        </div>

        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Step 03</div>
              <h2 style={{ margin: '6px 0 0', color: text, fontSize: 22 }}>Interactive Crossplot</h2>
            </div>
          </div>
          {plotData?.figure ? (
            <PlotlyFigure
              figure={plotData.figure}
              isLight={isLight}
              showExport
              exportName={`crossplot_${plotData.x_curve}_vs_${plotData.y_curve}`}
            />
          ) : (
            <div style={{ minHeight: 650, display: 'grid', placeItems: 'center', color: muted, border: `1px dashed ${border}`, borderRadius: 14 }}>
              Upload LAS, choose curves, then generate the crossplot.
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,360px)', gap: 18 }}>
        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
          <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Statistics</div>
          <h2 style={{ margin: '6px 0 12px', color: text, fontSize: 22 }}>{plotData ? `${plotData.point_count?.toLocaleString()} Points` : 'No Plot Yet'}</h2>
          {plotData ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <Metric label="Correlation" value={plotData.statistics?.correlation?.toFixed?.(4) ?? 'N/A'} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
                <CurveStats title="X Axis" stats={plotData.statistics?.x} />
                <CurveStats title="Y Axis" stats={plotData.statistics?.y} />
              </div>
            </div>
          ) : <div style={{ color: muted }}>Statistics appear after generating a crossplot.</div>}
        </div>
      </div>
    </section>
  )
}

function PetrophysicsHistogramPanel({ accent, isLight }: { accent: string; isLight: boolean }) {
  const [metadata, setMetadata] = useState<any>(null)
  const [settings, setSettings] = useState({
    selectedCurve: '',
    scaleType: 'Auto',
    customMin: '',
    customMax: '',
    depthFrom: '',
    depthTo: '',
    bins: 30,
    colorTheme: 'Auto by Curve',
    opacity: 0.75,
    kdeEnabled: true,
    showMean: true,
    showMedian: true,
    showPercentiles: true,
  })
  const [result, setResult] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)

  const panelBg = isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))'
  const border = isLight ? '#E2E8F0' : '#1E293B'
  const text = isLight ? '#0F172A' : '#F8FAFC'
  const muted = isLight ? '#64748B' : '#94A3B8'

  const hydrateMetadata = (data: any) => {
    setMetadata(data)
    setSettings(prev => ({
      ...prev,
      selectedCurve: data.curves?.[0]?.name || '',
      depthFrom: '',
      depthTo: '',
    }))
    setResult(null)
  }

  const loadDemo = async () => {
    setUploading(true)
    try {
      const response = await petrophysicsApi.loadHistogramDemo()
      hydrateMetadata(response.data)
      toast.success('Histogram demo LAS loaded')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to load histogram demo')
    } finally {
      setUploading(false)
    }
  }

  const uploadLas = async (file: File) => {
    setUploading(true)
    try {
      const response = await petrophysicsApi.uploadHistogramLas(file)
      hydrateMetadata(response.data)
      toast.success(`LAS "${file.name}" loaded`)
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'LAS upload failed')
    } finally {
      setUploading(false)
    }
  }

  const generate = async () => {
    if (!metadata?.file_id || !settings.selectedCurve) {
      toast.error('Upload LAS and select a curve first')
      return
    }
    setLoading(true)
    try {
      const response = await petrophysicsApi.generateHistogram({
        file_id: metadata.file_id,
        curve_name: settings.selectedCurve,
        scale_type: settings.scaleType,
        custom_min: emptyToNull(settings.customMin),
        custom_max: emptyToNull(settings.customMax),
        depth_from: emptyToNull(settings.depthFrom),
        depth_to: emptyToNull(settings.depthTo),
        bins: settings.bins,
        opacity: settings.opacity,
        kde_enabled: settings.kdeEnabled,
        show_mean: settings.showMean,
        show_median: settings.showMedian,
        show_percentiles: settings.showPercentiles,
      })
      setResult(response.data)
      toast.success('Histogram generated')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Histogram generation failed')
    } finally {
      setLoading(false)
    }
  }

  const update = (key: string, value: any) => setSettings(prev => ({ ...prev, [key]: value }))
  const figure = result ? buildHistogramFigure(result, settings, metadata, isLight) : null

  return (
    <section style={{ marginTop: 22, display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,420px) minmax(0,1fr)', gap: 18 }}>
        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Step 01</div>
              <h2 style={{ margin: '6px 0 0', color: text, fontSize: 24 }}>Upload LAS File</h2>
            </div>
            <button onClick={loadDemo} disabled={uploading} style={smallButton(isLight)}>{uploading ? 'Loading...' : 'Load Demo LAS'}</button>
          </div>
          <div
            onDrop={event => {
              event.preventDefault()
              const file = event.dataTransfer.files[0]
              if (file) uploadLas(file)
            }}
            onDragOver={event => event.preventDefault()}
            style={{ border: `2px dashed ${isLight ? '#CBD5E1' : '#334155'}`, borderRadius: 14, padding: 22, background: isLight ? '#F1F5F9' : '#08111F' }}
          >
            <div style={{ color: text, fontWeight: 900 }}>Drop LAS here or click to browse</div>
            <div style={{ color: muted, marginTop: 8 }}>Supports .las files for histogram analysis</div>
            <button
              style={{ ...smallButton(isLight), marginTop: 16 }}
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = '.las'
                input.onchange = event => {
                  const file = (event.target as HTMLInputElement).files?.[0]
                  if (file) uploadLas(file)
                }
                input.click()
              }}
            >
              Browse LAS
            </button>
            <div style={{ color: metadata ? '#10B981' : muted, marginTop: 14, fontSize: 13 }}>
              {metadata ? `Loaded: ${metadata.file_name || 'LAS file'}` : 'No LAS loaded yet'}
            </div>
          </div>
        </div>

        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
          <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>LAS Information</div>
          <h2 style={{ margin: '6px 0 14px', color: text, fontSize: 24 }}>{metadata?.well_name || 'No LAS loaded'}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 10 }}>
            {[
              ['File', metadata?.file_name || 'N/A'],
              ['Company', metadata?.company || 'N/A'],
              ['Field', metadata?.field || 'N/A'],
              ['Location', metadata?.location || 'N/A'],
              ['Depth Range', metadata ? `${Number(metadata.depth_start).toFixed(1)} - ${Number(metadata.depth_stop).toFixed(1)} ft` : '--'],
              ['Curves', metadata?.num_curves || '--'],
              ['Samples', metadata?.num_samples?.toLocaleString?.() || '--'],
              ['Null Value', metadata?.null_value ?? '--'],
            ].map(([label, value]) => <Metric key={label} label={label} value={value} />)}
          </div>
          {metadata?.curves?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {metadata.curves.slice(0, 22).map((curve: any) => (
                <span key={curve.name} style={{ border: `1px solid ${border}`, borderRadius: 999, padding: '6px 10px', color: muted, background: isLight ? '#F8FAFC' : '#08111F', fontSize: 12 }}>{curve.name}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,420px) minmax(0,1fr)', gap: 18 }}>
        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
          <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Step 02</div>
          <h2 style={{ margin: '6px 0 12px', color: text, fontSize: 22 }}>Histogram Settings</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <Control label="Log Curve">
              <select style={field(isLight)} value={settings.selectedCurve} onChange={event => update('selectedCurve', event.target.value)} disabled={!metadata}>
                <option value="">Select curve</option>
                {metadata?.curves?.map((curve: any) => <option key={curve.name} value={curve.name}>{curve.name}{curve.unit ? ` (${curve.unit})` : ''}</option>)}
              </select>
            </Control>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Control label="Histogram Scale">
                <select style={field(isLight)} value={settings.scaleType} onChange={event => update('scaleType', event.target.value)}>
                  {['Auto', 'Linear', 'Logarithmic', 'Custom'].map(scale => <option key={scale}>{scale}</option>)}
                </select>
              </Control>
              <Control label="Number of Bins">
                <select style={field(isLight)} value={settings.bins} onChange={event => update('bins', Number(event.target.value))}>
                  {[10, 15, 20, 25, 30, 40, 50, 75, 100].map(bin => <option key={bin} value={bin}>{bin}</option>)}
                </select>
              </Control>
            </div>
            {settings.scaleType === 'Custom' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <NumberControl label="Min Value" value={settings.customMin} onChange={value => update('customMin', value)} isLight={isLight} />
                <NumberControl label="Max Value" value={settings.customMax} onChange={value => update('customMax', value)} isLight={isLight} />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <NumberControl label="Depth From" value={settings.depthFrom} onChange={value => update('depthFrom', value)} isLight={isLight} placeholder={metadata?.depth_start || 'From'} />
              <NumberControl label="Depth To" value={settings.depthTo} onChange={value => update('depthTo', value)} isLight={isLight} placeholder={metadata?.depth_stop || 'To'} />
            </div>
            <Control label="Histogram Color">
              <select style={field(isLight)} value={settings.colorTheme} onChange={event => update('colorTheme', event.target.value)}>
                {['Auto by Curve', 'Blue', 'Green', 'Red', 'Purple', 'Cyan', 'Yellow'].map(color => <option key={color}>{color}</option>)}
              </select>
            </Control>
            <SliderLabel label="Bar Opacity" value={settings.opacity} min={0.1} max={1} step={0.05} onChange={value => update('opacity', value)} />
            <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${border}`, background: isLight ? '#F8FAFC' : '#08111F', display: 'grid', gap: 8 }}>
              {[
                ['KDE Density Overlay', 'kdeEnabled'],
                ['Show Mean Line', 'showMean'],
                ['Show Median Line', 'showMedian'],
                ['Show P10 / P50 / P90 Lines', 'showPercentiles'],
              ].map(([label, key]) => (
                <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: muted, fontSize: 13 }}>
                  {label}
                  <input type="checkbox" checked={Boolean((settings as any)[key])} onChange={event => update(key, event.target.checked)} style={{ accentColor: accent }} />
                </label>
              ))}
            </div>
            <button onClick={generate} disabled={loading || !metadata} style={{ width: '100%', marginTop: 6, padding: '13px 16px', borderRadius: 12, border: 'none', background: accent, color: '#fff', fontWeight: 900, cursor: 'pointer', boxShadow: `0 12px 34px ${accent}33` }}>
              {loading ? 'Generating Histogram...' : 'Generate Histogram'}
            </button>
          </div>
        </div>

        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg, minWidth: 0 }}>
          <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Step 03</div>
          <h2 style={{ margin: '6px 0 12px', color: text, fontSize: 22 }}>Interactive Histogram</h2>
          {figure ? (
            <PlotlyFigure figure={figure} isLight={isLight} showExport exportName={`${sanitizeFileName(metadata?.well_name || 'Well')}_${sanitizeFileName(result.curve_name)}_Histogram`} />
          ) : (
            <div style={{ minHeight: 540, display: 'grid', placeItems: 'center', color: muted, border: `1px dashed ${border}`, borderRadius: 14 }}>
              Upload LAS, choose a curve, then generate the histogram.
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,1fr) minmax(300px,1fr)', gap: 18 }}>
        <HistogramStatistics result={result} isLight={isLight} accent={accent} />
        <HistogramAnalytics result={result} isLight={isLight} accent={accent} />
      </div>
    </section>
  )
}

function CcusScreeningPanel({ accent, isLight }: { accent: string; isLight: boolean }) {
  const [session, setSession] = useState<any>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [params, setParams] = useState({
    gr_clean: '',
    gr_shale: '',
    matrix_density: 2.65,
    fluid_density: 1.0,
    phie_cutoff: 0.10,
    vsh_cutoff: 0.30,
    perm_cutoff: 15,
    min_thickness: 10,
    depth_top: '',
    depth_base: '',
  })
  const [selectedCurves, setSelectedCurves] = useState(['GR', 'VSH', 'PHIE', 'PERM_MD'])
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const panelBg = isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))'
  const border = isLight ? '#E2E8F0' : '#1E293B'
  const text = isLight ? '#0F172A' : '#F8FAFC'
  const muted = isLight ? '#64748B' : '#94A3B8'

  const hydrateSession = (data: any) => {
    setSession(data)
    setMapping({
      GR: data.mapping?.GR || '',
      RHOB: data.mapping?.RHOB || '',
      NPHI: data.mapping?.NPHI || '',
      RT: data.mapping?.RT || '',
      PHIE: data.mapping?.PHIE || '',
      PERM: data.mapping?.PERM || '',
    })
    setResult(null)
  }

  const loadSample = async () => {
    setUploading(true)
    try {
      const response = await ccusApi.loadSample()
      hydrateSession(response.data)
      toast.success('CCUS demo LAS loaded')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to load CCUS sample')
    } finally {
      setUploading(false)
    }
  }

  const uploadLas = async (file: File) => {
    setUploading(true)
    try {
      const response = await ccusApi.uploadLas(file)
      hydrateSession(response.data)
      toast.success(`LAS "${file.name}" loaded`)
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'LAS upload failed')
    } finally {
      setUploading(false)
    }
  }

  const runScreening = async () => {
    if (!session?.session_id) {
      toast.error('Upload or load a LAS file first')
      return
    }
    setLoading(true)
    try {
      const payload = {
        session_id: session.session_id,
        gr_curve: mapping.GR,
        rhob_curve: mapping.RHOB,
        nphi_curve: mapping.NPHI,
        rt_curve: mapping.RT,
        phie_curve: mapping.PHIE,
        perm_curve: mapping.PERM,
        gr_clean: emptyToNull(params.gr_clean),
        gr_shale: emptyToNull(params.gr_shale),
        matrix_density: params.matrix_density,
        fluid_density: params.fluid_density,
        phie_cutoff: params.phie_cutoff,
        vsh_cutoff: params.vsh_cutoff,
        perm_cutoff: params.perm_cutoff,
        min_thickness: params.min_thickness,
        depth_top: emptyToNull(params.depth_top),
        depth_base: emptyToNull(params.depth_base),
        plot_curves: selectedCurves,
      }
      const response = await ccusApi.calculate(payload)
      setResult(response.data)
      toast.success('CCUS screening completed')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'CCUS screening failed')
    } finally {
      setLoading(false)
    }
  }

  const curves = session?.curves || []
  const meta = session?.meta || {}

  return (
    <section style={{ marginTop: 22, display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,420px) minmax(0,1fr)', gap: 18 }}>
        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Step 01</div>
              <h2 style={{ margin: '6px 0 0', color: text, fontSize: 24 }}>Upload LAS File</h2>
            </div>
            <button onClick={loadSample} disabled={uploading} style={smallButton(isLight)}>{uploading ? 'Loading...' : 'Load Demo LAS'}</button>
          </div>
          <div
            onDrop={event => {
              event.preventDefault()
              const file = event.dataTransfer.files[0]
              if (file) uploadLas(file)
            }}
            onDragOver={event => event.preventDefault()}
            style={{ border: `2px dashed ${isLight ? '#CBD5E1' : '#334155'}`, borderRadius: 14, padding: 22, background: isLight ? '#F1F5F9' : '#08111F' }}
          >
            <div style={{ color: text, fontWeight: 900 }}>Drop LAS here or click to browse</div>
            <div style={{ color: muted, marginTop: 8 }}>Supported: .las well-log files</div>
            <button
              style={{ ...smallButton(isLight), marginTop: 16 }}
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = '.las'
                input.onchange = event => {
                  const file = (event.target as HTMLInputElement).files?.[0]
                  if (file) uploadLas(file)
                }
                input.click()
              }}
            >
              Browse LAS
            </button>
            <div style={{ color: session ? '#10B981' : muted, marginTop: 14, fontSize: 13 }}>
              {session ? `Loaded: ${meta.FILE_NAME || 'LAS file'}` : 'No LAS loaded yet'}
            </div>
          </div>
        </div>

        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
          <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Well Metadata</div>
          <h2 style={{ margin: '6px 0 14px', color: text, fontSize: 24 }}>{meta.WELL || 'No LAS loaded'}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 10 }}>
            {[
              ['Field', meta.FLD || 'N/A'],
              ['Company', meta.COMP || 'N/A'],
              ['Country', meta.CTRY || 'N/A'],
              ['Depth Range', meta.START_DEPTH ? `${meta.START_DEPTH} - ${meta.STOP_DEPTH} m` : '--'],
              ['Curves', meta.CURVE_COUNT || '--'],
              ['Samples', meta.ROWS || '--'],
            ].map(([label, value]) => <Metric key={label} label={label} value={value} />)}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,1fr) minmax(300px,1fr)', gap: 18 }}>
        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
          <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Step 02</div>
          <h2 style={{ margin: '6px 0 12px', color: text, fontSize: 22 }}>Curve Mapping & User Edits</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
            {[
              ['GR', 'Gamma Ray / GR'],
              ['RHOB', 'Density / RHOB'],
              ['NPHI', 'Neutron / NPHI'],
              ['RT', 'Resistivity / RT'],
              ['PHIE', 'Existing PHIE optional'],
              ['PERM', 'Existing PERM optional'],
            ].map(([key, label]) => (
              <Control key={key} label={label}>
                <select style={field(isLight)} value={mapping[key] || ''} onChange={event => setMapping(prev => ({ ...prev, [key]: event.target.value }))}>
                  <option value="">-- Not available / Calculate --</option>
                  {curves.map((curve: string) => <option key={curve} value={curve}>{curve}</option>)}
                </select>
              </Control>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
            {['GR', 'VSH', 'PHIE', 'PERM_MD', 'RT'].map(curve => (
              <label key={curve} style={{ color: text, border: `1px solid ${border}`, borderRadius: 999, padding: '8px 12px', background: selectedCurves.includes(curve) ? `${accent}22` : 'transparent' }}>
                <input type="checkbox" checked={selectedCurves.includes(curve)} onChange={event => setSelectedCurves(prev => event.target.checked ? [...prev, curve] : prev.filter(item => item !== curve))} /> {curve}
              </label>
            ))}
          </div>
        </div>

        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
          <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Step 03</div>
          <h2 style={{ margin: '6px 0 12px', color: text, fontSize: 22 }}>Screening Rules / Cutoffs</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            <NumberControl label="GR Clean" value={params.gr_clean} onChange={value => setParams(prev => ({ ...prev, gr_clean: value }))} isLight={isLight} placeholder="Auto P5" />
            <NumberControl label="GR Shale" value={params.gr_shale} onChange={value => setParams(prev => ({ ...prev, gr_shale: value }))} isLight={isLight} placeholder="Auto P95" />
            <NumberControl label="Matrix Density" value={params.matrix_density} onChange={value => setParams(prev => ({ ...prev, matrix_density: Number(value) }))} isLight={isLight} step="0.01" />
            <NumberControl label="Fluid Density" value={params.fluid_density} onChange={value => setParams(prev => ({ ...prev, fluid_density: Number(value) }))} isLight={isLight} step="0.01" />
            <NumberControl label="PHIE Cutoff" value={params.phie_cutoff} onChange={value => setParams(prev => ({ ...prev, phie_cutoff: Number(value) }))} isLight={isLight} step="0.01" />
            <NumberControl label="Vsh Cutoff" value={params.vsh_cutoff} onChange={value => setParams(prev => ({ ...prev, vsh_cutoff: Number(value) }))} isLight={isLight} step="0.01" />
            <NumberControl label="Perm Cutoff (mD)" value={params.perm_cutoff} onChange={value => setParams(prev => ({ ...prev, perm_cutoff: Number(value) }))} isLight={isLight} />
            <NumberControl label="Min Thickness" value={params.min_thickness} onChange={value => setParams(prev => ({ ...prev, min_thickness: Number(value) }))} isLight={isLight} />
            <NumberControl label="Visual Depth Top" value={params.depth_top} onChange={value => setParams(prev => ({ ...prev, depth_top: value }))} isLight={isLight} placeholder={meta.START_DEPTH || 'Auto start'} />
            <NumberControl label="Visual Depth Base" value={params.depth_base} onChange={value => setParams(prev => ({ ...prev, depth_base: value }))} isLight={isLight} placeholder={meta.STOP_DEPTH || 'Auto stop'} />
          </div>
          <button onClick={runScreening} disabled={loading || !session} style={{ width: '100%', marginTop: 16, padding: '12px 16px', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontWeight: 900, cursor: 'pointer' }}>
            {loading ? 'Running Screening...' : 'Run Screening'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 18 }}>
        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
          <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Step 04</div>
          <h2 style={{ margin: '6px 0 12px', color: text, fontSize: 22 }}>Interactive Multi-Track Log Viewer</h2>
          {result?.log_plot ? <PlotlyFigure figure={result.log_plot} isLight={isLight} /> : <div style={{ minHeight: 360, display: 'grid', placeItems: 'center', color: muted, border: `1px dashed ${border}`, borderRadius: 14 }}>Upload LAS and run screening to visualize logs.</div>}
        </div>
        <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
          <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>CO2 Storage Screening</div>
          <h2 style={{ margin: '6px 0 14px', color: text, fontSize: 20 }}>Zone Quality Guide</h2>
          <Guide color="#10B981" title="CO2 possible zone" text="Candidate top line where selected cutoffs pass." />
          <Guide color="#F59E0B" title="Review boundary" text="Near limits; inspect before interpretation." />
          <Guide color="#EF4444" title="Poor boundary" text="Red top line means PHIE, Vsh, or permeability failed." />
          {result?.summary && (
            <div style={{ marginTop: 16, padding: 14, borderRadius: 12, border: `1px solid ${border}`, color: muted }}>
              <b style={{ color: text }}>PHIE:</b> {result.summary.phie_source}<br />
              <b style={{ color: text }}>Permeability:</b> {result.summary.perm_source}<br /><br />
              <b style={{ color: text }}>Result:</b> {result.summary.zones_found} candidate zone(s), {result.summary.poor_zones_found || 0} poor boundary zone(s).
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 14 }}>
          <div>
            <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Step 05</div>
            <h2 style={{ margin: '6px 0 0', color: text, fontSize: 22 }}>Preliminary CCS Screening Zones</h2>
          </div>
          {session?.session_id && result?.export_url && <a href={ccusApi.exportUrl(session.session_id)} download style={{ ...smallButton(isLight), textDecoration: 'none', color: text }}>Export Excel</a>}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: text, fontSize: 13 }}>
            <thead>
              <tr>{['Zone', 'Top', 'Base', 'Thickness', 'Avg PHIE', 'Avg Vsh', 'Avg Perm mD', 'Avg GR', 'Avg RT', 'Score', 'Status'].map(head => <th key={head} style={{ textAlign: 'left', padding: 10, borderBottom: `1px solid ${border}`, color: muted }}>{head}</th>)}</tr>
            </thead>
            <tbody>
              {result?.zones?.length ? result.zones.map((zone: any) => (
                <tr key={`${zone.zone}-${zone.top_m}`}>
                  {[zone.zone, zone.top_m, zone.base_m, zone.thickness_m, zone.avg_phie, zone.avg_vsh, zone.avg_perm_md, zone.avg_gr_api, zone.avg_rt_ohmm, zone.screening_score, zone.status].map((value, index) => (
                    <td key={index} title={index === 10 ? zone.reason : undefined} style={{ padding: 10, borderBottom: `1px solid ${border}`, color: index === 10 ? statusColor(String(value)) : text }}>{String(value ?? '')}</td>
                  ))}
                </tr>
              )) : <tr><td colSpan={11} style={{ padding: 14, color: muted }}>No results yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function SeismicEnhancerPanel({ accent, isLight }: { accent: string; isLight: boolean }) {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [freqLow, setFreqLow] = useState(0)
  const [freqHigh, setFreqHigh] = useState(20)
  const [view, setView] = useState<'Inline' | 'Crossline'>('Inline')
  const [inlineNo, setInlineNo] = useState(426)
  const [crosslineNo, setCrosslineNo] = useState(950)
  const [dimension, setDimension] = useState('3D')
  const [workflow, setWorkflow] = useState('Low Frequency')
  const [amplitudeRange, setAmplitudeRange] = useState('+/-4k')
  const [colorScale, setColorScale] = useState('RdBu')
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{
    fileName: string;
    storagePath: string;
    size?: number;
  } | null>(null)

  const handleFileUpload = async (file: File) => {
    try {
      const resp = await seismicApi.uploadFile(file);
      setUploadedFileInfo({
        fileName: resp.data.file_name,
        storagePath: resp.data.storage_path,
        size: file.size,
      });
      toast.success(`File "${resp.data.file_name}" uploaded`);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Upload failed');
    }
  };

  const runEnhancement = async () => {
    setLoading(true)
    try {
      const response = await seismicApi.lowFrequencyEnhancement({
        file_name: uploadedFileInfo?.fileName ?? '3D_Seismic.sgy',
        storage_path: uploadedFileInfo?.storagePath,
        freq_low: freqLow,
        freq_high: freqHigh,
        gain: 1.8,
        sample_interval_ms: 2,
        workflow,
        dimension,
        dl_epochs: 15,
        dl_batch: 32,
        view,
        selected_inline: inlineNo,
        selected_crossline: crosslineNo,
        amplitude_range: amplitudeRange,
        color_scale: colorScale,
      })
      setResult(response.data)
      toast.success('Seismic enhancement results fetched from backend')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to fetch seismic enhancement results')
    } finally {
      setLoading(false)
    }
  }

  const panelBg = isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))'
  const border = isLight ? '#E2E8F0' : '#1E293B'
  const text = isLight ? '#0F172A' : '#F8FAFC'
  const muted = isLight ? '#64748B' : '#94A3B8'
  const plot = result?.plot

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,390px) minmax(0,1fr)', gap: 22, marginTop: 22 }}>
      <aside style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
        <h2 style={{ margin: '0 0 14px', color: text, fontSize: 24 }}>Upload SEG-Y (.sgy/.segy)</h2>
        {uploadedFileInfo ? (
          <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 24px', gap: 12, alignItems: 'center', padding: 16, border: `2px dashed ${isLight ? '#CBD5E1' : '#334155'}`, borderRadius: 14, background: isLight ? '#F1F5F9' : '#08111F', color: text }}>
            <div style={{ width: 34, height: 42, borderRadius: 6, border: `2px solid ${isLight ? '#94A3B8' : '#64748B'}` }} />
            <div>
              <strong>{uploadedFileInfo.fileName}</strong>
              <div style={{ color: muted, marginTop: 5, fontSize: 13 }}>{formatBytes(uploadedFileInfo.size)} uploaded and ready</div>
            </div>
            <button aria-label="Remove uploaded SEG-Y" onClick={() => { setUploadedFileInfo(null); setResult(null) }} style={{ border: 0, background: 'transparent', color: muted, cursor: 'pointer', fontSize: 24 }}>x</button>
          </div>
        ) : (
          <div
            style={{
              border: `2px dashed ${isLight ? '#CBD5E1' : '#334155'}`,
              borderRadius: 14,
              padding: 22,
              background: isLight ? '#F1F5F9' : '#08111F',
            }}
            onDrop={e => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFileUpload(file);
            }}
            onDragOver={e => e.preventDefault()}
          >
            <div style={{ color: text, fontWeight: 800 }}>Drag and drop file here</div>
            <div style={{ color: muted, marginTop: 8 }}>Limit 2GB per file · SGY, SEGY</div>
            <button
              style={{
                marginTop: 18,
                padding: '10px 16px',
                borderRadius: 9,
                border: `1px solid ${border}`,
                background: isLight ? '#FFFFFF' : '#0B1220',
                color: text,
                cursor: 'pointer',
              }}
              onClick={async () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.sgy,.segy';
                input.onchange = ev => {
                  const file = (ev.target as HTMLInputElement).files?.[0];
                  if (file) handleFileUpload(file);
                };
                input.click();
              }}
            >
              Browse files
            </button>
          </div>
        )}

        <Control label="Data Dimension"><select style={field(isLight)} value={dimension} onChange={e => setDimension(e.target.value)}><option>3D</option><option>2D</option></select></Control>
        <Control label="Low Frequency (Hz)"><input style={field(isLight)} type="number" value={freqLow} onChange={e => setFreqLow(Number(e.target.value))} /></Control>
        <Control label="High Frequency (Hz)"><input style={field(isLight)} type="number" value={freqHigh} onChange={e => setFreqHigh(Number(e.target.value))} /></Control>
        <Control label="Workflow"><select style={field(isLight)} value={workflow} onChange={e => setWorkflow(e.target.value)}><option>Low Frequency</option><option>High Frequency</option><option>Both</option></select></Control>
        <Control label="Amplitude Range"><select style={field(isLight)} value={amplitudeRange} onChange={e => setAmplitudeRange(e.target.value)}><option>+/-4k</option><option>+/-10k</option><option>+/-20k</option></select></Control>
        <Control label="Color Scale"><select style={field(isLight)} value={colorScale} onChange={e => setColorScale(e.target.value)}><option>RdBu</option><option>RdGy</option><option>gray</option><option>Blues</option><option>Reds</option></select></Control>
        <button onClick={runEnhancement} disabled={loading} style={{ width: '100%', marginTop: 16, padding: '12px 16px', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontWeight: 900, cursor: 'pointer' }}>{loading ? 'Fetching Results...' : 'Run Enhancement'}</button>
      </aside>

      <main style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
        {!plot && (
          <div style={{ padding: '18px 20px', borderRadius: 12, background: isLight ? '#E0F2FE' : 'rgba(37,99,235,.12)', border: `1px solid ${isLight ? '#BAE6FD' : '#1E3A8A'}`, color: isLight ? '#075985' : '#BFDBFE', marginBottom: 20, fontWeight: 800 }}>
            &lt;- Upload a SEG-Y file and press Run Enhancement to begin.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 18 }}>
          <SliderLabel label="Inline #" value={inlineNo} min={200} max={650} onChange={setInlineNo} />
          <SliderLabel label="Crossline #" value={crosslineNo} min={700} max={1200} onChange={setCrosslineNo} />
        </div>
        <div style={{ color: text, marginBottom: 16 }}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>View</div>
          <label style={{ marginRight: 18 }}><input type="radio" checked={view === 'Inline'} onChange={() => setView('Inline')} /> Inline</label>
          <label><input type="radio" checked={view === 'Crossline'} onChange={() => setView('Crossline')} /> Crossline</label>
        </div>
        <h2 style={{ margin: '0 0 16px', color: isLight ? '#1E3A5F' : '#F8FAFC', fontSize: 26 }}>AI Low Frequency Enhancer</h2>
        <h3 style={{ margin: '0 0 10px', color: text, fontSize: 15 }}>{view} {view === 'Inline' ? inlineNo : crosslineNo}</h3>
        {plot ? (
          <>
            <SeismicHeatmap plot={plot} section={plot.section} isLight={isLight} height={440} />
            <h2 style={{ margin: '30px 0 18px', color: isLight ? '#1E3A5F' : '#F8FAFC', fontSize: 25 }}>Seismic Low Frequency Enhancer</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(310px,1fr))', gap: 18 }}>
              <ResultPlotCard title={`Original inline ${inlineNo}`} plot={plot} section={plot.original_section} isLight={isLight} />
              <ResultPlotCard title={`Enhanced inline ${inlineNo}`} plot={plot} section={plot.enhanced_section} isLight={isLight} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(310px,1fr))', gap: 18, marginTop: 20 }}>
              <ResultPlotCard title="Difference (band-limited)" plot={plot} section={plot.difference_section} isLight={isLight} zmin={-400} zmax={400} />
              <SpectrumChart data={plot.spectrum || []} isLight={isLight} />
            </div>
          </>
        ) : (
          <div style={{ minHeight: 320, display: 'grid', placeItems: 'center', color: muted, border: `1px dashed ${border}`, borderRadius: 14 }}>
            Seismic result canvas is waiting for your run.
          </div>
        )}
        {result && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginTop: 18 }}>
            <Metric label="Energy Uplift" value={`${result.metrics.energy_uplift_pct}%`} />
            <Metric label="Similarity" value={result.metrics.structural_similarity} />
            <Metric label="Source" value={result.source} />
            <Metric label="Model Stack" value={result.model_stack} />
            {result.outputs?.download_url && (
              <a href={`http://127.0.0.1:8002${result.outputs.download_url}`} download style={{ padding: 12, borderRadius: 12, border: '1px solid #2563EB', background: 'rgba(37,99,235,.18)', color: '#BFDBFE', fontWeight: 900, textDecoration: 'none', display: 'grid', alignItems: 'center', textAlign: 'center' }}>
                Download Enhanced SEG-Y
              </a>
            )}
          </div>
        )}
      </main>
    </section>
  )
}

function applyCrossplotFigureStyle(figure: any, config: any, isLight: boolean, accent: string) {
  const paper = isLight ? '#FFFFFF' : '#111827'
  const plot = isLight ? '#F8FAFC' : '#111827'
  const grid = isLight ? '#D8E0EC' : '#253044'
  const text = isLight ? '#0F172A' : '#DCE7F7'
  const muted = isLight ? '#64748B' : '#6F86A6'
  const trace = figure?.data?.[0] || {}
  const pointCount = Array.isArray(trace.x) ? trace.x.length : 0
  const colorBy = config.color_by || 'Depth'
  return {
    data: [{
      ...trace,
      marker: {
        ...(trace.marker || {}),
        size: Number(config.point_size || 6) + 5,
        opacity: Number(config.opacity || 0.82),
        colorscale: [
          [0, '#2563EB'],
          [0.14, '#06B6D4'],
          [0.28, '#10B981'],
          [0.42, '#A3E635'],
          [0.56, '#F59E0B'],
          [0.7, '#F97316'],
          [0.84, '#EC4899'],
          [1, '#8B5CF6'],
        ],
        line: { width: 0.35, color: isLight ? 'rgba(15,23,42,.16)' : 'rgba(255,255,255,.08)' },
        colorbar: {
          ...(trace.marker?.colorbar || {}),
          title: { text: colorBy, side: 'top', font: { color: muted, size: 12 } },
          tickfont: { color: muted, size: 11 },
          thickness: 15,
          len: 0.74,
          x: 1.03,
          y: 0.5,
          bgcolor: isLight ? 'rgba(255,255,255,.82)' : 'rgba(17,24,39,.72)',
          bordercolor: isLight ? '#D8E0EC' : '#253044',
          borderwidth: 1,
          outlinewidth: 0,
        },
      },
    }],
    layout: {
      ...(figure?.layout || {}),
      height: 650,
      margin: { l: 78, r: 108, t: 92, b: 72 },
      paper_bgcolor: paper,
      plot_bgcolor: plot,
      font: { color: text, family: 'Inter, system-ui, sans-serif' },
      title: {
        text: [
          `<span style="color:${accent};font-size:28px;">|</span>`,
          `<span style="letter-spacing:2px;"> ${String(config.x_curve || 'X').toUpperCase()} VS ${String(config.y_curve || 'Y').toUpperCase()}</span>`,
          `<span style="float:right;color:${muted};font-size:12px;letter-spacing:2px;">${pointCount.toLocaleString()} DATA POINTS</span>`,
        ].join(''),
        x: 0.02,
        y: 0.97,
        xanchor: 'left',
        yanchor: 'top',
        font: { color: text, size: 19, family: 'Inter, system-ui, sans-serif' },
      },
      xaxis: {
        ...(figure?.layout?.xaxis || {}),
        gridcolor: grid,
        zerolinecolor: grid,
        linecolor: grid,
        tickcolor: grid,
        tickfont: { color: muted, size: 12 },
        title: { text: config.x_curve, font: { color: muted, size: 13 }, standoff: 18 },
        showgrid: true,
        mirror: true,
      },
      yaxis: {
        ...(figure?.layout?.yaxis || {}),
        gridcolor: grid,
        zerolinecolor: grid,
        linecolor: grid,
        tickcolor: grid,
        tickfont: { color: muted, size: 12 },
        title: { text: config.y_curve, font: { color: muted, size: 13 }, standoff: 18 },
        showgrid: true,
        mirror: true,
      },
      hoverlabel: {
        bgcolor: isLight ? '#FFFFFF' : '#121C2F',
        bordercolor: accent,
        font: { color: text },
      },
      annotations: [{
        text: 'Rendered',
        x: 1,
        y: 1.08,
        xref: 'paper',
        yref: 'paper',
        showarrow: false,
        font: { color: '#10B981', size: 12 },
        bgcolor: 'rgba(16,185,129,.14)',
        bordercolor: 'rgba(16,185,129,.28)',
        borderpad: 10,
      }],
    },
  }
}

function CurveStats({ title, stats }: { title: string; stats: any }) {
  if (!stats) return null
  return (
    <div style={{ border: '1px solid #1E293B', borderRadius: 12, padding: 12, background: 'rgba(15,23,42,.5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <strong>{title}</strong>
        <span style={{ color: '#38BDF8', fontWeight: 900 }}>{stats.curve}</span>
      </div>
      {[
        ['Count', stats.count],
        ['Min', stats.min],
        ['Max', stats.max],
        ['Mean', stats.mean],
        ['Std Dev', stats.std],
      ].map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', borderTop: '1px solid rgba(30,41,59,.7)' }}>
          <span style={{ color: '#94A3B8' }}>{label}</span>
          <span>{formatNumber(value)}</span>
        </div>
      ))}
    </div>
  )
}

function formatNumber(value: any) {
  if (value === null || value === undefined || value === '') return 'N/A'
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toFixed(Math.abs(parsed) >= 100 ? 2 : 5) : String(value)
}

function buildHistogramFigure(result: any, settings: any, metadata: any, isLight: boolean) {
  const color = getHistogramCurveColor(settings.selectedCurve || result.curve_name, settings.colorTheme)
  const paper = isLight ? '#FFFFFF' : '#111827'
  const plot = isLight ? '#F8FAFC' : 'rgba(11,18,32,.78)'
  const grid = isLight ? '#D8E0EC' : 'rgba(148,163,184,.13)'
  const text = isLight ? '#0F172A' : '#F1F5F9'
  const muted = isLight ? '#64748B' : '#94A3B8'
  const data: any[] = [{
    type: 'bar',
    x: result.histogram.bin_centers,
    y: result.histogram.counts,
    name: result.curve_name,
    marker: {
      color,
      opacity: settings.opacity,
      line: { color, width: 1 },
    },
    hovertemplate: `<b>${result.curve_name}</b><br>Range: %{x:.4f}<br>Frequency: %{y}<extra></extra>`,
  }]

  if (settings.kdeEnabled && result.kde?.x) {
    data.push({
      type: 'scatter',
      x: result.kde.x,
      y: result.kde.y,
      mode: 'lines',
      name: 'KDE',
      line: { color: isLight ? '#0F172A' : '#F8FAFC', width: 2.4, shape: 'spline' },
      hovertemplate: 'KDE<br>Value: %{x:.4f}<br>Density count: %{y:.2f}<extra></extra>',
    })
  }

  const shapes: any[] = []
  const annotations: any[] = []
  const addLine = (x: number, label: string, lineColor: string, dash = 'solid') => {
    shapes.push({ type: 'line', x0: x, x1: x, y0: 0, y1: 1, yref: 'paper', line: { color: lineColor, width: 1.6, dash } })
    annotations.push({
      x,
      y: 1,
      xref: 'x',
      yref: 'paper',
      text: label,
      showarrow: false,
      yanchor: 'bottom',
      font: { color: lineColor, size: 10 },
      bgcolor: isLight ? 'rgba(255,255,255,.86)' : 'rgba(15,23,42,.86)',
      bordercolor: lineColor,
      borderwidth: 1,
      borderpad: 3,
    })
  }
  if (settings.showMean) addLine(result.statistics.mean, 'Mean', '#3B82F6')
  if (settings.showMedian) addLine(result.statistics.median, 'Med', '#8B5CF6')
  if (settings.showPercentiles) {
    addLine(result.statistics.p10, 'P10', '#F59E0B', 'dash')
    addLine(result.statistics.p50, 'P50', '#06B6D4', 'dash')
    addLine(result.statistics.p90, 'P90', '#EF4444', 'dash')
  }

  return {
    data,
    layout: {
      height: 540,
      title: {
        text: metadata ? `<b>${metadata.well_name}</b> | <b>${Number(metadata.depth_start).toFixed(0)}-${Number(metadata.depth_stop).toFixed(0)} ft</b> | <b>${result.curve_name} Histogram</b>` : `<b>${result.curve_name} Histogram</b>`,
        font: { color: text, size: 15 },
        x: 0.5,
        xanchor: 'center',
      },
      paper_bgcolor: paper,
      plot_bgcolor: plot,
      font: { color: muted, family: 'Inter, system-ui, sans-serif' },
      xaxis: {
        title: { text: `${result.curve_name}${result.unit ? ` (${result.unit})` : ''}`, font: { color: muted, size: 12 } },
        tickfont: { color: muted, size: 11 },
        gridcolor: grid,
        zerolinecolor: grid,
        linecolor: isLight ? '#CBD5E1' : '#1E293B',
        type: settings.scaleType === 'Logarithmic' ? 'log' : 'linear',
      },
      yaxis: {
        title: { text: 'Frequency', font: { color: muted, size: 12 } },
        tickfont: { color: muted, size: 11 },
        gridcolor: grid,
        zerolinecolor: grid,
        linecolor: isLight ? '#CBD5E1' : '#1E293B',
      },
      legend: {
        bgcolor: isLight ? 'rgba(255,255,255,.86)' : 'rgba(15,23,42,.86)',
        bordercolor: isLight ? '#CBD5E1' : '#1E293B',
        borderwidth: 1,
        font: { color: muted, size: 11 },
        x: 0.98,
        xanchor: 'right',
        y: 0.98,
        yanchor: 'top',
      },
      margin: { t: 58, r: 24, b: 64, l: 68 },
      shapes,
      annotations,
      bargap: 0.05,
      hovermode: 'x',
    },
  }
}

function HistogramStatistics({ result, isLight, accent }: { result: any; isLight: boolean; accent: string }) {
  const border = isLight ? '#E2E8F0' : '#1E293B'
  const text = isLight ? '#0F172A' : '#F8FAFC'
  const muted = isLight ? '#64748B' : '#94A3B8'
  const panelBg = isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))'
  const rows = result ? [
    ['Curve', result.curve_name],
    ['Unit', result.unit || 'N/A'],
    ['Count', result.statistics.count?.toLocaleString?.()],
    ['Missing', `${result.statistics.missing_percentage?.toFixed?.(1)}%`],
    ['Min', result.statistics.min],
    ['Max', result.statistics.max],
    ['Mean', result.statistics.mean],
    ['Median', result.statistics.median],
    ['Std Dev', result.statistics.std],
    ['Variance', result.statistics.variance],
    ['P10', result.statistics.p10],
    ['P25', result.statistics.p25],
    ['P50', result.statistics.p50],
    ['P75', result.statistics.p75],
    ['P90', result.statistics.p90],
    ['Skewness', result.statistics.skewness],
    ['Kurtosis', result.statistics.kurtosis],
  ] : []

  return (
    <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
      <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>Statistics</div>
      <h2 style={{ margin: '6px 0 12px', color: text, fontSize: 22 }}>{result ? result.curve_name : 'No Histogram Yet'}</h2>
      {result ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          {rows.map(([label, value]) => <Metric key={label} label={label} value={formatNumber(value)} />)}
        </div>
      ) : <div style={{ color: muted }}>Generate a histogram to view statistics.</div>}
    </div>
  )
}

function HistogramAnalytics({ result, isLight, accent }: { result: any; isLight: boolean; accent: string }) {
  const border = isLight ? '#E2E8F0' : '#1E293B'
  const text = isLight ? '#0F172A' : '#F8FAFC'
  const muted = isLight ? '#64748B' : '#94A3B8'
  const panelBg = isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))'
  const qualityColor = result ? ({ Excellent: '#10B981', Good: '#3B82F6', Moderate: '#F59E0B', Poor: '#EF4444' } as Record<string, string>)[result.analytics.quality_label] || accent : accent

  return (
    <div style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
      <div style={{ color: accent, letterSpacing: 3, textTransform: 'uppercase', fontSize: 11, fontWeight: 900 }}>AI Curve Analytics</div>
      <h2 style={{ margin: '6px 0 12px', color: text, fontSize: 22 }}>{result ? result.analytics.quality_label : 'Waiting for Result'}</h2>
      {result ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 12, border: `1px solid ${qualityColor}55`, background: `${qualityColor}18` }}>
            <div style={{ color: qualityColor, fontSize: 34, fontWeight: 900 }}>{result.analytics.quality_score}</div>
            <div><div style={{ color: text, fontWeight: 900 }}>Curve Quality Score</div><div style={{ color: muted, fontSize: 13 }}>{result.analytics.distribution_type}</div></div>
          </div>
          {[
            ['Data Completeness', result.analytics.completeness, '#10B981'],
            ['Missing Values', result.analytics.missing_percentage, '#F59E0B'],
            ['Outlier Percentage', result.analytics.outlier_percentage, '#8B5CF6'],
            ['AI Confidence', result.analytics.ai_confidence, '#2563EB'],
          ].map(([label, value, color]) => (
            <div key={label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: muted, fontSize: 13, marginBottom: 6 }}>
                <span>{label}</span><b style={{ color: String(color) }}>{Number(value).toFixed(1)}%</b>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: isLight ? '#E2E8F0' : '#1E293B', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, Number(value))}%`, height: '100%', background: String(color), borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      ) : <div style={{ color: muted }}>Generate a histogram to view AI analytics.</div>}
    </div>
  )
}

function getHistogramCurveColor(curveName: string, theme: string): string {
  if (theme !== 'Auto by Curve') {
    const colorMap: Record<string, string> = {
      Blue: '#2563EB',
      Green: '#10B981',
      Red: '#EF4444',
      Purple: '#8B5CF6',
      Cyan: '#06B6D4',
      Yellow: '#F59E0B',
    }
    return colorMap[theme] || '#2563EB'
  }
  const name = curveName.toUpperCase()
  if (name.includes('GR')) return '#10B981'
  if (name.includes('SP')) return '#F59E0B'
  if (name.includes('RT') || name.includes('ILD') || name.includes('LLD') || name.includes('RESIST') || name.includes('LL')) return '#EF4444'
  if (name.includes('RHOB') || name.includes('DENS')) return '#2563EB'
  if (name.includes('NPHI') || name.includes('NEUT')) return '#8B5CF6'
  if (name.includes('DT') || name.includes('SONIC')) return '#06B6D4'
  if (name.includes('CALI')) return '#F97316'
  if (name.includes('PE')) return '#EC4899'
  return '#2563EB'
}

function sanitizeFileName(value: string) {
  return String(value || 'histogram').replace(/[^a-zA-Z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block', marginTop: 16 }}><div style={{ color: '#94A3B8', fontSize: 13, fontWeight: 800, marginBottom: 7 }}>{label}</div>{children}</label>
}

function NumberControl({ label, value, onChange, isLight, placeholder, step = '1' }: { label: string; value: any; onChange: (value: any) => void; isLight: boolean; placeholder?: any; step?: string }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ color: '#94A3B8', fontSize: 13, fontWeight: 800, marginBottom: 7 }}>{label}</div>
      <input style={field(isLight)} type="number" value={value} onChange={event => onChange(event.target.value)} placeholder={String(placeholder ?? '')} step={step} />
    </label>
  )
}

function PlotlyFigure({ figure, isLight, exportName = 'drake_ai_plot', showExport = false }: { figure: any; isLight: boolean; exportName?: string; showExport?: boolean }) {
  const plotRef = useRef<HTMLDivElement | null>(null)
  const [format, setFormat] = useState<'png' | 'jpeg' | 'svg'>('png')

  useEffect(() => {
    if (!plotRef.current || !figure?.data || !figure?.layout) return
    let cancelled = false
    import('plotly.js-dist-min').then(({ default: Plotly }) => {
      if (cancelled || !plotRef.current) return
      Plotly.react(
        plotRef.current,
        figure.data,
        {
          ...figure.layout,
          paper_bgcolor: isLight ? '#FFFFFF' : figure.layout.paper_bgcolor,
          plot_bgcolor: isLight ? '#F8FAFC' : figure.layout.plot_bgcolor,
          font: { ...(figure.layout.font || {}), color: isLight ? '#0F172A' : '#CBD5E1' },
        },
        {
          responsive: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['lasso2d', 'select2d'],
          toImageButtonOptions: {
            format: 'png',
            filename: 'ccus_screening_log_viewer',
            height: 900,
            width: 1300,
            scale: 2,
          },
        },
      )
    })
    return () => {
      cancelled = true
      import('plotly.js-dist-min').then(({ default: Plotly }) => {
        if (plotRef.current) Plotly.purge(plotRef.current)
      })
    }
  }, [figure, isLight])

  const exportImage = async () => {
    if (!plotRef.current) return
    const { default: Plotly } = await import('plotly.js-dist-min')
    Plotly.downloadImage(plotRef.current, {
      format,
      filename: exportName,
      width: 1400,
      height: 850,
      scale: 2,
    })
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div ref={plotRef} style={{ width: '100%', minHeight: 650, borderRadius: 12, overflow: 'hidden' }} />
      {showExport && (
        <div style={{
          position: 'absolute',
          right: 16,
          bottom: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: 10,
          borderRadius: 999,
          border: `1px solid ${isLight ? '#CBD5E1' : '#1E293B'}`,
          background: isLight ? 'rgba(255,255,255,.92)' : 'rgba(15,23,42,.92)',
          boxShadow: isLight ? '0 14px 32px rgba(15,23,42,.12)' : '0 18px 46px rgba(0,0,0,.35)',
          backdropFilter: 'blur(12px)',
          zIndex: 5,
        }}>
          <select
            value={format}
            onChange={event => setFormat(event.target.value as 'png' | 'jpeg' | 'svg')}
            style={{
              minWidth: 108,
              height: 46,
              border: `1px solid ${isLight ? '#CBD5E1' : '#1E293B'}`,
              borderRadius: 10,
              background: isLight ? '#F8FAFC' : '#111827',
              color: isLight ? '#0F172A' : '#F8FAFC',
              padding: '0 14px',
              fontWeight: 900,
              textTransform: 'uppercase',
            }}
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPG</option>
            <option value="svg">SVG</option>
          </select>
          <button
            onClick={exportImage}
            style={{
              height: 46,
              border: 'none',
              borderRadius: 10,
              background: 'transparent',
              color: isLight ? '#0F172A' : '#F8FAFC',
              padding: '0 16px',
              fontWeight: 900,
              letterSpacing: .5,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>⇩</span> EXPORT
          </button>
        </div>
      )}
    </div>
  )
}

function Guide({ color, title, text }: { color: string; title: string; text: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: 10, marginBottom: 12, alignItems: 'start' }}>
      <span style={{ width: 12, height: 12, borderRadius: 999, background: color, boxShadow: `0 0 18px ${color}66`, marginTop: 4 }} />
      <div><b>{title}</b><div style={{ color: '#94A3B8', marginTop: 3, fontSize: 13 }}>{text}</div></div>
    </div>
  )
}

function smallButton(isLight: boolean): React.CSSProperties {
  return {
    border: `1px solid ${isLight ? '#CBD5E1' : '#1E293B'}`,
    borderRadius: 10,
    background: isLight ? '#FFFFFF' : '#0B1220',
    color: isLight ? '#0F172A' : '#F8FAFC',
    padding: '10px 14px',
    fontWeight: 900,
    cursor: 'pointer',
  }
}

function emptyToNull(value: any) {
  return value === '' || value === undefined ? null : value
}

function statusColor(value: string) {
  if (value === 'Excellent' || value === 'Good') return '#10B981'
  if (value === 'Review') return '#F59E0B'
  if (value === 'Poor') return '#EF4444'
  return '#F8FAFC'
}

function SliderLabel({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 4 }}>{label}</div>
      <div style={{ textAlign: 'center', color: '#FF4B4B', fontFamily: 'monospace' }}>{value.toFixed(2)}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        style={{ width: '100%', accentColor: '#FF4B4B' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', fontFamily: 'monospace' }}><span>{min.toFixed(2)}</span><span>{max.toFixed(2)}</span></div>
    </label>
  )
}

function ResultPlotCard({ title, plot, section, isLight, zmin = -4000, zmax = 4000 }: { title: string; plot: any; section: number[][]; isLight: boolean; zmin?: number; zmax?: number }) {
  return (
    <div style={{ borderRadius: 14, border: `1px solid ${isLight ? '#E2E8F0' : '#1E293B'}`, background: isLight ? '#FFFFFF' : 'rgba(5,11,20,.36)', padding: 14 }}>
      <h3 style={{ margin: '0 0 8px', color: isLight ? '#0F172A' : '#F8FAFC', fontSize: 15 }}>{title}</h3>
      <SeismicHeatmap plot={plot} title={title} section={section} isLight={isLight} height={330} zmin={zmin} zmax={zmax} compact />
    </div>
  )
}

function SeismicHeatmap({ plot, title = 'Inline 426', section, isLight, height = 500, zmin = -4000, zmax = 4000, compact = false }: { plot: any; title?: string; section?: number[][]; isLight: boolean; height?: number; zmin?: number; zmax?: number; compact?: boolean }) {
  const plotRef = useRef<HTMLDivElement | null>(null)
  const values: number[][] = section || plot.section || []

  useEffect(() => {
    if (!plotRef.current || !values.length) return
    let cancelled = false
    const x = Array.isArray(plot.x) && plot.x.length ? plot.x : Array.from({ length: values[0]?.length || 0 }, (_, idx) => idx)
    const y = Array.isArray(plot.y) && plot.y.length ? plot.y : Array.from({ length: values.length }, (_, idx) => idx)
    const [autoMin, autoMax] = robustColorRange(values, zmin, zmax)
    const paper = isLight ? '#FFFFFF' : '#050B14'
    const grid = isLight ? '#E2E8F0' : '#1E293B'
    const text = isLight ? '#0F172A' : '#E2E8F0'

    import('plotly.js-dist-min').then(({ default: Plotly }) => {
      if (cancelled || !plotRef.current) return
      Plotly.react(
        plotRef.current,
        [{
          type: 'heatmap',
          z: values,
          x,
          y,
          zmin: autoMin,
          zmax: autoMax,
          colorscale: 'RdBu',
          reversescale: false,
          colorbar: {
            title: { text: 'Amplitude', font: { color: text, size: 12 } },
            tickfont: { color: text },
            thickness: compact ? 12 : 16,
            len: 0.88,
          },
          hovertemplate: [
            '<b>' + title + '</b>',
            'Crossline: %{x:.2f}',
            'Time / Depth: %{y:.2f}',
            'Amplitude: %{z:.3f}',
            '<extra></extra>',
          ].join('<br>'),
        }],
        {
          title: compact ? undefined : { text: `<b>${title}</b>`, font: { color: text, size: 16 } },
          height,
          margin: compact ? { l: 58, r: 38, t: 10, b: 48 } : { l: 66, r: 46, t: 48, b: 58 },
          paper_bgcolor: paper,
          plot_bgcolor: paper,
          font: { color: text, family: 'Inter, system-ui, sans-serif' },
          xaxis: {
            title: { text: plot.x_label || 'Crossline', font: { color: text } },
            gridcolor: grid,
            zerolinecolor: grid,
            tickfont: { color: text },
          },
          yaxis: {
            title: { text: plot.y_label || 'Time / Depth', font: { color: text } },
            autorange: 'reversed',
            gridcolor: grid,
            zerolinecolor: grid,
            tickfont: { color: text },
          },
        },
        {
          responsive: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['lasso2d', 'select2d'],
          toImageButtonOptions: {
            format: 'png',
            filename: title.replace(/\s+/g, '_').toLowerCase(),
            height,
            width: 1100,
            scale: 2,
          },
        },
      )
    })

    return () => {
      cancelled = true
      import('plotly.js-dist-min').then(({ default: Plotly }) => {
        if (plotRef.current) Plotly.purge(plotRef.current)
      })
    }
  }, [values, plot, title, isLight, height, zmin, zmax, compact])

  return <div ref={plotRef} style={{ width: '100%', minHeight: height, borderRadius: 10, overflow: 'hidden' }} />
}

function SpectrumChart({ data, isLight }: { data: any[]; isLight: boolean }) {
  const plotRef = useRef<HTMLDivElement | null>(null)
  const clean = data.filter(item => Number.isFinite(item.frequency) && Number.isFinite(item.original) && Number.isFinite(item.enhanced))

  useEffect(() => {
    if (!plotRef.current || !clean.length) return
    let cancelled = false
    const paper = isLight ? '#FFFFFF' : '#050B14'
    const grid = isLight ? '#E2E8F0' : '#1E293B'
    const text = isLight ? '#0F172A' : '#E2E8F0'
    const x = clean.map(item => item.frequency)
    import('plotly.js-dist-min').then(({ default: Plotly }) => {
      if (cancelled || !plotRef.current) return
      Plotly.react(
        plotRef.current,
        [
          {
            type: 'scatter',
            mode: 'lines',
            name: 'Original',
            x,
            y: clean.map(item => item.original),
            line: { color: '#2563EB', width: 2 },
            hovertemplate: 'Frequency: %{x:.3f} Hz<br>Original amp: %{y:.5f}<extra></extra>',
          },
          {
            type: 'scatter',
            mode: 'lines',
            name: 'Enhanced',
            x,
            y: clean.map(item => item.enhanced),
            line: { color: '#10B981', width: 2 },
            hovertemplate: 'Frequency: %{x:.3f} Hz<br>Enhanced amp: %{y:.5f}<extra></extra>',
          },
        ],
        {
          height: 330,
          margin: { l: 62, r: 24, t: 28, b: 54 },
          paper_bgcolor: paper,
          plot_bgcolor: paper,
          font: { color: text, family: 'Inter, system-ui, sans-serif' },
          legend: { orientation: 'h', x: 0.46, y: 1.16, font: { color: text } },
          xaxis: { title: { text: 'Frequency (Hz)', font: { color: text } }, gridcolor: grid, tickfont: { color: text } },
          yaxis: { title: { text: 'Amplitude (normalized)', font: { color: text } }, gridcolor: grid, tickfont: { color: text } },
        },
        { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] },
      )
    })
    return () => {
      cancelled = true
      import('plotly.js-dist-min').then(({ default: Plotly }) => {
        if (plotRef.current) Plotly.purge(plotRef.current)
      })
    }
  }, [clean, isLight])

  return (
    <div style={{ borderRadius: 14, border: `1px solid ${isLight ? '#E2E8F0' : '#1E293B'}`, background: isLight ? '#FFFFFF' : 'rgba(5,11,20,.36)', padding: 14 }}>
      <h3 style={{ margin: '0 0 8px', color: isLight ? '#0F172A' : '#F8FAFC', fontSize: 15 }}>Single-Trace Spectrum (Orig vs Enhanced)</h3>
      <div ref={plotRef} style={{ width: '100%', minHeight: 330, borderRadius: 10, overflow: 'hidden' }} />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: any }) {
  return <div style={{ padding: 12, borderRadius: 12, border: '1px solid #1E293B', background: 'rgba(15,23,42,.6)' }}><div style={{ color: '#94A3B8', fontSize: 12 }}>{label}</div><strong>{String(value)}</strong></div>
}

function field(isLight: boolean): React.CSSProperties {
  return { width: '100%', height: 50, borderRadius: 9, border: 'none', background: isLight ? '#EEF2F7' : '#08111F', color: isLight ? '#0F172A' : '#F8FAFC', padding: '0 16px', fontSize: 16 }
}

function formatBytes(value?: number) {
  if (!value) return 'Demo seismic volume'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function robustColorRange(values: number[][], fallbackMin: number, fallbackMax: number): [number, number] {
  const flattened = values.flat().filter(value => Number.isFinite(value))
  if (!flattened.length) return [fallbackMin, fallbackMax]
  const sortedAbs = flattened.map(value => Math.abs(value)).sort((a, b) => a - b)
  const percentileIndex = Math.min(sortedAbs.length - 1, Math.floor(sortedAbs.length * 0.98))
  const robustMax = sortedAbs[percentileIndex] || Math.max(Math.abs(fallbackMin), Math.abs(fallbackMax))
  const fallbackAbs = Math.max(Math.abs(fallbackMin), Math.abs(fallbackMax))
  const limit = robustMax > 0 && robustMax < fallbackAbs * 0.35 ? robustMax : fallbackAbs
  return [-limit, limit]
}

function MiniGraph({ accent, index, isLight }: { accent: string; index: number; isLight: boolean }) {
  const points = Array.from({ length: 18 }, (_, i) => {
    const x = 12 + i * 20
    const y = 78 + Math.sin(i * 0.75 + index) * 28 + Math.cos(i * 0.32) * 12
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width="100%" height="100%" viewBox="0 0 370 140" preserveAspectRatio="none">
      {Array.from({ length: 5 }, (_, i) => <line key={i} x1="0" x2="370" y1={20 + i * 24} y2={20 + i * 24} stroke={isLight ? '#E2E8F0' : '#1E293B'} strokeWidth="1" />)}
      <polyline points={points} fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={points} fill="none" stroke={isLight ? '#334155' : '#F8FAFC'} strokeOpacity=".18" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function visualBackground(kind: Props['kind'], accent: string, isLight: boolean) {
  if (kind === 'seismic') return isLight ? `repeating-linear-gradient(90deg,${accent}12 0 8px,${accent}18 8px 16px),#F8FAFC` : `repeating-linear-gradient(90deg,${accent}12 0 8px,${accent}18 8px 16px),#050B14`
  return isLight ? `radial-gradient(circle at 25% 25%,${accent}22,transparent 32%),linear-gradient(135deg,#F1F5F9,#FFFFFF)` : `radial-gradient(circle at 25% 25%,${accent}22,transparent 32%),linear-gradient(135deg,#050B14,#08111F)`
}

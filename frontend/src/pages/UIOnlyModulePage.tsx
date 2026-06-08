import { useStore } from '../store'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ccusApi, seismicApi } from '../services/api'

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
  const displaySubtitle = isSeismicEnhancer
    ? 'Fetched from the integrated GitHub seismic backend: SEG-Y 3D low-frequency enhancement with inline/crossline/time visualization.'
    : isCcusScreening
      ? 'Integrated CCUS GitHub screening workflow: LAS parsing, curve mapping, CO2 candidate zones, log viewer, and Excel export.'
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

function PlotlyFigure({ figure, isLight }: { figure: any; isLight: boolean }) {
  const plotRef = useRef<HTMLDivElement | null>(null)

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

  return <div ref={plotRef} style={{ width: '100%', minHeight: 650, borderRadius: 12, overflow: 'hidden' }} />
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

function SliderLabel({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 4 }}>{label}</div>
      <div style={{ textAlign: 'center', color: '#FF4B4B', fontFamily: 'monospace' }}>{value.toFixed(2)}</div>
      <input
        type="range"
        min={min}
        max={max}
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

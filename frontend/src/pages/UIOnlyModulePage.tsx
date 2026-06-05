import { useStore } from '../store'
import type React from 'react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { seismicApi } from '../services/api'

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
          <p style={mutedStyle}>{subtitle}</p>
        </div>
        <div style={{ width: 58, height: 58, borderRadius: 16, border: `1px solid ${accent}66`, background: `${accent}18`, boxShadow: `0 0 34px ${accent}18` }} />
      </section>

      {isSeismicEnhancer ? (
        <SeismicEnhancerPanel accent={accent} isLight={isLight} />
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

function SeismicEnhancerPanel({ accent, isLight }: { accent: string; isLight: boolean }) {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [freqLow, setFreqLow] = useState(0)
  const [freqHigh, setFreqHigh] = useState(20)
  const [view, setView] = useState<'Inline' | 'Crossline'>('Inline')
  const [inlineNo, setInlineNo] = useState(426)
  const [crosslineNo, setCrosslineNo] = useState(950)
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{
    fileName: string;
    storagePath: string;
  } | null>(null)

  const handleFileUpload = async (file: File) => {
    try {
      const resp = await seismicApi.uploadFile(file);
      setUploadedFileInfo({
        fileName: resp.data.file_name,
        storagePath: resp.data.storage_path,
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
      })
      setResult(response.data)
      toast.success('Seismic enhancement results fetched from backend')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to fetch seismic enhancement results')
    } finally {
      setLoading(false)
    }
  }

  // Run enhancement automatically when a file is uploaded
  useEffect(() => {
    if (uploadedFileInfo) {
      runEnhancement();
    }
  }, [uploadedFileInfo]);

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
          <div style={{ color: text, fontWeight: 800 }}>
            <strong>{uploadedFileInfo.fileName}</strong>
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

        <Control label="Data Dimension"><select style={field(isLight)} defaultValue="3D"><option>3D</option><option>2D</option></select></Control>
        <Control label="Low Frequency (Hz)"><input style={field(isLight)} type="number" value={freqLow} onChange={e => setFreqLow(Number(e.target.value))} /></Control>
        <Control label="High Frequency (Hz)"><input style={field(isLight)} type="number" value={freqHigh} onChange={e => setFreqHigh(Number(e.target.value))} /></Control>
        <Control label="Workflow"><select style={field(isLight)} defaultValue="Low Frequency"><option>Low Frequency</option><option>High Frequency</option><option>Both</option></select></Control>
        <Control label="Amplitude Range"><select style={field(isLight)} defaultValue="+/-4k"><option>+/-4k</option><option>+/-10k</option><option>+/-20k</option></select></Control>
        <Control label="Color Scale"><select style={field(isLight)} defaultValue="RdBu"><option>RdBu</option><option>RdGy</option><option>gray</option><option>Blues</option><option>Reds</option></select></Control>
        <button onClick={runEnhancement} disabled={loading} style={{ width: '100%', marginTop: 16, padding: '12px 16px', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontWeight: 900, cursor: 'pointer' }}>{loading ? 'Fetching Results...' : 'Run Enhancement'}</button>
      </aside>

      <main style={{ padding: 18, borderRadius: 16, border: `1px solid ${border}`, background: panelBg }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 18 }}>
          <SliderLabel label={String(inlineNo)} min="200.00" max="650.00" />
          <SliderLabel label={String(crosslineNo)} min="700.00" max="1200.00" />
        </div>
        <div style={{ color: text, marginBottom: 16 }}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>View</div>
          <label style={{ marginRight: 18 }}><input type="radio" checked={view === 'Inline'} onChange={() => setView('Inline')} /> Inline</label>
          <label><input type="radio" checked={view === 'Crossline'} onChange={() => setView('Crossline')} /> Crossline</label>
        </div>
        <h2 style={{ margin: '0 0 16px', color: isLight ? '#1E3A5F' : '#F8FAFC', fontSize: 26 }}>AI Low Frequency Enhancer</h2>
        <h3 style={{ margin: '0 0 10px', color: text, fontSize: 15 }}>{view} {view === 'Inline' ? inlineNo : crosslineNo}</h3>
        {plot ? <SeismicHeatmap plot={plot} isLight={isLight} /> : <div style={{ color: muted }}>Loading seismic result...</div>}
        {result && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginTop: 18 }}>
            <Metric label="Energy Uplift" value={`${result.metrics.energy_uplift_pct}%`} />
            <Metric label="Similarity" value={result.metrics.structural_similarity} />
            <Metric label="Source" value={result.source} />
          </div>
        )}
      </main>
    </section>
  )
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block', marginTop: 16 }}><div style={{ color: '#94A3B8', fontSize: 13, fontWeight: 800, marginBottom: 7 }}>{label}</div>{children}</label>
}

function SliderLabel({ label, min, max }: { label: string; min: string; max: string }) {
  return <div><div style={{ textAlign: 'center', color: '#FF4B4B', fontFamily: 'monospace' }}>{Number(label).toFixed(2)}</div><div style={{ height: 5, background: 'linear-gradient(90deg,#ff4b4b,#e5e7eb)', borderRadius: 99 }} /><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: '#94A3B8', fontFamily: 'monospace' }}><span>{min}</span><span>{max}</span></div></div>
}

function SeismicHeatmap({ plot, isLight }: { plot: any; isLight: boolean }) {
  const section: number[][] = plot.section || []
  const rows = section.length
  const cols = section[0]?.length || 0
  const cellW = cols ? 820 / cols : 1
  const cellH = rows ? 470 / rows : 1
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '70px minmax(0,1fr) 68px', gap: 10, alignItems: 'center' }}>
      <div style={{ writingMode: 'vertical-rl', color: '#64748B', textAlign: 'center' }}>Time (ms)</div>
      <svg viewBox="0 0 820 500" style={{ width: '100%', height: 500, background: isLight ? '#FFFFFF' : '#050B14' }}>
        {section.map((row, r) => row.map((value, c) => <rect key={`${r}-${c}`} x={c * cellW} y={r * cellH + 10} width={Math.ceil(cellW) + 0.4} height={Math.ceil(cellH) + 0.4} fill={rdBu(value)} />))}
        {[400, 500, 600, 700, 800, 900, 1000, 1100].map((tick, idx) => <text key={tick} x="4" y={18 + idx * (470 / 7)} fill="#64748B" fontSize="12">{tick}</text>)}
        {[700, 800, 900, 1000, 1100, 1200].map((tick, idx) => <text key={tick} x={80 + idx * 135} y="495" fill="#64748B" fontSize="12">{tick}</text>)}
      </svg>
      <div style={{ height: 385, borderRadius: 4, background: 'linear-gradient(180deg,#053061,#4393c3,#f7f7f7,#d6604d,#67001f)', position: 'relative' }}>
        <span style={{ position: 'absolute', right: -36, top: -2, color: '#64748B', fontSize: 12 }}>4000</span>
        <span style={{ position: 'absolute', right: -40, top: 184, color: '#64748B', fontSize: 12 }}>0</span>
        <span style={{ position: 'absolute', right: -42, bottom: -2, color: '#64748B', fontSize: 12 }}>-4000</span>
      </div>
      <div />
      <div style={{ textAlign: 'center', color: '#64748B' }}>Crossline</div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: any }) {
  return <div style={{ padding: 12, borderRadius: 12, border: '1px solid #1E293B', background: 'rgba(15,23,42,.6)' }}><div style={{ color: '#94A3B8', fontSize: 12 }}>{label}</div><strong>{String(value)}</strong></div>
}

function field(isLight: boolean): React.CSSProperties {
  return { width: '100%', height: 50, borderRadius: 9, border: 'none', background: isLight ? '#EEF2F7' : '#08111F', color: isLight ? '#0F172A' : '#F8FAFC', padding: '0 16px', fontSize: 16 }
}

function rdBu(value: number) {
  const t = Math.max(0, Math.min(1, (value + 4000) / 8000))
  if (t < 0.5) {
    const k = t / 0.5
    return mix([103, 0, 31], [247, 247, 247], k)
  }
  return mix([247, 247, 247], [5, 48, 97], (t - 0.5) / 0.5)
}

function mix(a: number[], b: number[], t: number) {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return `rgb(${c[0]},${c[1]},${c[2]})`
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

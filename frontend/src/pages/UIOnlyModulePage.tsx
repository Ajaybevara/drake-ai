import type React from 'react'

interface Props {
  title: string
  subtitle?: string
  accent?: string
  kind?: 'logs' | 'seismic' | 'production' | 'ccus' | 'digitizer' | 'generic'
}

const DEFAULT_SUBTITLE = 'UI-only Drake AI module screen. Backend integrations have been removed from this prototype view.'

export default function UIOnlyModulePage({ title, subtitle = DEFAULT_SUBTITLE, accent = '#38BDF8', kind = 'generic' }: Props) {
  const cards = kind === 'seismic'
    ? ['Frequency bands', 'Spectral preview', 'Enhanced seismic panel', 'Export controls']
    : kind === 'production'
      ? ['Well performance', 'Optimization candidates', 'Operating envelope', 'Recommendation cards']
      : kind === 'ccus'
        ? ['Well log screening', 'Reservoir suitability', 'Risk flags', 'Ranking summary']
        : kind === 'digitizer'
          ? ['Document input', 'OCR extraction', 'SLM/GPT assistant', 'Exported data']
          : ['Curve selector', 'Depth interval', 'AI result preview', 'Export panel']

  return (
    <div style={page}>
      <section style={hero}>
        <div>
          <div style={{ ...eyebrow, color: accent }}>Drake AI UI Prototype</div>
          <h1 style={titleStyle}>{title}</h1>
          <p style={muted}>{subtitle}</p>
        </div>
        <div style={{ width: 58, height: 58, borderRadius: 16, border: `1px solid ${accent}66`, background: `${accent}18`, boxShadow: `0 0 34px ${accent}18` }} />
      </section>

      <section style={grid}>
        {cards.map((card, index) => (
          <div key={card} style={panel}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, color: '#F8FAFC', fontSize: 18 }}>{card}</h3>
              <span style={{ color: accent, fontWeight: 900 }}>{String(index + 1).padStart(2, '0')}</span>
            </div>
            <div style={{ height: 140, marginTop: 16, borderRadius: 12, border: '1px solid #1E293B', background: visualBackground(kind, accent), overflow: 'hidden' }}>
              <MiniGraph accent={accent} index={index} />
            </div>
            <p style={{ margin: '12px 0 0', color: '#94A3B8', fontSize: 13, lineHeight: 1.55 }}>
              Polished UI placeholder ready for your next backend connection.
            </p>
          </div>
        ))}
      </section>
    </div>
  )
}

function MiniGraph({ accent, index }: { accent: string; index: number }) {
  const points = Array.from({ length: 18 }, (_, i) => {
    const x = 12 + i * 20
    const y = 78 + Math.sin(i * 0.75 + index) * 28 + Math.cos(i * 0.32) * 12
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width="100%" height="100%" viewBox="0 0 370 140" preserveAspectRatio="none">
      {Array.from({ length: 5 }, (_, i) => <line key={i} x1="0" x2="370" y1={20 + i * 24} y2={20 + i * 24} stroke="#1E293B" strokeWidth="1" />)}
      <polyline points={points} fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={points} fill="none" stroke="#F8FAFC" strokeOpacity=".18" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function visualBackground(kind: Props['kind'], accent: string) {
  if (kind === 'seismic') return 'repeating-linear-gradient(90deg,rgba(56,189,248,.12) 0 8px,rgba(239,68,68,.12) 8px 16px),#050B14'
  return `radial-gradient(circle at 25% 25%,${accent}22,transparent 32%),linear-gradient(135deg,#050B14,#08111F)`
}

const page: React.CSSProperties = { padding: 28, minHeight: '100%', overflow: 'auto', background: 'radial-gradient(circle at top right,rgba(56,189,248,.12),transparent 30%),linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)', color: '#F8FAFC' }
const hero: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, padding: 24, borderRadius: 18, border: '1px solid #1E293B', background: 'linear-gradient(135deg,rgba(15,23,42,.92),rgba(7,17,31,.82))', boxShadow: '0 24px 70px rgba(0,0,0,.28)' }
const eyebrow: React.CSSProperties = { letterSpacing: 4, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }
const titleStyle: React.CSSProperties = { margin: '8px 0', fontSize: 34, lineHeight: 1.1 }
const muted: React.CSSProperties = { margin: 0, color: '#94A3B8', lineHeight: 1.55 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginTop: 22 }
const panel: React.CSSProperties = { padding: 18, borderRadius: 16, border: '1px solid #1E293B', background: 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))', boxShadow: '0 18px 42px rgba(0,0,0,.22)' }

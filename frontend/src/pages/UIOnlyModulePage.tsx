import { useStore } from '../store'
import type React from 'react'

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
    </div>
  )
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

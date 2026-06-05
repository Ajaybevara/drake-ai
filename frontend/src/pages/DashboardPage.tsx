import type React from 'react'
import { Activity, Database, Gauge, Layers, RadioTower } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div style={page}>
      <section style={hero}>
        <div>
          <div style={eyebrow}>Drake AI Enterprise Platform</div>
          <h1 style={title}>Oil & Gas AI Workspace UI</h1>
          <p style={muted}>UI-only dashboard shell with premium dark styling and module navigation. All prior backend integrations have been removed from the active UI flow.</p>
        </div>
      </section>
      <div style={grid}>
        <Stat label="Petrophysics Tools" value="9" icon={<Gauge size={20} />} />
        <Stat label="Seismic Tools" value="1" icon={<RadioTower size={20} />} />
        <Stat label="Production Tools" value="2" icon={<Activity size={20} />} />
        <Stat label="Digitizer Tools" value="2" icon={<Layers size={20} />} />
      </div>
      <section style={panel}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Workspace Overview</h2>
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
          {['Well intelligence', 'Seismic enhancement', 'Production optimization', 'CCUS screening', 'OCR and SLM/GPT'].map(item => (
            <div key={item} style={miniCard}><Database size={17} color="#38BDF8" /><span>{item}</span></div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div style={stat}><div style={{ color: '#38BDF8' }}>{icon}</div><div><div style={statLabel}>{label}</div><div style={statValue}>{value}</div></div></div>
}

const page: React.CSSProperties = { padding: 28, minHeight: '100%', overflow: 'auto', background: 'linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)', color: '#F8FAFC' }
const hero: React.CSSProperties = { padding: 26, borderRadius: 18, border: '1px solid #1E293B', background: 'linear-gradient(135deg,rgba(15,23,42,.92),rgba(7,17,31,.82))', boxShadow: '0 24px 70px rgba(0,0,0,.28)' }
const eyebrow: React.CSSProperties = { color: '#38BDF8', letterSpacing: 4, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }
const title: React.CSSProperties = { margin: '8px 0', fontSize: 36, lineHeight: 1.08 }
const muted: React.CSSProperties = { margin: 0, color: '#94A3B8', lineHeight: 1.6 }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 16, marginTop: 18 }
const stat: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, padding: 18, borderRadius: 16, border: '1px solid #1E293B', background: 'rgba(15,23,42,.84)' }
const statLabel: React.CSSProperties = { color: '#94A3B8', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.2 }
const statValue: React.CSSProperties = { color: '#F8FAFC', fontSize: 28, fontWeight: 900, marginTop: 4 }
const panel: React.CSSProperties = { marginTop: 22, padding: 20, borderRadius: 18, border: '1px solid #1E293B', background: 'rgba(15,23,42,.82)' }
const miniCard: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, border: '1px solid #26364F', background: '#08111F', color: '#E2E8F0', fontWeight: 800 }

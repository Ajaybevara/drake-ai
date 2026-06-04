import type { LucideIcon } from 'lucide-react'

export default function ModuleCard({ title, subtitle, icon: Icon, accent, onClick }: { title: string; subtitle: string; icon: LucideIcon; accent: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ textAlign: 'left', minHeight: 150, padding: 18, borderRadius: 16, border: `1px solid ${accent}55`, background: 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.98))', color: '#F8FAFC', cursor: 'pointer', boxShadow: `0 0 28px ${accent}12`, transition: 'transform .14s, box-shadow .14s' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', background: `${accent}20`, color: accent, border: `1px solid ${accent}55` }}>
        <Icon size={21} />
      </div>
      <h3 style={{ margin: '16px 0 7px', fontSize: 18 }}>{title}</h3>
      <p style={{ margin: 0, color: '#94A3B8', fontSize: 13, lineHeight: 1.55 }}>{subtitle}</p>
    </button>
  )
}

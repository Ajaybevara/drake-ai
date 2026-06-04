import type { ProjectFileStatus } from '../../store'

const COLORS: Record<ProjectFileStatus | string, { bg: string; border: string; color: string }> = {
  Uploaded: { bg: 'rgba(37,99,235,.14)', border: 'rgba(59,130,246,.35)', color: '#93C5FD' },
  Parsed: { bg: 'rgba(16,185,129,.14)', border: 'rgba(16,185,129,.35)', color: '#6EE7B7' },
  Ready: { bg: 'rgba(16,185,129,.14)', border: 'rgba(16,185,129,.35)', color: '#6EE7B7' },
  Failed: { bg: 'rgba(239,68,68,.14)', border: 'rgba(239,68,68,.35)', color: '#FCA5A5' },
  Warning: { bg: 'rgba(245,158,11,.14)', border: 'rgba(245,158,11,.35)', color: '#FCD34D' },
}

export default function StatusBadge({ status }: { status: ProjectFileStatus | string }) {
  const color = COLORS[status] || COLORS.Uploaded
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 9px',
      borderRadius: 999,
      border: `1px solid ${color.border}`,
      background: color.bg,
      color: color.color,
      fontSize: 11,
      fontWeight: 800,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color.color }} />
      {status}
    </span>
  )
}

import { useStore } from '../../store'

const TYPE_STYLES: Record<string, { bg: string; color: string }> = {
  LAS:  { bg: 'rgba(59,130,246,.16)', color: '#F87171' },
  DLIS: { bg: 'rgba(139,92,246,.16)', color: '#C4B5FD' },
  TIFF: { bg: 'rgba(245,158,11,.15)', color: '#FBBF24' },
  PDF:  { bg: 'rgba(239,68,68,.14)', color: '#FCA5A5' },
  XLSX: { bg: 'rgba(34,197,94,.14)', color: '#86EFAC' },
  CSV:  { bg: 'rgba(20,184,166,.14)', color: '#5EEAD4' },
}

export default function DataTable() {
  const { files, theme } = useStore()
  const isLight = theme === 'light'

  if (!files.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: isLight ? '#64748B' : '#95A3B8', fontSize: 12, textAlign: 'center', padding: 14 }}>
      No files uploaded yet. Drag & drop LAS/DLIS files to get started.
    </div>
  )

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {['File Name','Type','Size','Date','Stats'].map(h => (
            <th key={h} style={{ padding: '5px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: isLight ? '#334155' : '#AAB6C6', background: isLight ? '#F1F5F9' : '#0E1622', borderBottom: `1px solid ${isLight ? '#CBD5E1' : '#1F2A3A'}`, whiteSpace: 'nowrap', position: 'sticky', top: 0 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {files.map(f => {
          const style = TYPE_STYLES[f.file_type] || { bg: '#13243A', color: '#AAB6C6' }
          return (
            <tr key={f.id} style={{ cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget as any).style.background = isLight ? '#FFEBEE' : '#101927'} onMouseLeave={e => (e.currentTarget as any).style.background = ''}>
              <td style={{ padding: '5px 10px', fontSize: 11, borderBottom: `1px solid ${isLight ? '#E2E8F0' : '#162235'}`, color: isLight ? '#0F172A' : '#E2E8F0', whiteSpace: 'nowrap' }}>{f.filename}</td>
              <td style={{ padding: '5px 10px', fontSize: 11, borderBottom: `1px solid ${isLight ? '#E2E8F0' : '#162235'}` }}>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase', background: style.bg, color: style.color }}>{f.file_type}</span>
              </td>
              <td style={{ padding: '5px 10px', fontSize: 11, borderBottom: `1px solid ${isLight ? '#E2E8F0' : '#162235'}`, color: isLight ? '#475569' : '#AAB6C6' }}>{f.file_size_mb} MB</td>
              <td style={{ padding: '5px 10px', fontSize: 11, borderBottom: `1px solid ${isLight ? '#E2E8F0' : '#162235'}`, color: isLight ? '#475569' : '#AAB6C6', whiteSpace: 'nowrap' }}>{f.uploaded_at?.slice(0,10) || '-'}</td>
              <td style={{ padding: '5px 10px', fontSize: 11, borderBottom: `1px solid ${isLight ? '#E2E8F0' : '#162235'}` }}>
                <span style={{ color: '#22C55E', fontSize: 10, cursor: 'pointer' }}>
                  {f.is_processed ? `${f.curve_count} curves` : 'Load'}
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

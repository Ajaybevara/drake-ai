import { Download, Eye, Trash2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { ProjectFile } from '../../store'
import { useStore } from '../../store'
import StatusBadge from './StatusBadge'
import toast from 'react-hot-toast'

const formatSize = (size: number) => `${(size / 1024 / 1024).toFixed(2)} MB`

export default function FileTable({ projectId, files }: { projectId: string; files: ProjectFile[] }) {
  const deleteProjectFile = useStore(s => s.deleteProjectFile)

  const downloadMeta = (file: ProjectFile) => {
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${file.name}.metadata.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!files.length) {
    return (
      <div style={{ padding: 20, borderRadius: 16, border: '1px solid #1E293B', background: 'rgba(15,23,42,.72)', color: '#94A3B8' }}>
        No files in this group yet.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid #1E293B', background: 'rgba(15,23,42,.72)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780, color: '#E2E8F0' }}>
        <thead>
          <tr style={{ background: 'rgba(7,17,31,.95)', color: '#94A3B8', fontSize: 12, textAlign: 'left' }}>
            {['File Name', 'Type', 'Size', 'Upload Date', 'Status', 'Compatible Modules', 'Actions'].map(header => (
              <th key={header} style={{ padding: '13px 14px', borderBottom: '1px solid #1E293B' }}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {files.map(file => (
            <tr key={file.id} style={{ borderBottom: '1px solid rgba(30,41,59,.8)' }}>
              <td style={{ padding: '13px 14px', fontWeight: 800 }}>{file.name}</td>
              <td style={{ padding: '13px 14px', color: '#93C5FD' }}>{file.type}</td>
              <td style={{ padding: '13px 14px', color: '#94A3B8' }}>{formatSize(file.size)}</td>
              <td style={{ padding: '13px 14px', color: '#94A3B8' }}>{new Date(file.uploadedAt).toLocaleString()}</td>
              <td style={{ padding: '13px 14px' }}><StatusBadge status={file.status} /></td>
              <td style={{ padding: '13px 14px', color: '#CBD5E1' }}>{file.compatibility.join(', ')}</td>
              <td style={{ padding: '13px 14px' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button title="View" onClick={() => toast(`${file.name} is available for compatible modules`)} style={iconButton}><Eye size={14} /></button>
                  <button title="Download metadata" onClick={() => downloadMeta(file)} style={iconButton}><Download size={14} /></button>
                  <button title="Delete" onClick={() => deleteProjectFile(projectId, file.id)} style={{ ...iconButton, color: '#FCA5A5' }}><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const iconButton: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: '1px solid #26364F',
  background: '#0B1220',
  color: '#CBD5E1',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
}

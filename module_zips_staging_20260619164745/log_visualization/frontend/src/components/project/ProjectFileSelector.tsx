import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useStore, type EnterpriseProjectFile } from '../../store'
import { readLocalProjectFile } from '../../utils/localProjectStorage'

type Props = {
  moduleName: string
  allowedExtensions?: string[]
  onSelectFile: (file: File, record: EnterpriseProjectFile) => Promise<void> | void
  compact?: boolean
}

export default function ProjectFileSelector({ moduleName, allowedExtensions = [], onSelectFile, compact = false }: Props) {
  const { enterpriseProject } = useStore()
  const [files, setFiles] = useState<EnterpriseProjectFile[]>([])
  const [fileId, setFileId] = useState('')

  useEffect(() => {
    if (!enterpriseProject) {
      setFiles([])
      return
    }
    setFiles(enterpriseProject.uploaded_files || [])
  }, [enterpriseProject, moduleName])

  const filtered = useMemo(() => {
    const allowed = allowedExtensions.map(ext => ext.toLowerCase().replace(/^\./, ''))
    const seen = new Set<string>()
    return files.filter(file => {
      const ext = (file.file_name.split('.').pop() || file.file_type || '').toLowerCase()
      if (allowed.length && !allowed.includes(ext)) return false
      const key = `${file.file_name.toLowerCase()}|${file.size_bytes}|${file.file_type.toLowerCase()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [allowedExtensions, files])

  const loadFile = async () => {
    if (!enterpriseProject || !fileId) return
    const record = filtered.find(item => item.file_id === fileId)
    if (!record) return
    try {
      const file = await readLocalProjectFile(enterpriseProject, record)
      await onSelectFile(file, record)
      toast.success(`Loaded ${record.file_name}`)
    } catch (error: any) {
      toast.error(error?.message || 'Project file load failed')
    }
  }

  if (!enterpriseProject) {
    return (
      <div style={compact ? compactWrap : wrap}>
        <div style={label}>Project Uploaded Files</div>
        <div style={row}>
          <select disabled style={{ ...select, opacity: .55 }}>
            <option>Create or open a project first</option>
          </select>
          <button disabled style={{ ...button, opacity: .45 }}>Use File</button>
        </div>
      </div>
    )
  }

  return (
    <div style={compact ? compactWrap : wrap}>
      <div style={label}>Project Uploaded Files</div>
      <div style={row}>
        <select value={fileId} onChange={event => setFileId(event.target.value)} style={select}>
          <option value="">Select uploaded project file</option>
          {filtered.map(file => <option key={file.file_id} value={file.file_id}>{file.file_name} ({file.file_type})</option>)}
        </select>
        <button disabled={!fileId} onClick={loadFile} style={{ ...button, opacity: fileId ? 1 : .45 }}>Use File</button>
      </div>
    </div>
  )
}

const wrap: React.CSSProperties = { marginTop: 14, padding: 14, borderRadius: 12, border: '1px solid #26364F', background: 'rgba(8,17,31,.8)' }
const compactWrap: React.CSSProperties = { display: 'grid', gap: 8, minWidth: 420 }
const label: React.CSSProperties = { color: '#9DB7D8', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.4 }
const row: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center' }
const select: React.CSSProperties = { flex: 1, minWidth: 0, height: 56, border: '1px solid #26364F', background: '#06101D', color: '#F8FAFC', borderRadius: 10, padding: '0 18px', outline: 'none', fontSize: 15, fontWeight: 800 }
const button: React.CSSProperties = { height: 56, border: '1px solid #10B981', background: '#10B981', color: '#00150E', borderRadius: 10, padding: '0 20px', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 15 }

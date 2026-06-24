import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useStore, type EnterpriseProjectFile } from '../../store'
import { readLocalProjectFile } from '../../utils/localProjectStorage'

type Props = {
  moduleName: string
  allowedExtensions?: string[]
  onSelectFile: (file: File, record: EnterpriseProjectFile) => Promise<void> | void
  onSelectFiles?: (files: { file: File; record: EnterpriseProjectFile }[]) => Promise<void> | void
  compact?: boolean
  multiple?: boolean
}

export default function ProjectFileSelector({ moduleName, allowedExtensions = [], onSelectFile, onSelectFiles, compact = false, multiple = false }: Props) {
  const { enterpriseProject } = useStore()
  const [files, setFiles] = useState<EnterpriseProjectFile[]>([])
  const [fileId, setFileId] = useState('')
  const [fileIds, setFileIds] = useState<string[]>([])
  const [open, setOpen] = useState(false)

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
    if (!enterpriseProject || (!fileId && !fileIds.length)) return
    if (multiple) {
      const records = filtered.filter(item => fileIds.includes(item.file_id))
      if (!records.length) return
      try {
        const loaded = []
        for (const record of records) {
          loaded.push({ file: await readLocalProjectFile(enterpriseProject, record), record })
        }
        if (onSelectFiles) await onSelectFiles(loaded)
        else if (loaded[0]) await onSelectFile(loaded[0].file, loaded[0].record)
        setOpen(false)
        toast.success(`Loaded ${records.length} project file${records.length === 1 ? '' : 's'}`)
      } catch (error: any) {
        toast.error(error?.message || 'Project file load failed')
      }
      return
    }
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

  const selectedRecords = filtered.filter(item => fileIds.includes(item.file_id))
  const selectedLabel = selectedRecords.length
    ? selectedRecords.length === 1
      ? `${selectedRecords[0].file_name} (${selectedRecords[0].file_type})`
      : `${selectedRecords.length} project LAS files selected`
    : 'Select uploaded project file'

  return (
    <div style={compact ? compactWrap : wrap}>
      <div style={label}>Project Uploaded Files</div>
      <div style={row}>
        {multiple ? <div style={dropdownWrap}>
          <button type="button" onClick={() => setOpen(value => !value)} style={multiSelectButton}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
            <span style={{ fontSize: 14, lineHeight: 1 }}>v</span>
          </button>
          {open ? <div style={dropdownMenu}>
            {filtered.length ? filtered.map(file => {
              const checked = fileIds.includes(file.file_id)
              return <label key={file.file_id} style={{ ...dropdownItem, background: checked ? 'rgba(16,185,129,.14)' : 'transparent' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setFileIds(prev => checked ? prev.filter(id => id !== file.file_id) : [...prev, file.file_id])}
                />
                <span>{file.file_name} ({file.file_type})</span>
              </label>
            }) : <div style={{ ...dropdownItem, color: '#9DB7D8' }}>No project LAS files found</div>}
          </div> : null}
        </div> : <select value={fileId} onChange={event => setFileId(event.target.value)} style={select}>
          <option value="">Select uploaded project file</option>
          {filtered.map(file => <option key={file.file_id} value={file.file_id}>{file.file_name} ({file.file_type})</option>)}
        </select>}
        <button disabled={multiple ? !fileIds.length : !fileId} onClick={loadFile} style={{ ...button, opacity: (multiple ? fileIds.length : fileId) ? 1 : .45 }}>Use File</button>
      </div>
    </div>
  )
}

const wrap: React.CSSProperties = { marginTop: 14, padding: 14, borderRadius: 12, border: '1px solid #26364F', background: 'rgba(8,17,31,.8)' }
const compactWrap: React.CSSProperties = { display: 'grid', gap: 8, minWidth: 420 }
const label: React.CSSProperties = { color: '#9DB7D8', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.4 }
const row: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center' }
const select: React.CSSProperties = { flex: 1, minWidth: 0, height: 56, border: '1px solid #26364F', background: '#06101D', color: '#F8FAFC', borderRadius: 10, padding: '0 18px', outline: 'none', fontSize: 15, fontWeight: 800 }
const dropdownWrap: React.CSSProperties = { flex: 1, minWidth: 0, position: 'relative' }
const multiSelectButton: React.CSSProperties = { ...select, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }
const dropdownMenu: React.CSSProperties = { position: 'absolute', zIndex: 20, top: 62, left: 0, right: 0, maxHeight: 220, overflowY: 'auto', border: '1px solid #26364F', background: '#06101D', borderRadius: 10, padding: 8, boxShadow: '0 18px 40px rgba(0,0,0,.35)' }
const dropdownItem: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 38, borderRadius: 8, padding: '7px 10px', color: '#F8FAFC', fontSize: 15, fontWeight: 800, cursor: 'pointer' }
const button: React.CSSProperties = { height: 56, border: '1px solid #10B981', background: '#10B981', color: '#00150E', borderRadius: 10, padding: '0 20px', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 15 }

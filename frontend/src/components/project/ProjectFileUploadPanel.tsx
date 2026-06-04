import { UploadCloud } from 'lucide-react'
import { useRef } from 'react'
import { useStore } from '../../store'
import toast from 'react-hot-toast'

export default function ProjectFileUploadPanel({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const addProjectFiles = useStore(s => s.addProjectFiles)

  const upload = (files: FileList | null) => {
    if (!files?.length) return
    addProjectFiles(projectId, Array.from(files))
    toast.success(`${files.length} file(s) added to project repository`)
  }

  return (
    <div style={{ padding: 22, borderRadius: 18, border: '1px solid #1E293B', background: 'linear-gradient(180deg,rgba(15,23,42,.94),rgba(7,17,31,.96))', color: '#F8FAFC' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 22 }}>Upload Project Files</h2>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={event => event.preventDefault()}
        onDrop={event => {
          event.preventDefault()
          upload(event.dataTransfer.files)
        }}
        style={{ border: '1px dashed #3B82F6', background: 'rgba(37,99,235,.08)', borderRadius: 14, minHeight: 160, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#CBD5E1' }}
      >
        <div style={{ textAlign: 'center' }}>
          <UploadCloud size={38} color="#38BDF8" style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 900, color: '#F8FAFC' }}>Drag and drop LAS, PDF, Word, image, Excel or CSV files</div>
          <div style={{ marginTop: 6, fontSize: 13, color: '#94A3B8' }}>Files are stored in this project and reused by every compatible module.</div>
          <button style={{ marginTop: 14, padding: '10px 16px', borderRadius: 9, border: '1px solid rgba(239,68,68,.45)', background: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: '#fff', cursor: 'pointer', fontWeight: 900 }}>Browse Files</button>
        </div>
      </div>
      <input ref={inputRef} type="file" multiple accept=".las,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.tif,.tiff,.csv,.xls,.xlsx" onChange={event => upload(event.target.files)} style={{ display: 'none' }} />
    </div>
  )
}

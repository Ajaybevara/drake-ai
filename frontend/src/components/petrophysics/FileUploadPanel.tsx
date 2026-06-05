// FileUploadPanel.tsx
import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { useStore } from '../../store'
import { curvesApi, filesApi, wellsApi } from '../../services/api'

export default function FileUploadPanel() {
  const { activeWell, setActiveWell, setFiles, setCurves, theme } = useStore()
  const isLight = theme === 'light'

  const onDrop = useCallback(async (accepted: File[]) => {
    if (!activeWell) return toast.error('Select a well first')
    for (const file of accepted) {
      try {
        toast.loading(`Uploading ${file.name}…`, { id: file.name })
        const res = await filesApi.upload(activeWell.id, file)
        toast.success(`Uploaded: ${file.name} (${res.data.curves_added?.length || 0} curves)`, { id: file.name })
        const [fRes, cRes, wRes] = await Promise.all([
          filesApi.list(activeWell.id),
          curvesApi.list(activeWell.id),
          wellsApi.get(activeWell.id),
        ])
        setActiveWell(wRes.data)
        setFiles(fRes.data)
        setCurves(cRes.data)
      } catch (e: any) {
        toast.error(`Failed: ${file.name}`, { id: file.name })
      }
    }
  }, [activeWell])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/octet-stream': ['.las','.dlis','.lis'], 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/pdf': ['.pdf'], 'image/tiff': ['.tif','.tiff'] },
  })

  return (
    <div {...getRootProps()} style={{ flex: 1, border: `2px dashed ${isDragActive ? '#9B1B1B' : isLight ? '#94A3B8' : '#29415E'}`, borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer', transition: 'all .2s', background: isDragActive ? 'rgba(155,27,27,.12)' : isLight ? '#F8FAFC' : '#0B111A', padding: 8 }}>
      <input {...getInputProps()} />
      <i className="fas fa-cloud-upload-alt" style={{ fontSize: 24, color: isDragActive ? '#9B1B1B' : '#388E3C' }}></i>
      <p style={{ fontSize: 10.5, color: isLight ? '#0F172A' : '#E2E8F0', textAlign: 'center', lineHeight: 1.4 }}>Drag & Drop files here</p>
      <p style={{ fontSize: 10, color: isLight ? '#64748B' : '#7B8798' }}>or</p>
      <button type="button" style={{ background: isLight ? '#FCD3D3' : '#1E1314', color: isLight ? '#9B1B1B' : '#FFEBEE', border: `1px solid ${isLight ? '#F87171' : '#3A2324'}`, borderRadius: 5, padding: '5px 12px', fontSize: 10.5, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', fontWeight: 600 }}>Browse Files</button>
      <small style={{ fontSize: 9, color: isLight ? '#64748B' : '#95A3B8', textAlign: 'center' }}>LAS, DLIS, LIS, TIFF,<br/>PDF, CSV, XLSX</small>
    </div>
  )
}

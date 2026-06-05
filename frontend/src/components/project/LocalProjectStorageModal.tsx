import { useEffect, useState } from 'react'
import { FolderOpen, Save, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { LocalProject } from '../../store'
import { localProjectsApi } from '../../services/api'

interface LocationItem {
  key: string
  label: string
  path: string
}

interface ProjectPackage {
  name: string
  path: string
  file_name: string
  files: number
  outputs: number
}

interface Props {
  mode: 'save' | 'open'
  open: boolean
  project?: LocalProject
  onClose: () => void
  onOpened?: (project: LocalProject) => void
}

export default function LocalProjectStorageModal({ mode, open, project, onClose, onOpened }: Props) {
  const [locations, setLocations] = useState<LocationItem[]>([])
  const [locationKey, setLocationKey] = useState('workspace')
  const [packages, setPackages] = useState<ProjectPackage[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    localProjectsApi.locations()
      .then(response => {
        setLocations(response.data)
        if (response.data?.[0]?.key) setLocationKey(response.data[0].key)
      })
      .catch(() => toast.error('Failed to load local storage locations'))
  }, [open])

  useEffect(() => {
    if (!open || mode !== 'open' || !locationKey) return
    setLoading(true)
    localProjectsApi.list(locationKey)
      .then(response => setPackages(response.data))
      .catch(() => toast.error('Failed to list local projects'))
      .finally(() => setLoading(false))
  }, [open, mode, locationKey])

  if (!open) return null

  const saveProject = async () => {
    if (!project) return
    setLoading(true)
    try {
      const response = await localProjectsApi.save({ location_key: locationKey, project })
      toast.success(`Saved project to ${response.data.path}`)
      onClose()
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to save project')
    } finally {
      setLoading(false)
    }
  }

  const openProject = async (path: string) => {
    setLoading(true)
    try {
      const response = await localProjectsApi.open(path)
      onOpened?.(response.data)
      toast.success(`Opened ${response.data.name}`)
      onClose()
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to open project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'grid', placeItems: 'center', background: 'rgba(2,6,23,.72)', backdropFilter: 'blur(8px)' }}>
      <div style={{ width: 'min(760px, calc(100vw - 32px))', maxHeight: '82vh', overflow: 'auto', borderRadius: 18, background: 'linear-gradient(180deg,#0F172A,#08111F)', border: '1px solid #26364F', boxShadow: '0 30px 80px rgba(0,0,0,.55)', color: '#F8FAFC' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', padding: 20, borderBottom: '1px solid #1E293B' }}>
          <div>
            <div style={{ color: '#38BDF8', letterSpacing: 3, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }}>
              {mode === 'save' ? 'Save Project To Local Storage' : 'Open Project From Local Storage'}
            </div>
            <h2 style={{ margin: '7px 0 0', fontSize: 24 }}>{mode === 'save' ? project?.name : 'Select a Drake AI project package'}</h2>
          </div>
          <button onClick={onClose} style={iconButton}><X size={16} /></button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
            {locations.map(location => {
              const active = location.key === locationKey
              return (
                <button key={location.key} onClick={() => setLocationKey(location.key)} style={{ textAlign: 'left', padding: 14, borderRadius: 12, border: `1px solid ${active ? '#38BDF8' : '#26364F'}`, background: active ? 'rgba(56,189,248,.12)' : '#08111F', color: '#F8FAFC', cursor: 'pointer' }}>
                  <strong>{location.label}</strong>
                  <div style={{ marginTop: 7, fontSize: 11, color: '#94A3B8', overflowWrap: 'anywhere' }}>{location.path}</div>
                </button>
              )
            })}
          </div>

          {mode === 'save' && (
            <button onClick={saveProject} disabled={loading} style={{ ...primaryButton, marginTop: 18, opacity: loading ? .7 : 1 }}>
              <Save size={17} /> {loading ? 'Saving...' : 'Save Project Here'}
            </button>
          )}

          {mode === 'open' && (
            <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
              {loading && <div style={{ color: '#94A3B8' }}>Loading projects...</div>}
              {!loading && !packages.length && <div style={{ color: '#94A3B8', padding: 16, border: '1px solid #26364F', borderRadius: 12 }}>No saved project packages found in this location.</div>}
              {packages.map(item => (
                <button key={item.path} onClick={() => openProject(item.path)} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: 14, borderRadius: 12, border: '1px solid #26364F', background: '#08111F', color: '#F8FAFC', cursor: 'pointer' }}>
                  <FolderOpen size={18} color="#38BDF8" />
                  <div style={{ flex: 1 }}>
                    <strong>{item.name}</strong>
                    <div style={{ marginTop: 5, color: '#94A3B8', fontSize: 12 }}>{item.files} files, {item.outputs} outputs</div>
                    <div style={{ marginTop: 4, color: '#64748B', fontSize: 11, overflowWrap: 'anywhere' }}>{item.path}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const iconButton: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: '1px solid #26364F', background: '#0B1220', color: '#CBD5E1', cursor: 'pointer', display: 'grid', placeItems: 'center' }
const primaryButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(239,68,68,.45)', background: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: '#fff', cursor: 'pointer', fontWeight: 900 }

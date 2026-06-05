import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { localProjectsApi } from '../../services/api'

interface LocationItem {
  key: string
  label: string
  path: string
}

interface Props {
  open: boolean
  onClose: () => void
  onCreate: (name: string, locationKey?: string) => void
}

export default function CreateProjectModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [locations, setLocations] = useState<LocationItem[]>([])
  const [locationKey, setLocationKey] = useState('workspace')

  useEffect(() => {
    if (!open) return
    localProjectsApi.locations()
      .then(response => {
        setLocations(response.data)
        if (response.data?.[0]?.key) setLocationKey(response.data[0].key)
      })
      .catch(() => {
        setLocations([{ key: 'workspace', label: 'Workspace local storage', path: 'backend/local_project_storage/projects' }])
        setLocationKey('workspace')
      })
  }, [open])

  if (!open) return null

  const submit = () => {
    const cleanName = name.trim()
    if (!cleanName) return
    onCreate(cleanName, locationKey)
    setName('')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(2,6,23,.72)', display: 'grid', placeItems: 'center', backdropFilter: 'blur(8px)' }}>
      <div style={{ width: 'min(720px, calc(100vw - 32px))', maxHeight: '86vh', overflow: 'auto', borderRadius: 18, background: 'linear-gradient(180deg,#0F172A,#08111F)', border: '1px solid #233047', boxShadow: '0 30px 80px rgba(0,0,0,.5)', color: '#F8FAFC' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottom: '1px solid #1E293B' }}>
          <div>
            <div style={{ fontSize: 12, color: '#38BDF8', letterSpacing: 3, textTransform: 'uppercase', fontWeight: 800 }}>New Drake AI Project</div>
            <h2 style={{ margin: '6px 0 0', fontSize: 24 }}>Create project workspace</h2>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #26364F', background: '#0B1220', color: '#CBD5E1', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 20 }}>
          <label style={{ fontSize: 13, color: '#94A3B8', fontWeight: 700 }}>Project name</label>
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && submit()}
            autoFocus
            placeholder="Permian Basin Petrophysics Study"
            style={{ width: '100%', marginTop: 8, height: 48, borderRadius: 10, border: '1px solid #26364F', background: '#050B14', color: '#F8FAFC', padding: '0 14px', outline: 'none', fontSize: 15 }}
          />
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 800, marginBottom: 10 }}>Create project in local storage</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
              {locations.map(location => {
                const active = location.key === locationKey
                return (
                  <button key={location.key} onClick={() => setLocationKey(location.key)} style={{ textAlign: 'left', padding: 13, borderRadius: 12, border: `1px solid ${active ? '#38BDF8' : '#26364F'}`, background: active ? 'rgba(56,189,248,.12)' : '#08111F', color: '#F8FAFC', cursor: 'pointer' }}>
                    <strong>{location.label}</strong>
                    <div style={{ marginTop: 6, fontSize: 11, color: '#94A3B8', overflowWrap: 'anywhere' }}>{location.path}</div>
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button onClick={onClose} style={{ padding: '11px 16px', borderRadius: 9, border: '1px solid #26364F', background: '#0B1220', color: '#CBD5E1', cursor: 'pointer', fontWeight: 800 }}>Cancel</button>
            <button onClick={submit} style={{ padding: '11px 18px', borderRadius: 9, border: '1px solid rgba(239,68,68,.45)', background: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: '#fff', cursor: 'pointer', fontWeight: 900 }}>Create Project</button>
          </div>
        </div>
      </div>
    </div>
  )
}

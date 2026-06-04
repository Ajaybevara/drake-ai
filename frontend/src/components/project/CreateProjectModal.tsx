import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onCreate: (name: string) => void
}

export default function CreateProjectModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  if (!open) return null

  const submit = () => {
    const cleanName = name.trim()
    if (!cleanName) return
    onCreate(cleanName)
    setName('')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(2,6,23,.72)', display: 'grid', placeItems: 'center', backdropFilter: 'blur(8px)' }}>
      <div style={{ width: 'min(520px, calc(100vw - 32px))', borderRadius: 18, background: 'linear-gradient(180deg,#0F172A,#08111F)', border: '1px solid #233047', boxShadow: '0 30px 80px rgba(0,0,0,.5)', color: '#F8FAFC' }}>
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button onClick={onClose} style={{ padding: '11px 16px', borderRadius: 9, border: '1px solid #26364F', background: '#0B1220', color: '#CBD5E1', cursor: 'pointer', fontWeight: 800 }}>Cancel</button>
            <button onClick={submit} style={{ padding: '11px 18px', borderRadius: 9, border: '1px solid rgba(239,68,68,.45)', background: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: '#fff', cursor: 'pointer', fontWeight: 900 }}>Create Project</button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ACCESS_MODULES, accessDeniedMessage, moduleForPath } from '../utils/accessControl'
import { useStore } from '../store'
import { supportApi } from '../services/api'

export default function LockedModulePage() {
  const location = useLocation()
  const theme = useStore(s => s.theme)
  const [sending, setSending] = useState(false)
  const isLight = theme === 'light'
  const moduleId = moduleForPath(location.pathname)
  const moduleLabel = ACCESS_MODULES.find(module => module.id === moduleId)?.label || 'This module'
  const palette = lockedPalette(isLight)
  const contactAdmin = async () => {
    if (!moduleId) return
    setSending(true)
    try {
      const { data } = await supportApi.requestAccess({
        module_id: moduleId,
        module_label: moduleLabel,
        page_path: location.pathname,
      })
      toast.success(data.message)
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Unable to contact admin')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={palette.page}>
      <section style={palette.panel}>
        <div style={iconWrap}><i className="fas fa-lock"></i></div>
        <div style={eyebrow}>Module Restricted</div>
        <h1 style={{ ...title, color: palette.text }}>{moduleLabel}</h1>
        <p style={palette.muted}>{accessDeniedMessage(moduleLabel)}</p>
        <button type="button" onClick={contactAdmin} disabled={sending} style={{ ...primaryButton, opacity: sending ? .7 : 1, cursor: sending ? 'wait' : 'pointer' }}>
          {sending ? 'Sending Request...' : 'Contact Admin'}
        </button>
      </section>
    </div>
  )
}

const page: React.CSSProperties = { minHeight: '100%', display: 'grid', placeItems: 'center', padding: 28, background: 'linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)', color: '#F8FAFC' }
const panel: React.CSSProperties = { width: 'min(640px,100%)', padding: 34, borderRadius: 16, border: '1px solid #26364F', background: 'rgba(15,23,42,.9)', textAlign: 'center' }
const iconWrap: React.CSSProperties = { width: 58, height: 58, borderRadius: 14, display: 'grid', placeItems: 'center', margin: '0 auto 18px', background: 'rgba(218,38,38,.16)', color: '#FCA5A5', fontSize: 24 }
const eyebrow: React.CSSProperties = { color: '#10B981', letterSpacing: 4, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }
const title: React.CSSProperties = { margin: '10px 0', fontSize: 34, lineHeight: 1.12 }
const muted: React.CSSProperties = { margin: '0 auto', color: '#9DB7D8', fontSize: 17, lineHeight: 1.6, maxWidth: 520 }
const primaryButton: React.CSSProperties = { marginTop: 22, border: '1px solid #10B981', background: '#10B981', color: '#00150E', borderRadius: 10, padding: '12px 16px', fontWeight: 900, cursor: 'pointer' }

function lockedPalette(isLight: boolean) {
  const text = isLight ? '#0F172A' : '#F8FAFC'
  return {
    text,
    page: { ...page, background: isLight ? '#F8FAFC' : page.background, color: text } as React.CSSProperties,
    panel: { ...panel, border: `1px solid ${isLight ? '#CBD5E1' : '#26364F'}`, background: isLight ? '#FFFFFF' : panel.background } as React.CSSProperties,
    muted: { ...muted, color: isLight ? '#64748B' : '#9DB7D8' } as React.CSSProperties,
  }
}

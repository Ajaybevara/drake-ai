import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ACCESS_MODULES } from '../../utils/accessControl'
import { supportApi } from '../../services/api'
import { useStore } from '../../store'

type FeedbackValue = { rating: number; message: string }

const initialFeedback = () => Object.fromEntries(
  ACCESS_MODULES.map(module => [module.id, { rating: 5, message: '' }]),
) as Record<string, FeedbackValue>

export default function FeedbackWidget() {
  const location = useLocation()
  const theme = useStore(state => state.theme)
  const user = useStore(state => state.user)
  const [open, setOpen] = useState(false)
  const [requiredForLogout, setRequiredForLogout] = useState(false)
  const [requiredForExit, setRequiredForExit] = useState(false)
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<Record<string, FeedbackValue>>(initialFeedback)
  const groupedModules = useMemo(() => ACCESS_MODULES.reduce<Record<string, typeof ACCESS_MODULES>>((groups, module) => {
    groups[module.group] = [...(groups[module.group] || []), module]
    return groups
  }, {}), [])

  const isLight = theme === 'light'
  const panel = isLight ? '#FFFFFF' : '#0B111A'
  const page = isLight ? '#F1F5F9' : '#070B12'
  const card = isLight ? '#FFFFFF' : '#0E1622'
  const text = isLight ? '#0F172A' : '#F8FAFC'
  const muted = isLight ? '#64748B' : '#94A3B8'
  const border = isLight ? '#CBD5E1' : '#26364F'

  useEffect(() => {
    const requireFeedback = () => {
      setRequiredForLogout(true)
      setOpen(true)
    }
    window.addEventListener('drake:require-logout-feedback', requireFeedback)
    return () => window.removeEventListener('drake:require-logout-feedback', requireFeedback)
  }, [])

  useEffect(() => {
    if (!user) return

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (sessionStorage.getItem('drake_allow_external_navigation') === 'true') {
        sessionStorage.removeItem('drake_allow_external_navigation')
        return
      }
      if (sessionStorage.getItem('drake_exit_feedback_submitted') === 'true') return
      setRequiredForExit(true)
      setOpen(true)
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [user])

  const updateModule = (moduleId: string, patch: Partial<FeedbackValue>) => {
    setFeedback(current => ({
      ...current,
      [moduleId]: { ...current[moduleId], ...patch },
    }))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSending(true)
    try {
      const { data } = await supportApi.submitFeedback({
        page_path: location.pathname,
        modules: ACCESS_MODULES.map(module => ({
          module_id: module.id,
          module_label: module.label,
          rating: feedback[module.id]?.rating || 5,
          message: feedback[module.id]?.message.trim() || '',
        })),
      })
      toast.success(data.message)
      const shouldCloseAfterFeedback = requiredForExit
      if (shouldCloseAfterFeedback) {
        sessionStorage.setItem('drake_exit_feedback_submitted', 'true')
      }
      setFeedback(initialFeedback())
      setOpen(false)
      if (requiredForLogout) {
        setRequiredForLogout(false)
        window.dispatchEvent(new Event('drake:logout-feedback-complete'))
      }
      setRequiredForExit(false)
      if (shouldCloseAfterFeedback) {
        window.setTimeout(() => window.close(), 0)
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Unable to send feedback')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 12000, minHeight: 46, padding: '0 18px', border: '1px solid #10B981', borderRadius: 999, background: '#10B981', color: '#00150E', fontWeight: 900, cursor: 'pointer', boxShadow: '0 14px 34px rgba(16,185,129,.26)' }}>
        <i className="fas fa-comment-dots" style={{ marginRight: 8 }} />
        Feedback
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Drake AI module feedback" style={{ position: 'fixed', inset: 0, zIndex: 20000, background: page, color: text, overflowY: 'auto' }}>
          <form onSubmit={submit} style={{ width: 'min(980px,calc(100% - 32px))', margin: '0 auto', padding: '30px 0 54px' }}>
            <header style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, padding: '20px 22px', marginBottom: 18, border: `1px solid ${border}`, borderRadius: 16, background: panel, boxShadow: '0 14px 40px rgba(0,0,0,.18)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
                <img src={isLight ? '/logo_light.png' : '/logo.png'} alt="Drake AI" style={{ width: 150, height: 74, objectFit: 'contain', flex: '0 0 auto' }} />
                <div>
                <h1 style={{ margin: '7px 0 5px', fontSize: 30 }}>Drake AI Feedback</h1>
                <p style={{ margin: 0, color: muted, lineHeight: 1.5 }}>Your feedback helps us improve every module and deliver a better Drake AI experience. Rate the modules you have used and share your suggestions with our team.</p>
                </div>
              </div>
              {!requiredForLogout && !requiredForExit && <button type="button" onClick={() => setOpen(false)} aria-label="Close feedback" style={{ width: 42, height: 42, flex: '0 0 auto', border: `1px solid ${border}`, borderRadius: 10, background: card, color: text, cursor: 'pointer', fontSize: 24 }}>×</button>}
            </header>

            {Object.entries(groupedModules).map(([group, modules]) => (
              <section key={group} style={{ marginTop: 18 }}>
                <div style={{ margin: '0 0 10px 4px', color: '#10B981', fontSize: 13, fontWeight: 900, letterSpacing: 2.4, textTransform: 'uppercase' }}>{group}</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {modules.map(module => (
                    <article key={module.id} style={{ padding: 18, border: `1px solid ${border}`, borderRadius: 14, background: card }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) minmax(150px,220px)', gap: 14, alignItems: 'end' }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 900 }}>{module.label}</div>
                          <div style={{ marginTop: 4, color: muted, fontSize: 12 }}>{module.path}</div>
                        </div>
                        <label style={{ display: 'grid', gap: 6, color: muted, fontSize: 12, fontWeight: 800 }}>
                          Rating
                          <select value={feedback[module.id]?.rating || 5} onChange={event => updateModule(module.id, { rating: Number(event.target.value) })} style={{ minHeight: 42, border: `1px solid ${border}`, borderRadius: 9, background: panel, color: text, padding: '0 11px' }}>
                            {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} / 5</option>)}
                          </select>
                        </label>
                      </div>
                      <label style={{ display: 'grid', gap: 7, marginTop: 13, color: muted, fontSize: 12, fontWeight: 800 }}>
                        Feedback for {module.label}
                        <textarea value={feedback[module.id]?.message || ''} onChange={event => updateModule(module.id, { message: event.target.value })} maxLength={4000} rows={3} placeholder={`Share feedback about ${module.label}...`} style={{ resize: 'vertical', minHeight: 82, border: `1px solid ${border}`, borderRadius: 9, background: panel, color: text, padding: 11, fontFamily: 'inherit', lineHeight: 1.45 }} />
                      </label>
                    </article>
                  ))}
                </div>
              </section>
            ))}

            <div style={{ position: 'sticky', bottom: 14, display: 'flex', justifyContent: 'flex-end', gap: 10, padding: 14, marginTop: 20, border: `1px solid ${border}`, borderRadius: 14, background: panel, boxShadow: '0 16px 44px rgba(0,0,0,.28)' }}>
              {!requiredForLogout && !requiredForExit && <button type="button" onClick={() => setOpen(false)} style={{ minHeight: 46, padding: '0 18px', border: `1px solid ${border}`, borderRadius: 10, background: card, color: text, fontWeight: 900, cursor: 'pointer' }}>Cancel</button>}
              <button type="submit" disabled={sending} style={{ minHeight: 46, padding: '0 22px', border: '1px solid #10B981', borderRadius: 10, background: '#10B981', color: '#00150E', fontWeight: 900, cursor: sending ? 'wait' : 'pointer', opacity: sending ? .7 : 1 }}>
                {sending ? 'Sending All Feedback...' : 'Submit All Feedback'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

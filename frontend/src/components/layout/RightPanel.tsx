import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store'
import { aiApi, gptApi } from '../../services/api'
import CrossPlot from '../petrophysics/CrossPlot'
import FileUploadPanel from '../petrophysics/FileUploadPanel'

const MODULES = [
  { type: 'missing_log', icon: 'fas fa-brain', label: 'Missing Log Prediction' },
  { type: 'facies', icon: 'fas fa-layer-group', label: 'Facies Classification' },
  { type: 'formation_tops', icon: 'fas fa-map-signs', label: 'Formation Tops Detection' },
  { type: 'porosity', icon: 'fas fa-gauge-high', label: 'Porosity Prediction' },
  { type: 'permeability', icon: 'fas fa-droplet', label: 'Permeability Prediction' },
  { type: 'water_saturation', icon: 'fas fa-water', label: 'Water Saturation Prediction' },
  { type: 'auto_splice', icon: 'fas fa-code-branch', label: 'Auto Splice' },
]

export default function RightPanel() {
  const { activeWell, aiJobs, upsertAIJob, theme } = useStore()
  const navigate = useNavigate()
  const isLight = theme === 'light'
  const [sectionsOpen, setSectionsOpen] = useState({ upload: true, crossPlot: true, results: true, gpt: true })
  const [plotTab, setPlotTab] = useState('Cross Plot')
  const [width, setWidth] = useState(360)
  const [isResizing, setIsResizing] = useState(false)
  const [gptMessages, setGptMessages] = useState([
    { role: 'assistant', content: 'Hello! I am Drake GPT.\nAsk me anything about this well.' }
  ])
  const [gptInput, setGptInput] = useState('')
  const [gptLoading, setGptLoading] = useState(false)
  const msgsRef = useRef<HTMLDivElement>(null)

  const bg = isLight ? '#F8FAFC' : '#080D15'
  const panel = isLight ? '#FFFFFF' : '#0B111A'
  const header = isLight ? '#F1F5F9' : '#0E1622'
  const border = isLight ? '#CBD5E1' : '#1F2A3A'
  const text = isLight ? '#0F172A' : '#E2E8F0'
  const muted = isLight ? '#64748B' : '#95A3B8'
  const active = isLight ? '#DA2626' : '#FFEBEE'
  const visibleJobs = aiJobs.filter(job => job.status !== 'failed')

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [gptMessages])

  const toggleSection = (sec: keyof typeof sectionsOpen) => {
    setSectionsOpen(prev => ({ ...prev, [sec]: !prev[sec] }))
  }

  const runModule = async (jobType: string) => {
    if (!activeWell) return toast.error('Select a well first')
    try {
      const res = await aiApi.run(activeWell.id, jobType)
      upsertAIJob(res.data)
      toast.success(`Started: ${jobType.replace(/_/g, ' ')}`)
      pollJob(res.data.id)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to start job')
    }
  }

  const pollJob = (jobId: number) => {
    const iv = setInterval(async () => {
      try {
        const res = await aiApi.get(jobId)
        upsertAIJob(res.data)
        if (['completed', 'failed'].includes(res.data.status)) {
          clearInterval(iv)
          if (res.data.status === 'completed') toast.success(`${res.data.job_type} completed - ${res.data.accuracy}% accuracy`)
          else toast.error(`${res.data.job_type} failed: ${res.data.error_message}`)
        }
      } catch {
        clearInterval(iv)
      }
    }, 1500)
  }

  const runAll = () => MODULES.forEach((m, index) => setTimeout(() => runModule(m.type), index * 350))

  const sendGPT = async () => {
    if (!gptInput.trim() || !activeWell) return
    const userMsg = { role: 'user', content: gptInput }
    const newMsgs = [...gptMessages, userMsg]
    setGptMessages(newMsgs)
    setGptInput('')
    setGptLoading(true)
    try {
      const res = await gptApi.chat(activeWell.id, newMsgs)
      setGptMessages([...newMsgs, { role: 'assistant', content: res.data.reply }])
    } catch {
      setGptMessages([...newMsgs, { role: 'assistant', content: 'I encountered an error. Please try again.' }])
    } finally {
      setGptLoading(false)
    }
  }

  const startResizing = (e: React.MouseEvent) => {
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = width
    const onMouseMove = (moveEvent: MouseEvent) => setWidth(Math.max(300, Math.min(620, startWidth - (moveEvent.clientX - startX))))
    const onMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const Section = ({ id, title, icon, children, minHeight }: any) => (
    <div style={{ flexShrink: 0, border: `1px solid ${border}`, borderRadius: 8, overflow: 'hidden', background: panel, minHeight: sectionsOpen[id as keyof typeof sectionsOpen] ? minHeight : 'auto' }}>
      <div onClick={() => toggleSection(id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: header, cursor: 'pointer', borderBottom: sectionsOpen[id as keyof typeof sectionsOpen] ? `1px solid ${border}` : 'none' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: text, letterSpacing: .3, display: 'flex', alignItems: 'center', gap: 9 }}>
          <i className={icon} style={{ fontSize: 14 }}></i> {title}
        </div>
        <i className={`fas fa-chevron-${sectionsOpen[id as keyof typeof sectionsOpen] ? 'up' : 'down'}`} style={{ color: muted, fontSize: 12 }}></i>
      </div>
      {sectionsOpen[id as keyof typeof sectionsOpen] && children}
    </div>
  )

  const TabBar = ({ tabs, selected, setSelected }: any) => (
    <div style={{ display: 'flex', padding: '0 10px', background: header, borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
      {tabs.map((t: string) => (
        <div key={t} onClick={() => setSelected(t)} style={{ padding: '8px 12px', fontSize: 12.4, color: selected === t ? active : muted, cursor: 'pointer', borderBottom: selected === t ? '3px solid #DA2626' : '3px solid transparent', fontWeight: selected === t ? 800 : 600 }}>
          {t}
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ width, background: bg, borderLeft: `1px solid ${border}`, display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0, padding: 8, gap: 8, position: 'relative' }}>
      <div onMouseDown={startResizing} style={{ width: 4, cursor: 'col-resize', position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 10, background: isResizing ? '#DA2626' : 'transparent', transition: 'background .2s' }} />

      <Section id="results" title="AI Results" icon="fas fa-chart-bar">
        <div style={{ padding: '9px 12px', maxHeight: 320, overflowY: 'auto' }}>
          {visibleJobs.length === 0 && <div style={{ fontSize: 9, color: muted, textAlign: 'center', padding: '12px 0' }}>No active AI analyses. Use AI Prediction or AI Uncertainty for LAS calculations.</div>}
          {visibleJobs.map(job => (
            <div key={job.id} className="animate-in" style={{ background: isLight ? '#F8FAFC' : '#101927', border: `1px solid ${isLight ? '#CBD5E1' : '#223047'}`, borderRadius: 6, padding: 9, marginBottom: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ fontSize: 9.4, fontWeight: 700, color: text, textTransform: 'capitalize' }}>{job.job_type.replace(/_/g, ' ')}</div>
                <span style={{ fontSize: 7.5, padding: '2px 7px', borderRadius: 10, fontWeight: 700, background: job.status === 'completed' ? '#D1FAE5' : job.status === 'running' ? '#DBEAFE' : job.status === 'failed' ? '#FEE2E2' : '#F1F5F9', color: job.status === 'completed' ? '#065F46' : job.status === 'running' ? '#DA2626' : job.status === 'failed' ? '#991B1B' : '#64748B' }}>{job.status}</span>
              </div>
              <div style={{ height: 4, background: isLight ? '#E2E8F0' : '#223047', borderRadius: 2, marginBottom: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${job.progress}%`, background: job.status === 'completed' ? '#388E3C' : '#DA2626', borderRadius: 2 }}></div>
              </div>
              {job.accuracy && <div style={{ fontSize: 8.2, color: muted, marginBottom: 5 }}>Accuracy: <strong style={{ color: text }}>{job.accuracy}%</strong>{job.confidence && <> · Confidence: <strong style={{ color: text }}>{job.confidence}</strong></>}</div>}
              {job.status === 'completed' && (
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => toast.success('Opening AI results')} style={{ flex: 1, padding: 5, borderRadius: 5, fontSize: 8.6, fontWeight: 600, cursor: 'pointer', border: '1px solid #DA2626', background: '#DA2626', color: '#fff', fontFamily: 'DM Sans,sans-serif' }}>View Results</button>
                  <button onClick={() => toast.success('LAS export queued')} style={{ flex: 1, padding: 5, borderRadius: 5, fontSize: 8.6, fontWeight: 600, cursor: 'pointer', border: `1px solid ${border}`, background: panel, color: text, fontFamily: 'DM Sans,sans-serif' }}>Export LAS</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section id="gpt" title="Drake GPT (AI Assistant)" icon="fas fa-robot" minHeight={220}>
            <div style={{ padding: '9px 12px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button onClick={() => runAll()} style={{ padding: '6px 8px', borderRadius: 6, background: '#0E1622', border: `1px solid ${border}`, color: text, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Analyze this well</button>
                <button onClick={() => toast('Finding pay zones...')} style={{ padding: '6px 8px', borderRadius: 6, background: '#0E1622', border: `1px solid ${border}`, color: text, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Find pay zones</button>
                <button onClick={() => navigate('/petrophysics/log-qc')} style={{ padding: '6px 8px', borderRadius: 6, background: '#0E1622', border: `1px solid ${border}`, color: text, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Explain QC issues</button>
              </div>
            </div>
            <div ref={msgsRef} style={{ padding: '9px 12px', overflowY: 'auto', maxHeight: 160 }}>
          {gptMessages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'assistant' ? 'flex-start' : 'flex-end', gap: 7, marginBottom: 8 }}>
              {m.role === 'assistant' && <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#DA2626,#9B1B1B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7.5, color: '#fff', fontWeight: 700, flexShrink: 0 }}>AI</div>}
              <div style={{ background: m.role === 'assistant' ? (isLight ? '#EEF2FF' : '#181E32') : (isLight ? '#DBEAFE' : '#13243A'), borderRadius: m.role === 'assistant' ? '0 7px 7px 7px' : '7px 0 7px 7px', padding: '6px 9px', fontSize: 9, color: text, lineHeight: 1.5, whiteSpace: 'pre-wrap', maxWidth: '85%' }}>{m.content}</div>
            </div>
          ))}
          {gptLoading && <div style={{ fontSize: 9, color: muted, paddingLeft: 32 }}>Thinking...</div>}
        </div>
            <div style={{ padding: '8px 12px', display: 'flex', gap: 8 }}>
              <button onClick={() => toast('Generating report...')} style={{ flex: 1, padding: '8px 10px', borderRadius: 6, background: '#DA2626', border: 'none', color: '#fff', fontWeight: 800, fontSize: 12 }}>Generate PDF Report</button>
              <button onClick={() => toast('Comparing offset wells...')} style={{ padding: '8px 10px', borderRadius: 6, background: 'transparent', border: `1px solid ${border}`, color: text, fontWeight: 700, fontSize: 12 }}>Compare wells</button>
              <button onClick={() => runModule('missing_log')} style={{ padding: '8px 10px', borderRadius: 6, background: 'transparent', border: `1px solid ${border}`, color: text, fontWeight: 700, fontSize: 12 }}>Predict missing logs</button>
            </div>
        <div style={{ display: 'flex', gap: 5, padding: '7px 10px', borderTop: `1px solid ${border}` }}>
          <input value={gptInput} onChange={e => setGptInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendGPT()} placeholder="Ask a question..." style={{ flex: 1, background: isLight ? '#FFFFFF' : '#080D15', border: `1px solid ${border}`, borderRadius: 6, padding: '5px 9px', fontSize: 9, outline: 'none', fontFamily: 'DM Sans,sans-serif', color: text }} />
          <button onClick={sendGPT} disabled={gptLoading} style={{ width: 28, height: 28, background: '#1D4ED8', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fas fa-paper-plane" style={{ fontSize: 11 }}></i>
          </button>
        </div>
      </Section>
    </div>
  )
}

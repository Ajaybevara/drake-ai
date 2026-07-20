import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store'
import { gptApi } from '../../services/api'

export default function FloatingChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<{role: 'user' | 'bot', text: string}[]>([
    { role: 'bot', text: 'Hello! I am Drake. How can I assist you with your petroleum data today?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const { theme, enterpriseProject } = useStore()
  const isLight = theme === 'light'
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleSend = async () => {
    if (!input.trim()) return
    const question = input.trim()
    const nextMessages = [...messages, { role: 'user' as const, text: question }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const apiMessages = nextMessages
        .filter(message => message.role !== 'bot' || message.text !== 'Hello! I am Drake. How can I assist you with your petroleum data today?')
        .slice(-10)
        .map(message => ({ role: message.role === 'bot' ? 'assistant' : 'user', content: message.text }))
      const { data } = await gptApi.projectChat(apiMessages, buildProjectContext(enterpriseProject))
      setMessages(prev => [...prev, { role: 'bot', text: data.reply || 'I could not generate a response for that question.' }])
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'bot', text: error?.response?.data?.detail || localProjectAnswer(question, enterpriseProject) }])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  return (
    <>
      {isOpen && (
        <div style={{
          position: 'fixed', right: 24, bottom: 90, width: 320, height: 400, zIndex: 250,
          background: isLight ? '#FFFFFF' : '#0B111A', borderRadius: 12,
          border: `1px solid ${isLight ? '#CBD5E1' : '#1F2A3A'}`,
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', fontFamily: 'DM Sans,sans-serif'
        }}>
          <div style={{ background: 'linear-gradient(135deg,#9B1B1B,#DA2626)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <img src="/drake%20bot.png" alt="Drake Bot" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: '50%' }} />
              Drake Assistant
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          
          <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                <div style={{
                  background: msg.role === 'user' ? (isLight ? '#E2E8F0' : '#1E293B') : (isLight ? '#FFEBEE' : '#172554'),
                  color: isLight ? '#0F172A' : '#F8FAFC',
                  padding: '10px 14px', borderRadius: 12,
                  borderBottomRightRadius: msg.role === 'user' ? 2 : 12,
                  borderBottomLeftRadius: msg.role === 'bot' ? 2 : 12,
                  fontSize: 14, lineHeight: 1.4
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', maxWidth: '80%' }}>
                <div style={{
                  background: isLight ? '#FFEBEE' : '#172554',
                  color: isLight ? '#0F172A' : '#F8FAFC',
                  padding: '10px 14px', borderRadius: 12,
                  borderBottomLeftRadius: 2,
                  fontSize: 14, lineHeight: 1.4
                }}>
                  Thinking with your project data...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: 12, borderTop: `1px solid ${isLight ? '#E2E8F0' : '#1F2A3A'}`, display: 'flex', gap: 8 }}>
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask me anything..." 
              disabled={loading}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 20, border: `1px solid ${isLight ? '#CBD5E1' : '#334155'}`, background: isLight ? '#F8FAFC' : '#0F172A', color: isLight ? '#0F172A' : '#F8FAFC', outline: 'none' }}
            />
            <button onClick={handleSend} disabled={loading} style={{ width: 40, height: 40, borderRadius: '50%', background: loading ? '#64748B' : '#10B981', color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Drake Chatbot"
        style={{
          position: 'fixed', right: 24, bottom: 24, zIndex: 250, width: 50, height: 50,
          borderRadius: '50%', border: 'none',
          background: '#000', color: '#F8FAFC',
          boxShadow: '0 18px 42px rgba(0,0,0,.34), 0 0 0 4px rgba(0,0,0,.05)',
          display: 'grid', placeItems: 'center', cursor: 'pointer', overflow: 'hidden', padding: 0
        }}
      >
        <img src="/drake%20bot.png" alt="Drake Bot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </button>
    </>
  )
}

function buildProjectContext(project: any) {
  return {
    project_name: project?.project_name || project?.name || '',
    project_type: project?.project_type || '',
    description: project?.description || '',
    uploaded_files: project?.uploaded_files || project?.files || [],
    generated_results: project?.generated_results || project?.outputs || [],
    exported_files: project?.exported_files || [],
    module_history: project?.module_history || project?.activity || [],
  }
}

function localProjectAnswer(question: string, project: any) {
  const context = buildProjectContext(project)
  const text = question.toLowerCase()
  const files = context.uploaded_files || []
  const results = context.generated_results || []
  const history = context.module_history || []
  const projectName = context.project_name || 'the active project'

  const matchedFiles = relevantItems(text, files)
  const matchedResults = relevantItems(text, results)
  const moduleCounts = countBy(results, (item: any) => item.module_name || item.module || 'Unknown module')

  if (text.includes('well') || text.includes('wells')) {
    if (!files.length && !results.length) return `I do not see well files or generated well results in ${projectName} yet. Upload well data first, then I can explain each well from the available records.`
    const wells = inferWellNames(files, results)
    const wellLines = wells.slice(0, 12).map((name, index) => `${index + 1}. ${name}`).join('\n')
    const moduleText = moduleCounts.length ? ` Generated result modules available: ${moduleCounts.slice(0, 6).map(item => `${item.name} (${item.count})`).join(', ')}.` : ''
    return `Based on ${projectName}, I found ${wells.length || files.length} possible well/data entries.${moduleText}\n${wellLines || 'The uploaded files do not expose clean well names, but I can still summarize by file or result name.'}`
  }

  if (text.includes('module') || text.includes('access') || text.includes('run')) {
    if (!moduleCounts.length) return `No generated module outputs are saved in ${projectName} yet. Run a module, then I can explain what it produced.`
    return `Saved module outputs in ${projectName}: ${moduleCounts.map(item => `${item.name}: ${item.count}`).join(', ')}. Ask about one module name and I will focus on those results.`
  }

  if (matchedFiles.length || matchedResults.length) {
    const fileText = matchedFiles.slice(0, 5).map((file: any) => file.file_name || file.name || 'Unnamed file').join(', ')
    const resultText = matchedResults.slice(0, 5).map((result: any) => resultSummary(result)).join('\n')
    return [
      matchedFiles.length ? `Matching uploaded files: ${fileText}.` : '',
      matchedResults.length ? `Matching generated results:\n${resultText}` : '',
    ].filter(Boolean).join('\n')
  }

  if (text.includes('file') || text.includes('upload') || text.includes('data')) {
    if (!files.length) return 'I do not see uploaded files in the active project yet. Upload files first, then I can summarize them.'
    const groups = countBy(files, (file: any) => file.bucket || file.file_type || file.type || 'file')
    const names = files.slice(0, 8).map((file: any) => file.file_name || file.name || 'Unnamed file').join(', ')
    return `I found ${files.length} uploaded file(s) in ${projectName}. Types: ${groups.map(item => `${item.name} (${item.count})`).join(', ')}. Recent files: ${names}.`
  }
  if (text.includes('result') || text.includes('analysis') || text.includes('prediction')) {
    if (!results.length) return 'I do not see generated results yet. Run a module first, then I can summarize the outputs.'
    return `I found ${results.length} generated result(s). Latest results:\n${results.slice(0, 5).map((result: any) => resultSummary(result)).join('\n')}`
  }
  if (text.includes('history') || text.includes('recent') || text.includes('workflow')) {
    if (!history.length) return 'No workflow history is available for the active project yet.'
    return `Latest workflow activity:\n${history.slice(0, 6).map((item: any) => `${item.timestamp || item.created_at || ''} ${item.module_name || item.text || 'Project activity'} ${item.action || ''} ${item.status || ''}`.trim()).join('\n')}`
  }
  if (text.includes('summary') || text.includes('summarize') || text.includes('overview')) {
    return `Project summary for ${projectName}: ${files.length} uploaded file(s), ${results.length} generated result(s), and ${history.length} workflow record(s). Result modules: ${moduleCounts.map(item => `${item.name} (${item.count})`).join(', ') || 'none yet'}.`
  }
  return `I do not have an exact saved value for that question in ${projectName}. I can answer from available project records: ${files.length} uploaded file(s), ${results.length} generated result(s), and ${history.length} workflow record(s). Ask about a well name, file name, module name, latest result, or project history.`
}

function textOf(value: any): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(textOf).join(' ')
  if (typeof value === 'object') return Object.values(value).map(textOf).join(' ')
  return ''
}

function tokens(text: string) {
  const stop = new Set(['the', 'and', 'with', 'from', 'that', 'this', 'what', 'give', 'show', 'tell', 'each', 'explain', 'about'])
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 2 && !stop.has(token))
}

function relevantItems(question: string, items: any[]) {
  const queryTokens = tokens(question)
  if (!queryTokens.length) return []
  return items
    .map(item => ({ item, score: queryTokens.filter(token => textOf(item).toLowerCase().includes(token)).length }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.item)
}

function countBy(items: any[], getName: (item: any) => string) {
  const counts = new Map<string, number>()
  items.forEach(item => {
    const name = getName(item) || 'Unknown'
    counts.set(name, (counts.get(name) || 0) + 1)
  })
  return Array.from(counts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
}

function inferWellNames(files: any[], results: any[]) {
  const names = new Set<string>()
  files.forEach(file => {
    const raw = file.file_name || file.name
    if (!raw) return
    const cleaned = String(raw).replace(/\.[^.]+$/, '').replace(/[_-]?(las|log|well|data|csv|xlsx?)$/i, '').replace(/[_-]+/g, ' ').trim()
    if (cleaned) names.add(cleaned)
  })
  results.forEach(result => {
    const raw = result.well_name || result.well || result.result_preview?.well_name
    if (raw) names.add(String(raw))
  })
  return Array.from(names)
}

function resultSummary(result: any) {
  const name = result.file_name || result.prediction_name || result.name || 'Unnamed result'
  const moduleName = result.module_name || result.module || 'Unknown module'
  const preview = result.result_preview ? ` - ${textOf(result.result_preview).slice(0, 260)}` : ''
  return `${name} (${moduleName})${preview}`
}

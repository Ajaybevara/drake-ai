import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import toast from 'react-hot-toast'
import { slmGptApi } from '../services/api'
import { useStore } from '../store'
import { saveResultToLocalProject, uploadFilesToLocalProject } from '../utils/localProjectStorage'

type Workspace = {
  workspace_id: string
  name: string
  document_count: number
  chunk_count: number
  updated_at: string
}

type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
  sources?: any[]
  mode?: string
}

type ChatThread = {
  id: string
  title: string
  documentKey: string
  documentIds: string[]
  messages: ChatMessage[]
  updatedAt: string
}

const starterMessage: ChatMessage = {
  role: 'assistant',
  text: 'Open or create a Drake SLM/GPT workspace, upload oil and gas documents, then ask questions from the indexed content.',
}

export default function DrakeSlmGptPage() {
  const { theme, user, enterpriseProject, setEnterpriseProject } = useStore()
  const isLight = theme === 'light'
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])
  const [workspaceName, setWorkspaceName] = useState('Latest-Drake')
  const [question, setQuestion] = useState('')
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState('')
  const [engineStatus, setEngineStatus] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [chatBusy, setChatBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const palette = useMemo(() => ({
    page: isLight ? '#F8FAFC' : '#050B14',
    card: isLight ? '#FFFFFF' : '#0B1320',
    cardSoft: isLight ? '#F1F5F9' : '#07111F',
    border: isLight ? '#DCE6F2' : '#1E2B3F',
    text: isLight ? '#0F172A' : '#F8FAFC',
    muted: isLight ? '#64748B' : '#9FB2CC',
    accent: '#EF4444',
    green: '#10B981',
  }), [isLight])

  const activeProjectId = enterpriseProject?.project_id || ''
  const activeUserId = user?.id ? String(user.id) : 'guest'

  useEffect(() => {
    setWorkspaceName(enterpriseProject?.project_name || 'Latest-Drake')
    setActiveWorkspace(null)
    setDocuments([])
    setSelectedDocumentIds([])
    if (activeProjectId) refreshWorkspaces(activeProjectId)
  }, [activeProjectId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeThreadId, chatThreads, chatBusy])

  useEffect(() => {
    slmGptApi.status()
      .then(({ data }) => setEngineStatus(data))
      .catch(() => setEngineStatus(null))
  }, [])

  const activeThread = chatThreads.find(thread => thread.id === activeThreadId)
  const messages = activeThread?.messages || [starterMessage]

  const refreshWorkspaces = async (projectId = activeProjectId) => {
    if (!projectId) return
    try {
      const { data } = await slmGptApi.listWorkspaces(projectId)
      const list = data.workspaces || []
      setWorkspaces(list)
      if (!activeWorkspace && list.length) openWorkspace(list[0].workspace_id)
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to load SLM/GPT workspaces')
    }
  }

  const openWorkspace = async (workspaceId: string) => {
    setBusy(true)
    try {
      const { data } = await slmGptApi.getWorkspace(workspaceId)
      setActiveWorkspace(data)
      const workspaceDocs = data.documents || []
      setDocuments(workspaceDocs)
      setSelectedDocumentIds(workspaceDocs.map((doc: any) => doc.document_id))
      hydrateThreads(data.workspace_id, workspaceDocs)
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Workspace open failed')
    } finally {
      setBusy(false)
    }
  }

  const hydrateThreads = (workspaceId: string, docs: any[]) => {
    const key = historyStorageKey(workspaceId, activeUserId, activeProjectId)
    let stored: ChatThread[] = []
    try {
      stored = JSON.parse(localStorage.getItem(key) || localStorage.getItem(legacyHistoryStorageKey(workspaceId)) || '[]')
      if (stored.length && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(stored.slice(0, 40)))
    } catch {
      stored = []
    }
    setChatThreads(stored)
    if (stored.length) setActiveThreadId(stored[0].id)
    else {
      const allIds = docs.map((doc: any) => doc.document_id)
      const thread = makeThread(allIds, docs)
      setChatThreads([thread])
      setActiveThreadId(thread.id)
    }
  }

  const persistThreads = (workspaceId: string, threads: ChatThread[]) => {
    try {
      localStorage.setItem(historyStorageKey(workspaceId, activeUserId, activeProjectId), JSON.stringify(threads.slice(0, 40)))
    } catch {
      // Chat still works; only local history persistence failed.
    }
  }

  useEffect(() => {
    if (!activeWorkspace || !documents.length || !selectedDocumentIds.length) return
    const documentKey = selectionKey(selectedDocumentIds)
    const existing = chatThreads.find(thread => thread.documentKey === documentKey)
    if (existing) {
      setActiveThreadId(existing.id)
      return
    }
    const thread = makeThread(selectedDocumentIds, documents)
    const next = [thread, ...chatThreads]
    setChatThreads(next)
    setActiveThreadId(thread.id)
    persistThreads(activeWorkspace.workspace_id, next)
  }, [selectionKey(selectedDocumentIds), activeWorkspace?.workspace_id, documents.length])

  const createWorkspace = async () => {
    if (!activeProjectId) return toast.error('Open or create a Drake project first')
    if (!workspaceName.trim()) return toast.error('Enter workspace name')
    setBusy(true)
    try {
      const { data } = await slmGptApi.createWorkspace(workspaceName.trim(), activeProjectId)
      setWorkspaces(prev => [data, ...prev])
      setActiveWorkspace(data)
      setDocuments([])
      setSelectedDocumentIds([])
      toast.success('SLM/GPT workspace created')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Workspace creation failed')
    } finally {
      setBusy(false)
    }
  }

  const uploadDocuments = async (files: FileList | null) => {
    if (!activeProjectId) return toast.error('Open or create a Drake project first')
    if (!files?.length) return
    setBusy(true)
    try {
      let workspace = activeWorkspace
      if (!workspace) {
        const created = await slmGptApi.createWorkspace(workspaceName.trim() || enterpriseProject?.project_name || 'Drake SLM/GPT', activeProjectId)
        workspace = created.data
        setActiveWorkspace(workspace)
        setWorkspaces(prev => [workspace as Workspace, ...prev])
      }
      if (!workspace) throw new Error('Workspace creation failed')
      const workspaceId = workspace.workspace_id
      const uploaded: any[] = []
      for (const file of Array.from(files)) {
        const { data } = await slmGptApi.uploadDocument(workspaceId, file)
        uploaded.push(data)
      }
      if (enterpriseProject) {
        try {
          const { data } = await uploadFilesToLocalProject(enterpriseProject, Array.from(files))
          const result = await saveResultToLocalProject(data.project, {
            module_name: 'Drake SLM/GPT',
            prediction_name: `${workspace.name || 'workspace'} document index`,
            extension: 'json',
            result_payload: {
              action: 'documents_indexed',
              workspace_id: workspaceId,
              workspace_name: workspace.name,
              uploaded_documents: uploaded.map(item => ({
                document_id: item.document_id,
                file_name: item.file_name,
                file_type: item.file_type,
                size_bytes: item.size_bytes,
                chunk_count: item.chunk_count,
                uploaded_at: item.uploaded_at,
              })),
            },
          })
          setEnterpriseProject(result.data.project)
        } catch {
          // SLM/GPT backend indexing succeeded; project-folder copy is optional.
        }
      }
      await openWorkspace(workspaceId)
      await refreshWorkspaces()
      toast.success(`${uploaded.length} document(s) indexed`)
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Document indexing failed')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const askQuestion = async () => {
    if (!activeWorkspace) return toast.error('Open a workspace first')
    if (!selectedDocumentIds.length) return toast.error('Select at least one indexed file')
    if (!question.trim()) return
    const prompt = question.trim()
    const threadId = activeThreadId || makeThread(selectedDocumentIds, documents).id
    updateThreadMessages(threadId, [{ role: 'user', text: prompt }])
    setQuestion('')
    setChatBusy(true)
    try {
      const { data } = await slmGptApi.chat(activeWorkspace.workspace_id, prompt, selectedDocumentIds)
      updateThreadMessages(threadId, [{ role: 'assistant', text: data.answer, sources: data.sources || [], mode: data.mode }])
      await saveSlmChatResult(prompt, data)
    } catch (error: any) {
      updateThreadMessages(threadId, [{ role: 'assistant', text: error?.response?.data?.detail || 'SLM/GPT could not answer from the indexed workspace.' }])
    } finally {
      setChatBusy(false)
    }
  }

  const saveSlmChatResult = async (prompt: string, response: any) => {
    if (!enterpriseProject || !activeWorkspace) return
    try {
      const selectedDocs = documents.filter(doc => selectedDocumentIds.includes(doc.document_id))
      const { data } = await saveResultToLocalProject(enterpriseProject, {
        module_name: 'Drake SLM/GPT',
        prediction_name: prompt.slice(0, 70) || 'slm_gpt_answer',
        extension: 'json',
        result_payload: {
          action: 'knowledge_chat',
          question: prompt,
          answer: response.answer,
          mode: response.mode,
          workspace_id: activeWorkspace.workspace_id,
          workspace_name: activeWorkspace.name,
          selected_documents: selectedDocs.map(doc => ({
            document_id: doc.document_id,
            file_name: doc.file_name,
            file_type: doc.file_type,
          })),
          sources: response.sources || [],
          created_at: new Date().toISOString(),
        },
      })
      setEnterpriseProject(data.project)
    } catch {
      // Chat answer remains visible; project history save can be retried after reopening the local project folder.
    }
  }

  const updateThreadMessages = (threadId: string, additions: ChatMessage[]) => {
    if (!activeWorkspace) return
    setChatThreads(prev => {
      let found = false
      const next = prev.map(thread => {
        if (thread.id !== threadId) return thread
        found = true
        return { ...thread, messages: [...thread.messages, ...additions], updatedAt: new Date().toISOString() }
      })
      const finalThreads = found ? next : [{ ...makeThread(selectedDocumentIds, documents), id: threadId, messages: [starterMessage, ...additions] }, ...next]
      persistThreads(activeWorkspace.workspace_id, finalThreads)
      return finalThreads
    })
    setActiveThreadId(threadId)
  }

  const stats = [
    { label: 'Workspaces', value: workspaces.length },
    { label: 'Selected Files', value: selectedDocumentIds.length },
    { label: 'Text Chunks', value: activeWorkspace?.chunk_count || 0 },
  ]

  return (
    <div style={{ minHeight: '100%', overflow: 'auto', background: palette.page, color: palette.text, padding: 24 }}>
      <section style={{ border: `1px solid ${palette.border}`, background: palette.card, borderRadius: 8, padding: 22, display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'center' }}>
        <div>
          <div style={{ color: palette.green, fontSize: 12, fontWeight: 900, letterSpacing: 5, textTransform: 'uppercase' }}>Drake AI Digitizer</div>
          <h1 style={{ margin: '8px 0 6px', fontSize: 34, lineHeight: 1.1 }}>Drake SLM/GPT</h1>
          <p style={{ margin: 0, color: palette.muted, maxWidth: 820 }}>
            Project-scoped Oil & Gas RAG workspace from the uploaded ZIP: index engineering documents, select files, ask grounded questions, and keep data separated per Drake project/user.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {stats.map(stat => (
            <div key={stat.label} style={{ minWidth: 112, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '12px 14px', background: palette.cardSoft }}>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{stat.value}</div>
              <div style={{ color: palette.muted, fontSize: 11, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '330px minmax(0, 1fr) 260px', gap: 18, marginTop: 18, alignItems: 'start' }}>
        <aside style={{ border: `1px solid ${palette.border}`, background: palette.card, borderRadius: 8, padding: 16 }}>
          <PanelTitle label="Workspace" accent={palette.green} />
          {!activeProjectId ? (
            <div style={{ border: `1px solid ${palette.border}`, background: palette.cardSoft, color: palette.muted, borderRadius: 8, padding: 12, marginBottom: 14, lineHeight: 1.5 }}>
              Open or create a Drake project first. SLM/GPT stores indexed files inside the active project only.
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} style={inputStyle(palette)} placeholder="Workspace name" />
            <button onClick={createWorkspace} disabled={busy || !activeProjectId} style={buttonStyle(palette.green)}>New</button>
          </div>
          <div style={{ display: 'grid', gap: 8, maxHeight: 250, overflow: 'auto' }}>
            {workspaces.map(workspace => (
              <button key={workspace.workspace_id} onClick={() => openWorkspace(workspace.workspace_id)} style={{
                textAlign: 'left',
                border: `1px solid ${activeWorkspace?.workspace_id === workspace.workspace_id ? palette.green : palette.border}`,
                background: activeWorkspace?.workspace_id === workspace.workspace_id ? 'rgba(16,185,129,.12)' : palette.cardSoft,
                color: palette.text,
                borderRadius: 8,
                padding: 12,
                cursor: 'pointer',
              }}>
                <div style={{ fontWeight: 900 }}>{workspace.name}</div>
                <div style={{ color: palette.muted, fontSize: 12 }}>{workspace.document_count} docs - {workspace.chunk_count} chunks</div>
              </button>
            ))}
            {!workspaces.length ? <EmptyText text="No SLM/GPT workspaces yet." color={palette.muted} /> : null}
          </div>

          <div style={{ height: 1, background: palette.border, margin: '16px 0' }} />
          <PanelTitle label="Index Documents" accent={palette.green} />
          <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.csv,.json,.md,.docx,.las" onChange={event => uploadDocuments(event.target.files)} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy || !activeProjectId} style={{ ...buttonStyle(palette.accent), width: '100%', height: 44 }}>
            <i className="fas fa-file-arrow-up"></i>&nbsp;&nbsp; Upload Documents
          </button>
          <p style={{ color: palette.muted, fontSize: 12, lineHeight: 1.55 }}>Supports PDF, DOCX, TXT, CSV, JSON, MD, LAS, and ZIP files. Files are stored only under this active project workspace.</p>

          <div style={{ height: 1, background: palette.border, margin: '16px 0' }} />
          <PanelTitle label="Indexed Documents" accent={palette.green} />
          {documents.length ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button onClick={() => setSelectedDocumentIds(documents.map(doc => doc.document_id))} style={smallButtonStyle(palette)}>All</button>
              <button onClick={() => setSelectedDocumentIds([])} style={smallButtonStyle(palette)}>None</button>
            </div>
          ) : null}
          <div style={{ display: 'grid', gap: 8, maxHeight: 330, overflow: 'auto' }}>
            {documents.map(doc => (
              <label key={doc.document_id} style={{ border: `1px solid ${selectedDocumentIds.includes(doc.document_id) ? palette.green : palette.border}`, borderRadius: 8, padding: 10, background: selectedDocumentIds.includes(doc.document_id) ? 'rgba(16,185,129,.12)' : palette.cardSoft, cursor: 'pointer', display: 'block' }}>
                <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={selectedDocumentIds.includes(doc.document_id)}
                    onChange={event => {
                      setSelectedDocumentIds(prev => event.target.checked
                        ? Array.from(new Set([...prev, doc.document_id]))
                        : prev.filter(id => id !== doc.document_id))
                    }}
                    style={{ marginTop: 4 }}
                  />
                  <div>
                    <div style={{ fontWeight: 900, wordBreak: 'break-word' }}>{doc.file_name}</div>
                    <div style={{ color: palette.muted, fontSize: 12 }}>{doc.file_type || 'file'} - {Math.round((doc.size_bytes || 0) / 1024)} KB</div>
                    <p style={{ color: palette.muted, fontSize: 12, lineHeight: 1.45, margin: '8px 0 0' }}>{doc.text_preview}</p>
                  </div>
                </div>
              </label>
            ))}
            {!documents.length ? <EmptyText text="Upload documents to start RAG answers." color={palette.muted} /> : null}
          </div>
        </aside>

        <main style={{ border: `1px solid ${palette.border}`, background: palette.card, borderRadius: 8, minHeight: 680, display: 'grid', gridTemplateRows: 'auto 1fr auto' }}>
          <div style={{ padding: 16, borderBottom: `1px solid ${palette.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: palette.green, fontSize: 12, fontWeight: 900, letterSpacing: 4, textTransform: 'uppercase' }}>Knowledge Chat</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{activeWorkspace?.name || 'No workspace selected'}</div>
              <div style={{ color: palette.muted, fontSize: 12, marginTop: 3 }}>
                {activeProjectId ? `Project: ${enterpriseProject?.project_name || activeProjectId}` : 'No active project'}
              </div>
            </div>
            <span style={{ border: `1px solid ${palette.border}`, color: palette.muted, borderRadius: 999, padding: '7px 12px', fontSize: 12, fontWeight: 900 }}>
              {engineStatus?.vllm_reachable ? 'vLLM Ready' : activeWorkspace ? 'RAG Ready' : 'Create Workspace'}
            </span>
          </div>

          <div style={{ padding: 18, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.map((message, index) => (
              <div key={index} style={{ alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: message.role === 'user' ? '72%' : '92%' }}>
                <div style={{
                  background: message.role === 'user' ? 'rgba(239,68,68,.18)' : palette.cardSoft,
                  border: `1px solid ${message.role === 'user' ? 'rgba(239,68,68,.35)' : palette.border}`,
                  color: palette.text,
                  borderRadius: 8,
                  padding: '12px 14px',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}>
                  {message.mode ? <div style={{ color: palette.green, fontSize: 11, fontWeight: 900, marginBottom: 6, textTransform: 'uppercase' }}>{message.mode}</div> : null}
                  {message.text}
                </div>
                {message.sources?.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {message.sources.map((source, sourceIndex) => (
                      <span key={sourceIndex} style={{ color: palette.muted, border: `1px solid ${palette.border}`, borderRadius: 999, padding: '4px 8px', fontSize: 11 }}>
                        {source.file_name} #{source.chunk_index + 1}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {chatBusy ? <div style={{ color: palette.muted }}>Drake SLM/GPT is searching indexed documents...</div> : null}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: 16, borderTop: `1px solid ${palette.border}`, display: 'flex', gap: 10 }}>
            <input
              value={question}
              onChange={event => setQuestion(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && askQuestion()}
              placeholder="Ask from selected indexed file(s)..."
              style={inputStyle(palette)}
              disabled={chatBusy || !activeWorkspace || !selectedDocumentIds.length}
            />
            <button onClick={askQuestion} disabled={chatBusy || !activeWorkspace || !selectedDocumentIds.length} style={{ ...buttonStyle(palette.green), width: 52 }}>
              <i className={`fas ${chatBusy ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
            </button>
          </div>
        </main>

        <aside style={{ border: `1px solid ${palette.border}`, background: palette.card, borderRadius: 8, padding: 14, maxHeight: 760, overflow: 'auto' }}>
          <PanelTitle label="Chat History" accent={palette.green} />
          <div style={{ border: `1px solid ${engineStatus?.vllm_reachable ? palette.green : palette.border}`, background: engineStatus?.vllm_reachable ? 'rgba(16,185,129,.12)' : palette.cardSoft, borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 12 }}>{engineStatus?.vllm_reachable ? 'vLLM Connected' : 'Local Fallback'}</div>
            <div style={{ color: palette.muted, fontSize: 11, marginTop: 4, wordBreak: 'break-word' }}>{engineStatus?.llm_model || 'qwen2.5-7b-instruct'}</div>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {chatThreads.map(thread => (
              <button key={thread.id} onClick={() => {
                setActiveThreadId(thread.id)
                setSelectedDocumentIds(thread.documentIds)
              }} style={{
                textAlign: 'left',
                border: `1px solid ${thread.id === activeThreadId ? palette.green : palette.border}`,
                background: thread.id === activeThreadId ? 'rgba(16,185,129,.12)' : palette.cardSoft,
                color: palette.text,
                borderRadius: 8,
                padding: 10,
                cursor: 'pointer',
              }}>
                <div style={{ fontWeight: 900, fontSize: 13, lineHeight: 1.25 }}>{thread.title}</div>
                <div style={{ color: palette.muted, fontSize: 11, marginTop: 5 }}>{thread.messages.filter(message => message.role === 'user').length} question(s)</div>
              </button>
            ))}
            {!chatThreads.length ? <EmptyText text="Select files to start a chat thread." color={palette.muted} /> : null}
          </div>
        </aside>
      </section>
    </div>
  )
}

function PanelTitle({ label, accent }: { label: string; accent: string }) {
  return <div style={{ color: accent, fontSize: 12, fontWeight: 900, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
}

function EmptyText({ text, color }: { text: string; color: string }) {
  return <div style={{ color, border: '1px dashed currentColor', borderRadius: 8, padding: 14, fontSize: 13 }}>{text}</div>
}

function inputStyle(palette: any): React.CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    height: 42,
    borderRadius: 8,
    border: `1px solid ${palette.border}`,
    background: palette.cardSoft,
    color: palette.text,
    outline: 'none',
    padding: '0 12px',
    fontWeight: 700,
  }
}

function buttonStyle(background: string): React.CSSProperties {
  return {
    border: 'none',
    borderRadius: 8,
    background,
    color: '#FFFFFF',
    padding: '0 14px',
    cursor: 'pointer',
    fontWeight: 900,
  }
}

function smallButtonStyle(palette: any): React.CSSProperties {
  return {
    border: `1px solid ${palette.border}`,
    borderRadius: 7,
    background: palette.cardSoft,
    color: palette.text,
    padding: '6px 10px',
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: 12,
  }
}

function selectionKey(ids: string[]) {
  return [...ids].sort().join('|')
}

function historyStorageKey(workspaceId: string, userId: string, projectId: string) {
  return `drake_slm_gpt_chat_history_${userId}_${projectId || 'no-project'}_${workspaceId}`
}

function legacyHistoryStorageKey(workspaceId: string) {
  return `drake_slm_gpt_chat_history_${workspaceId}`
}

function makeThread(documentIds: string[], docs: any[]): ChatThread {
  const selectedDocs = docs.filter(doc => documentIds.includes(doc.document_id))
  const title = selectedDocs.length === 1
    ? selectedDocs[0].file_name
    : selectedDocs.length
      ? `${selectedDocs.length} selected files`
      : 'No selected files'

  return {
    id: `thread-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    documentKey: selectionKey(documentIds),
    documentIds: [...documentIds],
    messages: [starterMessage],
    updatedAt: new Date().toISOString(),
  }
}

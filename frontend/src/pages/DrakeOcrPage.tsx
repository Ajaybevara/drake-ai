import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import toast from 'react-hot-toast'
import { ocrApi } from '../services/api'
import { useStore } from '../store'
import { saveExportToLocalProject, saveResultToLocalProject } from '../utils/localProjectStorage'

type InputType = 'image' | 'pdf'

type HistoryItem = {
  id: string
  fileName: string
  fileType: InputType
  previewUrl?: string
  extractedText: string
  timestamp: string
  mode?: string
}

export default function DrakeOcrPage() {
  const { theme, user, enterpriseProject, setEnterpriseProject } = useStore()
  const isLight = theme === 'light'
  const [inputType, setInputType] = useState<InputType>('image')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [extractedText, setExtractedText] = useState('')
  const [editedText, setEditedText] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState('')
  const [engineStatus, setEngineStatus] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const historyKey = ocrHistoryKey(user?.id, enterpriseProject?.project_id)

  const palette = useMemo(() => ({
    page: isLight ? '#F8FAFC' : '#050B14',
    card: isLight ? '#FFFFFF' : '#0B1320',
    cardSoft: isLight ? '#F1F5F9' : '#07111F',
    border: isLight ? '#DCE6F2' : '#1E2B3F',
    text: isLight ? '#0F172A' : '#F8FAFC',
    muted: isLight ? '#64748B' : '#9FB2CC',
    red: '#EF4444',
    green: '#10B981',
  }), [isLight])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(historyKey) || localStorage.getItem('drake_ocr_history') || '[]')
      if (saved.length && !localStorage.getItem(historyKey)) localStorage.setItem(historyKey, JSON.stringify(saved.slice(0, 12)))
      setHistory(saved)
    } catch {
      setHistory([])
    }
    ocrApi.status()
      .then(({ data }) => setEngineStatus(data))
      .catch(() => setEngineStatus(null))
  }, [historyKey])

  useEffect(() => {
    localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 12)))
  }, [history, historyKey])

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const chooseFile = (nextFile: File | null) => {
    setFile(nextFile)
    setExtractedText('')
    setEditedText('')
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    if (nextFile && nextFile.type.startsWith('image/')) setPreviewUrl(URL.createObjectURL(nextFile))
    else setPreviewUrl('')
  }

  const hasAnyOcrEngine = !!(engineStatus?.vllm_reachable || engineStatus?.local_ocr_available)
  const imageOcrUnavailable = inputType === 'image' && engineStatus && !hasAnyOcrEngine
  const pdfVisionUnavailable = inputType === 'pdf' && engineStatus && !engineStatus.vllm_reachable && !engineStatus.local_ocr_available

  const extract = async () => {
    if (!file) return toast.error('Upload an image or PDF first')
    if (imageOcrUnavailable) {
      return toast.error('No OCR engine is available. Start vLLM OCR or install the local OCR runtime.')
    }
    setBusy(true)
    try {
      const { data } = inputType === 'image' ? await ocrApi.extractImage(file) : await ocrApi.extractPdf(file)
      const text = data.text || ''
      setExtractedText(text)
      setEditedText(text)
      const item: HistoryItem = {
        id: `${Date.now()}`,
        fileName: file.name,
        fileType: inputType,
        previewUrl,
        extractedText: text,
        timestamp: new Date().toISOString(),
        mode: data.mode,
      }
      setHistory(prev => [item, ...prev.filter(entry => entry.fileName !== file.name)].slice(0, 12))
      await saveOcrResult(file, inputType, text, data)
      toast.success(`OCR completed${data.pages ? ` (${data.pages} page${data.pages === 1 ? '' : 's'})` : ''}`)
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'OCR extraction failed')
    } finally {
      setBusy(false)
    }
  }

  const exportText = async (format: 'docx' | 'pdf') => {
    if (!editedText.trim()) return toast.error('No OCR text to export')
    setExporting(format)
    try {
      const { data } = await ocrApi.exportText(editedText, format)
      const byteCharacters = atob(data.content)
      const byteNumbers = Array.from(byteCharacters, char => char.charCodeAt(0))
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: data.mime })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = data.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      await saveOcrExport(data.content, data.filename, format)
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || `Export ${format.toUpperCase()} failed`)
    } finally {
      setExporting('')
    }
  }

  const loadHistory = (item: HistoryItem) => {
    setInputType(item.fileType)
    setFile(null)
    setPreviewUrl(item.previewUrl || '')
    setExtractedText(item.extractedText)
    setEditedText(item.extractedText)
  }

  const saveOcrResult = async (sourceFile: File, fileType: InputType, text: string, response: any) => {
    if (!enterpriseProject) return
    try {
      const { data } = await saveResultToLocalProject(enterpriseProject, {
        module_name: 'Drake OCR',
        prediction_name: `${sourceFile.name} OCR extraction`,
        extension: 'json',
        result_payload: {
          action: 'ocr_extract',
          file_name: sourceFile.name,
          file_type: fileType,
          size_bytes: sourceFile.size,
          pages: response.pages || 1,
          mode: response.mode,
          extracted_text: text,
          extracted_characters: text.length,
          created_at: new Date().toISOString(),
        },
      })
      setEnterpriseProject(data.project)
    } catch {
      // OCR output remains available on screen; project history save can be retried after reopening the local project folder.
    }
  }

  const saveOcrExport = async (contentBase64: string, fileName: string, format: 'docx' | 'pdf') => {
    if (!enterpriseProject || !editedText.trim()) return
    try {
      const { data } = await saveExportToLocalProject(enterpriseProject, {
        module_name: 'Drake OCR',
        export_type: format,
        prediction_name: fileName.replace(/\.[^.]+$/, '') || 'ocr_export',
        extension: format,
        content_base64: contentBase64,
      })
      setEnterpriseProject(data.project)
    } catch {
      // Browser download succeeded; only local project export history failed.
    }
  }

  return (
    <div style={{ minHeight: '100%', overflow: 'auto', background: palette.page, color: palette.text, padding: 24 }}>
      <section style={{ border: `1px solid ${palette.border}`, background: palette.card, borderRadius: 8, padding: 22, display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'center' }}>
        <div>
          <div style={{ color: palette.green, fontSize: 12, fontWeight: 900, letterSpacing: 5, textTransform: 'uppercase' }}>Drake AI Digitizer</div>
          <h1 style={{ margin: '8px 0 6px', fontSize: 34, lineHeight: 1.1 }}>Drake OCR</h1>
          <p style={{ margin: 0, color: palette.muted, maxWidth: 840 }}>
            Integrated from the uploaded OCR ZIP: image/PDF OCR with vLLM vision extraction, Markdown editing, history, and DOCX/PDF export.
          </p>
        </div>
        <div style={{ border: `1px solid ${hasAnyOcrEngine ? palette.green : palette.border}`, background: hasAnyOcrEngine ? 'rgba(16,185,129,.12)' : palette.cardSoft, borderRadius: 8, padding: '12px 14px', minWidth: 170 }}>
          <div style={{ fontWeight: 900 }}>{engineStatus?.vllm_reachable ? 'vLLM OCR Ready' : engineStatus?.local_ocr_available ? 'Local OCR Ready' : 'OCR Engine Missing'}</div>
          <div style={{ color: palette.muted, fontSize: 12, marginTop: 4 }}>{engineStatus?.vllm_reachable ? (engineStatus?.vllm_ocr_model || 'qwen2.5-vl-7b') : engineStatus?.local_ocr_available ? 'RapidOCR CPU fallback' : 'Start OCR service'}</div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr) 280px', gap: 18, marginTop: 18, alignItems: 'start' }}>
        <aside style={panelStyle(palette)}>
          <PanelTitle label="Document Input" accent={palette.green} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {(['image', 'pdf'] as InputType[]).map(type => (
              <button key={type} onClick={() => { setInputType(type); chooseFile(null) }} style={tabStyle(palette, inputType === type)}>
                {type === 'image' ? 'Image' : 'PDF'}
              </button>
            ))}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={inputType === 'image' ? '.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp' : '.pdf'}
            onChange={event => chooseFile(event.target.files?.[0] || null)}
            style={{ display: 'none' }}
          />
          <button onClick={() => fileRef.current?.click()} style={{ ...buttonStyle(palette.red), width: '100%', height: 46 }}>
            <i className="fas fa-file-arrow-up"></i>&nbsp;&nbsp; Upload {inputType === 'image' ? 'Image' : 'PDF'}
          </button>
          {file ? (
            <div style={{ marginTop: 14, border: `1px solid ${palette.border}`, background: palette.cardSoft, borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 900, wordBreak: 'break-word' }}>{file.name}</div>
              <div style={{ color: palette.muted, fontSize: 12, marginTop: 4 }}>{Math.round(file.size / 1024)} KB</div>
            </div>
          ) : null}
          {imageOcrUnavailable ? (
            <div style={{ marginTop: 12, border: `1px solid ${palette.border}`, background: palette.cardSoft, color: palette.muted, borderRadius: 8, padding: 10, fontSize: 12, lineHeight: 1.5 }}>
              Image OCR needs vLLM vision or the local OCR runtime.
            </div>
          ) : pdfVisionUnavailable ? (
            <div style={{ marginTop: 12, border: `1px solid ${palette.border}`, background: palette.cardSoft, color: palette.muted, borderRadius: 8, padding: 10, fontSize: 12, lineHeight: 1.5 }}>
              Text PDFs can extract locally. Scanned PDFs need vLLM vision or the local OCR runtime.
            </div>
          ) : null}
          <button onClick={extract} disabled={busy || !file || !!imageOcrUnavailable} style={{ ...buttonStyle(palette.green), width: '100%', height: 46, marginTop: 14, opacity: busy || !file || imageOcrUnavailable ? .55 : 1 }}>
            <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>&nbsp;&nbsp; {busy ? 'Extracting...' : 'Extract Text'}
          </button>

          <div style={{ height: 1, background: palette.border, margin: '18px 0' }} />
          <PanelTitle label="Preview" accent={palette.green} />
          <div style={{ minHeight: 230, border: `1px solid ${palette.border}`, borderRadius: 8, background: palette.cardSoft, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
            {previewUrl ? (
              <img src={previewUrl} alt="OCR preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ color: palette.muted, fontSize: 13, padding: 16, textAlign: 'center' }}>{inputType === 'pdf' ? 'PDF selected files are processed page by page.' : 'Image preview appears here.'}</div>
            )}
          </div>
        </aside>

        <main style={{ ...panelStyle(palette), minHeight: 720, display: 'grid', gridTemplateRows: 'auto 1fr auto', padding: 0 }}>
          <div style={{ padding: 16, borderBottom: `1px solid ${palette.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <PanelTitle label="OCR Output" accent={palette.green} />
              <div style={{ fontSize: 22, fontWeight: 900 }}>{file?.name || 'No file selected'}</div>
            </div>
            <span style={{ border: `1px solid ${palette.border}`, color: palette.muted, borderRadius: 999, padding: '7px 12px', fontSize: 12, fontWeight: 900 }}>
              {extractedText ? `${extractedText.length.toLocaleString()} chars` : 'Ready'}
            </span>
          </div>
          <textarea
            value={editedText}
            onChange={event => setEditedText(event.target.value)}
            placeholder="Extracted OCR Markdown will appear here..."
            style={{ resize: 'none', width: '100%', minHeight: 540, border: 'none', outline: 'none', background: palette.card, color: palette.text, padding: 18, lineHeight: 1.6, fontSize: 15, fontFamily: 'Inter, system-ui, sans-serif' }}
          />
          <div style={{ padding: 16, borderTop: `1px solid ${palette.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => exportText('docx')} disabled={!editedText.trim() || !!exporting} style={smallActionStyle(palette)}>
              <i className={`fas ${exporting === 'docx' ? 'fa-spinner fa-spin' : 'fa-file-word'}`}></i>&nbsp;&nbsp; Export DOCX
            </button>
            <button onClick={() => exportText('pdf')} disabled={!editedText.trim() || !!exporting} style={smallActionStyle(palette)}>
              <i className={`fas ${exporting === 'pdf' ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`}></i>&nbsp;&nbsp; Export PDF
            </button>
          </div>
        </main>

        <aside style={{ ...panelStyle(palette), maxHeight: 760, overflow: 'auto' }}>
          <PanelTitle label="OCR History" accent={palette.green} />
          <div style={{ display: 'grid', gap: 8 }}>
            {history.map(item => (
              <button key={item.id} onClick={() => loadHistory(item)} style={{ textAlign: 'left', border: `1px solid ${palette.border}`, background: palette.cardSoft, color: palette.text, borderRadius: 8, padding: 10, cursor: 'pointer' }}>
                <div style={{ fontWeight: 900, fontSize: 13, wordBreak: 'break-word' }}>{item.fileName}</div>
                <div style={{ color: palette.muted, fontSize: 11, marginTop: 5 }}>{item.fileType.toUpperCase()} - {new Date(item.timestamp).toLocaleString()}</div>
              </button>
            ))}
            {!history.length ? <EmptyText text="No OCR history yet." color={palette.muted} /> : null}
          </div>
        </aside>
      </section>
    </div>
  )
}

function ocrHistoryKey(userId: number | undefined, projectId: string | undefined) {
  return `drake_ocr_history_${userId || 'guest'}_${projectId || 'no-project'}`
}

function PanelTitle({ label, accent }: { label: string; accent: string }) {
  return <div style={{ color: accent, fontSize: 12, fontWeight: 900, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
}

function EmptyText({ text, color }: { text: string; color: string }) {
  return <div style={{ color, border: '1px dashed currentColor', borderRadius: 8, padding: 14, fontSize: 13 }}>{text}</div>
}

function panelStyle(palette: any): React.CSSProperties {
  return {
    border: `1px solid ${palette.border}`,
    background: palette.card,
    borderRadius: 8,
    padding: 16,
  }
}

function tabStyle(palette: any, active: boolean): React.CSSProperties {
  return {
    border: `1px solid ${active ? palette.green : palette.border}`,
    background: active ? 'rgba(16,185,129,.12)' : palette.cardSoft,
    color: palette.text,
    borderRadius: 8,
    padding: '10px 12px',
    cursor: 'pointer',
    fontWeight: 900,
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

function smallActionStyle(palette: any): React.CSSProperties {
  return {
    border: `1px solid ${palette.border}`,
    borderRadius: 8,
    background: palette.cardSoft,
    color: palette.text,
    padding: '10px 13px',
    cursor: 'pointer',
    fontWeight: 900,
  }
}

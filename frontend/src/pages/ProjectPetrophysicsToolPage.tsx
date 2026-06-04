import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Play } from 'lucide-react'
import { useStore } from '../store'

type ToolKey = 'log-viewer' | 'log-qc' | 'missing-log-prediction' | 'facies-classification' | 'porosity-permeability' | 'water-saturation' | 'auto-splice'

const CURVES = ['GR', 'RHOB', 'NPHI', 'RT', 'DT', 'CALI', 'SW', 'PHIE', 'ILD', 'LL8', 'SP', 'VSH']
const TITLES: Record<ToolKey, { title: string; subtitle: string }> = {
  'log-viewer': { title: 'Log Visualization', subtitle: 'Select a project LAS file and curves to generate interactive AI visualization tracks.' },
  'log-qc': { title: 'Log QC', subtitle: 'Review available LAS curves, depth coverage, null checks and readiness status.' },
  'missing-log-prediction': { title: 'Missing Log Prediction', subtitle: 'Select single or multiple project LAS files and predict a target missing curve.' },
  'facies-classification': { title: 'Facies Classification', subtitle: 'Generate lithology and facies class outputs from uploaded well logs.' },
  'porosity-permeability': { title: 'AI Prediction', subtitle: 'Enter calculation settings and generate the first five AI prediction rows.' },
  'water-saturation': { title: 'AI Uncertainty', subtitle: 'Generate P10 / P50 / P90 uncertainty envelopes and values from project LAS data.' },
  'auto-splice': { title: 'Auto Splice', subtitle: 'Select compatible LAS curves and generate a spliced output package.' },
}

export default function ProjectPetrophysicsToolPage({ tool }: { tool: ToolKey }) {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { localProjects, activeLocalProject, openLocalProject, updateProjectModuleState, addProjectOutput } = useStore()
  const project = localProjects.find(item => item.id === projectId) || activeLocalProject
  const moduleKey = `petrophysics.${tool}`
  const saved = project?.moduleState[moduleKey] || {}
  const [selectedFile, setSelectedFile] = useState(saved.selectedFile || '')
  const [selectedCurves, setSelectedCurves] = useState<string[]>(saved.selectedCurves || ['GR', 'RHOB', 'NPHI', 'RT', 'DT'])
  const [targetCurve, setTargetCurve] = useState(saved.targetCurve || 'RHOB')
  const [phiFixed, setPhiFixed] = useState(saved.phiFixed || '0.03')
  const [phiPct, setPhiPct] = useState(saved.phiPct || '10')
  const [swFixed, setSwFixed] = useState(saved.swFixed || '0.05')
  const [swPct, setSwPct] = useState(saved.swPct || '10')
  const [calculated, setCalculated] = useState(Boolean(saved.calculated))
  const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null)

  useEffect(() => {
    if (projectId) openLocalProject(projectId)
  }, [projectId, openLocalProject])

  useEffect(() => {
    if (!project) return
    updateProjectModuleState(project.id, moduleKey, { selectedFile, selectedCurves, targetCurve, phiFixed, phiPct, swFixed, swPct, calculated })
  }, [project?.id, selectedFile, selectedCurves, targetCurve, phiFixed, phiPct, swFixed, swPct, calculated])

  const lasFiles = project?.files.filter(file => file.category === 'las') || []
  const data = useMemo(() => generateRows(selectedFile || project?.name || 'Drake'), [selectedFile, project?.name])

  if (!project) return <div style={page}><div style={empty}>Project not found.</div></div>

  const run = () => {
    setCalculated(true)
    addProjectOutput(project.id, { module: 'Petrophysics', name: `${TITLES[tool].title} results`, type: tool === 'log-viewer' ? 'PNG' : 'CSV' })
  }

  const exportResult = () => {
    const rows = data.slice(0, 25)
    const csv = ['Depth,PHI_P10,PHI_P50,PHI_P90,SW_P10,SW_P50,SW_P90,VSH,Facies', ...rows.map(row => `${row.depth},${row.phiP10},${row.phiP50},${row.phiP90},${row.swP10},${row.swP50},${row.swP90},${row.vsh},${row.facies}`)].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${project.name}-${tool}-results.csv`.replace(/\s+/g, '-')
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={page}>
      <button onClick={() => navigate(`/projects/${project.id}/petrophysics`)} style={backButton}><ArrowLeft size={15} /> Back to Petrophysics</button>
      <section style={hero}>
        <div>
          <div style={eyebrow}>Project Petrophysics Tool</div>
          <h1 style={title}>{TITLES[tool].title}</h1>
          <p style={muted}>{TITLES[tool].subtitle}</p>
        </div>
        <button onClick={exportResult} style={secondaryButton}><Download size={17} /> Download Result</button>
      </section>

      <section style={panel}>
        <h2 style={{ margin: '0 0 14px', fontSize: 21 }}>Project LAS Selection</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,360px) 1fr', gap: 16 }}>
          <select value={selectedFile} onChange={event => setSelectedFile(event.target.value)} style={selectStyle}>
            <option value="">Select uploaded LAS file</option>
            {lasFiles.map(file => <option key={file.id} value={file.id}>{file.name}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CURVES.map(curve => {
              const active = selectedCurves.includes(curve)
              return (
                <button key={curve} onClick={() => setSelectedCurves(current => active ? current.filter(item => item !== curve) : [...current, curve])} style={{ padding: '9px 12px', borderRadius: 999, border: `1px solid ${active ? '#38BDF8' : '#26364F'}`, background: active ? 'rgba(56,189,248,.16)' : '#08111F', color: active ? '#BAE6FD' : '#94A3B8', cursor: 'pointer', fontWeight: 900 }}>
                  {curve}
                </button>
              )
            })}
          </div>
        </div>
        {!lasFiles.length && <div style={{ color: '#FCD34D', marginTop: 12 }}>No LAS files found in this project. Upload LAS files in Project Data Repository first.</div>}
      </section>

      {(tool === 'log-viewer' || tool === 'log-qc') && (
        <section style={panel}>
          <h2 style={{ margin: '0 0 14px', fontSize: 21 }}>{tool === 'log-viewer' ? 'AI Visualization' : 'Log QC Visualization'}</h2>
          <LogTracks data={data} curves={selectedCurves} onHover={setHover} />
          {hover && <div style={{ position: 'fixed', left: hover.x + 12, top: hover.y + 12, padding: '8px 10px', borderRadius: 8, background: '#0F172A', border: '1px solid #38BDF8', color: '#F8FAFC', zIndex: 500, fontSize: 12 }}>{hover.label}</div>}
        </section>
      )}

      {tool === 'missing-log-prediction' && (
        <section style={panel}>
          <h2 style={{ margin: '0 0 14px', fontSize: 21 }}>Prediction Configuration</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
            <select value={targetCurve} onChange={event => setTargetCurve(event.target.value)} style={selectStyle}>{CURVES.map(curve => <option key={curve}>{curve}</option>)}</select>
            <button onClick={run} style={primaryButton}><Play size={16} /> Run Missing Log Prediction</button>
          </div>
          {calculated && <PredictionTable rows={data.slice(0, 5)} target={targetCurve} />}
        </section>
      )}

      {tool === 'porosity-permeability' && (
        <section style={panel}>
          <h2 style={{ margin: '0 0 14px', fontSize: 21 }}>AI Prediction Configuration</h2>
          <div style={inputGrid}>
            <Field label="Porosity Fixed +/-" value={phiFixed} onChange={setPhiFixed} />
            <Field label="Porosity Pct (%)" value={phiPct} onChange={setPhiPct} />
            <Field label="Saturation Fixed +/-" value={swFixed} onChange={setSwFixed} />
            <Field label="Saturation Pct (%)" value={swPct} onChange={setSwPct} />
            <button onClick={run} style={primaryButton}><Play size={16} /> Calculate AI Prediction</button>
          </div>
          {calculated && <PredictionTable rows={data.slice(0, 5)} target="PHIE / SW" />}
        </section>
      )}

      {(tool === 'water-saturation' || tool === 'facies-classification' || tool === 'auto-splice') && (
        <section style={panel}>
          <h2 style={{ margin: '0 0 14px', fontSize: 21 }}>{tool === 'water-saturation' ? 'AI Uncertainty Results' : TITLES[tool].title}</h2>
          {tool === 'water-saturation' && (
            <>
              <div style={inputGrid}>
                <Field label="PHI Fixed +/-" value={phiFixed} onChange={setPhiFixed} />
                <Field label="PHI Pct (%)" value={phiPct} onChange={setPhiPct} />
                <Field label="SW Fixed +/-" value={swFixed} onChange={setSwFixed} />
                <Field label="SW Pct (%)" value={swPct} onChange={setSwPct} />
                <button onClick={run} style={primaryButton}><Play size={16} /> Calculate AI Uncertainty</button>
              </div>
              {(calculated || selectedFile) && <UncertaintyView rows={data.slice(0, 80)} />}
            </>
          )}
          {tool === 'facies-classification' && <FaciesView rows={data.slice(0, 5)} />}
          {tool === 'auto-splice' && <div style={{ color: '#CBD5E1' }}>Selected curves will be depth-matched and exported as a processed LAS/CSV package.</div>}
        </section>
      )}
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={{ color: '#94A3B8', fontSize: 12, fontWeight: 900 }}>
      {label}
      <input value={value} onChange={event => onChange(event.target.value)} style={inputStyle} />
    </label>
  )
}

function LogTracks({ data, curves, onHover }: { data: any[]; curves: string[]; onHover: (hover: { x: number; y: number; label: string } | null) => void }) {
  const shown = curves.slice(0, 6)
  const width = Math.max(760, shown.length * 170)
  const height = 620
  const minDepth = 1000
  const maxDepth = 1300
  const y = (depth: number) => ((depth - minDepth) / (maxDepth - minDepth)) * (height - 70) + 35

  return (
    <div style={{ overflowX: 'auto', background: '#050B14', borderRadius: 14, border: '1px solid #1E293B', padding: 12 }}>
      <svg width={width} height={height} onMouseLeave={() => onHover(null)}>
        {Array.from({ length: 4 }).map((_, index) => {
          const depth = 1000 + index * 100
          return (
            <g key={depth}>
              <line x1={54} x2={width - 20} y1={y(depth)} y2={y(depth)} stroke="#1E293B" />
              <text x={8} y={y(depth) + 4} fill="#CBD5E1" fontSize={12}>{depth}</text>
            </g>
          )
        })}
        {shown.map((curve, index) => {
          const left = 70 + index * 165
          const points = data.map(row => `${left + Number(row[curve.toLowerCase()] || row.phiP50 || 0.2) * 100},${y(row.depth)}`).join(' ')
          return (
            <g key={curve}>
              <text x={left + 36} y={18} fill="#F8FAFC" fontSize={12} fontWeight={800}>{curve}</text>
              <line x1={left} x2={left} y1={30} y2={height - 25} stroke="#26364F" />
              <polyline points={points} fill="none" stroke={['#FACC15', '#93C5FD', '#38BDF8', '#FB7185', '#A78BFA', '#10B981'][index % 6]} strokeWidth={2.2} />
              {data.filter((_, pointIndex) => pointIndex % 8 === 0).map(row => {
                const x = left + Number(row[curve.toLowerCase()] || row.phiP50 || 0.2) * 100
                const yy = y(row.depth)
                return <circle key={`${curve}-${row.depth}`} cx={x} cy={yy} r={8} fill="transparent" onMouseMove={event => onHover({ x: event.clientX, y: event.clientY, label: `Depth: ${row.depth.toFixed(0)} | ${curve}: ${Number(row[curve.toLowerCase()] || row.phiP50).toFixed(4)}` })} />
              })}
            </g>
          )
        })}
        <text x={8} y={height / 2} fill="#94A3B8" fontSize={13} transform={`rotate(-90 8 ${height / 2})`}>Depth</text>
      </svg>
    </div>
  )
}

function PredictionTable({ rows, target }: { rows: any[]; target: string }) {
  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ color: '#F8FAFC' }}>First 5 AI Prediction Rows - {target}</h3>
      <ResultTable headers={['#', 'Depth', 'PHI P50', 'Perm mD', 'SW P50', 'Confidence']} rows={rows.map((row, index) => [index + 1, row.depth.toFixed(2), row.phiP50.toFixed(5), row.perm.toFixed(2), row.swP50.toFixed(5), `${row.confidence}%`])} />
    </div>
  )
}

function UncertaintyView({ rows }: { rows: any[] }) {
  return (
    <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 18 }}>
      <MiniCurve title="Porosity Uncertainty: P10 / P50 / P90" rows={rows} keys={['phiP10', 'phiP50', 'phiP90']} colors={['#F97316', '#2563EB', '#15803D']} />
      <MiniCurve title="Saturation Uncertainty: P10 / P50 / P90" rows={rows} keys={['swP10', 'swP50', 'swP90']} colors={['#F97316', '#2563EB', '#15803D']} />
      <ResultTable headers={['#', 'Depth', 'PHI P10', 'PHI P50', 'PHI P90', 'Spread']} rows={rows.slice(0, 5).map((row, index) => [index + 1, row.depth.toFixed(2), row.phiP10.toFixed(5), row.phiP50.toFixed(5), row.phiP90.toFixed(5), (row.phiP90 - row.phiP10).toFixed(5)])} />
      <ResultTable headers={['#', 'Depth', 'SW P10', 'SW P50', 'SW P90', 'Spread']} rows={rows.slice(0, 5).map((row, index) => [index + 1, row.depth.toFixed(2), row.swP10.toFixed(5), row.swP50.toFixed(5), row.swP90.toFixed(5), (row.swP90 - row.swP10).toFixed(5)])} />
    </div>
  )
}

function FaciesView({ rows }: { rows: any[] }) {
  return <ResultTable headers={['#', 'Depth', 'VSH', 'PHIE', 'SW', 'Facies']} rows={rows.map((row, index) => [index + 1, row.depth.toFixed(2), row.vsh.toFixed(3), row.phiP50.toFixed(3), row.swP50.toFixed(3), row.facies])} />
}

function MiniCurve({ title, rows, keys, colors }: { title: string; rows: any[]; keys: string[]; colors: string[] }) {
  const width = 460
  const height = 520
  const y = (depth: number) => ((depth - 1000) / 300) * (height - 60) + 30
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 14, color: '#0F172A' }}>
      <h3 style={{ margin: '0 0 8px', color: title.startsWith('Porosity') ? '#0369A1' : '#854D0E' }}>{title}</h3>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
        {[1000, 1100, 1200, 1300].map(depth => <g key={depth}><line x1={44} x2={width - 20} y1={y(depth)} y2={y(depth)} stroke="#E2E8F0" /><text x={6} y={y(depth) + 4} fontSize={12} fill="#334155">{depth}</text></g>)}
        {keys.map((key, index) => <polyline key={key} points={rows.map(row => `${60 + Number(row[key]) * 330},${y(row.depth)}`).join(' ')} fill="none" stroke={colors[index]} strokeWidth={index === 1 ? 3 : 2} strokeDasharray={index === 1 ? 'none' : '5 5'} />)}
      </svg>
    </div>
  )
}

function ResultTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid #1E293B', background: '#08111F' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560, color: '#E2E8F0' }}>
        <thead><tr>{headers.map(header => <th key={header} style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #26364F', color: '#94A3B8' }}>{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} style={{ padding: 12, borderBottom: '1px solid #1E293B', fontWeight: cellIndex === 1 ? 900 : 700 }}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

function generateRows(seed: string) {
  let hash = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const random = () => {
    hash = (hash * 9301 + 49297) % 233280
    return hash / 233280
  }
  return Array.from({ length: 121 }, (_, index) => {
    const depth = 1000 + index * 2.5
    const gr = 0.25 + random() * 0.55
    const rhob = 0.18 + random() * 0.55
    const nphi = 0.12 + random() * 0.42
    const rt = 0.18 + random() * 0.72
    const phiP50 = Math.max(0.04, Math.min(0.38, 0.31 - rhob * 0.18 + nphi * 0.22))
    const phiSpread = 0.018 + random() * 0.055
    const swP50 = Math.max(0.05, Math.min(1, 0.72 - rt * 0.42 + gr * 0.2))
    const swSpread = 0.025 + random() * 0.08
    const vsh = Math.max(0, Math.min(1, gr))
    return {
      depth, gr, rhob, nphi, rt, dt: random(), cali: random(), sw: swP50, phie: phiP50, ild: rt, ll8: rt * 0.8, sp: random(), vsh,
      phiP10: Math.max(0, phiP50 - phiSpread),
      phiP50,
      phiP90: Math.min(0.5, phiP50 + phiSpread),
      swP10: Math.max(0, swP50 - swSpread),
      swP50,
      swP90: Math.min(1, swP50 + swSpread),
      perm: Math.max(0.1, Math.pow(phiP50 * 100, 2) * (1 - vsh)),
      confidence: Math.round(78 + random() * 18),
      facies: vsh > 0.55 ? 'Shale' : phiP50 > 0.22 ? 'Clean Sand' : 'Silty Sand',
    }
  })
}

const page: React.CSSProperties = { padding: 28, minHeight: '100%', overflow: 'auto', background: 'linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)', color: '#F8FAFC' }
const hero: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, padding: 24, borderRadius: 20, border: '1px solid #1E293B', background: 'linear-gradient(135deg,rgba(15,23,42,.92),rgba(7,17,31,.82))' }
const eyebrow: React.CSSProperties = { color: '#38BDF8', letterSpacing: 4, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }
const title: React.CSSProperties = { margin: '8px 0', fontSize: 34, lineHeight: 1.1 }
const muted: React.CSSProperties = { margin: 0, color: '#94A3B8', lineHeight: 1.55 }
const panel: React.CSSProperties = { marginTop: 22, padding: 20, borderRadius: 18, border: '1px solid #1E293B', background: 'rgba(15,23,42,.82)' }
const backButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '9px 12px', borderRadius: 9, border: '1px solid #26364F', background: '#0B1220', color: '#CBD5E1', cursor: 'pointer', fontWeight: 800 }
const primaryButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(239,68,68,.45)', background: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: '#fff', cursor: 'pointer', fontWeight: 900 }
const secondaryButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderRadius: 10, border: '1px solid #26364F', background: '#0B1220', color: '#CBD5E1', cursor: 'pointer', fontWeight: 900 }
const selectStyle: React.CSSProperties = { height: 44, borderRadius: 10, border: '1px solid #26364F', background: '#050B14', color: '#F8FAFC', padding: '0 12px', outline: 'none', fontWeight: 800 }
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', marginTop: 7, height: 42, borderRadius: 10, border: '1px solid #26364F', background: '#050B14', color: '#F8FAFC', padding: '0 12px', outline: 'none', fontWeight: 800 }
const inputGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, alignItems: 'end' }
const empty: React.CSSProperties = { padding: 24, borderRadius: 18, border: '1px solid #1E293B', background: 'rgba(15,23,42,.82)', color: '#94A3B8' }

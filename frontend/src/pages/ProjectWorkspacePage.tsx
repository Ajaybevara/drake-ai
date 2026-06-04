import { useEffect } from 'react'
import type React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, Bot, Database, FileUp, Gauge, Leaf, LineChart, ScanLine, Waves } from 'lucide-react'
import { useStore } from '../store'
import ModuleCard from '../components/project/ModuleCard'
import StatusBadge from '../components/project/StatusBadge'

export default function ProjectWorkspacePage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { localProjects, activeLocalProject, openLocalProject } = useStore()
  const project = localProjects.find(item => item.id === projectId) || activeLocalProject

  useEffect(() => {
    if (projectId) openLocalProject(projectId)
  }, [projectId, openLocalProject])

  if (!project) {
    return <div style={page}><div style={empty}>Project not found. Open or create a project from Projects.</div></div>
  }

  const counts = {
    las: project.files.filter(file => file.category === 'las').length,
    reports: project.files.filter(file => file.category === 'reports').length,
    tables: project.files.filter(file => file.category === 'tables').length,
    digitizer: project.files.filter(file => file.category === 'images' || file.category === 'digitizer').length,
  }

  return (
    <div style={page}>
      <section style={hero}>
        <div>
          <div style={eyebrow}>Active Project Workspace</div>
          <h1 style={title}>{project.name}</h1>
          <p style={muted}>All uploaded files, selections, module outputs, and generated reports are preserved in this project workspace.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => navigate(`/projects/${project.id}/data`)} style={primaryButton}><FileUp size={17} /> Upload Files</button>
          <button onClick={() => navigate(`/projects/${project.id}/reports`)} style={secondaryButton}>Download Package</button>
        </div>
      </section>

      <div style={statsGrid}>
        <Stat label="LAS Files" value={counts.las} />
        <Stat label="Reports" value={counts.reports} />
        <Stat label="Excel / CSV" value={counts.tables} />
        <Stat label="Module Outputs" value={project.outputs.length} />
      </div>

      <section style={panel}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Database size={18} color="#38BDF8" />
          <h2 style={{ margin: 0, fontSize: 22 }}>Project Data Repository Summary</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          {['Well Logs / LAS', 'Reports / PDF & Word', 'Images', 'Excel / CSV', 'Digitization Inputs'].map((label, index) => (
            <div key={label} style={{ padding: 14, borderRadius: 12, background: '#08111F', border: '1px solid #1E293B' }}>
              <div style={{ color: '#94A3B8', fontSize: 12 }}>{label}</div>
              <div style={{ color: '#F8FAFC', fontSize: 24, fontWeight: 900, marginTop: 6 }}>{[counts.las, counts.reports, project.files.filter(f => f.category === 'images').length, counts.tables, counts.digitizer][index]}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ margin: '24px 0 14px', fontSize: 22 }}>Select Drake AI Domain</h2>
        <div style={moduleGrid}>
          <ModuleCard title="Petrophysics" subtitle="Use project LAS files for visualization, QC, missing-log AI, facies, prediction, uncertainty and auto splice." icon={Gauge} accent="#38BDF8" onClick={() => navigate(`/projects/${project.id}/petrophysics`)} />
          <ModuleCard title="Seismic" subtitle="Seismic viewer and attribute analysis connected to project seismic inputs." icon={Waves} accent="#8B5CF6" onClick={() => navigate(`/projects/${project.id}/seismic`)} />
          <ModuleCard title="Production" subtitle="Production analytics, forecasting, rate and cumulative plots from Excel or CSV." icon={LineChart} accent="#10B981" onClick={() => navigate(`/projects/${project.id}/production`)} />
          <ModuleCard title="CCUS" subtitle="Storage screening, suitability, capacity review, risk review and well ranking." icon={Leaf} accent="#F59E0B" onClick={() => navigate(`/projects/${project.id}/ccus`)} />
          <ModuleCard title="Drake AI Digitizer" subtitle="Raster log digitization, curve extraction, OCR and legacy data conversion." icon={ScanLine} accent="#EF4444" onClick={() => navigate(`/projects/${project.id}/digitizer`)} />
        </div>
      </section>

      <section style={panel}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Activity size={18} color="#38BDF8" />
          <h2 style={{ margin: 0, fontSize: 22 }}>Recent Activity</h2>
        </div>
        {project.activity.slice(0, 5).map(activity => (
          <div key={activity.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: '1px solid #1E293B', color: '#CBD5E1' }}>
            <span>{activity.text}</span>
            <span style={{ color: '#64748B', fontSize: 12 }}>{new Date(activity.createdAt).toLocaleString()}</span>
          </div>
        ))}
        {!project.activity.length && <div style={{ color: '#94A3B8' }}>No activity yet.</div>}
      </section>

      <section style={panel}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bot size={18} color="#38BDF8" />
          <h2 style={{ margin: 0, fontSize: 22 }}>Project Health</h2>
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <StatusBadge status={counts.las > 0 ? 'Ready' : 'Warning'} />
          <span style={{ color: '#94A3B8' }}>{counts.las > 0 ? 'Petrophysics-ready LAS files detected.' : 'Upload LAS files to unlock petrophysics tools.'}</span>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={statCard}>
      <div style={{ color: '#94A3B8', fontSize: 12, letterSpacing: 1.3, textTransform: 'uppercase', fontWeight: 900 }}>{label}</div>
      <div style={{ color: '#F8FAFC', fontSize: 28, fontWeight: 900, marginTop: 6 }}>{value}</div>
    </div>
  )
}

const page: React.CSSProperties = { padding: 28, minHeight: '100%', overflow: 'auto', background: 'radial-gradient(circle at top right,rgba(56,189,248,.12),transparent 30%),linear-gradient(135deg,#050B14,#07111F 52%,#0B1628)', color: '#F8FAFC' }
const hero: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, padding: 24, borderRadius: 20, border: '1px solid #1E293B', background: 'linear-gradient(135deg,rgba(15,23,42,.92),rgba(7,17,31,.82))', boxShadow: '0 24px 70px rgba(0,0,0,.28)' }
const eyebrow: React.CSSProperties = { color: '#38BDF8', letterSpacing: 4, textTransform: 'uppercase', fontSize: 12, fontWeight: 900 }
const title: React.CSSProperties = { margin: '8px 0', fontSize: 34, lineHeight: 1.1 }
const muted: React.CSSProperties = { margin: 0, color: '#94A3B8', lineHeight: 1.55 }
const primaryButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(239,68,68,.45)', background: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: '#fff', cursor: 'pointer', fontWeight: 900 }
const secondaryButton: React.CSSProperties = { padding: '12px 16px', borderRadius: 10, border: '1px solid #26364F', background: '#0B1220', color: '#CBD5E1', cursor: 'pointer', fontWeight: 900 }
const statsGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginTop: 18 }
const statCard: React.CSSProperties = { padding: 17, borderRadius: 16, border: '1px solid #1E293B', background: 'rgba(15,23,42,.82)' }
const panel: React.CSSProperties = { marginTop: 22, padding: 20, borderRadius: 18, border: '1px solid #1E293B', background: 'rgba(15,23,42,.82)' }
const moduleGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }
const empty: React.CSSProperties = { padding: 24, borderRadius: 18, border: '1px solid #1E293B', background: 'rgba(15,23,42,.82)', color: '#94A3B8' }

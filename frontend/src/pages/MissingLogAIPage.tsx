import { useMemo } from 'react'
import FileUploadPanel from '../components/petrophysics/FileUploadPanel'
import { useStore } from '../store'

export default function MissingLogAIPage() {
  const { activeWell, aiJobs } = useStore()
  const latestJob = useMemo(() => aiJobs.find((job) => job.job_type === 'missing_log'), [aiJobs])

  return (
    <div style={{ padding: 24, minHeight: '100%', overflow: 'auto' }}>
      <div style={{ maxWidth: 920, marginBottom: 22 }}>
        <h1 style={{ marginBottom: 10, color: '#0F172A' }}>Multi Well AI Missing Log Predictor</h1>
        <p style={{ margin: 0, color: '#475569', lineHeight: 1.7 }}>
          Upload batches of well logs and generate AI-predicted missing curves for your project. Use the active well selector on the left to pick a target well for upload and prediction.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 20, minWidth: 0 }}>
        <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #E2E8F0', padding: 24, minWidth: 0 }}>
          <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#2563EB', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Step 1</div>
              <h2 style={{ margin: '8px 0 0', color: '#0F172A' }}>Upload Well Log Files</h2>
            </div>
            <div style={{ padding: '8px 12px', borderRadius: 12, background: '#EFF6FF', color: '#0F172A', fontWeight: 700 }}>
              Active well: {activeWell?.name || 'None selected'}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Supported formats</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {['LAS', 'CSV', 'XLSX', 'PDF'].map((label) => (
                  <span key={label} style={{ padding: '7px 13px', background: '#F1F5F9', borderRadius: 999, fontSize: 11, color: '#334155', fontWeight: 600 }}>{label}</span>
                ))}
              </div>
            </div>

            <div style={{ padding: 20, background: '#F8FAFC', borderRadius: 16, border: '1px dashed #CBD5E1' }}>
              <FileUploadPanel />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #E2E8F0', padding: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 12 }}>Batch Summary</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#0F172A', fontWeight: 600 }}>Current Well</span>
                <span style={{ color: '#475569' }}>{activeWell?.name || 'None'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#0F172A', fontWeight: 600 }}>Recent AI Job</span>
                <span style={{ color: '#475569' }}>{latestJob ? latestJob.status : 'No jobs yet'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#0F172A', fontWeight: 600 }}>Target Curves</span>
                <span style={{ color: '#475569' }}>RHOB, NPHI, DT, RT, GR</span>
              </div>
            </div>
          </div>

          <div style={{ background: '#0F172A', borderRadius: 18, color: '#fff', padding: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>How it works</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, color: '#CBD5E1' }}>
              Upload logs, then run the missing-log AI predictor to generate synthetic curves where data is missing. The system uses model-driven prediction and saves results back to the selected well.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

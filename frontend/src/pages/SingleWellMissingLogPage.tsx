import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useStore } from '../store'
import { aiApi } from '../services/api'

interface JobOut {
  id: number
  well_id: number
  job_type: string
  status: string
  progress: number
  accuracy?: number
  confidence?: string
  predicted_curves: string[]
  error_message?: string
  created_at?: string
  completed_at?: string
}

export default function SingleWellMissingLogPage() {
  const { activeWell, aiJobs, setAIJobs } = useStore()
  const [loading, setLoading] = useState(false)
  const [job, setJob] = useState<JobOut | null>(null)

  useEffect(() => {
    if (!activeWell) {
      setJob(null)
      return
    }
    const latest = aiJobs.find((j) => j.job_type === 'missing_log')
    if (latest) setJob(latest)
  }, [activeWell?.id, aiJobs])

  const handleRun = async () => {
    if (!activeWell) {
      toast.error('Select a well first')
      return
    }
    setLoading(true)
    try {
      const res = await aiApi.run(activeWell.id, 'missing_log')
      setJob(res.data)
      toast.success('Single well missing log AI job started')
      const jobsRes = await aiApi.list(activeWell.id)
      setAIJobs(jobsRes.data)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to start AI job')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, minHeight: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, color: '#0F172A' }}>Single Well AI Missing Log Predictor</h1>
          <p style={{ margin: '8px 0 0', color: '#475569', maxWidth: 680 }}>
            Upload well logs, train a missing-log model for a single selected well, and generate AI-predicted curves.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, marginBottom: 20, minWidth: 0 }}>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24, minWidth: 0 }}>
          <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: 1 }}>Step 1</div>
              <h2 style={{ margin: '8px 0 0', fontSize: 20, color: '#0F172A' }}>Select a well and upload logs</h2>
            </div>
            <div style={{ padding: '8px 12px', background: '#FFEBEE', borderRadius: 12, color: '#0F172A', fontSize: 12, fontWeight: 600 }}>
              Active well: {activeWell?.name || 'None selected'}
            </div>
          </div>

          {!activeWell ? (
            <div style={{ padding: 30, border: '1px dashed #CBD5E1', borderRadius: 14, textAlign: 'center', color: '#64748B' }}>
              Select a well from the project explorer to upload logs and run predictions.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ padding: 20, background: '#F8FAFC', borderRadius: 14, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>Upload files for {activeWell.name}</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    Upload LAS, CSV or XLSX well logs and allow the AI engine to detect missing curves for this well.
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {['LAS', 'CSV', 'XLSX'].map((format) => (
                      <span key={format} style={{ background: '#E2E8F0', color: '#334155', padding: '6px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{format}</span>
                    ))}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRun}
                disabled={loading || !activeWell}
                style={{ width: 240, padding: '12px 16px', borderRadius: 12, border: 'none', background: '#2563EB', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Starting prediction…' : 'Run Missing Log Prediction'}
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 10 }}>Prediction Status</div>
            {job ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>Job ID</span>
                  <span style={{ color: '#475569' }}>{job.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>Status</span>
                  <span style={{ color: job.status === 'completed' ? '#10B981' : '#F59E0B' }}>{job.status}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>Progress</span>
                  <span style={{ color: '#475569' }}>{Math.round(job.progress)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>Accuracy</span>
                  <span style={{ color: '#475569' }}>{job.accuracy ? `${job.accuracy}%` : 'Pending'}</span>
                </div>
              </div>
            ) : (
              <div style={{ color: '#64748B' }}>Run a missing-log prediction job to see status and output details here.</div>
            )}
          </div>

          <div style={{ background: '#0F172A', borderRadius: 16, color: '#fff', padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Ready for fast single-well AI</div>
            <div style={{ fontSize: 14, lineHeight: 1.75 }}>
              Use this workflow when you want to analyze one well at a time and preserve your existing well log structure.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

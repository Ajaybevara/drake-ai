import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import toast from 'react-hot-toast'
import { useStore } from '../store'
import { curvesApi, aiApi, petrophysicsApi } from '../services/api'
import FileUploadPanel from '../components/petrophysics/FileUploadPanel'

function buildChartData(curveResponse: any, bundleRows: any[]) {
  const depths = curveResponse?.data?.data?.depths || bundleRows?.map((row) => row.DEPTH) || []
  const values = curveResponse?.data?.data?.values || []
  return depths.map((depth: number, index: number) => ({
    depth,
    value: values[index] ?? null,
    porosity: bundleRows?.[index]?.POROSITY,
  }))
}

export default function PorosityPermeabilityPage() {
  const activeWell = useStore((state) => state.activeWell)
  const queryClient = useQueryClient()
  const [runningJob, setRunningJob] = useState<string | null>(null)
  const [phiFixed, setPhiFixed] = useState('0.03')
  const [phiPct, setPhiPct] = useState('10')
  const [swFixed, setSwFixed] = useState('0.05')
  const [swPct, setSwPct] = useState('10')
  const [calculated, setCalculated] = useState(false)

  const { data: bundleData, isLoading: bundleLoading, refetch } = useQuery({
    queryKey: ['petrophysics', 'bundle', activeWell?.id],
    queryFn: () => petrophysicsApi.predictionBundle(activeWell!.id).then((res) => res.data.bundle || {}),
    enabled: !!activeWell,
  })

  const porosityCurve = useQuery({
    queryKey: ['curve', activeWell?.id, 'PHIE'],
    queryFn: () => curvesApi.getByMnem(activeWell!.id, 'PHIE').then((res) => res),
    enabled: !!activeWell,
  })

  const permeabilityCurve = useQuery({
    queryKey: ['curve', activeWell?.id, 'KLOG'],
    queryFn: () => curvesApi.getByMnem(activeWell!.id, 'KLOG').then((res) => res),
    enabled: !!activeWell,
  })

  const chartData = useMemo(() => {
    if (!activeWell) return []
    return buildChartData(porosityCurve.data, bundleData?.porosity || [])
  }, [activeWell, porosityCurve.data, bundleData])

  const permData = useMemo(() => {
    const depths = permeabilityCurve.data?.data?.data?.depths || []
    const values = permeabilityCurve.data?.data?.data?.values || []
    if (!activeWell || !depths.length) return []
    return depths.map((depth: number, idx: number) => ({ depth, perm: values[idx] }))
  }, [activeWell, permeabilityCurve.data])

  const porosityRows = bundleData?.porosity || []
  const latestPorosity = porosityRows?.[Math.max((porosityRows?.length || 1) - 1, 0)]?.POROSITY
  const latestPerm = permData?.[permData.length - 1]?.perm

  async function runJob(type: 'porosity' | 'permeability') {
    if (!activeWell) return
    setRunningJob(type)
    try {
      await aiApi.run(activeWell.id, type)
      toast.success(`${type === 'porosity' ? 'Porosity' : 'Permeability'} AI job started`)
      queryClient.invalidateQueries({ queryKey: ['curve', activeWell.id, type === 'porosity' ? 'PHIE' : 'KLOG'] })
      queryClient.invalidateQueries({ queryKey: ['petrophysics', 'bundle', activeWell.id] })
    } catch (error) {
      toast.error('Unable to start AI job')
    } finally {
      setRunningJob(null)
    }
  }

  async function calculatePrediction() {
    setRunningJob('prediction')
    await refetch()
    setCalculated(true)
    setRunningJob(null)
    toast.success('AI prediction calculated')
  }

  if (!activeWell) {
    return (
      <div style={{ padding: 24, minHeight: '100%', overflow: 'auto', display: 'grid', placeItems: 'center', color: '#64748B' }}>
        Select a well first, then upload a LAS file to run AI prediction.
      </div>
    )
  }

  if (!bundleLoading && !porosityRows.length && !permData.length) {
    return (
      <div style={{ padding: 24, minHeight: '100%', overflow: 'auto', display: 'grid', gap: 24 }}>
        <div style={{ padding: 28, borderRadius: 22, background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)' }}>
          <div style={{ fontSize: 13, letterSpacing: 4, color: '#2563EB', fontWeight: 700, textTransform: 'uppercase' }}>AI Prediction</div>
          <h1 style={{ margin: '10px 0 8px', color: '#0F172A' }}>Upload LAS for AI prediction results</h1>
          <p style={{ margin: 0, color: '#64748B' }}>
            Drake AI will parse uploaded curves and calculate porosity, permeability, water saturation, lithology, quality, and confidence from the LAS file.
          </p>
        </div>
        <div style={{ height: 300, padding: 22, borderRadius: 20, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <FileUploadPanel />
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, minHeight: '100%', overflow: 'auto', display: 'grid', gap: 24 }}>
      <div>
        <h1 style={{ marginBottom: 6, color: '#0F172A' }}>AI Prediction</h1>
        <p style={{ margin: 0, color: '#475569' }}>
          AI prediction results from the uploaded LAS file: porosity, permeability, water saturation, lithology, and confidence.
        </p>
      </div>

      <div style={{ padding: 22, borderRadius: 20, background: '#ffffff', border: '1px solid #E2E8F0' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Configuration</div>
        <p style={{ margin: '0 0 18px', color: '#64748B' }}>Enter values and click Calculate to show the first five AI prediction rows from the uploaded LAS file.</p>
        <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ padding: 18, borderRadius: 16, background: '#F8FAFC', border: '1px solid #BFDBFE' }}>
            <div style={{ fontWeight: 800, color: '#0369A1', marginBottom: 14 }}>Porosity Prediction</div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
              <label style={{ color: '#334155', fontWeight: 700 }}>Fixed ±<input value={phiFixed} onChange={(e) => setPhiFixed(e.target.value)} style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 10, border: '1px solid #CBD5E1' }} /></label>
              <label style={{ color: '#334155', fontWeight: 700 }}>Pct (%)<input value={phiPct} onChange={(e) => setPhiPct(e.target.value)} style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 10, border: '1px solid #CBD5E1' }} /></label>
            </div>
          </div>
          <div style={{ padding: 18, borderRadius: 16, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <div style={{ fontWeight: 800, color: '#92400E', marginBottom: 14 }}>Saturation Prediction</div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
              <label style={{ color: '#334155', fontWeight: 700 }}>Fixed ±<input value={swFixed} onChange={(e) => setSwFixed(e.target.value)} style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 10, border: '1px solid #CBD5E1' }} /></label>
              <label style={{ color: '#334155', fontWeight: 700 }}>Pct (%)<input value={swPct} onChange={(e) => setSwPct(e.target.value)} style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 10, border: '1px solid #CBD5E1' }} /></label>
            </div>
          </div>
        </div>
        <button onClick={calculatePrediction} disabled={runningJob === 'prediction'} style={{ marginTop: 16, borderRadius: 12, border: 'none', background: '#2563EB', color: '#FFFFFF', padding: '13px 22px', cursor: 'pointer', fontWeight: 800 }}>
          {runningJob === 'prediction' ? 'Calculating...' : 'Calculate AI Prediction'}
        </button>
        {calculated && <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', fontWeight: 700 }}>AI prediction calculated. Showing the first five results below.</div>}
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ padding: 22, borderRadius: 20, background: '#ffffff', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Porosity Prediction</div>
              <div style={{ fontSize: 13, color: '#64748B' }}>PHIE derived from uploaded LAS density, neutron, sonic, and shale-volume context.</div>
            </div>
            <button
              onClick={calculatePrediction}
              disabled={!activeWell || runningJob === 'prediction'}
              style={{ borderRadius: 12, border: 'none', background: '#2563EB', color: '#FFFFFF', padding: '10px 18px', cursor: 'pointer' }}
            >
              {runningJob === 'prediction' ? 'Calculating...' : 'Calculate'}
            </button>
          </div>

          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 18, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" />
                <XAxis dataKey="depth" reversed tick={{ fill: '#64748B', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748B', fontSize: 12 }} domain={['dataMin - 0.05', 'dataMax + 0.05']} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#CBD5E1' }} />
                <Legend verticalAlign="top" height={32} />
                <Line name="Porosity" type="monotone" dataKey="porosity" stroke="#22C55E" strokeWidth={2} dot={false} />
                <Line name="PHIE" type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginTop: 20 }}>
            <div style={{ padding: 16, borderRadius: 16, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 12, color: '#64748B' }}>Latest Porosity</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>{latestPorosity?.toFixed(3) ?? '—'}</div>
            </div>
            <div style={{ padding: 16, borderRadius: 16, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 12, color: '#64748B' }}>Bundle Rows</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>{porosityRows?.length ?? '—'}</div>
            </div>
            <div style={{ padding: 16, borderRadius: 16, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 12, color: '#64748B' }}>Curve Source</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>{porosityCurve.data ? 'PHIE' : 'Auto'}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: 22, borderRadius: 20, background: '#ffffff', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Permeability Profile</div>
              <div style={{ fontSize: 13, color: '#64748B' }}>KLOG from AI prediction or available well curves.</div>
            </div>
            <button
              onClick={calculatePrediction}
              disabled={!activeWell || runningJob === 'prediction'}
              style={{ borderRadius: 12, border: 'none', background: '#2563EB', color: '#ffffff', padding: '10px 18px', cursor: 'pointer' }}
            >
              {runningJob === 'prediction' ? 'Calculating...' : 'Calculate'}
            </button>
          </div>

          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={permData} margin={{ top: 8, right: 18, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" />
                <XAxis dataKey="depth" reversed tick={{ fill: '#64748B', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748B', fontSize: 12 }} domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#CBD5E1' }} />
                <Legend verticalAlign="top" height={32} />
                <Line name="Permeability" type="monotone" dataKey="perm" stroke="#F97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginTop: 20 }}>
            <div style={{ padding: 16, borderRadius: 16, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 12, color: '#64748B' }}>Latest KLOG</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>{latestPerm ? latestPerm.toFixed(2) : '—'}</div>
            </div>
            <div style={{ padding: 16, borderRadius: 16, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 12, color: '#64748B' }}>Data Points</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>{permData?.length ?? '0'}</div>
            </div>
            <div style={{ padding: 16, borderRadius: 16, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 12, color: '#64748B' }}>Source</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>AI Curve</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 22, borderRadius: 20, background: '#ffffff', border: '1px solid #E2E8F0' }}>
        <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>Porosity Preview</div>
        {bundleLoading ? (
          <p style={{ color: '#64748B' }}>Loading bundle data…</p>
        ) : porosityRows?.length ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {['Top 5 Porosity', 'Average Porosity', 'Confidence'].map((label, index) => (
                <div key={label} style={{ padding: 16, borderRadius: 16, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 12, color: '#64748B' }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
                    {index === 0 ? `${porosityRows.slice(0, 5).map((row: any) => row.POROSITY.toFixed(3)).join(', ')}` : index === 1 ? `${(
                      porosityRows.reduce((sum: number, row: any) => sum + row.POROSITY, 0) / porosityRows.length
                    ).toFixed(3)}` : `${porosityRows[0]?.CONFIDENCE.toFixed(0)}%`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ color: '#64748B' }}>No porosity preview is available yet.</p>
        )}
      </div>

      <div style={{ padding: 22, borderRadius: 20, background: '#ffffff', border: '1px solid #E2E8F0' }}>
        <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>Complete AI Prediction Results</div>
        {bundleData?.preview?.length ? (
          <div style={{ overflow: 'auto', maxHeight: 520, border: '1px solid #E2E8F0', borderRadius: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#F8FAFC', zIndex: 1 }}>
                <tr>
                  {['Depth', 'PHIE', 'SW %', 'Lithology', 'P10', 'P50', 'P90'].map((head) => (
                    <th key={head} style={{ textAlign: 'left', padding: '12px 14px', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bundleData.preview.slice(0, 5).map((row: any, index: number) => (
                  <tr key={`${row.DEPTH}-${index}`} style={{ background: index % 2 ? '#FFFFFF' : '#F8FAFC' }}>
                    <td style={{ padding: '11px 14px', color: '#0F172A', fontWeight: 700 }}>{row.DEPTH}</td>
                    <td style={{ padding: '11px 14px', color: '#0F172A' }}>{row.POROSITY?.toFixed?.(4) ?? '-'}</td>
                    <td style={{ padding: '11px 14px', color: '#0F172A' }}>{row.WATER_SATURATION?.toFixed?.(2) ?? '-'}</td>
                    <td style={{ padding: '11px 14px', color: '#0F172A' }}>{row.LITHOLOGY || '-'}</td>
                    <td style={{ padding: '11px 14px', color: '#F97316' }}>{row.P10?.toFixed?.(4) ?? '-'}</td>
                    <td style={{ padding: '11px 14px', color: '#2563EB', fontWeight: 800 }}>{row.P50?.toFixed?.(4) ?? '-'}</td>
                    <td style={{ padding: '11px 14px', color: '#15803D' }}>{row.P90?.toFixed?.(4) ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#64748B', margin: 0 }}>No prediction rows are available yet.</p>
        )}
      </div>
    </div>
  )
}

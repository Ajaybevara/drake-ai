import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../store'
import { petrophysicsApi } from '../services/api'
import FileUploadPanel from '../components/petrophysics/FileUploadPanel'

const cardStyle = {
  padding: 22,
  borderRadius: 20,
  background: '#ffffff',
  border: '1px solid #E2E8F0',
}

const statStyle = {
  padding: 16,
  borderRadius: 16,
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
}

function formatValue(value: any, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return Number(value).toFixed(digits)
}

export default function UncertaintyAnalysisPage() {
  const activeWell = useStore((state) => state.activeWell)
  const [phiMethod, setPhiMethod] = useState<'percent' | 'fixed'>('percent')
  const [swMethod, setSwMethod] = useState<'percent' | 'fixed'>('percent')
  const [phiFixed, setPhiFixed] = useState('0.03')
  const [phiPct, setPhiPct] = useState('10')
  const [swFixed, setSwFixed] = useState('0.05')
  const [swPct, setSwPct] = useState('10')
  const [calculated, setCalculated] = useState(false)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['petrophysics', 'uncertainty', activeWell?.id, phiMethod, swMethod, phiFixed, phiPct, swFixed, swPct],
    queryFn: () => petrophysicsApi.uncertainty(activeWell!.id, {
      phi_method: phiMethod,
      sw_method: swMethod,
      phi_pct: Number(phiPct) / 100,
      sw_pct: Number(swPct) / 100,
      phi_unc: Number(phiFixed),
      sw_unc: Number(swFixed),
    }).then((res) => res.data),
    enabled: !!activeWell,
  })

  const rows = data?.all_records || []
  const summary = data?.summary_cards || {}

  const lithologyRows = useMemo(() => {
    const counts = summary.lithology_counts || {}
    return Object.keys(counts).map((name) => ({ name, count: counts[name] }))
  }, [summary])

  const maxRows = rows.length > 600 ? rows.filter((_: any, index: number) => index % Math.ceil(rows.length / 600) === 0) : rows

  if (!activeWell) {
    return (
      <div style={{ padding: 24, minHeight: '100%', overflow: 'auto', display: 'grid', placeItems: 'center', color: '#64748B' }}>
        Select a well first, then upload a LAS file to calculate uncertainty.
      </div>
    )
  }

  if (!isLoading && (!data?.success || !rows.length)) {
    return (
      <div style={{ padding: 24, minHeight: '100%', overflow: 'auto', display: 'grid', gap: 24 }}>
        <div style={{ padding: 28, borderRadius: 22, background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)' }}>
          <div style={{ fontSize: 13, letterSpacing: 4, color: '#2563EB', fontWeight: 700, textTransform: 'uppercase' }}>Uncertainty</div>
          <h1 style={{ margin: '10px 0 8px', color: '#0F172A' }}>Upload LAS for P10 / P50 / P90 uncertainty</h1>
          <p style={{ margin: 0, color: '#64748B' }}>
            P10, P50, and P90 uncertainty envelopes for porosity and water saturation are computed directly from the active LAS curves.
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18 }}>
        <div>
          <h1 style={{ marginBottom: 6, color: '#0F172A' }}>Uncertainty Analysis</h1>
          <p style={{ margin: 0, color: '#475569' }}>
            Integrated Drake uncertainty workflow for porosity, water saturation, lithology, and P10/P50/P90 confidence bands.
          </p>
        </div>
        <button
          onClick={async () => { await refetch(); setCalculated(true) }}
          disabled={!activeWell || isFetching}
          style={{ borderRadius: 12, border: 'none', background: '#2563EB', color: '#FFFFFF', padding: '10px 18px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {isFetching ? 'Computing...' : 'Recompute'}
        </button>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Configuration</div>
        <p style={{ margin: '0 0 18px', color: '#64748B' }}>Select uncertainty method and values. P10/P50/P90 curves are computed from uploaded LAS prediction results.</p>
        <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ padding: 18, borderRadius: 16, background: '#F8FAFC', border: '1px solid #BFDBFE' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0369A1', marginBottom: 14 }}>Porosity Uncertainty</div>
            <label style={{ color: '#334155', fontWeight: 700 }}>Uncertainty Method
              <select value={phiMethod} onChange={(event) => setPhiMethod(event.target.value as 'percent' | 'fixed')} style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 10, border: '1px solid #CBD5E1' }}>
                <option value="fixed">Fixed Absolute (±)</option>
                <option value="percent">Percent Spread</option>
              </select>
            </label>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr', marginTop: 12 }}>
              <label style={{ color: '#334155', fontWeight: 700 }}>Fixed ±<input value={phiFixed} onChange={(e) => setPhiFixed(e.target.value)} style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 10, border: '1px solid #CBD5E1' }} /></label>
              <label style={{ color: '#334155', fontWeight: 700 }}>Pct (%)<input value={phiPct} onChange={(e) => setPhiPct(e.target.value)} style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 10, border: '1px solid #CBD5E1' }} /></label>
            </div>
          </div>
          <div style={{ padding: 18, borderRadius: 16, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#92400E', marginBottom: 14 }}>Saturation Uncertainty</div>
            <label style={{ color: '#334155', fontWeight: 700 }}>Uncertainty Method
              <select value={swMethod} onChange={(event) => setSwMethod(event.target.value as 'percent' | 'fixed')} style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 10, border: '1px solid #CBD5E1' }}>
                <option value="fixed">Fixed Absolute (±)</option>
                <option value="percent">Percent Spread</option>
              </select>
            </label>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr', marginTop: 12 }}>
              <label style={{ color: '#334155', fontWeight: 700 }}>Fixed ±<input value={swFixed} onChange={(e) => setSwFixed(e.target.value)} style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 10, border: '1px solid #CBD5E1' }} /></label>
              <label style={{ color: '#334155', fontWeight: 700 }}>Pct (%)<input value={swPct} onChange={(e) => setSwPct(e.target.value)} style={{ width: '100%', marginTop: 6, padding: 12, borderRadius: 10, border: '1px solid #CBD5E1' }} /></label>
            </div>
          </div>
        </div>
        <button onClick={async () => { await refetch(); setCalculated(true) }} disabled={isFetching} style={{ marginTop: 16, borderRadius: 12, border: 'none', background: '#2563EB', color: '#FFFFFF', padding: '13px 22px', cursor: 'pointer', fontWeight: 800 }}>
          {isFetching ? 'Calculating...' : 'Calculate Uncertainty'}
        </button>
        {calculated && <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', fontWeight: 700 }}>Uncertainty calculated — {rows.length} depth points processed.</div>}
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
        {[
          { label: 'Avg PHI P50', value: formatValue(summary.avg_phi_p50, 4) },
          { label: 'Avg PHI Spread', value: formatValue(summary.avg_phi_spread, 4) },
          { label: 'Avg SW P50', value: formatValue(summary.avg_sw_p50, 4) },
          { label: 'Avg SW Spread', value: formatValue(summary.avg_sw_spread, 4) },
          { label: 'Max PHI Depth', value: summary.max_phi_spread_depth ?? '-' },
          { label: 'Rows', value: summary.rows ?? 0 },
        ].map((item) => (
          <div key={item.label} style={statStyle}>
            <div style={{ fontSize: 12, color: '#64748B' }}>{item.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 320px' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Porosity Uncertainty</div>
              <div style={{ fontSize: 13, color: '#64748B' }}>Effective porosity with P10/P50/P90 bounds.</div>
            </div>
            <select
              value={phiMethod}
              onChange={(event) => setPhiMethod(event.target.value as 'percent' | 'fixed')}
              style={{ borderRadius: 10, border: '1px solid #CBD5E1', padding: '9px 10px', color: '#0F172A', background: '#FFFFFF' }}
            >
              <option value="percent">Percent spread</option>
              <option value="fixed">Fixed spread</option>
            </select>
          </div>
          <div style={{ width: '100%', height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={maxRows} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 18 }}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" />
                <XAxis type="number" tick={{ fill: '#64748B', fontSize: 12 }} domain={[0, 0.5]} label={{ value: 'Porosity fraction', position: 'insideBottom', offset: -10, fill: '#475569' }} />
                <YAxis dataKey="DEPTH" type="number" reversed tick={{ fill: '#64748B', fontSize: 12 }} domain={['dataMin', 'dataMax']} label={{ value: 'Depth', angle: -90, position: 'insideLeft', fill: '#475569' }} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#CBD5E1' }} />
                <Legend verticalAlign="top" height={32} />
                <Line name="P10 Optimistic" type="monotone" dataKey="PHI_P10" stroke="#F97316" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                <Line name="P50 Best Estimate" type="monotone" dataKey="PHI_P50" stroke="#2563EB" strokeWidth={3} dot={false} />
                <Line name="P90 Conservative" type="monotone" dataKey="PHI_P90" stroke="#15803D" strokeWidth={2} strokeDasharray="8 6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>Available Logs</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(data?.available_logs || []).slice(0, 14).map((log: string) => (
                <span key={log} style={{ padding: '6px 10px', borderRadius: 999, background: '#EFF6FF', color: '#1D4ED8', fontSize: 12, fontWeight: 700 }}>{log}</span>
              ))}
              {!data?.available_logs?.length && <span style={{ color: '#64748B' }}>No active well logs found.</span>}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>Lithology Mix</div>
            <div style={{ display: 'grid', gap: 12 }}>
              {lithologyRows.length ? lithologyRows.map((item) => (
                <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', color: '#0F172A', fontWeight: 600 }}>
                  <span>{item.name}</span>
                  <span style={{ color: '#2563EB' }}>{item.count}</span>
                </div>
              )) : <p style={{ margin: 0, color: '#64748B' }}>No lithology result yet.</p>}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 1fr' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Water Saturation Uncertainty</div>
              <div style={{ fontSize: 13, color: '#64748B' }}>Archie-style SW with uncertainty bounds.</div>
            </div>
            <select
              value={swMethod}
              onChange={(event) => setSwMethod(event.target.value as 'percent' | 'fixed')}
              style={{ borderRadius: 10, border: '1px solid #CBD5E1', padding: '9px 10px', color: '#0F172A', background: '#FFFFFF' }}
            >
              <option value="percent">Percent spread</option>
              <option value="fixed">Fixed spread</option>
            </select>
          </div>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={maxRows} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 18 }}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" />
                <XAxis type="number" tick={{ fill: '#64748B', fontSize: 12 }} domain={[0, 1]} label={{ value: 'Water Saturation Sw', position: 'insideBottom', offset: -10, fill: '#475569' }} />
                <YAxis dataKey="DEPTH" type="number" reversed tick={{ fill: '#64748B', fontSize: 12 }} domain={['dataMin', 'dataMax']} label={{ value: 'Depth', angle: -90, position: 'insideLeft', fill: '#475569' }} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#CBD5E1' }} />
                <Legend verticalAlign="top" height={32} />
                <Line name="P10 Low Sw" type="monotone" dataKey="SW_P10" stroke="#F97316" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                <Line name="P50 Best Estimate" type="monotone" dataKey="SW_P50" stroke="#2563EB" strokeWidth={3} dot={false} />
                <Line name="P90 High Sw" type="monotone" dataKey="SW_P90" stroke="#15803D" strokeWidth={2} strokeDasharray="8 6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Interpretation Notes</div>
          {isLoading ? (
            <p style={{ color: '#64748B' }}>Computing uncertainty...</p>
          ) : data?.success ? (
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Porosity</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {(data.phi_interp || []).map((note: string) => (
                    <div key={note} style={{ padding: 12, borderRadius: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569', lineHeight: 1.5 }}>{note}</div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Saturation</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {(data.sw_interp || []).map((note: string) => (
                    <div key={note} style={{ padding: 12, borderRadius: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569', lineHeight: 1.5 }}>{note}</div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: '#64748B' }}>{data?.message || 'Select an active well to compute uncertainty.'}</p>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 1fr' }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0369A1', marginBottom: 14 }}>Porosity Uncertainty — First 5 Rows</div>
          <div style={{ overflow: 'auto', border: '1px solid #E2E8F0', borderRadius: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#F8FAFC' }}>
                <tr>{['#', 'Depth', 'PHI P10', 'PHI P50', 'PHI P90', 'Spread'].map((head) => <th key={head} style={{ textAlign: 'left', padding: '12px 14px', color: '#0F172A', borderBottom: '1px solid #E2E8F0' }}>{head}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row: any, index: number) => (
                  <tr key={`phi-${row.DEPTH}-${index}`}>
                    <td style={{ padding: '11px 14px', color: '#0F172A' }}>{index + 1}</td>
                    <td style={{ padding: '11px 14px', color: '#0F172A', fontWeight: 800 }}>{formatValue(row.DEPTH, 2)}</td>
                    <td style={{ padding: '11px 14px', color: '#15803D' }}>{formatValue(row.PHI_P10, 5)}</td>
                    <td style={{ padding: '11px 14px', color: '#1D4ED8', fontWeight: 800 }}>{formatValue(row.PHI_P50, 5)}</td>
                    <td style={{ padding: '11px 14px', color: '#E11D48' }}>{formatValue(row.PHI_P90, 5)}</td>
                    <td style={{ padding: '11px 14px', color: '#854D0E' }}>{formatValue(row.PHI_UNCERTAINTY_SPREAD, 5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#92400E', marginBottom: 14 }}>Saturation Uncertainty — First 5 Rows</div>
          <div style={{ overflow: 'auto', border: '1px solid #E2E8F0', borderRadius: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#F8FAFC' }}>
                <tr>{['#', 'Depth', 'SW P10', 'SW P50', 'SW P90', 'Spread'].map((head) => <th key={head} style={{ textAlign: 'left', padding: '12px 14px', color: '#0F172A', borderBottom: '1px solid #E2E8F0' }}>{head}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row: any, index: number) => (
                  <tr key={`sw-${row.DEPTH}-${index}`}>
                    <td style={{ padding: '11px 14px', color: '#0F172A' }}>{index + 1}</td>
                    <td style={{ padding: '11px 14px', color: '#0F172A', fontWeight: 800 }}>{formatValue(row.DEPTH, 2)}</td>
                    <td style={{ padding: '11px 14px', color: '#15803D' }}>{formatValue(row.SW_P10, 5)}</td>
                    <td style={{ padding: '11px 14px', color: '#92400E', fontWeight: 800 }}>{formatValue(row.SW_P50, 5)}</td>
                    <td style={{ padding: '11px 14px', color: '#E11D48' }}>{formatValue(row.SW_P90, 5)}</td>
                    <td style={{ padding: '11px 14px', color: '#854D0E' }}>{formatValue(row.SW_UNCERTAINTY_SPREAD, 5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

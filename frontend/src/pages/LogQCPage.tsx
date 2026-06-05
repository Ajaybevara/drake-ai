import { useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import FileUploadPanel from '../components/petrophysics/FileUploadPanel'
import { curvesApi } from '../services/api'
import { useStore } from '../store'

const COLORS = ['#22C55E', '#F59E0B', '#3B82F6', '#06B6D4', '#8B5CF6', '#EC4899', '#EF4444', '#84CC16']
const STANDARD = ['GR', 'RHOB', 'NPHI', 'RT', 'DT']

function range(values: Array<number | null | undefined>) {
  const nums = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!nums.length) return { min: 0, max: 1 }
  return { min: Math.min(...nums), max: Math.max(...nums) }
}

function pathFor(curve: any, depthMin: number, depthMax: number, width: number, height: number) {
  const depths = curve?.data?.depths || []
  const values = curve?.data?.values || []
  const { min, max } = range(values)
  const isLog = /RT|ILD|LLD|RES/i.test(curve.mnemonic)
  const safeMin = isLog ? Math.max(min, 0.001) : min
  const safeMax = isLog ? Math.max(max, safeMin * 10) : max
  const dSpan = depthMax - depthMin || 1
  const vSpan = safeMax - safeMin || 1
  const step = Math.max(1, Math.floor(depths.length / 1100))
  const out: string[] = []
  for (let i = 0; i < depths.length; i += step) {
    const depth = Number(depths[i])
    const raw = values[i]
    if (!Number.isFinite(depth) || raw === null || raw === undefined || !Number.isFinite(Number(raw))) continue
    const value = Number(raw)
    const xNorm = isLog
      ? (Math.log10(Math.max(value, safeMin)) - Math.log10(safeMin)) / (Math.log10(safeMax) - Math.log10(safeMin) || 1)
      : (value - safeMin) / vSpan
    const x = Math.max(0, Math.min(width, xNorm * width))
    const y = ((depth - depthMin) / dSpan) * height
    out.push(`${out.length ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return out.join('')
}

export default function LogQCPage() {
  const activeWell = useStore((state) => state.activeWell)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [hover, setHover] = useState<any>(null)

  const curvesQuery = useQuery({
    queryKey: ['curves', activeWell?.id],
    queryFn: () => curvesApi.list(activeWell!.id).then((res) => res.data),
    enabled: !!activeWell,
  })

  const curves = curvesQuery.data || []
  const defaultIds = useMemo(() => {
    const ids: number[] = []
    for (const key of STANDARD) {
      const hit = curves.find((curve: any) => curve.mnemonic.toUpperCase() === key || curve.mnemonic.toUpperCase().startsWith(key))
      if (hit && !ids.includes(hit.id)) ids.push(hit.id)
    }
    return ids.slice(0, 5)
  }, [curves])

  const activeIds = selectedIds.length ? selectedIds : defaultIds
  const activeMetas = curves.filter((curve: any) => activeIds.includes(curve.id))
  const dataQueries = useQueries({
    queries: activeMetas.map((curve: any) => ({
      queryKey: ['curve-data', curve.id],
      queryFn: () => curvesApi.getData(curve.id).then((res) => res.data),
      enabled: !!curve.id,
    })),
  })
  const tracks = activeMetas.map((curve: any, index: number) => ({ ...curve, ...(dataQueries[index]?.data || {}) }))
  const depths = tracks.flatMap((track: any) => track.data?.depths || []).map(Number).filter(Number.isFinite)
  const depthMin = depths.length ? Math.min(...depths) : 0
  const depthMax = depths.length ? Math.max(...depths) : 1000
  const height = 720
  const width = 230

  const depthTicks = useMemo(() => {
    const start = Math.ceil(depthMin / 100) * 100
    const end = Math.floor(depthMax / 100) * 100
    const ticks = []
    for (let depth = start; depth <= end; depth += 100) ticks.push(depth)
    return ticks.length ? ticks : Array.from({ length: 8 }, (_, index) => depthMin + ((depthMax - depthMin) / 7) * index)
  }, [depthMin, depthMax])

  const nearestPoint = (track: any, y: number) => {
    const depths = track?.data?.depths || []
    const values = track?.data?.values || []
    const targetDepth = depthMin + (y / height) * (depthMax - depthMin || 1)
    let bestIndex = -1
    let bestDistance = Number.POSITIVE_INFINITY
    for (let i = 0; i < depths.length; i++) {
      const value = values[i]
      if (value === null || value === undefined || !Number.isFinite(Number(value))) continue
      const distance = Math.abs(Number(depths[i]) - targetDepth)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = i
      }
    }
    if (bestIndex < 0) return null
    return { depth: Number(depths[bestIndex]), value: Number(values[bestIndex]) }
  }

  const toggle = (id: number) => {
    setSelectedIds((current) => {
      const base = current.length ? current : defaultIds
      return base.includes(id) ? base.filter((item) => item !== id) : [...base, id].slice(-8)
    })
  }

  if (!activeWell) {
    return <div style={{ padding: 24, color: '#64748B' }}>Select a well first.</div>
  }

  if (!curves.length) {
    return (
      <div style={{ padding: 24, minHeight: '100%', display: 'grid', gap: 24 }}>
        <div style={{ padding: 28, borderRadius: 22, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 13, letterSpacing: 4, color: '#2563EB', fontWeight: 700, textTransform: 'uppercase' }}>AI Visualization</div>
          <h1 style={{ margin: '10px 0 8px', color: '#0F172A' }}>Upload LAS To Visualize Logs</h1>
          <p style={{ margin: 0, color: '#64748B' }}>After upload, all LAS curves will appear here and you can select the logs to visualize.</p>
        </div>
        <div style={{ height: 300, padding: 22, borderRadius: 20, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <FileUploadPanel />
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, minHeight: '100%', display: 'grid', gap: 24 }}>
      <div style={{ padding: 28, borderRadius: 22, background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)' }}>
        <div style={{ fontSize: 13, letterSpacing: 4, color: '#2563EB', fontWeight: 700, textTransform: 'uppercase' }}>AI Visualization</div>
        <h1 style={{ margin: '10px 0 8px', color: '#0F172A' }}>AI Log Visualization</h1>
        <p style={{ margin: 0, color: '#64748B' }}>Select uploaded LAS logs below. Resistivity logs use logarithmic scaling automatically.</p>
      </div>

      <div style={{ padding: 22, borderRadius: 20, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>{curves.length} log curves detected</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {curves.map((curve: any, index: number) => {
            const active = activeIds.includes(curve.id)
            return (
              <button
                key={curve.id}
                onClick={() => toggle(curve.id)}
                style={{
                  padding: '9px 13px',
                  borderRadius: 999,
                  border: `1px solid ${active ? COLORS[index % COLORS.length] : '#FCA5A5'}`,
                  background: active ? '#FFEBEE' : '#FFFFFF',
                  color: active ? COLORS[index % COLORS.length] : '#2563EB',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {active ? '● ' : ''}{curve.mnemonic}
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: 13, color: '#64748B' }}>Active tracks: {activeMetas.map((curve: any) => curve.mnemonic).join(', ') || 'None'}</div>
      </div>

      <div style={{ borderRadius: 18, border: '1px solid #1F2937', background: '#06111F', padding: 22, overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `90px repeat(${tracks.length}, ${width}px)`, minWidth: 90 + tracks.length * width }}>
          <div style={{ color: '#E2E8F0', fontWeight: 800, textAlign: 'center', paddingBottom: 10 }}>Depth</div>
          {tracks.map((track: any, index: number) => {
            const r = range(track.data?.values || [])
            return (
              <div key={track.id} style={{ color: '#E2E8F0', textAlign: 'center', fontWeight: 800, paddingBottom: 10 }}>
                <div>{track.mnemonic}{track.unit ? ` (${track.unit})` : ''}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#CBD5E1', fontWeight: 500, padding: '8px 12px 0' }}>
                  <span>{r.min.toFixed(2)}</span><span>{r.max.toFixed(2)}</span>
                </div>
              </div>
            )
          })}
          <div style={{ position: 'relative', height, borderRight: '1px solid #334155' }}>
            {depthTicks.map((depth) => (
              <div key={depth} style={{ position: 'absolute', top: `${((depth - depthMin) / (depthMax - depthMin || 1)) * 100}%`, left: 0, right: 10, color: '#E2E8F0', fontSize: 13, textAlign: 'right', transform: 'translateY(-50%)' }}>
                {depth.toFixed(0)}
              </div>
            ))}
          </div>
          {tracks.map((track: any, index: number) => (
            <div
              key={track.id}
              onMouseMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect()
                const y = event.clientY - rect.top
                const point = nearestPoint(track, y)
                if (point) setHover({ ...point, x: event.clientX - rect.left + 12, y: y + 12, mnemonic: track.mnemonic, unit: track.unit || '', trackId: track.id })
              }}
              onMouseLeave={() => setHover(null)}
              style={{ height, borderRight: '1px solid #334155', position: 'relative', backgroundImage: 'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)', backgroundSize: '100% 80px, 46px 100%' }}
            >
              <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                <path d={pathFor(track, depthMin, depthMax, width - 18, height)} fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth={2} />
              </svg>
              {hover?.trackId === track.id && (
                <div style={{ position: 'absolute', left: Math.min(hover.x, width - 135), top: Math.min(hover.y, height - 70), zIndex: 5, padding: '8px 10px', borderRadius: 4, background: '#D8B4FE', color: '#3B0764', fontSize: 13, fontWeight: 700, pointerEvents: 'none', boxShadow: '0 8px 18px rgba(15,23,42,.25)' }}>
                  <div>Depth: {hover.depth.toFixed(2)}</div>
                  <div>{hover.mnemonic}: {hover.value.toFixed(4)} {hover.unit}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import FileUploadPanel from './FileUploadPanel'
import { useStore } from '../../store'
import { curvesApi } from '../../services/api'

type CurveMeta = {
  id: number
  mnemonic: string
  unit?: string
  description?: string
  min_value?: number
  max_value?: number
  mean_value?: number
  null_count: number
  is_predicted: boolean
}

type CurveTrack = CurveMeta & {
  data?: {
    depths?: number[]
    values?: Array<number | null>
  }
}

const TRACK_PREFS = [
  { keys: ['GR', 'GRD', 'GRS', 'CGR', 'SGR'], label: 'GR', color: '#FACC15', unit: 'API', log: false },
  { keys: ['RT', 'RESD', 'ILD', 'LLD', 'AT90', 'RDEP'], label: 'Resistivity', color: '#FB7185', unit: 'ohm.m', log: true },
  { keys: ['RHOB', 'RHOZ', 'DEN', 'ZDEN'], label: 'RHOB', color: '#F87171', unit: 'g/cc', log: false },
  { keys: ['NPHI', 'NPHIS', 'NPHISS', 'TNPH', 'NPL'], label: 'NPHI', color: '#3B82F6', unit: 'fraction', log: false },
  { keys: ['DT', 'DTP', 'DTC', 'DTCO', 'AC', 'SONIC'], label: 'DT', color: '#FB923C', unit: 'us/ft', log: false },
]

function pickCurve(curves: CurveMeta[], keys: string[]) {
  const upper = curves.map((curve) => ({ ...curve, upper: curve.mnemonic.toUpperCase() }))
  for (const key of keys) {
    const exact = upper.find((curve) => curve.upper === key)
    if (exact) return exact
  }
  for (const key of keys) {
    const fuzzy = upper.find((curve) => curve.upper.startsWith(key) || curve.upper.includes(key))
    if (fuzzy) return fuzzy
  }
  return null
}

function valueRange(track: CurveTrack) {
  const values = (track.data?.values || []).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!values.length) return { min: track.min_value ?? 0, max: track.max_value ?? 1 }
  return {
    min: track.min_value ?? Math.min(...values),
    max: track.max_value ?? Math.max(...values),
  }
}

function makePath(track: CurveTrack, minDepth: number, maxDepth: number, width: number, height: number, logScale: boolean) {
  const depths = track.data?.depths || []
  const values = track.data?.values || []
  const { min, max } = valueRange(track)
  const safeMin = logScale ? Math.max(min, 0.001) : min
  const safeMax = logScale ? Math.max(max, safeMin * 10) : max
  const dSpan = maxDepth - minDepth || 1
  const vSpan = safeMax - safeMin || 1
  const points: string[] = []

  for (let i = 0; i < depths.length; i += Math.max(1, Math.floor(depths.length / 1200))) {
    const raw = values[i]
    const depth = Number(depths[i])
    if (raw === null || raw === undefined || !Number.isFinite(Number(raw)) || !Number.isFinite(depth)) continue
    const value = Number(raw)
    const normalized = logScale
      ? (Math.log10(Math.max(value, safeMin)) - Math.log10(safeMin)) / (Math.log10(safeMax) - Math.log10(safeMin) || 1)
      : (value - safeMin) / vSpan
    const x = Math.max(0, Math.min(width, normalized * width))
    const y = ((depth - minDepth) / dSpan) * height
    points.push(`${points.length ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
  }

  return points.join('')
}

export default function LogViewer() {
  const { activeWell, curves: storeCurves, setCurves } = useStore()

  const curvesQuery = useQuery({
    queryKey: ['curves', activeWell?.id],
    queryFn: () => curvesApi.list(activeWell!.id).then((res) => res.data),
    enabled: !!activeWell,
  })

  const curves = (curvesQuery.data || storeCurves || []) as CurveMeta[]

  const selectedMetas = useMemo(() => {
    const selected = TRACK_PREFS.map((pref) => pickCurve(curves, pref.keys)).filter(Boolean) as CurveMeta[]
    const missingSlots = Math.max(0, 5 - selected.length)
    const extras = curves.filter((curve) => !selected.some((sel) => sel.id === curve.id)).slice(0, missingSlots)
    return [...selected, ...extras]
  }, [curves])

  const curveDataQueries = useQueries({
    queries: selectedMetas.map((curve) => ({
      queryKey: ['curve-data', curve.id],
      queryFn: () => curvesApi.getData(curve.id).then((res) => res.data),
      enabled: !!curve.id,
    })),
  })

  const tracks = selectedMetas.map((meta, index) => ({
    ...meta,
    ...(curveDataQueries[index]?.data || {}),
  })) as CurveTrack[]

  const depthRange = useMemo(() => {
    const depths = tracks.flatMap((track) => track.data?.depths || []).filter((depth) => Number.isFinite(Number(depth))).map(Number)
    if (!depths.length) return { min: activeWell?.top_depth || 0, max: activeWell?.base_depth || activeWell?.total_depth || 1000 }
    return { min: Math.min(...depths), max: Math.max(...depths) }
  }, [tracks, activeWell])

  if (!activeWell) {
    return (
      <div style={{ padding: 24, height: '100%', display: 'grid', placeItems: 'center', color: '#64748B' }}>
        Select a well first, then upload a LAS file for AI visualization.
      </div>
    )
  }

  if (!curves.length) {
    return (
      <div style={{ padding: 24, minHeight: '100%', overflow: 'auto', display: 'grid', gap: 24 }}>
        <div style={{ padding: 28, borderRadius: 22, background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)' }}>
          <div style={{ fontSize: 13, letterSpacing: 4, color: '#2563EB', fontWeight: 700, textTransform: 'uppercase' }}>Industrial Geological Dashboard</div>
          <h1 style={{ margin: '10px 0 8px', color: '#0F172A' }}>AI-powered LAS well log analysis</h1>
          <p style={{ margin: 0, color: '#64748B' }}>Upload a LAS file to load log curves, visualize tracks, and unlock AI prediction and uncertainty workflows.</p>
        </div>
        <div style={{ height: 280, padding: 22, borderRadius: 20, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <FileUploadPanel />
        </div>
      </div>
    )
  }

  const height = 720
  const width = 250
  const depthTicks = Array.from({ length: 8 }, (_, index) => depthRange.min + ((depthRange.max - depthRange.min) / 7) * index)

  return (
    <div style={{ padding: 24, minHeight: '100%', overflow: 'auto', display: 'grid', gap: 24 }}>
      <div style={{ padding: 28, borderRadius: 22, background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)' }}>
        <div style={{ fontSize: 13, letterSpacing: 4, color: '#2563EB', fontWeight: 700, textTransform: 'uppercase' }}>Industrial Geological Dashboard</div>
        <h1 style={{ margin: '10px 0 8px', color: '#0F172A' }}>AI Log Visualization</h1>
        <p style={{ margin: 0, color: '#64748B' }}>
          {curves.length} log curves detected from the active LAS file. Standard petrophysical tracks are loaded automatically.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '320px 1fr' }}>
        <div style={{ padding: 20, borderRadius: 18, background: '#FFFFFF', border: '1px solid #E2E8F0', minHeight: 240 }}>
          <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Upload / Replace LAS</div>
          <FileUploadPanel />
        </div>
        <div style={{ padding: 20, borderRadius: 18, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Available Logs</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {curves.map((curve) => (
              <span key={curve.id} style={{ padding: '7px 11px', borderRadius: 999, background: selectedMetas.some((item) => item.id === curve.id) ? '#FCD3D3' : '#F8FAFC', border: '1px solid #FCA5A5', color: '#9B1B1B', fontSize: 12, fontWeight: 700 }}>
                {curve.mnemonic}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ borderRadius: 18, border: '1px solid #1F2937', background: '#06111F', padding: 22, overflowX: 'auto' }}>
        <div style={{ color: '#CBD5E1', marginBottom: 16 }}>Displaying {tracks.length} logs across {tracks.length} tracks from active LAS file.</div>
        <div style={{ display: 'grid', gridTemplateColumns: `90px repeat(${tracks.length}, ${width}px)`, alignItems: 'stretch', minWidth: 90 + tracks.length * width }}>
          <div style={{ color: '#E2E8F0', fontWeight: 700, textAlign: 'center', paddingBottom: 10 }}>Depth</div>
          {tracks.map((track, index) => {
            const pref = TRACK_PREFS.find((item) => item.keys.some((key) => track.mnemonic.toUpperCase().includes(key)))
            const range = valueRange(track)
            return (
              <div key={track.id} style={{ color: '#E2E8F0', textAlign: 'center', fontWeight: 700, paddingBottom: 10 }}>
                <div>{track.mnemonic} {track.unit ? `(${track.unit})` : pref?.unit ? `(${pref.unit})` : ''}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#CBD5E1', fontWeight: 500, padding: '8px 12px 0' }}>
                  <span>{range.min?.toFixed?.(2) ?? range.min}</span>
                  <span>{range.max?.toFixed?.(2) ?? range.max}</span>
                </div>
              </div>
            )
          })}

          <div style={{ position: 'relative', height, borderRight: '1px solid #334155' }}>
            {depthTicks.map((depth) => (
              <div key={depth} style={{ position: 'absolute', top: `${((depth - depthRange.min) / (depthRange.max - depthRange.min || 1)) * 100}%`, left: 0, right: 10, color: '#E2E8F0', fontSize: 13, textAlign: 'right', transform: 'translateY(-50%)' }}>
                {depth.toFixed(0)}
              </div>
            ))}
            <div style={{ position: 'absolute', top: '50%', left: -20, transform: 'rotate(-90deg)', color: '#E2E8F0', fontSize: 14 }}>Depth</div>
          </div>

          {tracks.map((track, index) => {
            const pref = TRACK_PREFS.find((item) => item.keys.some((key) => track.mnemonic.toUpperCase().includes(key)))
            const color = pref?.color || ['#22C55E', '#FB7185', '#F87171', '#3B82F6', '#FB923C'][index % 5]
            const logScale = pref?.log || /RT|ILD|LLD|RES/i.test(track.mnemonic)
            return (
              <div key={track.id} style={{ height, borderRight: '1px solid #334155', position: 'relative', backgroundImage: 'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)', backgroundSize: '100% 80px, 50px 100%' }}>
                <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                  <path
                    d={makePath(track, depthRange.min, depthRange.max, width - 18, height, logScale)}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                  />
                </svg>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

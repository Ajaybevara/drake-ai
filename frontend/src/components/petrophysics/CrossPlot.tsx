import { useEffect, useRef } from 'react'
import { useStore } from '../../store'

const ZONES = [
  { color: '#3B82F6', label: 'Zone 1', n: 70 },
  { color: '#22C55E', label: 'Zone 2', n: 60 },
  { color: '#F59E0B', label: 'Zone 3', n: 55 },
  { color: '#EF4444', label: 'Zone 4', n: 45 },
  { color: '#F97316', label: 'Zone 5', n: 35 },
]

export default function CrossPlot() {
  const ref = useRef<HTMLCanvasElement>(null)
  const { theme } = useStore()
  const isLight = theme === 'light'

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height

    ctx.fillStyle = isLight ? '#FFFFFF' : '#0B111A'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = isLight ? '#CBD5E1' : '#223047'; ctx.lineWidth = .5
    ctx.strokeRect(24, 6, W - 30, H - 20)
    for (let i = 1; i < 5; i++) {
      const x = 24 + (W - 30) * i / 5
      const y = 6 + (H - 18) * i / 5
      ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x, H - 14); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(W - 6, y); ctx.stroke()
    }

    ctx.fillStyle = isLight ? '#334155' : '#D3DAE5'; ctx.font = '7px IBM Plex Mono'; ctx.textAlign = 'center'
    ctx.fillText('NPHI (v/v)', W / 2, H)
    ctx.save(); ctx.translate(9, H / 2); ctx.rotate(-Math.PI / 2)
    ctx.fillText('RHOB (g/cc)', 0, 0); ctx.restore()

    ;['-0.15','0','0.15','0.30','0.45'].forEach((t, i) => {
      ctx.textAlign = 'center'; ctx.fillText(t, 24 + (W - 30) * i / 4, H - 8)
    })
    ;['2.95','2.70','2.45','2.20','1.95'].forEach((t, i) => {
      ctx.textAlign = 'right'; ctx.fillText(t, 22, 8 + (H - 18) * i / 4 + 3)
    })

    let seed = 42
    const rnd = () => { seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF; return (seed >>> 0) / 4294967295 }
    const px = (v: number) => 24 + (v + .15) / .6 * (W - 30)
    const py = (v: number) => 6 + (2.95 - v) / 1 * (H - 18)

    ZONES.forEach(z => {
      ctx.fillStyle = z.color + 'CC'
      for (let i = 0; i < z.n; i++) {
        const np = -0.05 + rnd() * .5, rh = 2.0 + rnd() * .85
        ctx.beginPath(); ctx.arc(px(np), py(rh), 1.25, 0, Math.PI * 2); ctx.fill()
      }
    })
  }, [isLight])

  return (
    <div style={{ padding: '5px 8px', height: '100%' }}>
      <canvas ref={ref} width={420} height={260} style={{ width: '100%', height: '100%' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
        <div style={{ fontSize: 9.5, color: isLight ? '#0F172A' : '#D3DAE5', fontWeight: 600, width: '100%', letterSpacing: .5 }}>ZONES</div>
        {ZONES.map(z => (
          <span key={z.label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9.5, color: isLight ? '#475569' : '#AAB6C6' }}>
            <span style={{ width: 7, height: 7, background: z.color, borderRadius: '50%', display: 'inline-block' }}></span>
            {z.label}
          </span>
        ))}
      </div>
    </div>
  )
}

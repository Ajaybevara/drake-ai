// Histogram component for petrophysics visualization
import { useEffect, useRef } from 'react';
import { useStore } from '../../store';

// Simple random data generation for demo purposes
const generateData = (count: number) => {
  const data: number[] = [];
  for (let i = 0; i < count; i++) {
    data.push(Math.random() * 100);
  }
  return data;
};

export default function Histogram() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { theme } = useStore();
  const isLight = theme === 'light';

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = isLight ? '#FFFFFF' : '#0B111A';
    ctx.fillRect(0, 0, W, H);

    const data = generateData(30);
    const max = Math.max(...data);
    const barWidth = (W - 40) / data.length;
    data.forEach((value, i) => {
      const barHeight = (value / max) * (H - 40);
      const x = 20 + i * barWidth;
      const y = H - barHeight - 20;
      ctx.fillStyle = isLight ? '#3B82F6' : '#60A5FA';
      ctx.fillRect(x, y, barWidth - 2, barHeight);
    });

    // Axes
    ctx.strokeStyle = isLight ? '#64748B' : '#A1A1AA';
    ctx.beginPath();
    ctx.moveTo(20, 20);
    ctx.lineTo(20, H - 20);
    ctx.lineTo(W - 20, H - 20);
    ctx.stroke();
  }, [isLight]);

  return (
    <div style={{ padding: '5px 8px', height: '100%' }}>
      <canvas ref={ref} width={420} height={260} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

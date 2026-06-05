import React, { useState } from 'react';
import { useStore } from '../../store';
import CrossPlot from './CrossPlot';
import Histogram from './Histogram';

export default function StraightBar() {
  const [tab, setTab] = useState<'log' | 'crossplot' | 'histogram'>('log');
  const { theme } = useStore();
  const isLight = theme === 'light';

  const tabStyle = (active: boolean) => ({
    padding: '8px 16px',
    cursor: 'pointer',
    borderBottom: active ? `2px solid ${isLight ? '#2563EB' : '#60A5FA'}` : '2px solid transparent',
    color: isLight ? '#0F172A' : '#F8FAFC',
    fontWeight: active ? 600 : 400,
  });

  return (
    <div style={{ marginTop: 24, background: isLight ? '#FFFFFF' : 'linear-gradient(180deg,rgba(15,23,42,.9),rgba(7,17,31,.96))', borderRadius: 12, border: `1px solid ${isLight ? '#E2E8F0' : '#1E293B'}`, padding: 12, boxShadow: isLight ? '0 4px 12px rgba(0,0,0,.02)' : '0 18px 42px rgba(0,0,0,.22)' }}>
      <div style={{ display: 'flex', gap: 24, borderBottom: `1px solid ${isLight ? '#E2E8F0' : '#1E293B'}` }}>
        <div style={tabStyle(tab === 'log')} onClick={() => setTab('log')}>Log</div>
        <div style={tabStyle(tab === 'crossplot')} onClick={() => setTab('crossplot')}>Crossplot</div>
        <div style={tabStyle(tab === 'histogram')} onClick={() => setTab('histogram')}>Histogram</div>
      </div>
      <div style={{ padding: 12 }}>
        {tab === 'log' && <div>Log Visualization Placeholder – integrate your log view here.</div>}
        {tab === 'crossplot' && <CrossPlot />}
        {tab === 'histogram' && <Histogram />}
      </div>
    </div>
  );
}

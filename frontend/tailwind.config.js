/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'app-bg':    '#0F172A',
        'app-panel': '#111827',
        'app-card':  '#1E293B',
        'app-border':'#334155',
        'accent':    '#2563EB',
        'accent-hover': '#1D4ED8',
        'success':   '#10B981',
        'warning':   '#F59E0B',
        'danger':    '#EF4444',
        'ai-purple': '#7C3AED',
      },
      fontFamily: {
        sans:  ['DM Sans', 'sans-serif'],
        mono:  ['IBM Plex Mono', 'monospace'],
        display: ['Rajdhani', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../env/frontend', '')

  return {
    envDir: '../env/frontend',
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || process.env.VITE_API_URL || 'http://127.0.0.1:8002',
          changeOrigin: true,
        },
      },
    },
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/summary': 'http://localhost:8000',
      '/schedules': 'http://localhost:8000',
      '/medical-records': 'http://localhost:8000',
      '/imports': 'http://localhost:8000',
      '/anomalies': 'http://localhost:8000',
      '/logs': 'http://localhost:8000',
      '/aliases': 'http://localhost:8000',
      '/exports': 'http://localhost:8000',
      '/seed': 'http://localhost:8000',
    },
  },
})

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// In dev, /api is proxied to the live deployment so the frontend can run with plain `npx vite`.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'https://jaisa-tha-udtaryan.netlify.app', changeOrigin: true, secure: true },
    },
  },
})

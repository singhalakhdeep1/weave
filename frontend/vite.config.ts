import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development the API and the collaboration socket are proxied, so the app is
// same-origin and the refresh cookie needs no cross-site setup.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5001', changeOrigin: true },
      '/collab': { target: 'ws://localhost:5001', ws: true },
    },
  },
})

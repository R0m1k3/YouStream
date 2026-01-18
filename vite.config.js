import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Configuration du proxy pour contourner CORS en développement
    proxy: {
      '/api/invidious': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/invidious/, '')
      },
      '/api/backend': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/backend/, '/api')
      },
      '/vi': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true
      },
      '/ggpht': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true
      },
      '/videoplayback': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true
      }
    }
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Configuration du proxy pour contourner CORS en développement
    proxy: {
      '/api/invidious': {
        target: 'http://localhost:3002', // Port exposé par Docker pour Invidious (3002)
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/invidious/, '')
      }
    }
  }
})

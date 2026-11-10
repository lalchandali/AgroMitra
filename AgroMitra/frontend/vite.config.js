import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          if (id.includes('/node_modules/recharts/') || id.includes('/node_modules/d3-')) {
            return 'vendor-charts'
          }
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
            return 'vendor-react'
          }
          if (/\/node_modules\/(react-router|react-router-dom|@remix-run)\//.test(id)) {
            return 'vendor-router'
          }
          if (id.includes('/node_modules/react-icons/')) return 'vendor-icons'
          if (id.includes('/node_modules/react-hot-toast/')) return 'vendor-toast'
          if (id.includes('/node_modules/axios/')) return 'vendor-axios'

          return undefined
        },
      },
    },
  },
})

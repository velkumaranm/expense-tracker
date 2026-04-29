import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined
          if (id.includes("firebase")) return "firebase"
          if (id.includes("recharts") || id.includes("chart.js") || id.includes("react-chartjs-2")) return "charts"
          if (id.includes("react")) return "react-vendor"
          return "vendor"
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
})

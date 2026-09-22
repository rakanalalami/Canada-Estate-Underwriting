import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Vite's default splitting already isolates the dynamically imported
    // export modules (exceljs, jsPDF) and their transitive dependencies, so a
    // manual vendor chunk would only drag them into the initial load.
    chunkSizeWarningLimit: 1200,
  },
})

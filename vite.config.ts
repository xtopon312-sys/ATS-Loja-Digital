import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  build: {
    rolldownOptions: { output: { codeSplitting: { groups: [
      { name: 'firebase-firestore', test: /node_modules[\\/]@firebase[\\/]firestore[\\/]/, priority: 20 },
    ] } } },
  },
  server: { host: '127.0.0.1', port: 4174, strictPort: true },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
  test: {
    environment: 'jsdom',
    include: ['src/app/**/*.test.tsx', 'src/shared/**/*.test.{ts,tsx}', 'src/modules/store-theme/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/shared/test/setup.ts'],
    css: true,
    coverage: { reportsDirectory: './coverage' },
  },
})

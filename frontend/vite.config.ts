import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Listen on all interfaces for Docker
    port: 5173,
    strictPort: true,
    hmr: {
      // HMR through nginx proxy - client connects to localhost:80
      host: 'localhost',
      protocol: 'ws',
      clientPort: 80,
    },
    watch: {
      // Enable polling for Docker volumes - required for file change detection in mounted volumes
      usePolling: true,
      interval: 1000,
    },
  },
})

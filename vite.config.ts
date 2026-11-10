import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Las Villas Club - Control de Garita',
        short_name: 'Las Villas',
        description: 'Pases de acceso para residentes, control de garita y administración de Villa Club.',
        theme_color: '#064e3b',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
      },
    }),
  ],
})

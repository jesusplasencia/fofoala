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
        description: 'Pases QR de garita, carnet de residentes y vitrina de Las Villas Club.',
        theme_color: '#11472a',
        background_color: '#fffaf0',
        display: 'standalone',
        orientation: 'portrait',
      },
    }),
  ],
})

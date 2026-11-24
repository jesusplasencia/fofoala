import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build' && !loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL?.trim()) {
    throw new Error('Configura VITE_API_BASE_URL en Vercel (Production y Preview) antes de compilar.')
  }
  return {
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      workbox: {
        // La versión nueva reemplaza a la vieja apenas se publica (sin quedarse en caché)
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
      },
      manifest: {
        name: 'Las Villas Club - Control de Garita',
        short_name: 'Las Villas',
        description: 'Pases QR de garita, carnet de residentes y vitrina de Las Villas Club.',
        theme_color: '#11472a',
        background_color: '#fffaf0',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
}
})

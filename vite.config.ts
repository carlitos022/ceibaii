import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/ceiba-fleet.svg'],
      manifest: {
        name: 'Ceiba Fleet - CustomServiciosRS',
        short_name: 'Ceiba Fleet',
        description: 'Monitor GPS, flotas, video, geocercas y alarmas integrado con Ceiba II.',
        theme_color: '#03111f',
        background_color: '#03111f',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/ceiba-fleet.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['ceiba-original/**/*'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ceiba-map-tiles',
              expiration: { maxEntries: 300, maxAgeSeconds: 86400 }
            }
          }
        ]
      }
    })
  ],
  server: { host: '0.0.0.0' }
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    manifest: { name: 'HishabPro', short_name: 'HishabPro', lang: 'bn', start_url: '/', display: 'standalone', background_color: '#F2F5F4', theme_color: '#0E7A5F',
      icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] },
    workbox: { navigateFallback: '/index.html' } // app shell only; financial data is never cached as a source of truth
  })]
});

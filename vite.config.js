// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  test: {
    // happy-dom is used instead of jsdom: jsdom v29 is incompatible with Vitest v4
    environment: 'happy-dom',
    globals: true,
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}'],
    exclude: ['.claude/**', 'node_modules/**'],
  },
  base: '/shadowhk/',
  plugins: [
    react(),
    // CSP removed — Firebase Auth popup requires access to multiple Google domains.
    // Re-add once hosting domain is finalized.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,json,png,svg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'ShadowHK — Learn Real Hong Kong Cantonese',
        short_name: 'ShadowHK',
        description: 'Scene-first Cantonese pronunciation training',
        theme_color: '#1A2A18',
        background_color: '#F7F4EC',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/shadowhk/',
        start_url: '/shadowhk/',
        categories: ['education'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor';
          if (id.includes('node_modules/idb')) return 'storage';
        },
      },
    },
  },
  server: {
    port: 3000,
  },
});

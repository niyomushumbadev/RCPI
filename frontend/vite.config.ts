import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies /api → backend so cookies (refresh token) stay first-party
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Group large vendor libraries into their own cached chunks so app
        // code updates don't invalidate the long-lived library chunks.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          maps: ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
  server: {
    // PORT is passed by the root `npm run dev` launcher; default unchanged
    port: parseInt(process.env.PORT || '5173', 10) || 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});

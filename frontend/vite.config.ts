import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies /api → backend so cookies (refresh token) stay first-party
export default defineConfig({
  plugins: [react()],
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

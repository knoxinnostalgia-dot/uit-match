import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind IPv4 explicitly: on Windows "localhost" can resolve to ::1 only,
    // which some tools and older browsers fail to reach.
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
});

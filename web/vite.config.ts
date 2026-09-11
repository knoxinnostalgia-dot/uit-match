import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'three/examples/jsm/loaders/FBXLoader.js',
      'three/examples/jsm/postprocessing/EffectComposer.js',
      'three/examples/jsm/postprocessing/RenderPass.js',
      'three/examples/jsm/postprocessing/UnrealBloomPass.js',
    ],
  },
  server: {
    // Bind IPv4 explicitly: on Windows "localhost" can resolve to ::1 only,
    // which some tools and older browsers fail to reach.
    host: '127.0.0.1',
    port: 5173,
    watch: {
      ignored: ['**/public/entrance/hand3d/**', '**/*.fbx'],
    },
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
});

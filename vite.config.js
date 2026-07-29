import { defineConfig } from 'vite'

export default defineConfig({
  root: 'demo',
  server: {
    port: 5174,
    host: '127.0.0.1',
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  }
});
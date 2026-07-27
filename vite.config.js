import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5174,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  }
});
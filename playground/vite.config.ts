import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {defineConfig} from 'vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    fs: {allow: ['..']},
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          codemirror: ['@codemirror/state', '@codemirror/view', '@codemirror/language', '@codemirror/lint', '@codemirror/commands'],
        },
      },
    },
  },
});

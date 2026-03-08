import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    rollupOptions: {
      external: ['electron'],
      // 输出为 preload.js 而非 index.js，避免与 main 输出冲突
      output: {
        entryFileNames: 'preload.js',
      },
    },
  },
});

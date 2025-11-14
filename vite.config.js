// project/vite.config.js

import { defineConfig } from 'vite';
import path from 'path';

const clientRoot = path.resolve(__dirname, 'client');

export default defineConfig({
  // 🔹 frontend root = client/
  root: clientRoot,

  // 🔹 kde jsou statické soubory (config.json, obrázky, css...)
  publicDir: path.resolve(clientRoot, 'public'),

  build: {
    // kam buildovat – varianta A: dist přímo v client/
    outDir: path.resolve(clientRoot, 'dist'),
    // pokud chceš spíš project/dist/client, dej:
    // outDir: path.resolve(__dirname, 'dist/client'),

    emptyOutDir: true,

    rollupOptions: {
      // vstupní HTML
      input: path.resolve(clientRoot, 'index.html'),

      output: {
        manualChunks(id) {
          const normalized = id.split(path.sep).join('/');

          if (normalized.includes('/node_modules/')) {
            return 'vendor';
          }
          if (normalized.includes('/src/lib/')) {
            return 'lib';
          }
        //   if (normalized.includes('/src/app/modules/customers/')) {
        //     return 'customers';
        //   }
        //   if (normalized.includes('/src/app/modules/invoices/')) {
        //     return 'invoices';
        //   }
        }
      }
    }
  },

  resolve: {
    alias: {
      '@app': path.resolve(clientRoot, 'src/app'),
      '@lib': path.resolve(clientRoot, 'src/lib')
    }
  }
});

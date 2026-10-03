import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        drawDefense: fileURLToPath(new URL('./draw-defense.html', import.meta.url))
      }
    }
  }
});

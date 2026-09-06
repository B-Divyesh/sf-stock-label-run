import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        demo: new URL('./demo/index.html', import.meta.url).pathname,
      },
    },
  },
  server: { host: '127.0.0.1' },
});

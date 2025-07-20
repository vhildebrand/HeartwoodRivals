import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
    },
    server: {
        port: 5173,
        host: '0.0.0.0',
        hmr: {
            host: 'localhost'  // HMR should use localhost for development
        },
        watch: {
            usePolling: true   // Required for Docker file watching
        }
    }
});

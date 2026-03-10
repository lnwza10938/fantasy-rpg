import { defineConfig } from 'vite';

export default defineConfig({
    root: './',
    server: {
        host: '0.0.0.0', // Force IPv4/IPv6 binding
        port: 5173,
        strictPort: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
    },
});

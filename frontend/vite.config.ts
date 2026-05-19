import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@/components': path.resolve(__dirname, './src/shared/components'),
            '@/hooks': path.resolve(__dirname, './src/shared/hooks'),
            '@/utils': path.resolve(__dirname, './src/shared/utils'),
            '@/types': path.resolve(__dirname, './src/shared/types'),
            '@/features': path.resolve(__dirname, './src/features'),
            '@/core': path.resolve(__dirname, './src/core'),
            '@/store': path.resolve(__dirname, './src/store'),
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
            },
            '/socket.io': {
                target: 'http://localhost:5000',
                ws: true,
            },
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    'state-vendor': ['zustand', '@tanstack/react-query'],
                    'editor-vendor': ['slate', 'slate-react', 'slate-history'],
                    'collab-vendor': ['yjs', 'y-websocket', 'y-indexeddb', 'socket.io-client'],
                },
            },
        },
    },
});

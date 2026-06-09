import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        open: true,
    },
    resolve: {
        alias: [
            {
                find: /^rollup$/,
                replacement: path.resolve(process.cwd(), 'node_modules/@rollup/wasm-node/dist/rollup.js'),
            },
            {
                find: /^rollup\/(.+)$/,
                replacement: path.resolve(process.cwd(), 'node_modules/@rollup/wasm-node/dist/$1'),
            },
        ],
    },
    optimizeDeps: {
        exclude: ['rollup', '@rollup/wasm-node'],
    },
});

import { defineConfig } from 'vite';

const proxy = { '^/api/': { target: process.env.SALUD_DIGNA_API || 'http://localhost:5080', changeOrigin: true } };
export default defineConfig({ server: { proxy }, preview: { proxy } });

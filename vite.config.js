import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { deepSeekPlugin } from './server/deepseek.js';
export default defineConfig({ plugins: [react(), tailwindcss(), deepSeekPlugin()] });

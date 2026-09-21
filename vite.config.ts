import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Production builds target the root of atom.aiesec.be. GitHub Pages remains a
  // fallback deployment and supplies /igt-tracker/ through its workflow env.
  const base = loadEnv(mode, process.cwd(), '').VITE_BASE_PATH || '/'

  return {
    base,
    plugins: [
      react(),
      // Vite does not copy dotfiles from public/. cPanel needs this SPA
      // fallback beside index.html so direct React Router links do not 404.
      {
        name: 'copy-cpanel-htaccess',
        closeBundle() {
          fs.copyFileSync(
            path.resolve(__dirname, 'public/.htaccess'),
            path.resolve(__dirname, 'dist/.htaccess'),
          )
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      // Dev runs via an 8.3 short-path prefix; relax fs allow-list so the short
      // and long path forms of the project root both resolve.
      fs: { strict: false },
    },
  }
})

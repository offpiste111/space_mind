import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

let gitHash = 'unknown'
try {
  gitHash = execSync('git rev-parse --short HEAD').toString().trim()
} catch (e) {
  console.warn('Failed to get git commit hash', e)
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: "web_src",
  base: "./",
  publicDir: "public",
  build : {
    outDir: "./../dist_vite",
    emptyOutDir: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify('0.1.0'),
    __GIT_HASH__: JSON.stringify(gitHash),
  }
})

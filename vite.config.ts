import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
})

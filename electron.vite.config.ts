import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      minify: true,
      rollupOptions: {
        output: { manualChunks: undefined } // single main chunk — small file
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { minify: true }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()],
    build: {
      // Tree-shake, minify, and split vendor chunks for faster initial parse
      minify: 'esbuild',
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-zustand': ['zustand']
          }
        }
      }
    },
    // Disable sourcemaps in production to reduce memory footprint
    esbuild: {
      // Remove console.log in production builds
      drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
    }
  }
})

import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const projectRoot = path.resolve(__dirname, '..')

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '')
  const apiBaseUrl = env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

  return {
    envDir: projectRoot,
    plugins: [
      figmaAssetResolver(),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})

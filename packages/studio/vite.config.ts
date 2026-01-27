import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'

// Virtual Module Plugin for Config Loading
function kompoConfigLoader() {
  const virtualModuleId = 'virtual:kompo-config'
  const resolvedVirtualModuleId = '\0' + virtualModuleId

  return {
    name: 'kompo-config-loader',
    resolveId(id: string) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId
      }
    },
    load(id: string) {
      if (id === resolvedVirtualModuleId) {
        const configPath = path.resolve(__dirname, '../../libs/config/kompo.config.json')
        if (fs.existsSync(configPath)) {
          const config = fs.readFileSync(configPath, 'utf-8')
          return `export default ${config}`
        }
        return `export default {}`
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), kompoConfigLoader()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

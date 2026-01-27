/**
 * Load .env from monorepo root into process.env.
 * Uses createRequire to dynamically load dependencies in a bundler-safe way.
 */
import { createRequire } from 'node:module'

export function loadEnvSync(): void {
  // Only run in Node.js environment
  if (typeof process === 'undefined' || !process.versions?.node) {
    return
  }

  try {
    const require = createRequire(import.meta.url)
    const fs = require('node:fs')
    const path = require('node:path')
    const { parse } = require('dotenv')

    let currentDir = process.cwd()
    // Search upwards for pnpm-workspace.yaml
    for (let i = 0; i < 5; i++) {
      if (fs.existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
        const envPath = path.join(currentDir, '.env')
        if (fs.existsSync(envPath)) {
          const envConfig = parse(fs.readFileSync(envPath))
          for (const k in envConfig) {
            // Only set if not already set (allow override by CLI environment)
            if (!process.env[k]) {
              process.env[k] = envConfig[k]
            }
          }
        }
        break
      }
      currentDir = path.dirname(currentDir)
    }
  } catch (e) {
    // console.warn('[Config] Failed to load .env synchronously:', e)
  }
}

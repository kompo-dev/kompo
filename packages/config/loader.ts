import fs from 'node:fs'
import path from 'node:path'

/**
 * Smart environment loader for Kompo monorepo.
 * Searches for a .env file starting from the current work directory and moving up.
 */
export function loadEnv() {
  // Only run in Node.js environment
  if (typeof process === 'undefined' || !process.versions?.node) {
    return false
  }

  let currentDir = process.cwd()
  const root = path.parse(currentDir).root

  while (currentDir !== root) {
    const envPath = path.join(currentDir, '.env')

    if (fs.existsSync(envPath)) {
      try {
        // Use Node.js 20+ native env loader
        process.loadEnvFile(envPath)
        return true
      } catch (e) {
        // Fallback or silent fail
        return false
      }
    }

    currentDir = path.dirname(currentDir)
  }

  return false
}

/**
 * Legacy alias for backward compatibility
 */
export const loadEnvSync = loadEnv

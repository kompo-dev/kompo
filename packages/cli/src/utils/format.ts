import { execSync } from 'node:child_process'

/**
 * Runs pnpm format in the specified directory
 * Defaults to ignoring output unless error occurs
 */
export function runFormat(cwd: string) {
  try {
    // biome check --write . (handles formatting + import sorting)
    execSync('pnpm check', { cwd, stdio: 'ignore' })
  } catch (_error) {
    // Ignore formatting errors (maybe no formatter installed or config issue)
    // We don't want to break the command flow if formatting fails
  }
}

/**
 * Runs pnpm sort (sort-package-json) in the specified directory
 */
export function runSort(cwd: string) {
  try {
    execSync('pnpm sort', { cwd, stdio: 'ignore' })
  } catch (_error) {
    // Ignore errors
  }
}

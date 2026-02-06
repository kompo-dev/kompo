import { execSync } from 'node:child_process'

/**
 * Runs pnpm format in the specified directory
 * Defaults to ignoring output unless error occurs
 */
export function runFormat(cwd: string) {
  try {
    // 1. Try running 'check' script (standard in this repo)
    execSync('pnpm check', { cwd, stdio: 'ignore' })
  } catch (_error) {
    try {
      // 2. Fallback: Run biome directly via pnpm exec
      execSync('pnpm exec biome check --write .', { cwd, stdio: 'ignore' })
    } catch (_e) {
      // Ignore
    }
  }
}

/**
 * Runs pnpm sort (sort-package-json) in the specified directory
 */
export function runSort(cwd: string) {
  try {
    // 1. Try running 'sort' script
    execSync('pnpm sort', { cwd, stdio: 'ignore' })
  } catch (_error) {
    try {
      // 2. Fallback: Run sort-package-json directly
      execSync('pnpm exec sort-package-json package.json', { cwd, stdio: 'ignore' })
    } catch (_e) {
      // Ignore
    }
  }
}

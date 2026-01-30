import { spawn } from 'node:child_process'
import { log, taskLog } from '@clack/prompts'
import color from 'picocolors'

/**
 * Installs dependencies in the specified directory using pnpm.
 * Provides a standardized UI output with spinner/progress.
 */
export async function installDependencies(repoRoot: string): Promise<void> {
  const installLog = taskLog({
    title: 'Installing dependencies',
    limit: 5,
  })

  // We capture error lines to display them if installation fails
  const errorLines: string[] = []

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('pnpm', ['install', '--ignore-scripts'], { cwd: repoRoot })

      child.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean)
        for (const line of lines) {
          installLog.message(line)
        }
      })

      child.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean)
        for (const line of lines) {
          installLog.message(line)
          // Capture error lines for display after failure
          // Simple heuristic to catch relevant error messages
          if (line.includes('ERR') || line.includes('error') || line.includes('Error')) {
            errorLines.push(line)
          }
        }
      })

      child.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`pnpm install exited with code ${code}`))
        }
      })

      child.on('error', reject)
    })

    installLog.success(
      color.green(
        'Dependencies installed (scripts skipped to prevent build errors during scaffolding)'
      )
    )
  } catch (error) {
    installLog.error(color.red('Failed to install dependencies'))

    // Show captured error lines so they remain visible
    if (errorLines.length > 0) {
      for (const line of errorLines.slice(-5)) {
        log.error(line)
      }
    }

    log.warning(color.yellow('Please run "pnpm install" manually.'))

    // We re-throw so the caller knows it failed,
    // though the CLI might just proceed or exit depending on context.
    throw error
  }
}

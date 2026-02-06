import { Command } from 'commander'
import color from 'picocolors'
import { createFsEngine } from '../engine/fs-engine'
import type { KompoPluginRegistry } from '../registries/plugin.registry'
import { ensureProjectContext } from '../utils/project'
import type { DoctorCheckResult } from './doctor/doctor.check'
import { getDoctorChecks } from './doctor/doctor.registry'
import './doctor/checks/naming-conventions.check'
import './doctor/checks/forbidden-imports.check'
import './doctor/checks/ports-adapters.check'
import './doctor/checks/config-sync.check'
import { confirm, isCancel } from '@clack/prompts'
import { FRAMEWORKS } from '@kompo/config/constants'
import { readKompoConfig, writeKompoConfig } from '@kompo/kit'
import { getApps, getDomains } from '../utils/project'

// Helper to flatten results
const _flatten = (results: (DoctorCheckResult | DoctorCheckResult[])[]): DoctorCheckResult[] => {
  return results.flatMap((r) => (Array.isArray(r) ? r : [r]))
}

export function createDoctorCommand(_registry: KompoPluginRegistry): Command {
  const cmd = new Command('doctor')
    .description('Check functionality and dependencies')
    .option('--fix', 'Automatically attempt to fix issues (e.g. sync config)')
    .action(async (options) => {
      console.log(color.blue('🩺 Running Kompo Doctor...'))

      const { repoRoot } = await ensureProjectContext(process.cwd())

      const fs = createFsEngine()
      const ctx = { repoRoot, fs }

      const checks = getDoctorChecks()
      const allResults: DoctorCheckResult[] = []

      for (const check of checks) {
        // Run check
        try {
          const results = await check.run(ctx)
          const flatResults = Array.isArray(results) ? results : [results]

          // Check if any error/warning
          const hasIssues = flatResults.some((r) => r.status === 'error' || r.status === 'warning')

          if (!hasIssues) {
            console.log(color.green(`✅ ${check.description}`))
          } else {
            console.log(color.yellow(`Checking ${check.description}...`))
            allResults.push(...flatResults)

            // Print issues immediately for this check
            for (const res of flatResults) {
              if (res.status === 'ok') continue

              const icon =
                res.status === 'error'
                  ? color.red('❌')
                  : res.status === 'warning'
                    ? color.yellow('⚠️')
                    : color.blue('ℹ️')

              console.log(`${icon} ${res.message}`)
              if (res.suggestion) {
                console.log(color.dim(`   → ${res.suggestion}`))
              }
            }
          }
        } catch (e) {
          console.error(color.red(`💥 Check "${check.id}" failed with exception:`), e)
        }
      }

      const issues = allResults.filter((r) => r.status === 'error' || r.status === 'warning')

      if (issues.length === 0) {
        console.log(color.green('\n✨ All checks passed!'))
        return
      }

      console.log(color.red(`\nFound ${issues.length} issues.`))

      // --- Fix / Sync Logic ---
      const syncIssues = issues.filter(
        (i) => i.fix && ['add-domain', 'remove-domain', 'add-app', 'remove-app'].includes(i.fix)
      )

      if (syncIssues.length > 0) {
        let shouldFix = options.fix
        if (!shouldFix) {
          shouldFix = await confirm({
            message: `Found ${syncIssues.length} synchronization issues. Sync config with file system?`,
            initialValue: true,
          })
        }

        if (!isCancel(shouldFix) && shouldFix) {
          console.log(color.blue('\n🔄 Synchronizing config...'))

          const config = readKompoConfig(repoRoot)
          if (config) {
            const fsDomains = await getDomains(repoRoot)
            const fsApps = await getApps(repoRoot)

            // 1. Sync Domains
            const newDomains = { ...config.domains }
            // Remove missing
            Object.keys(newDomains).forEach((d) => {
              if (!fsDomains.includes(d)) delete newDomains[d]
            })
            // Add new
            fsDomains.forEach((d) => {
              if (!newDomains[d]) {
                newDomains[d] = { ports: [], useCases: [], entities: [] }
              }
            })
            config.domains = newDomains

            // 2. Sync Apps
            const newApps = { ...config.apps }
            // Remove missing
            Object.keys(newApps).forEach((p) => {
              // p is like 'apps/web'
              const name = p.replace('apps/', '')
              if (!fsApps.includes(name)) delete newApps[p]
            })
            // Add new
            fsApps.forEach((name) => {
              const p = `apps/${name}`
              if (!newApps[p]) {
                // Try to infer type? For now defaults.
                newApps[p] = {
                  packageName: `@org/${name}`,
                  ports: {},
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  // infer basics?
                  framework: name.includes('api') ? FRAMEWORKS.EXPRESS : FRAMEWORKS.VITE,
                }
              }
            })
            config.apps = newApps

            writeKompoConfig(repoRoot, config)
            console.log(color.green('✅ Config synchronized.'))
          }
        }
      }

      if (issues.length > 0 && !options.fix) {
        process.exit(0)
      }
    })

  return cmd
}

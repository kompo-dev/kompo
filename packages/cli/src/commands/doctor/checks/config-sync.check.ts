import { readKompoConfig } from '@kompo/kit'
import { getApps, getDomains } from '../../../utils/project'
import type { DoctorCheck, DoctorCheckContext, DoctorCheckResult } from '../doctor.check'
import { registerDoctorCheck } from '../doctor.registry'

export const configSyncCheck: DoctorCheck = {
  id: 'config-sync',
  description: 'Checking synchronization between Config and FileSystem',
  async run(ctx: DoctorCheckContext): Promise<DoctorCheckResult[]> {
    const config = readKompoConfig(ctx.repoRoot)
    if (!config) {
      return [{ status: 'error', message: 'kompo.config.json not found' }]
    }

    const fsDomains = await getDomains(ctx.repoRoot)
    const fsApps = await getApps(ctx.repoRoot)

    const configDomains = Object.keys(config.domains || {})
    const configApps = Object.keys(config.apps || {})

    const results: DoctorCheckResult[] = []

    // 1. Domains on Disk but not in Config (Zombies)
    // We want to add them to config
    const domainsToAdd = fsDomains.filter((d) => !configDomains.includes(d))
    domainsToAdd.forEach((d) => {
      results.push({
        status: 'warning',
        message: `Domain '${d}' found on disk but missing from config.`,
        suggestion: `Run 'kompo doctor --fix' to add '${d}' to config.`,
        fix: 'add-domain',
      })
    })

    // 2. Domains in Config but not on Disk (Ghosts)
    // We want to remove them from config
    const domainsToRemove = configDomains.filter((d) => !fsDomains.includes(d))
    domainsToRemove.forEach((d) => {
      results.push({
        status: 'error',
        message: `Domain '${d}' found in config but missing from disk.`,
        suggestion: `Run 'kompo doctor --fix' to clean up '${d}' from config.`,
        fix: 'remove-domain',
      })
    })

    // 3. Apps on Disk but not in Config
    // Apps are identified by directory name in getApps?
    // getApps returns names like 'web', 'api'.
    // Config apps keys are paths? Let's check.
    // Usually config.apps keys are "apps/web" etc.
    const fsAppPaths = fsApps.map((a) => `apps/${a}`)

    // Check Config keys vs constructed paths
    // Note: Config keys might be absolute or relative? Usually relative "apps/web".
    // We need to be careful with matching.

    // Simple check:
    const appsToAdd = fsAppPaths.filter((p) => !configApps.includes(p))
    appsToAdd.forEach((p) => {
      results.push({
        status: 'warning',
        message: `App '${p}' found on disk but missing from config.`,
        suggestion: `Run 'kompo doctor --fix' to register '${p}'.`,
        fix: 'add-app',
      })
    })

    const appsToRemove = configApps.filter((p) => !fsAppPaths.includes(p))
    appsToRemove.forEach((p) => {
      results.push({
        status: 'error',
        message: `App '${p}' in config but missing from disk.`,
        suggestion: `Run 'kompo doctor --fix' to remove '${p}'.`,
        fix: 'remove-app',
      })
    })

    if (results.length === 0) {
      return [{ status: 'ok' }]
    }

    return results
  },
}

registerDoctorCheck(configSyncCheck)

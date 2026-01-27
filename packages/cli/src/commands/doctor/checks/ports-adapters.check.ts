import { readKompoConfig } from '@kompo/kit'
import type { DoctorCheckResult } from '../doctor.check'
import { registerDoctorCheck } from '../doctor.registry'

registerDoctorCheck({
  id: 'ports-without-adapters',
  description: 'Check for defined Ports without Adapters',
  async run({ repoRoot }): Promise<DoctorCheckResult[]> {
    const issues: DoctorCheckResult[] = []
    const config = readKompoConfig(repoRoot)

    if (!config || !config.domains) return [{ status: 'ok' }]

    // Collect all implemented ports from adapters
    const implementedPorts = new Set<string>()
    if (config.adapters) {
      for (const adapter of Object.values(config.adapters)) {
        if (adapter.port) {
          implementedPorts.add(adapter.port)
        }
      }
    }

    // Check ports definitions
    for (const [domainName, domainConfig] of Object.entries(config.domains)) {
      if (domainConfig.ports) {
        for (const port of domainConfig.ports) {
          const portName = typeof port === 'string' ? port : port.name
          if (!implementedPorts.has(portName)) {
            issues.push({
              status: 'warning', // Changed to warning as it may be work in progress
              message: `Port "${portName}" in domain "${domainName}" has no registered adapter in kompo.config.json`,
              suggestion: `kompo add adapter --port ${portName}`,
            })
          }
        }
      }
    }

    if (issues.length === 0) {
      return [{ status: 'ok' }]
    }
    return issues
  },
})

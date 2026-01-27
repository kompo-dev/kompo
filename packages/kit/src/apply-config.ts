/**
 * Apply config utilities - shared between --template and kompo apply
 */

import { BACKEND_TYPES, DESIGN_SYSTEMS, FRAMEWORKS } from './definitions/constants'
import { PORT_DEFINITIONS } from './definitions/port.definitions'
import type { StepEntry } from './kompo-config'

// Temporary loose type to avoid strict coupling with CLI Zod schema for now
// Ideally kit should export the Zod schema or a compatible type
type StepLike = Omit<StepEntry, 'timestamp'> | any

export interface ApplyContext {
  rootDir: string
  projectName: string
  org: string
  frontendAppName: string
  backendAppName?: string
}

export interface ApplyConfig {
  steps: Omit<StepEntry, 'timestamp'>[]
}

/**
 * Extract plugins from step entries
 */
export function extractPluginsFromSteps(steps: StepLike[]): {
  framework: string
  backend: string
  designSystem: string
  ports: string[]
  adapters: Record<string, string>
  drivers: Record<string, string>
  domains: string[]
  wirings: { app: string; port: string; adapter: string }[]
  domainPorts: Record<string, string[]>
} {
  let framework = FRAMEWORKS.NEXTJS
  let backend = BACKEND_TYPES.NONE
  let designSystem = DESIGN_SYSTEMS.VANILLA

  const ports: string[] = []
  const adapters: Record<string, string> = {}
  const drivers: Record<string, string> = {} // Added
  const domains: string[] = []
  const wirings: { app: string; port: string; adapter: string }[] = [] // Added
  const domainPorts: Record<string, string[]> = {} // Added
  const features: string[] = [] // Initialize features array
  const effectiveSteps = steps || []

  for (const entry of effectiveSteps) {
    const cmd = entry.command

    // Framework (from App creation)
    if ((cmd === 'new' || cmd === 'add') && entry.type === 'app') {
      if (entry.driver) framework = entry.driver
      if (entry.designSystem || entry.design) {
        designSystem = entry.designSystem || entry.design
      }
    }

    // Backend
    if ((cmd === 'new' || cmd === 'add') && entry.type === 'app' && entry.name === 'api') {
      if (entry.driver) backend = entry.driver
    }

    if (cmd === 'add' && entry.type === 'design-system') {
      designSystem = entry.name
    }

    // Domain
    if (cmd === 'add' && entry.type === 'domain') {
      domains.push(entry.name)
    }

    // Port
    if (cmd === 'add' && entry.type === 'port') {
      let portName = entry.name
      // Smart Naming Logic (Simple minimal version matching CLI definitions)
      // If capability is provided, try to infer suffix
      // orm -> repository
      // rpc -> gateway
      // wallet -> provider
      // events -> publisher
      // notifications -> notifier
      // jobs -> executor
      if (entry.capability) {
        const cap = entry.capability

        // Find definition that supports this capability
        const def = PORT_DEFINITIONS.find((d) => d.capabilities.includes(cap))

        if (def && def.suffix) {
          const suffix = def.suffix
          if (!portName.endsWith(`-${suffix}`)) {
            portName = `${portName}-${suffix}`
          }
        }
      }

      ports.push(portName)
      if (entry.domain) {
        if (!domainPorts[entry.domain]) domainPorts[entry.domain] = []
        domainPorts[entry.domain].push(portName)
      }
    }

    // Adapter
    if (cmd === 'add' && entry.type === 'adapter' && entry.port) {
      adapters[entry.port] = entry.name
      if (entry.driver) {
        drivers[entry.port] = entry.driver
      }
    }

    // Wiring
    if (cmd === 'wire' && entry.type === 'adapter' && entry.port && entry.name && entry.app) {
      wirings.push({
        app: entry.app, // e.g. "apps/web"
        port: entry.port,
        adapter: entry.name,
      })
    }

    // Feature
    if (cmd === 'add' && entry.type === 'feature') {
      features.push(entry.name)
    }
  }

  return {
    framework,
    backend,
    designSystem,
    ports,
    adapters,
    drivers,
    domains,
    wirings,
    domainPorts,
  }
}

/**
 * Get the list of plugins to merge into catalog from config
 */
export function getPluginsToMerge(config: ApplyConfig): string[] {
  const { framework, backend, designSystem, ports } = extractPluginsFromSteps(config.steps)

  return [
    `framework-${framework}`,
    ...(backend !== 'none' ? [`backend-${backend}`] : []),
    `design-${designSystem}`,
    ...ports.map((p) => `port-${p}`),
  ]
}

/**
 * Apply config utilities - shared between --template and kompo apply
 */

import { DESIGN_SYSTEMS, FRAMEWORKS } from './definitions/constants'
import { PORT_DEFINITIONS } from './definitions/port.definitions'
import type { StepEntry } from './kompo-config'

// Temporary loose type to avoid strict coupling with CLI Zod schema for now
// Ideally kit should export the Zod schema or a compatible type
type StepLike = Omit<StepEntry, 'timestamp'> | any

export interface ProjectStructure {
  framework: string
  designSystem: string
  ports: string[]
  adapters: Record<string, string>
  drivers: Record<string, string>
  domains: string[]
  features: string[]
  wirings: { app: string; port: string; adapter: string }[]
  domainPorts: Record<string, string[]>
  chains?: string[]
  instances?: Record<string, string>
}

export interface ApplyConfig {
  steps: Omit<StepEntry, 'timestamp'>[]
}

/**
 * Extract plugins from step entries
 */
export function extractPluginsFromSteps(steps: StepLike[]): ProjectStructure {
  let framework = FRAMEWORKS.NEXTJS
  let designSystem = DESIGN_SYSTEMS.VANILLA

  const ports: string[] = []
  const adapters: Record<string, string> = {}
  const drivers: Record<string, string> = {}
  const domains: string[] = []
  const wirings: { app: string; port: string; adapter: string }[] = []
  const domainPorts: Record<string, string[]> = {}
  const features: string[] = []
  const chains: string[] = []
  const instances: Record<string, string> = {}

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

        if (def?.suffix) {
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
    designSystem,
    ports,
    adapters,
    drivers,
    domains,
    wirings,
    domainPorts,
    features,
    chains,
    instances,
  }
}

/**
 * Get the list of plugins to merge into catalog from config
 */
export function getPluginsToMerge(config: ApplyConfig): string[] {
  const { framework, designSystem, ports } = extractPluginsFromSteps(config.steps)

  return [`framework-${framework}`, `design-${designSystem}`, ...ports.map((p) => `port-${p}`)]
}

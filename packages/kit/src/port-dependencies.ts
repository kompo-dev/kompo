/**
 * Port dependencies management for Kompo CLI
 * Handles inter-plugin dependencies (e.g., auth requires orm)
 */

import { type KompoConfig, readKompoConfig } from './kompo-config'

/**
 * Port dependency declaration
 */
export interface PortDependency {
  /** Port ID that is required */
  port: string
  /** If true, auto-install without prompt. If false, prompt user. */
  required: boolean
  /** Optional condition - only require when this evaluates to true */
  when?: (answers: Record<string, unknown>) => boolean
}

/**
 * Provider descriptor for composite ports (like auth)
 */
export interface ProviderDescriptor {
  id: string
  name: string
  description: string
  /** Ports this provider satisfies (e.g., Privy satisfies both 'wallet' and 'auth') */
  satisfies?: string[]
  /** Dependencies this provider requires */
  dependencies?: PortDependency[]
}

/**
 * Check if a port is installed in the project
 */
export function isPortInstalled(rootDir: string, portId: string): boolean {
  const config = readKompoConfig(rootDir)
  if (!config) return false

  // Check in adapters
  if (config.adapters) {
    for (const adapter of Object.values(config.adapters)) {
      if (adapter.port === portId) {
        return true
      }
    }
  }

  // Check in apps' ports
  for (const app of Object.values(config.apps)) {
    if (app.ports && portId in app.ports) {
      return true
    }
  }

  return false
}

/**
 * Get all installed ports in the project
 */
export function getInstalledPorts(rootDir: string): string[] {
  const config = readKompoConfig(rootDir)
  if (!config) return []

  const ports = new Set<string>()

  // From adapters
  if (config.adapters) {
    for (const adapter of Object.values(config.adapters)) {
      ports.add(adapter.port)
    }
  }

  // From apps
  for (const app of Object.values(config.apps)) {
    if (app.ports) {
      for (const portId of Object.keys(app.ports)) {
        ports.add(portId)
      }
    }
  }

  return Array.from(ports)
}

/**
 * Check if a provider satisfies a given port
 * Used for providers like Privy that satisfy both 'wallet' and 'auth'
 */
export function providerSatisfiesPort(provider: ProviderDescriptor, portId: string): boolean {
  return provider.satisfies?.includes(portId) ?? false
}

/**
 * Get missing required dependencies for a provider
 */
export function getMissingDependencies(
  rootDir: string,
  provider: ProviderDescriptor,
  answers: Record<string, unknown>
): PortDependency[] {
  if (!provider.dependencies) return []

  return provider.dependencies.filter((dep) => {
    // Check condition if present
    if (dep.when && !dep.when(answers)) {
      return false
    }
    // Check if port is already installed
    return !isPortInstalled(rootDir, dep.port)
  })
}

/**
 * Get required (auto-install) dependencies
 */
export function getRequiredDependencies(
  rootDir: string,
  provider: ProviderDescriptor,
  answers: Record<string, unknown>
): PortDependency[] {
  return getMissingDependencies(rootDir, provider, answers).filter((dep) => dep.required)
}

/**
 * Get optional dependencies (prompt user)
 */
export function getOptionalDependencies(
  rootDir: string,
  provider: ProviderDescriptor,
  answers: Record<string, unknown>
): PortDependency[] {
  return getMissingDependencies(rootDir, provider, answers).filter((dep) => !dep.required)
}

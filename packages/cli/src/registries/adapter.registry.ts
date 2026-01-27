import type { AdapterGenerator } from '../generators/adapter.generator'
import type { CapabilityManifest } from './capability.registry'

export interface RegisteredAdapter {
  capability: CapabilityManifest
  generator: AdapterGenerator
}

const registry: RegisteredAdapter[] = []

/**
 * Registers a new adapter generator for a specific capability.
 * @param capability The capability manifest (defines the menu structure)
 * @param generator The generator function (executes the logic)
 */
export function registerAdapterGenerator(
  capability: CapabilityManifest,
  generator: AdapterGenerator
) {
  // Prevent duplicate registration by ID
  const existingIndex = registry.findIndex((r) => r.capability.id === capability.id)
  if (existingIndex >= 0) {
    registry[existingIndex] = { capability, generator }
  } else {
    registry.push({ capability, generator })
  }
}

/**
 * Retrieves all registered adapter generators.
 */
export function getRegisteredAdapters(): RegisteredAdapter[] {
  return [...registry]
}

/**
 * Retrieves a specific generator by capability ID.
 */
export function getAdapterGenerator(capabilityId: string): RegisteredAdapter | undefined {
  return registry.find((r) => r.capability.id === capabilityId)
}

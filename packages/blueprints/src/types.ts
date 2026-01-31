/**
 * Single source of truth for Kompo Blueprint types.
 * All types are inferred from Zod schemas to ensure synchronization with runtime validation.
 */

import type {
  AdapterBlueprint,
  AppBlueprint,
  Blueprint,
  DriverBlueprint,
} from './schemas/blueprint.schema'
import type { FeatureManifest } from './schemas/feature.schema'
import type { StarterManifest } from './schemas/starter.schema'
import type { Step } from './schemas/step.schema'

// Re-export for convenience
export type { Step as BlueprintStep }
export type { StarterManifest }
export type { FeatureManifest }
export type { Blueprint, AppBlueprint, AdapterBlueprint, DriverBlueprint }

export interface BlueprintOptions {
  framework?: string
  plan?: 'community' | 'enterprise'
}

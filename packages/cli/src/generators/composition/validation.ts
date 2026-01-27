import type { CapabilityManifest } from '../../registries/capability.registry'
import type { AdapterManifest } from './types'

export interface ValidationError {
  path: string
  message: string
  code: string
}

export interface ValidationWarning {
  path: string
  message: string
  code: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export type ValidatorFunction = (
  manifest: AdapterManifest,
  capability: CapabilityManifest
) => ValidationResult

export const validateAdapterManifest = (
  manifest: AdapterManifest,
  capability: CapabilityManifest
): ValidationResult => {
  const validators: ValidatorFunction[] = [
    validateBasicStructure,
    validateProviderCompatibility,
    // Add placeholders if implementation is empty for now
    // validateDependencies,
    // validateComposition,
    // validateEnvironment
  ]

  return validators.reduce(
    (acc, validator) => {
      const result = validator(manifest, capability)
      return {
        valid: acc.valid && result.valid,
        errors: [...acc.errors, ...result.errors],
        warnings: [...acc.warnings, ...result.warnings],
      }
    },
    { valid: true, errors: [], warnings: [] } as ValidationResult
  )
}

// Validateurs individuels
const validateBasicStructure: ValidatorFunction = (manifest) => {
  // In a real scenario, checks if manifest is null/undefined too
  if (!manifest)
    return {
      valid: false,
      errors: [{ path: 'root', message: 'Manifest is missing', code: 'MISSING' }],
      warnings: [],
    }

  return {
    valid: !!(manifest.name && manifest.capability),
    errors: !manifest.name ? [{ path: 'name', message: 'Name is required', code: 'REQUIRED' }] : [],
    warnings: [],
  }
}

const validateProviderCompatibility: ValidatorFunction = (manifest, capability) => {
  // If manifest doesn't specify which provider it implements, maybe it matches by name or dir?
  // User example had `manifest.provider`. Our schema has `name`. Let's assume `name` is the provider ID or related.
  // Actually, our manifest schema has "name" as provider ID.
  const providerExists = capability.providers?.some((p) => p.id === manifest.provider) ?? false
  return {
    valid: providerExists,
    errors: providerExists
      ? []
      : [
          {
            path: 'provider',
            message: `Provider ${manifest.provider} not supported by capability ${capability.id}`,
            code: 'INCOMPATIBLE_PROVIDER',
          },
        ],
    warnings: [],
  }
}

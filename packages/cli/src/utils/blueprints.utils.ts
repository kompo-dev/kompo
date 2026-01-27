import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getTemplatesDir } from '@kompo/blueprints'
import color from 'picocolors'
import type { ProviderManifest } from '../registries/capability.registry'

/**
 * Dynamically load providers for a capability from the blueprints registry.
 * Structure: @kompo/blueprints/elements/libs/adapters/<capability>/providers/<provider>/blueprint.json
 */
export function loadProvidersFromBlueprints(capabilityId: string): ProviderManifest[] {
  const templatesDir = getTemplatesDir()
  const providersDir = join(templatesDir, 'libs', 'adapters', capabilityId, 'providers')

  if (!existsSync(providersDir)) return []

  const providers: ProviderManifest[] = []
  const entries = readdirSync(providersDir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const blueprintPath = join(providersDir, entry.name, 'blueprint.json')
      const manifest = loadBlueprintManifest(blueprintPath, capabilityId)
      if (manifest) providers.push(manifest)
    }
  }

  return providers
}

function loadBlueprintManifest(
  blueprintPath: string,
  capabilityId: string
): ProviderManifest | null {
  if (!existsSync(blueprintPath)) return null

  try {
    const content = readFileSync(blueprintPath, 'utf-8')
    const blueprint = JSON.parse(content)

    // Only include if it matches the capability (defensive check)
    if (blueprint.capability === capabilityId || blueprint.family === capabilityId) {
      if (!blueprint.id) {
        console.warn(
          color.yellow(`⚠️  Blueprint at ${blueprintPath} is missing a strict "id". Skipping.`)
        )
        return null
      }

      return {
        id: blueprint.id,
        name: blueprint.name || blueprint.id,
        description: blueprint.description,
        drivers: blueprint.drivers || [],
      }
    }
  } catch {
    // Ignore invalid blueprints
  }

  return null
}

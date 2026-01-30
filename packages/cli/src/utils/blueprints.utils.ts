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

/**
 * Loads and validates a static blueprint file.
 *
 * @param blueprintPath - Absolute path to the blueprint.json
 */
export async function loadBlueprint<T = any>(blueprintPath: string): Promise<T> {
  // 1. Read file
  let content = ''
  try {
    // We use dynamic import for fs to avoid top-level node deps issues in some contexts, though here strict ESM is fine.
    // But we can just use readdir/readFileSync from the top import or import 'node:fs/promises'
    const { readFile } = await import('node:fs/promises')
    content = await readFile(blueprintPath, 'utf-8')
  } catch (e) {
    throw new Error(`Failed to read blueprint at ${blueprintPath}: ${(e as Error).message}`)
  }

  if (!content) {
    throw new Error(`Blueprint is empty: ${blueprintPath}`)
  }

  // 2. Parse JSON
  let config: any
  try {
    config = JSON.parse(content)
  } catch (e) {
    throw new Error(`Failed to parse blueprint JSON at ${blueprintPath}: ${(e as Error).message}`)
  }

  // 3. Validate Schema
  const { blueprintSchema } = await import('@kompo/blueprints')

  try {
    const validated = blueprintSchema.parse(config)
    return validated as unknown as T
  } catch (error: any) {
    if (error.errors) {
      const issues = error.errors
        .map((e: any) => `  - ${e.path.join('.')}: ${e.message}`)
        .join('\n')
      throw new Error(`❌ Invalid blueprint at ${blueprintPath}:\n${issues}`)
    }
    throw error
  }
}

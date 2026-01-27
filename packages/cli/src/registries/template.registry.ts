import type { BlueprintConfig } from '../commands/new.command'

export interface BlueprintManifest extends BlueprintConfig {
  name: string
  description?: string
  path?: string
}

export interface BlueprintProvider {
  name: string
  getBlueprint(blueprintName: string): Promise<BlueprintManifest | null>
}

const providers: BlueprintProvider[] = []

export function registerBlueprintProvider(provider: BlueprintProvider) {
  providers.push(provider)
}

export async function getBlueprint(blueprintName: string): Promise<BlueprintManifest | null> {
  for (const provider of providers) {
    const blueprint = await provider.getBlueprint(blueprintName)
    if (blueprint) return blueprint
  }
  return null
}

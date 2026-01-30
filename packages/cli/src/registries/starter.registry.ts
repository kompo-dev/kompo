import type { StarterManifest } from '@kompo/blueprints/types'

export interface StarterProvider {
  name: string
  getStarter(starterName: string): Promise<StarterManifest | null>
}

const providers: StarterProvider[] = []

export function registerStarterProvider(provider: StarterProvider) {
  providers.push(provider)
}

export async function getStarter(starterName: string): Promise<StarterManifest | null> {
  for (const provider of providers) {
    const starter = await provider.getStarter(starterName)
    if (starter) return starter
  }
  return null
}

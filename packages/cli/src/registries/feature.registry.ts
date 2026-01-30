import type { FeatureManifest } from '@kompo/blueprints/types'

export interface FeatureProvider {
  name: string
  getFeature(featureName: string): Promise<FeatureManifest | null>
}

const providers: FeatureProvider[] = []

export function registerFeatureProvider(provider: FeatureProvider) {
  providers.push(provider)
}

export async function getFeature(featureName: string): Promise<FeatureManifest | null> {
  for (const provider of providers) {
    const feature = await provider.getFeature(featureName)
    if (feature) return feature
  }
  return null
}

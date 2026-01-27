export interface FeatureBlueprint {
  domains: {
    name: string
    entities?: string[]
    ports?: string[]
    'use-cases'?: string[] // use-cases or useCases
  }[]
  adapters?: {
    name: string
    port: string
    driver: string
    app?: string // Optional, if global or specific
  }[]
}

export interface FeatureProvider {
  name: string
  getFeature(featureName: string): Promise<FeatureBlueprint | null>
}

const providers: FeatureProvider[] = []

export function registerFeatureProvider(provider: FeatureProvider) {
  providers.push(provider)
}

export async function getFeature(featureName: string): Promise<FeatureBlueprint | null> {
  for (const provider of providers) {
    const feature = await provider.getFeature(featureName)
    if (feature) return feature
  }
  return null
}

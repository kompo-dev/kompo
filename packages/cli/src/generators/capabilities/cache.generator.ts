import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { generateAdapter } from '../adapter.generator'

export const cacheCapability: CapabilityManifest = {
  id: 'cache',
  name: 'Cache',
  kind: 'cache',
  icon: '⚡',
  description: 'In-Memory / KV Store',
  hint: 'Caching Layer (Redis, Upstash)',
  defaultSubject: 'cache',
  providers: loadProvidersFromBlueprints('cache'),
}

registerAdapterGenerator(cacheCapability, generateAdapter)

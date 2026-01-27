import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { generateAdapter } from '../adapter.generator'

export const searchCapability: CapabilityManifest = {
  id: 'search',
  name: 'Search',
  kind: 'index',
  icon: '🔎',
  description: 'Full-text Search Engine',
  hint: 'Search Engine (Algolia, MeiliSearch)',
  defaultSubject: 'search',
  providers: loadProvidersFromBlueprints('search'),
}

registerAdapterGenerator(searchCapability, generateAdapter)

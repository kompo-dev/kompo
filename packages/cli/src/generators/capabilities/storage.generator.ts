import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { generateAdapter } from '../adapter.generator'

export const storageCapability: CapabilityManifest = {
  id: 'storage',
  name: 'Storage',
  kind: 'gateway',
  icon: '📦',
  description: 'File Storage Service',
  hint: 'File Upload (S3, R2, Firebase)',
  defaultSubject: 'storage',
  providers: loadProvidersFromBlueprints('storage'),
}

registerAdapterGenerator(storageCapability, generateAdapter)

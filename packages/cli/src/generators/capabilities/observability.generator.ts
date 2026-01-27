import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { generateAdapter } from '../adapter.generator'

export const observabilityCapability: CapabilityManifest = {
  id: 'observability',
  name: 'Observability',
  kind: 'monitor',
  icon: '👁️ ',
  description: 'Monitoring & Error Tracking',
  hint: 'Monitoring (Sentry, Datadog)',
  defaultSubject: 'monitoring',
  providers: loadProvidersFromBlueprints('observability'),
}

registerAdapterGenerator(observabilityCapability, generateAdapter)

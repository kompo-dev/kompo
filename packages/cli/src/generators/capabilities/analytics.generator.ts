import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { generateAdapter } from '../adapter.generator'

export const analyticsCapability: CapabilityManifest = {
  id: 'analytics',
  name: 'Analytics',
  kind: 'index',
  icon: '📊',
  description: 'Product Analytics & Tracking',
  hint: 'User Tracking (PostHog, Segment)',
  defaultSubject: 'analytics',
  providers: loadProvidersFromBlueprints('analytics'),
}

registerAdapterGenerator(analyticsCapability, generateAdapter)

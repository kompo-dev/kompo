import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { generateAdapter } from '../adapter.generator'

export const flagsCapability: CapabilityManifest = {
  id: 'flags',
  name: 'Feature Flags',
  kind: 'provider',
  icon: '🚩',
  description: 'Feature Flag Management',
  hint: 'Feature Flags (LaunchDarkly, PostHog, Env)',
  defaultSubject: 'flags',
  providers: loadProvidersFromBlueprints('flags'),
}

registerAdapterGenerator(flagsCapability, generateAdapter)

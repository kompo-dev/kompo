import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { generateAdapter } from '../adapter.generator'

export const authCapability: CapabilityManifest = {
  id: 'auth',
  name: 'Auth',
  kind: 'provider',
  icon: '🔐',
  description: 'Authentication & User Management',
  hint: 'User Login (Privy, Clerk, Lucia)',
  defaultSubject: 'auth',
  providers: loadProvidersFromBlueprints('auth'),
}

registerAdapterGenerator(authCapability, generateAdapter)

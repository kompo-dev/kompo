import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { generateAdapter } from '../adapter.generator'

export const paymentsCapability: CapabilityManifest = {
  id: 'payments',
  name: 'Payments',
  kind: 'processor',
  icon: '💳',
  description: 'Payment Processing & Subscriptions',
  hint: 'Payment Processing (Stripe, LemonSqueezy)',
  defaultSubject: 'payments',
  providers: loadProvidersFromBlueprints('payments'),
}

registerAdapterGenerator(paymentsCapability, generateAdapter)

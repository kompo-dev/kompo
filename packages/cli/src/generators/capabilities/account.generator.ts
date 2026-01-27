import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { createAdapterGenerator } from '../composition/factory'
import { stepRegistry } from '../composition/step.registry'
import { registerCoreSteps } from '../composition/steps/core.steps'

// Register Core Steps (Idempotent)
registerCoreSteps(stepRegistry)

export const accountCapability: CapabilityManifest = {
  id: 'account',
  name: 'Account',
  kind: 'provider',
  icon: '🆔',
  description: 'User Identity (Smart Accounts, ENS)',
  hint: 'Identity & Smart Accounts (Kernel, Safe)',
  defaultSubject: 'account',
  providers: loadProvidersFromBlueprints('account'),
}

export const generateAccountAdapter = createAdapterGenerator({
  capability: accountCapability,
})

registerAdapterGenerator(accountCapability, generateAccountAdapter)

import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { createAdapterGenerator } from '../composition/factory'
import { stepRegistry } from '../composition/step.registry'
import { registerCoreSteps } from '../composition/steps/core.steps'

// Register Core Steps (Idempotent)
registerCoreSteps(stepRegistry)

export const walletCapability: CapabilityManifest = {
  id: 'wallet',
  name: 'Wallet',
  kind: 'provider',
  icon: '💼',
  description: 'Web3 Wallet connection and management',
  hint: 'Wallet UI (RainbowKit, ConnectKit)',
  defaultSubject: 'wallet',
  providers: loadProvidersFromBlueprints('wallet'),
}

export const generateWalletAdapter = createAdapterGenerator({
  capability: walletCapability,
  // customSteps if needed
})

registerAdapterGenerator(walletCapability, generateWalletAdapter)

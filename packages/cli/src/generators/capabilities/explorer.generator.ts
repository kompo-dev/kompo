import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { createAdapterGenerator } from '../composition/factory'
import { stepRegistry } from '../composition/step.registry'
import { registerCoreSteps } from '../composition/steps/core.steps'

registerCoreSteps(stepRegistry)

export const explorerCapability: CapabilityManifest = {
  id: 'explorer',
  name: 'Explorer',
  kind: 'gateway',
  icon: '🌐',
  description: 'Blockchain Explorer & Data Services (Alchemy, Infura, Etherscan)',
  hint: 'Chain Data APIs (Alchemy SDK, Infura, Etherscan)',
  defaultSubject: 'api',
  providers: loadProvidersFromBlueprints('explorer'),
}

export const generateExplorerAdapter = createAdapterGenerator({
  capability: explorerCapability,
})

registerAdapterGenerator(explorerCapability, generateExplorerAdapter)

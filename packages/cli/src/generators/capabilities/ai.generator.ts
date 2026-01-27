import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { generateAdapter } from '../adapter.generator'

export const aiCapability: CapabilityManifest = {
  id: 'ai',
  name: 'AI',
  kind: 'gateway', // Considered a gateway to external intelligence
  icon: '🤖',
  description: 'LLM & AI Inference',
  hint: 'Artificial Intelligence (OpenAI, Anthropic)',
  defaultSubject: 'ai',
  providers: loadProvidersFromBlueprints('ai'),
}

registerAdapterGenerator(aiCapability, generateAdapter)

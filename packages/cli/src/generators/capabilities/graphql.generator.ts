import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { createAdapterGenerator } from '../composition/factory'

export const graphqlCapability: CapabilityManifest = {
  id: 'graphql',
  name: 'GraphQL',
  kind: 'adapter',
  icon: '🕸️',
  description: 'GraphQL Client Adapters (Apollo, Urql)',
  defaultSubject: 'api',
  providers: loadProvidersFromBlueprints('graphql'),
}

export const generateGraphqlAdapter = createAdapterGenerator({
  capability: graphqlCapability,
})

registerAdapterGenerator(graphqlCapability, generateGraphqlAdapter)

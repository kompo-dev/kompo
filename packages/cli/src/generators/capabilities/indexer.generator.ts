import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { generateAdapter } from '../adapter.generator'

export const indexerCapability: CapabilityManifest = {
  id: 'indexer',
  name: 'Indexer',
  kind: 'index',
  icon: '⚡',
  description: 'Custom Data Indexing & Querying (The Graph, Ponder, Subgraphs)',
  hint: 'Custom Blockchain Subgraph Indexing (The Graph, Ponder, Ghost)',
  defaultSubject: 'indexer',
  providers: loadProvidersFromBlueprints('indexer'),
}

registerAdapterGenerator(indexerCapability, generateAdapter)

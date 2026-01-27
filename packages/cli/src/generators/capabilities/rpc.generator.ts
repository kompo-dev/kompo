import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { createAdapterGenerator } from '../composition/factory'

export const rpcCapability: CapabilityManifest = {
  id: 'rpc',
  name: 'RPC',
  kind: 'gateway',
  icon: '⚡',
  description: 'Remote Procedure Call (Blockchain, APIs)',
  hint: 'Blockchain Connectivity (Viem, Ethers)',
  defaultSubject: 'blockchain',
  providers: loadProvidersFromBlueprints('rpc'),
}

export const generateRpcAdapter = createAdapterGenerator({
  capability: rpcCapability,
})

registerAdapterGenerator(rpcCapability, generateRpcAdapter)

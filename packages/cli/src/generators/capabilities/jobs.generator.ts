import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { generateAdapter } from '../adapter.generator'

export const jobsCapability: CapabilityManifest = {
  id: 'jobs',
  name: 'Jobs',
  kind: 'executor',
  icon: '⚙️ ',
  description: 'Background Jobs & Workflows',
  hint: 'Async Workloads (BullMQ, Inngest, Trigger.dev)',
  defaultSubject: 'jobs',
  providers: loadProvidersFromBlueprints('jobs'),
}

registerAdapterGenerator(jobsCapability, generateAdapter)

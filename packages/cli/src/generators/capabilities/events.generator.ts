import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { generateAdapter } from '../adapter.generator'

export const eventsCapability: CapabilityManifest = {
  id: 'events',
  name: 'Events',
  kind: 'publisher',
  icon: '📡',
  description: 'Event Bus & Message Queue',
  hint: 'Event Messaging (Kafka, RabbitMQ)',
  defaultSubject: 'events',
  providers: loadProvidersFromBlueprints('events'),
}

registerAdapterGenerator(eventsCapability, generateAdapter)

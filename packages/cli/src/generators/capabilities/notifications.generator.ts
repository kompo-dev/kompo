import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { generateAdapter } from '../adapter.generator'

export const notificationsCapability: CapabilityManifest = {
  id: 'notifications',
  name: 'Notifications',
  kind: 'notifier',
  icon: '🔔',
  description: 'Transactional Messaging (Push, Email, SMS)',
  hint: 'Message Sending (Resend, Twilio)',
  defaultSubject: 'notifications',
  providers: loadProvidersFromBlueprints('notifications'),
}

registerAdapterGenerator(notificationsCapability, generateAdapter)

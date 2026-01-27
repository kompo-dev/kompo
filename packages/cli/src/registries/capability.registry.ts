import { analyticsCapability } from '../generators/capabilities/analytics.generator'
import { authCapability } from '../generators/capabilities/auth.generator'
import { cacheCapability } from '../generators/capabilities/cache.generator'
import { eventsCapability } from '../generators/capabilities/events.generator'
import { httpCapability } from '../generators/capabilities/http.generator'
import { indexerCapability } from '../generators/capabilities/indexer.generator'
import { jobsCapability } from '../generators/capabilities/jobs.generator'
import { notificationsCapability } from '../generators/capabilities/notifications.generator'
import { ormCapability } from '../generators/capabilities/orm.generator'
import { paymentsCapability } from '../generators/capabilities/payments.generator'
import { storageCapability } from '../generators/capabilities/storage.generator'
import { walletCapability } from '../generators/capabilities/wallet.generator'

export interface DriverManifest {
  id: string
  name: string
  plan?: 'community' | 'enterprise'
  status?: 'enabled' | 'available' | 'coming-soon'
  description?: string
  runtime?: boolean
  blueprint?: string
  sharedDriver?: string
}

export interface ProviderManifest {
  id: string
  name: string
  description?: string
  plan?: 'community' | 'enterprise'
  status?: 'enabled' | 'available' | 'coming-soon'
  drivers?: DriverManifest[]
}

export interface CapabilityManifest {
  id: string
  name: string
  kind: string
  description: string
  plan?: 'community' | 'enterprise'
  status?: 'enabled' | 'available' | 'coming-soon'
  providers?: ProviderManifest[]
  hint?: string
  icon?: string
  defaultSubject: string
  configure?: (options: {
    repoRoot: string
    portName: string
    providerId: string
    driverId?: string
    domainName?: string
    scope: string
  }) => Promise<{
    alias?: string
    isSpecializedClient?: boolean
    templateData?: Record<string, unknown>
  }>
}

export interface CapabilityProvider {
  name: string
  getCapabilities(): Promise<CapabilityManifest[]>
}

const providers: CapabilityProvider[] = []

export function registerCapabilityProvider(provider: CapabilityProvider) {
  providers.push(provider)
}

export async function getCapabilities(): Promise<CapabilityManifest[]> {
  const mergedCapabilities: Map<string, CapabilityManifest> = new Map()

  for (const provider of providers) {
    const providerCapabilities = await provider.getCapabilities()

    for (const capability of providerCapabilities) {
      if (!mergedCapabilities.has(capability.id)) {
        // Clone to avoid mutation issues if deeper merge happens later
        mergedCapabilities.set(capability.id, JSON.parse(JSON.stringify(capability)))
      } else {
        // Merge Providers (formerly Solutions)
        const existingCapability = mergedCapabilities.get(capability.id)
        if (!existingCapability) continue

        if (capability.providers) {
          if (!existingCapability.providers) existingCapability.providers = []

          for (const providerManifest of capability.providers) {
            const existingProvider = existingCapability.providers.find(
              (p) => p.id === providerManifest.id
            )

            if (!existingProvider) {
              existingCapability.providers.push(providerManifest)
            } else if (providerManifest.drivers) {
              // Merge Drivers
              if (!existingProvider.drivers) existingProvider.drivers = []
              for (const driver of providerManifest.drivers) {
                const existingDriver = existingProvider.drivers.find((d) => d.id === driver.id)
                if (!existingDriver) {
                  existingProvider.drivers.push(driver)
                }
              }
            }
          }
        }
      }
    }
  }
  return Array.from(mergedCapabilities.values())
}

// Default Hierarchical Capabilities - loaded from generators
const DEFAULT_CAPABILITIES: CapabilityManifest[] = [
  ormCapability,
  authCapability,
  cacheCapability,
  analyticsCapability,
  eventsCapability,
  indexerCapability,
  jobsCapability,
  notificationsCapability,
  paymentsCapability,
  storageCapability,
  walletCapability,
  httpCapability,
]

registerCapabilityProvider({
  name: 'OSS Capabilities',
  getCapabilities: async () => DEFAULT_CAPABILITIES,
})

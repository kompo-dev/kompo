import { cancel } from '@clack/prompts'
import {
  type FrameworkId,
  type KompoConfig,
  LIBS_DIR,
  readKompoConfig,
  writeKompoConfig,
} from '@kompo/kit'

import { DEFAULT_ALIAS } from './naming'

export function parseAdapterId(adapterId: string) {
  const parts = adapterId.split('.')
  const derivedAlias = parts.length > 1 ? parts[1] : DEFAULT_ALIAS
  const isSpecialized = derivedAlias !== DEFAULT_ALIAS
  const baseAdapterName = parts[0]

  return {
    alias: derivedAlias,
    isSpecialized,
    baseAdapterName,
  }
}

export { type FrameworkId, type KompoConfig, LIBS_DIR, readKompoConfig, writeKompoConfig }

interface RegisterAdapterOptions {
  repoRoot: string
  adapterName: string
  portName: string
  providerId: string
  driver?: string
  capability?: string
  configKey?: string

  isInstance?: boolean
}

function resolveCanonicalPortName(config: any, portName: string): string {
  const domains = config.domains || {}

  // Smart Resolution:
  // If portName is "nft" but the domain has "nft-repository", use the canonical name.
  // This works for any suffix (e.g., abc-gateway, def-notifications, etc.)
  // by checking if the existing port starts with the requested name followed by a hyphen.
  for (const domainKey in domains) {
    const domain = domains[domainKey]
    const canonicalPort = domain.ports.find((p: any) => {
      const pName = typeof p === 'string' ? p : p.name
      // Match exact
      if (pName === portName) return true
      // Match prefix (e.g., 'nft' matches 'nft-repository')
      return pName.startsWith(`${portName}-`)
    })

    if (canonicalPort) {
      return typeof canonicalPort === 'string' ? canonicalPort : canonicalPort.name
    }
  }
  return portName
}

export function registerAdapter(options: RegisterAdapterOptions) {
  const { repoRoot, adapterName, portName, providerId, driver, configKey } = options
  const config = readKompoConfig(repoRoot)
  if (config) {
    if (!config.adapters) config.adapters = {}

    const registeredPortName = resolveCanonicalPortName(config, portName)
    const { capability, isInstance } = options

    const key = configKey || adapterName

    // Global Uniqueness Check:
    // If an adapter with this ID (key) exists but is for a DIFFERENT port, it's a naming collision.
    // The key (alias) determines the unique ID in kompo.config.json.
    if (config.adapters[key] && config.adapters[key].port !== registeredPortName) {
      throw new Error(
        `Adapter alias/ID "${key}" is already used by port "${config.adapters[key].port}". Please choose a unique alias.`
      )
    }

    config.adapters[key] = {
      port: registeredPortName,
      engine: providerId,
      driver: driver || providerId,
      // alias: derived from key (adapterId), no longer stored
      path: `${LIBS_DIR}/adapters/${adapterName}`,
      capability,

      isInstance,
      createdAt: new Date().toISOString(),
    }

    writeKompoConfig(repoRoot, config)
  }
}

export function registerDomain(
  repoRoot: string,
  domain: string,
  options: { ports?: string[]; useCases?: string[] } = {}
) {
  const config = readKompoConfig(repoRoot)
  if (config) {
    if (!config.domains) config.domains = {}

    // Provide defaults or merge
    const existing = config.domains[domain] || { ports: [], useCases: [], entities: [] }

    const ports = options.ports || existing.ports || []
    const useCases = options.useCases || existing.useCases || []

    config.domains[domain] = {
      ...existing,
      ports,
      useCases,
    }

    writeKompoConfig(repoRoot, config)
  }
}

export function registerEntity(repoRoot: string, domain: string, entityName: string) {
  const config = readKompoConfig(repoRoot)
  if (config) {
    if (!config.domains) config.domains = {}
    if (!config.domains[domain]) config.domains[domain] = { ports: [], useCases: [], entities: [] }
    if (!config.domains[domain].entities.includes(entityName)) {
      config.domains[domain].entities.push(entityName)
      writeKompoConfig(repoRoot, config)
    }
  }
}

export function registerUseCase(repoRoot: string, domain: string, useCaseName: string) {
  const config = readKompoConfig(repoRoot)
  if (config) {
    if (!config.domains) config.domains = {}
    if (!config.domains[domain]) config.domains[domain] = { ports: [], useCases: [], entities: [] }
    if (
      config.domains[domain].useCases &&
      !config.domains[domain].useCases?.includes(useCaseName)
    ) {
      if (!config.domains[domain].useCases) config.domains[domain].useCases = []
      config.domains[domain].useCases?.push(useCaseName)
      writeKompoConfig(repoRoot, config)
    }
  }
}

export function registerPort(
  repoRoot: string,
  domain: string,
  portName: string,
  portType: string = 'other'
) {
  const config = readKompoConfig(repoRoot)
  if (config) {
    if (!config.domains) config.domains = {}
    if (!config.domains[domain]) config.domains[domain] = { ports: [], useCases: [], entities: [] }

    const portExists = config.domains[domain].ports.some((p: any) => {
      const name = typeof p === 'string' ? p : p.name
      return name === portName
    })

    if (!portExists) {
      config.domains[domain].ports.push({ name: portName, type: portType })
      writeKompoConfig(repoRoot, config)
    }
  }
}

export function registerValueObject(
  _repoRoot: string,
  _domain: string,
  _entityName: string,
  _voName: string
) {
  // Value objects are currently tracked inside entities or implicitly.
  // This is a placeholder for future tracking in kompo.config.json.
}

export function registerAppPortUsage(
  repoRoot: string,
  appIdentifier: string,
  portName: string,
  adapterName: string
) {
  const config = readKompoConfig(repoRoot)
  if (config) {
    if (!config.apps) config.apps = {}

    // 1. Try exact path match (e.g. "apps/web")
    let appConfig = config.apps[appIdentifier]

    // 2. Try short name match (e.g. "web" matching "apps/web")
    if (!appConfig) {
      const foundEntry = Object.entries(config.apps).find(([path]) => {
        const parts = path.split('/')
        return parts[parts.length - 1] === appIdentifier
      })
      if (foundEntry) {
        appConfig = foundEntry[1]
      }
    }

    if (appConfig) {
      if (!appConfig.ports) appConfig.ports = {}

      const registeredPortName = resolveCanonicalPortName(config, portName)

      const existing = appConfig.ports[registeredPortName]
      if (Array.isArray(existing)) {
        if (!existing.includes(adapterName)) {
          existing.push(adapterName)
        }
      } else if (existing && typeof existing === 'string') {
        if (existing !== adapterName) {
          appConfig.ports[registeredPortName] = [existing, adapterName]
        }
      } else {
        appConfig.ports[registeredPortName] = adapterName
      }
      appConfig.updatedAt = new Date().toISOString()

      writeKompoConfig(repoRoot, config)
    }
  }
}

export function ensureKompoConfig(repoRoot: string): KompoConfig {
  const config = readKompoConfig(repoRoot)
  if (!config) {
    cancel('kompo.config.json not found')
    process.exit(1)
  }
  return config
}

export function detectEnabledFrameworks(repoRoot: string): FrameworkId[] {
  const config = readKompoConfig(repoRoot)
  if (!config || !config.apps) return []

  const frameworks = new Set<FrameworkId>()
  Object.values(config.apps).forEach((app: any) => {
    if (app.frontend) {
      frameworks.add(app.frontend)
    }
  })

  return Array.from(frameworks)
}

// Default: Return all enabled frameworks (shared behavior)
export function getFrameworksForTarget(repoRoot: string, targetApp?: string): FrameworkId[] {
  const config = readKompoConfig(repoRoot)
  if (!config || !config.apps) return []

  // If a specific target app is provided, try to find its framework
  if (targetApp) {
    // 1. Try exact path match
    if (config.apps[targetApp]?.frontend) {
      return [config.apps[targetApp].frontend]
    }

    // 2. Try matching by package name or directory name
    const foundEntry = Object.entries(config.apps).find(([path, app]: [string, any]) => {
      // Check package name
      if (app.packageName === targetApp) return true

      // Check folder name (basename) from path
      // Normalize separators just in case (though keys are usually forward slash)
      const parts = path.split('/')
      const folderName = parts[parts.length - 1]
      return folderName === targetApp
    })

    if (foundEntry?.[1].frontend) {
      return [foundEntry[1].frontend]
    }

    // Strict Mode: If target is specified but not found or has no frontend, return nothing.
    // Do NOT fallback to all frameworks. Context was explicit.
    return []
  }

  // Default: Return all enabled frameworks (shared behavior)
  return detectEnabledFrameworks(repoRoot)
}

/**
 * Find adapters for a port that match given capability and provider.
 * Used to detect if we need to prompt for a unique alias.
 */
export function getSimilarAdaptersForPort(
  repoRoot: string,
  portName: string,
  capabilityId: string,
  providerId: string
): Array<{ name: string; alias: string }> {
  const config = readKompoConfig(repoRoot)
  if (!config?.adapters) return []

  const canonicalPort = resolveCanonicalPortName(config, portName)

  return Object.entries(config.adapters)
    .filter(([_, adapter]: [string, any]) => {
      return (
        adapter.port === canonicalPort &&
        adapter.capability === capabilityId &&
        (adapter.engine === providerId || adapter.driver?.startsWith(providerId))
      )
    })
    .map(([key]: [string, any]) => {
      const { alias } = parseAdapterId(key)

      return {
        name: key, // name in list is the ID/key
        alias,
      }
    })
}

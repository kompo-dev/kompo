import path from 'node:path'
import color from 'picocolors'
import { getRegisteredAdapters } from '../../../registries/adapter.registry'
import { runFormat, runSort } from '../../../utils/format'
import {
  ensureProjectContext,
  getAvailablePorts,
  getDomains,
  getPortRegistry,
} from '../../../utils/project'
// Import generators to ensure they are registered
import '../../../generators'
import { cancel, intro, isCancel, log, note, outro, select } from '@clack/prompts'
import { PORT_DEFINITIONS, readKompoConfig } from '@kompo/kit'
import type { DriverManifest, ProviderManifest } from '../../../registries/capability.registry'
import { getSimilarAdaptersForPort, registerAdapter } from '../../../utils/config'
import {
  DEFAULT_ALIAS,
  getAdapterFactoryName,
  getInfraDirName,
  getInfraPackageName,
} from '../../../utils/naming'
import { runAddPort } from '../port/port.command'

export async function runAddAdapter(
  options: {
    skipTests?: boolean
    port?: string
    provider?: string
    app?: string
    domain?: string
    name?: string
    allowedCapabilities?: string[]
    capability?: string
    nonInteractive?: boolean
    skipInstall?: boolean
    alias?: string
    driver?: string
    sharedDriver?: string
  } = {}
) {
  const cwd = process.cwd()
  const { repoRoot } = await ensureProjectContext(cwd)

  if (!options.nonInteractive) {
    intro(color.bgBlueBright(' Add Adapter '))
  }

  // ============================================================
  // STEP 1: PORT SELECTION (FIRST!)
  // ============================================================
  let selectedPort: string | undefined = options.port
  let selectedDomain: string | undefined = options.domain
  let portType: string | undefined

  const portRegistry = await getPortRegistry(repoRoot)
  const existingPorts = await getAvailablePorts(repoRoot)
  const domains = await getDomains(repoRoot)

  // If port is provided via --port option, validate it exists (strict mode)
  if (selectedPort && !existingPorts.includes(selectedPort)) {
    log.error(`Port "${selectedPort}" not found.`)
    if (existingPorts.length > 0) {
      log.message(`Available ports: ${existingPorts.join(', ')}`)
    } else {
      log.message('No ports exist yet. Run without --port to create one interactively.')
    }
    process.exit(1)
  }

  // If port exists, get its type and domain
  if (selectedPort) {
    const config = readKompoConfig(repoRoot)
    if (config?.domains) {
      for (const [domainName, d] of Object.entries(config.domains)) {
        const portEntry = d.ports.find((p) => {
          const pName = typeof p === 'string' ? p : p.name
          return pName === selectedPort
        })
        if (portEntry) {
          portType = typeof portEntry === 'string' ? 'other' : portEntry.type
          if (!options.domain) {
            selectedDomain = domainName
          }
          break
        }
      }
    }
  }

  // Interactive port selection if not provided
  if (!selectedPort && !options.nonInteractive) {
    // Show info message
    let info = color.dim(`Ports define WHAT your domain needs.\n`)
    info += color.dim(`Adapters define HOW.\n`)
    info += color.dim(`Select a Port to implement with this Adapter.\n\n`)
    if (portRegistry.length > 0) {
      info += `Found ${color.cyan(String(portRegistry.length))} existing port(s).`
    } else if (domains.length === 0) {
      info += color.yellow(`Project is empty. Let's create a Domain and a Port first.`)
    } else {
      info += color.yellow(`No ports found. Create one to continue.`)
    }
    note(info, 'Info')

    while (true) {
      const portOptions: { label: string; value: string; hint?: string }[] = [
        { label: color.green('+ Create New Port'), value: 'CREATE_NEW' },
      ]

      if (portRegistry.length > 0) {
        // Calculate max lengths for aligned header
        const maxNameLen = Math.max(...portRegistry.map((p) => p.name.length), 4)
        const maxTypeLen = Math.max(...portRegistry.map((p) => (p.type || 'other').length), 4)

        // Header row as separator
        const headerLabel = color.dim(
          `${'PORT'.padEnd(maxNameLen)}  ${'TYPE'.padEnd(maxTypeLen)}  DOMAIN`
        )
        portOptions.push({
          label: headerLabel,
          value: '__sep__',
          hint: '- disable -',
        })

        // Port rows
        portOptions.push(
          ...portRegistry.map((p) => {
            const typeStr = (p.type || 'other').padEnd(maxTypeLen)
            return {
              label: `${color.cyan(p.name.padEnd(maxNameLen))}  ${color.yellow(typeStr)}  ${color.magenta(p.domain)}`,
              value: `EXISTING:${p.domain}:${p.name}:${p.type || 'other'}`,
            }
          })
        )
      }

      let portResponse: string | symbol

      if (portRegistry.length === 0) {
        portResponse = 'CREATE_NEW'
      } else {
        const portResponseSelection = await select({
          message: 'Select a Port to implement:',
          options: portOptions,
        })
        portResponse = portResponseSelection
      }

      if (isCancel(portResponse)) {
        cancel('Operation cancelled.')
        process.exit(0)
      }

      if (portResponse === '__sep__') continue

      if (portResponse === 'CREATE_NEW') {
        // Delegate to runAddPort

        const portResult = await runAddPort(undefined, {
          skipTests: options.skipTests,
          autoWire: false,
          skipAdapterPrompt: true,
          nonInteractive: false,
        })

        if (portResult?.portName) {
          selectedPort = portResult.portName
          selectedDomain = portResult.domain
          // Get port type from newly created port
          const newPortRegistry = await getPortRegistry(repoRoot)
          const newEntry = newPortRegistry.find((p) => p.name === selectedPort)
          portType = newEntry?.type || 'other'
        } else {
          log.warn('Port creation cancelled or failed.')
          continue
        }
      } else {
        // Parse EXISTING:domain:name:type
        const [_, domain, name, type] = (portResponse as string).split(':')
        selectedPort = name
        selectedDomain = domain
        portType = type
      }

      break
    }
  }

  // Non-interactive without port specified
  if (!selectedPort && options.nonInteractive) {
    log.error('Non-interactive mode requires --port <port-name>.')
    process.exit(1)
  }

  if (!selectedPort) {
    log.error('No port selected.')
    process.exit(1)
  }

  // ============================================================
  // STEP 2: SHOW EXISTING ADAPTERS FOR THIS PORT
  // ============================================================
  const existingAdapters = getSimilarAdaptersForPort(repoRoot, selectedPort, '', '')

  if (existingAdapters.length > 0 && !options.nonInteractive) {
    log.info(`\nThis port has ${existingAdapters.length} adapter(s):`)
    for (const a of existingAdapters) {
      log.message(`  ${color.cyan('•')} ${a.name} ${color.dim(`(alias: ${a.alias})`)}`)
    }
    log.message('')
  }

  // ============================================================
  // STEP 3: FILTER & SELECT CAPABILITY
  // ============================================================
  const registeredAdapters = getRegisteredAdapters()

  if (registeredAdapters.length === 0) {
    log.error('✗ No adapter generators registered.')
    process.exit(1)
  }

  // Filter by port type if known
  let availableAdapters = registeredAdapters
  if (portType) {
    const def = PORT_DEFINITIONS.find((pd) => pd.value === portType)
    if (def?.capabilities && def.capabilities.length > 0) {
      availableAdapters = registeredAdapters.filter((a) =>
        def.capabilities.includes(a.capability.id)
      )
    }
  }

  // Additional filter if allowedCapabilities is provided
  if (options.allowedCapabilities && options.allowedCapabilities.length > 0) {
    const allowed = options.allowedCapabilities
    availableAdapters = availableAdapters.filter((a) => allowed.includes(a.capability.id))
  }

  if (availableAdapters.length === 0) {
    log.error(`No adapters available for port type "${portType}".`)
    process.exit(1)
  }

  let capabilityId = options.capability
  let selectedAdapter: ReturnType<typeof getRegisteredAdapters>[0] | undefined
  let selectedProviderId: string | undefined = options.provider
  let selectedDriverId: string | undefined = options.driver

  // Try to infer capability from provider if non-interactive
  if (!capabilityId && options.nonInteractive && options.provider) {
    for (const r of registeredAdapters) {
      const p = r.capability.providers?.find((p) => p.id === options.provider)
      if (p) {
        capabilityId = r.capability.id
        break
      }
    }
  }

  // ============================================================
  // STEP 4: SELECTION LOOP (Capability -> Provider -> Driver)
  // ============================================================
  const kompoConfig = readKompoConfig(repoRoot)
  if (!options.app && kompoConfig?.apps && Object.keys(kompoConfig.apps).length === 1) {
    options.app = Object.keys(kompoConfig.apps)[0]
  }

  let preferredDriver: string | undefined
  if (options.app && kompoConfig?.apps?.[options.app]) {
    // biome-ignore lint/suspicious/noExplicitAny: dynamic config
    const appConf = kompoConfig.apps[options.app] as any
    preferredDriver = appConf.frontend || appConf.framework
  }

  while (true) {
    // A. Choose Capability
    let capabilityResponse = capabilityId

    if (!capabilityResponse) {
      const selectOptions = availableAdapters.map((r) => ({
        label: r.capability.icon
          ? `${r.capability.icon} ${r.capability.name}`
          : (r.capability.name as string),
        value: r.capability.id as string,
        hint: r.capability.description,
      }))

      const response = await select({
        message: `Select implementation type for "${selectedPort}":`,
        options: selectOptions,
      })

      if (isCancel(response)) {
        cancel('Operation cancelled.')
        process.exit(0)
      }
      capabilityResponse = response as string
      capabilityId = capabilityResponse
    }

    selectedAdapter = registeredAdapters.find((r) => r.capability.id === capabilityResponse)
    if (!selectedAdapter) process.exit(1)

    const capability = selectedAdapter.capability

    // B. Select Provider
    if (options.provider) {
      selectedProviderId = undefined
      for (const p of capability.providers || []) {
        if (p.id === options.provider) {
          selectedProviderId = p.id
          if (options.driver) {
            const dr = p.drivers?.find((d: DriverManifest) => d.id === options.driver)
            if (dr) {
              selectedDriverId = dr.id
            } else {
              log.error(`✗ Driver "${options.driver}" not found in provider ${p.name}`)
              process.exit(1)
            }
          } else if (options.nonInteractive && p.drivers?.length) {
            if (p.drivers.length === 1) {
              selectedDriverId = p.drivers[0].id
            } else {
              log.error(`Provider "${p.id}" has multiple drivers. Please specify --driver <id>.`)
              process.exit(1)
            }
          }
          break
        }
        const dr = p.drivers?.find(
          (d: DriverManifest) => d.id === options.provider || d.id === options.driver
        )
        if (dr) {
          selectedProviderId = p.id
          selectedDriverId = dr.id
          break
        }
      }
      if (!selectedProviderId) {
        log.error(`✗ Provider "${options.provider}" not found in capability ${capability.name}`)
        process.exit(1)
      }
      break
    } else if (options.nonInteractive) {
      if (capability.providers && capability.providers.length === 1) {
        selectedProviderId = capability.providers[0].id
        const provider = capability.providers[0]

        if (provider.drivers?.length) {
          if (provider.drivers.length === 1) {
            selectedDriverId = provider.drivers[0].id
          } else {
            log.error(
              `Provider "${provider.id}" has multiple drivers. Please specify --driver <id>.`
            )
            process.exit(1)
          }
        }
        break
      } else {
        log.error(
          `Ambiguous provider for capability ${capability.name}. Please specify --provider.`
        )
        process.exit(1)
      }
    } else {
      // Interactive Selection
      const providerOptions: { label: string; value: string }[] = (capability.providers ?? []).map(
        (p: ProviderManifest) => ({
          label: p.name,
          value: p.id,
        })
      )

      providerOptions.unshift({
        label: '← Back',
        value: 'BACK',
      })

      const providerResponse = await select({
        message: `Select ${capability.name} Provider:`,
        options: providerOptions,
      })

      if (isCancel(providerResponse)) {
        cancel('Operation cancelled.')
        process.exit(0)
      }

      if (providerResponse === 'BACK') {
        capabilityId = undefined
        continue
      }

      selectedProviderId = providerResponse as string

      // Select Driver
      const provider = capability.providers?.find(
        (p: ProviderManifest) => p.id === selectedProviderId
      )

      // Auto-select driver if matches app framework
      if (preferredDriver && provider?.drivers && !selectedDriverId) {
        const match = provider.drivers.find(
          (d: DriverManifest) =>
            d.id === preferredDriver || (preferredDriver && d.id === preferredDriver.split('-')[0])
        )
        if (match) {
          selectedDriverId = match.id
          log.info(`Auto-selected driver: ${color.cyan(match.name)}`)
        }
      }

      if (!selectedDriverId && provider?.drivers?.length && provider.drivers.length > 1) {
        const driverOptions = (provider.drivers ?? []).map((d: DriverManifest) => ({
          label: d.name,
          value: d.id,
        }))

        driverOptions.unshift({
          label: '← Back',
          value: 'BACK',
        })

        const driverResponse = await select({
          message: `Select ${provider.name} Driver:`,
          options: driverOptions,
        })

        if (isCancel(driverResponse)) {
          cancel('Operation cancelled.')
          process.exit(0)
        }

        if (driverResponse === 'BACK') {
          continue
        }

        selectedDriverId = driverResponse as string
      } else if (provider?.drivers?.length === 1) {
        selectedDriverId = provider.drivers[0].id
      }

      break
    }
  }

  if (!selectedProviderId || !selectedAdapter) process.exit(1)

  const capability = selectedAdapter.capability
  const generator = selectedAdapter.generator

  const selectedProvider = capability.providers?.find(
    (p: ProviderManifest) => p.id === selectedProviderId
  )
  if (!selectedProvider) process.exit(1)

  // ============================================================
  // STEP 5: DETERMINE ADAPTER NAME & CONFIGURATION
  // ============================================================
  // Clean port name for adapter naming
  // e.g. "http-client-gateway" -> "http-client" if capability is "gateway" or "http"
  // e.g. "user-repository" -> "user" if capability is "repository"
  let portBase = selectedPort

  // We loop through all port definitions to find if the selected port ends with a known suffix
  for (const def of PORT_DEFINITIONS) {
    if (def.suffix && portBase.endsWith(`-${def.suffix}`)) {
      portBase = portBase.replace(`-${def.suffix}`, '')
      break
    }
  }

  const subject = capability.defaultSubject ? `${capability.defaultSubject}` : ''

  // Smart naming: Avoid redundancy like "notifications-notifications-resend"
  // If portBase includes subject, don't prepend subject again.
  let namePrefix = `${portBase}-`
  if (subject && portBase.includes(subject)) {
    // Port name already contains subject (e.g. notifications -> notifications-resend)
    // Keep it as is
  } else if (subject) {
    namePrefix += `${subject}-`
  }

  const defaultAdapterName =
    options.name ||
    `${namePrefix}${selectedProvider.id}${
      selectedDriverId &&
      selectedDriverId !== selectedProvider.id &&
      selectedDriverId !== `${capability.id}-${selectedProvider.id}`
        ? `-${selectedDriverId}`
        : ''
    }`

  const adapterName = defaultAdapterName

  let adapterAlias = options.alias
  const isNewAlias = false
  let isSpecializedClient = false

  // ============================================================
  // SCOPE SELECTION (Global vs Domain)
  // ============================================================
  // We ask this for ALL adapters to standardized env vars (MAIN_... vs DOMAIN_...)

  if (!adapterAlias && !options.nonInteractive) {
    const scopeResponse = await select({
      message: `What is the scope of this ${capability.name}?`,
      options: [
        {
          label: 'Global (Shared across domains)',
          value: 'global',
          hint: `Uses MAIN_${(subject || portBase).toUpperCase().replace(/-/g, '_')}_...`,
        },
        {
          label: `Domain-specific (${options.domain || 'this domain'} only)`,
          value: 'domain',
          hint: `Uses ${(options.domain || portBase).toUpperCase().replace(/-/g, '_')}_...`,
        },
      ],
    })

    if (isCancel(scopeResponse)) {
      cancel('Operation cancelled.')
      process.exit(0)
    }

    if (scopeResponse === 'global') {
      adapterAlias = DEFAULT_ALIAS // 'main'
      isSpecializedClient = false
    } else {
      // Domain specific
      adapterAlias = options.domain || portBase
      isSpecializedClient = true
    }
  } else if (!adapterAlias) {
    // Default for non-interactive: Domain specific if domain is present, else Global?
    // Or stick to existing default logic.
    // Existing default was: adapterName (which is portBase-subject...)
    // Let's default to global ('main') if no alias provided in non-interactive for consistency?
    // Or keep naive default. Let's keep naive default or 'main'.
    // For now, let's default to 'main' if not specified, to align with "Global by default" often preferred?
    // Safest is DEFAULT_ALIAS ('main')
    adapterAlias = DEFAULT_ALIAS
  }

  // DELEGATE CONFIGURATION TO CAPABILITY GENERATOR
  const additionalTemplateData: Record<string, unknown> = {}

  if (capability.configure) {
    const capabilityConfig = await capability.configure({
      repoRoot,
      portName: selectedPort,
      providerId: selectedProvider.id,
      driverId: selectedDriverId,
      domainName: selectedDomain,
      scope: kompoConfig?.project.org || 'org',
    })

    // Only override if configure implementation explicitly returns an alias AND we haven't manually selected one via prompt?
    // Actually, prompt above sets adapterAlias.
    // Use capability config only if it provides something we didn't set, or if it MUST override.
    // But we want to standardize.
    // Let's assume capability.configure returns templateData mostly.

    if (capabilityConfig.templateData) {
      Object.assign(additionalTemplateData, capabilityConfig.templateData)
    }
    // Ignore alias from capability.configure if we set one, or check priority?
    // ORM generator sets alias. We should likely remove that from ORM generator now.
  }

  // Ensure ormDriver and databasePort are present for driver/infra templates
  if (capability.id === 'orm') {
    additionalTemplateData.ormDriver = selectedDriverId
    additionalTemplateData.databasePort = 5432
  }
  // No legacy fallback - all capabilities must implement configure()

  // Default alias for base adapter (no alias)
  if (!adapterAlias) {
    adapterAlias = adapterName
  }

  // ============================================================
  // STEP 6: REGISTER & GENERATE
  // ============================================================

  // Ensure port is registered in the domain
  if (selectedDomain) {
    const { registerPort } = await import('../../../utils/config')
    const pType = capability.kind === 'repository' ? 'repository' : portType || 'other'
    registerPort(repoRoot, selectedDomain, selectedPort, pType)
    options.domain = selectedDomain
  }

  // Find and merge catalogs
  let adapterBlueprintDir: string | undefined
  try {
    const { getBlueprintCatalogPath } = await import('@kompo/blueprints')
    const { mergeBlueprintCatalog, updateCatalogFromFeatures } = await import('@kompo/kit')
    const { mergeBlueprintScripts } = await import('../../../utils/scripts')

    const providerDir = selectedProvider.id
    const adapterLookup = `${capability.id}/providers/${providerDir}`
    const adapterCatalogPath = getBlueprintCatalogPath(adapterLookup, 'adapter')
    const { repoRoot, config } = await ensureProjectContext(cwd)

    if (adapterCatalogPath) {
      const catalogGroups: string[] = []

      const org = config?.project?.org
      if (!org) {
        log.error('Organization name could not be determined from configuration.')
        process.exit(1)
      }

      const infraAlias = adapterAlias || DEFAULT_ALIAS
      const subject = capability.defaultSubject
      const infraName = getInfraDirName(subject, infraAlias)
      const infraPackageName = getInfraPackageName(org, subject, infraAlias)

      const context = {
        org,
        app: options.app,
        domain: selectedDomain,
        name: adapterName,
        port: selectedPort,
        alias: adapterAlias,
        capability: capability.id,
        provider: selectedProvider.id,
        driver: selectedDriverId,
        ormDriver: selectedDriverId,
        databasePort: 5432,
        infraPackageName,
        infraDirName: infraName,
        infraAlias,
        ...additionalTemplateData,
      }

      const adapterGroup = `adapter-${capability.id}-${selectedProvider.id}`
      mergeBlueprintCatalog(repoRoot, adapterGroup, adapterCatalogPath)
      catalogGroups.push(adapterGroup)
      await mergeBlueprintScripts(repoRoot, adapterLookup, 'adapter', context)

      if (selectedDriverId) {
        // Use shared driver if available for catalog lookup (e.g. supabase -> postgres)
        const driverId =
          (selectedProvider.drivers?.find((d) => d.id === selectedDriverId)
            ?.sharedDriver as string) || selectedDriverId

        const driverLookup = `${capability.id}/${selectedProvider.id}/${driverId}`
        const driverCatalogPath = getBlueprintCatalogPath(driverLookup, 'driver')

        if (driverCatalogPath) {
          const driverGroup = `driver-${selectedDriverId}`
          mergeBlueprintCatalog(repoRoot, driverGroup, driverCatalogPath)
          catalogGroups.push(driverGroup)
          await mergeBlueprintScripts(repoRoot, driverLookup, 'driver', context)
        }
      }

      if (catalogGroups.length > 0) {
        updateCatalogFromFeatures(repoRoot, catalogGroups)
      }
    }

    adapterBlueprintDir = adapterCatalogPath ? path.dirname(adapterCatalogPath) : undefined

    if (!adapterBlueprintDir) {
      const fallbackPath = getBlueprintCatalogPath(adapterLookup, 'adapter', 'blueprint.json')
      if (fallbackPath) adapterBlueprintDir = path.dirname(fallbackPath)
    }
  } catch {
    // Ignore catalog errors
  }

  // Register Adapter in config

  // Naming Convention:
  // Main Adapter: ID = adapterName (e.g. http-client-axios)
  // Specialized Client: ID = adapterName-alias (e.g. http-client-axios-coingecko)
  // specialized client is just an alias for a specific configuration
  const adapterId =
    isSpecializedClient && adapterAlias ? `${adapterName}.${adapterAlias}` : adapterName

  registerAdapter({
    repoRoot,
    adapterName: adapterName,
    portName: selectedPort,
    providerId: selectedProvider.id,
    driver: selectedDriverId,
    capability: capability.id,
    configKey: adapterId,
    isInstance: false,
  })

  if (options.app) {
    const { registerAppPortUsage } = await import('../../../utils/config')
    registerAppPortUsage(repoRoot, options.app, selectedPort, adapterId)
  }

  const selectedDriver = selectedProvider.drivers?.find(
    (d: DriverManifest) => d.id === selectedDriverId
  )

  await generator({
    cwd,
    repoRoot,
    portName: selectedPort,
    capability,
    provider: selectedProvider,
    driver: selectedDriver,
    sharedDriver: options.sharedDriver || selectedDriver?.sharedDriver,
    name: adapterName,
    alias: adapterAlias,
    domainName: options.domain,
    targetApp: options.app,
    skipInstall: options.skipInstall,
    isNewAlias,
    isSpecializedClient,
    templateData: additionalTemplateData, // Pass captured template data
  })

  // Smart Port Injection
  if (options.domain && adapterBlueprintDir) {
    try {
      const { generatePort } = await import('../../../generators/port.generator')
      await generatePort({
        portName: selectedPort,
        domain: options.domain,
        repoRoot,
        blueprintPath: adapterBlueprintDir,
        force: true,
        quiet: true,
        skipTests: true,
      })
      log.info(`Updated port ${selectedPort} interface from adapter definition.`)
    } catch (e) {
      log.warn(`Failed to update port interface: ${e}`)
    }
  }

  // ============================================================
  // STEP 7: SUMMARY & OUTRO
  // ============================================================
  if (!options.nonInteractive) {
    if (isSpecializedClient) {
      // Specialized client summary
      const specializedExportName = getAdapterFactoryName(adapterName, adapterAlias)

      log.success(`
${color.bold('Created specialized client:')}
  ${color.cyan('📄 Client:')} libs/adapters/${adapterName}/src/clients/${adapterAlias}.client.ts
     ${color.dim('Export:')} ${specializedExportName}
     ${color.dim('Env vars:')} ${adapterAlias.toUpperCase().replace(/-/g, '_')}_API_URL
`)
    } else {
      note(
        `${selectedDriverId ? `${color.reset(color.cyan('🔌 Driver:'))}  libs/drivers/${selectedDriverId}` : ''}
${color.reset(color.cyan('🎁 Adapter:'))} libs/adapters/${adapterName}
${color.reset(color.cyan('🧩 Port:'))}    libs/domains/src/${selectedDomain}/ports/${selectedPort}
${selectedDomain ? `${color.reset(color.cyan('🧠 Domain:'))}  libs/domains/src/${selectedDomain}` : ''}`,
        color.bgGreen(' Enjoy! ')
      )
    }
    outro(color.bgCyan(color.bold(' Adapter setup completed ')))
  }

  runSort(repoRoot)
  runFormat(repoRoot)
}

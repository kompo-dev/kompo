import nodeFs from 'node:fs'
import path from 'node:path'
import { cancel, intro, isCancel, log, note, outro, select, spinner, text } from '@clack/prompts'

import { getBlueprint, type BlueprintConfig as RepoBlueprintConfig } from '@kompo/blueprints'

import {
  BACKEND_TYPES,
  DESIGN_SYSTEMS,
  extractPluginsFromSteps,
  FRAMEWORKS,
  initKompoConfig,
  type KompoConfig,
  mergeBlueprintCatalog,
  readKompoConfig,
  updateCatalogFromFeatures,
} from '@kompo/kit'

import { Command } from 'commander'
import color from 'picocolors'
import { createFsEngine } from '../engine/fs-engine'
import type { FeatureBlueprint } from '../registries/feature.registry'
import type { KompoPluginRegistry } from '../registries/plugin.registry'
import { type BlueprintManifest, registerBlueprintProvider } from '../registries/template.registry'
import { blueprintValidationSchema, type Step } from '../schemas/step.schema'
import { runFormat, runSort } from '../utils/format'
import { installDependencies } from '../utils/install'
import { findRepoRoot } from '../utils/project'
import { createKebabCaseValidator, RESTRICTED_APP_NAMES } from '../validations/naming.validation'

// Register OSS Blueprint Provider (Default)
registerBlueprintProvider({
  name: 'OSS Blueprints',
  getBlueprint: async (name) => {
    const b = getBlueprint(name)
    return (b as unknown as BlueprintManifest) || null
  },
})

const DEFAULT_ORG = 'org'

/**
 * Parse organization name argument
 * - "@org" -> { org: "org" }
 * - "org" -> { org: "org" }
 * - undefined -> { org: null }
 */
function parseOrgArg(arg?: string): {
  org: string | null
} {
  if (!arg) {
    return { org: null }
  }

  // Check if it's a full org name (@org)
  const match = arg.match(/^@([a-z0-9-]+)$/)
  if (match?.[1]) {
    return { org: match[1] }
  }

  // It's just an org name without @
  return { org: arg }
}

async function mergeScriptsFor(
  repoRoot: string,
  name: string,
  type: 'app' | 'feature' | 'design-system' | 'lib' | 'adapter' | 'driver',
  context: Record<string, any> = {}
) {
  const { mergeBlueprintScripts } = await import('../utils/scripts')
  await mergeBlueprintScripts(repoRoot, name, type, context)
}

export function createNewCommand(registry: KompoPluginRegistry): Command {
  const cmd = new Command('new')
    .description('Create a new Kompo project')
    .argument('[name]', 'Project name (organization) or Application name')
    .option('-y, --yes', 'Skip prompts and use defaults')
    .option('--org <name>', 'Explicitly set organization name')
    .option('--app <name>', 'Explicitly set application name')
    .option(
      '-t, --template <name>',
      'Use a predefined template (nft-marketplace, dao, dashboard, defi-swap) or path to local JSON file'
    )
    .action(
      async (
        nameArg: string | undefined,
        options: {
          yes?: boolean
          template?: string
          org?: string
          app?: string
          debug?: boolean
        },
        command: Command
      ) => {
        try {
          const debug = options.debug || command.parent?.opts().debug
          await runNewCommand(nameArg, { ...options, debug }, registry)
        } catch (error) {
          log.error(`Error: ${error instanceof Error ? error.message : error}`)
          process.exit(1)
        }
      }
    )

  return cmd
}

export interface BlueprintConfig {
  framework: string
  backend: string
  designSystem?: string
  frontend?: string
  ports?: string[]
  chains?: string[]
  adapters?: Record<string, string>
  drivers?: Record<string, string> // Added for driver selection (Port -> Driver)
  domains?: string[]
  features?: (FeatureBlueprint | string)[]
  wirings?: { app: string; port: string; adapter: string }[] // Added for explicit wiring
  domainPorts?: Record<string, string[]>
  instances?: Record<string, string>
}

export async function runNewCommand(
  nameArg: string | undefined,
  options: {
    yes?: boolean
    template?: string
    debug?: boolean
    org?: string
    app?: string
  },
  _registry: KompoPluginRegistry
): Promise<void> {
  let blueprintConfig: BlueprintConfig | null = null
  let selectedBlueprint: BlueprintManifest | null = null
  const stepsToExecute: any[] = []

  const fs = createFsEngine()
  const { getTemplatesDir } = await import('@kompo/blueprints')
  const templatesDir = getTemplatesDir()

  // Handle template mode
  if (options.template) {
    let isJsonOpts = false

    // Check if valid file path or assume json
    let manifestPath = options.template
    if (await fs.fileExists(manifestPath)) {
      isJsonOpts = true
    } else if (await fs.fileExists(`${manifestPath}.json`)) {
      isJsonOpts = true
      manifestPath = `${manifestPath}.json`
    } else if (manifestPath.endsWith('.json')) {
      // Explicit .json extension but file not found -> will error inside isJsonOpts block
      isJsonOpts = true
    }

    if (isJsonOpts) {
      // Load from manifest file
      if (!(await fs.fileExists(manifestPath))) {
        log.error(color.red(`Blueprint manifest not found at ${manifestPath}`))
        process.exit(1)
      }
      intro(`🚀 Creating new Kompo project from manifest: ${manifestPath}`)

      // We define a flexible manifest type on the fly or duplicate
      // ProjectBlueprintManifest
      interface LocalManifest {
        framework?: string
        backend?: string
        designSystem?: string
        ports?: string[]
        adapters?: Record<string, string>
        drivers?: Record<string, string>
        chains?: string[]
        features?: FeatureBlueprint[]
        frontend?: string
      }
      const manifest = await fs.readJson<LocalManifest>(manifestPath)

      blueprintConfig = {
        framework: manifest.framework || FRAMEWORKS.NEXTJS,
        backend: manifest.backend || BACKEND_TYPES.NEXTJS,
        designSystem: manifest.designSystem || DESIGN_SYSTEMS.TAILWIND,
        ports: manifest.ports || [],
        adapters: manifest.adapters || {},
        drivers: manifest.drivers || {},
        chains: manifest.chains || [],
        features: manifest.features || [],
        frontend: manifest.frontend,
      }
    } else {
      // Load from registry (Starters)
      const { validateBlueprintName } = await import('../validations/naming.validation')
      const validationError = validateBlueprintName(options.template)
      if (validationError) {
        log.error(validationError)
        process.exit(1)
      }

      const { getStarter } = await import('@kompo/blueprints')
      const starter = getStarter(options.template)

      if (!starter) {
        log.error(`Starter "${options.template}" not found.`)
        log.message('Run "kompo new" to see available starters interactively.')
        process.exit(1)
      }

      // Security Check (same as interactive)
      if (starter.path) {
        const forbiddenLibsPath = path.join(starter.path, 'files', 'libs')
        // We need nodeFs here, imported as 'nodeFs' or from 'fs-extra'
        // Checking imports: import * as nodeFs from 'node:fs' is available at top of file
        if (nodeFs.existsSync(forbiddenLibsPath)) {
          log.error('⛔️  SECURITY VIOLATION: Invalid Starter Structure')
          log.message(
            `The starter "${starter.name}" contains a "files/libs" directory, which is strictly forbidden.`
          )
          process.exit(1)
        }
      }

      // Assign to outer scope
      selectedBlueprint = starter as unknown as BlueprintManifest
      selectedBlueprint.name = options.template // Ensure name matches request if resolved from deep path

      intro(`🚀 Creating new Kompo project from starter: ${color.blueBright(starter.name)}`)
      log.message(starter.description)

      // Use starter as config source
      const blueprint = starter as RepoBlueprintConfig & Partial<BlueprintConfig>

      // Extract config from blueprint
      if ('steps' in blueprint) {
        // Blueprint structure handling with Zod validation
        const parseResult = blueprintValidationSchema.safeParse(blueprint)

        if (!parseResult.success) {
          log.error('❌ Blueprint validation failed')
          console.error(parseResult.error.format())
          process.exit(1)
        }

        const validBlueprint = parseResult.data
        if (validBlueprint.steps) {
          stepsToExecute.push(...validBlueprint.steps)
        }
        // We can safely cast because extractPluginsFromSteps expects StepEntry-like objects
        // and our Zod schema matches that structure
        const extracted = extractPluginsFromSteps((validBlueprint.steps || []) as Step[])

        // Merge extracted config with explicit config from blueprint if present
        blueprintConfig = {
          framework: blueprint.framework || extracted.framework,
          backend: extracted.backend,
          designSystem: extracted.designSystem,
          adapters: { ...extracted.adapters, ...(blueprint.adapters || {}) },
          drivers: { ...extracted.drivers, ...(blueprint.drivers || {}) },
          domains: extracted.domains,

          features: blueprint.features as (FeatureBlueprint | string)[] | undefined,
          wirings: extracted.wirings,
          domainPorts: extracted.domainPorts,
        }
      } else {
        // Modern / Enterprise manifest structure
        blueprintConfig = blueprint as unknown as BlueprintConfig
      }
    }
  } else {
    // Interactive Hierarchical Selection
    const { getTemplatesDir } = await import('@kompo/blueprints')
    const templatesDir = getTemplatesDir()
    const startersDir = path.join(templatesDir, '../starters')

    console.clear()
    intro(color.bgBlue('Kompo create project'))
    note("Welcome to Kompo. Let's create a project!")

    // Helper to get directories
    const getDirs = async (p: string) => {
      if (!nodeFs.existsSync(p)) return []
      const entries = await nodeFs.promises.readdir(p, { withFileTypes: true })
      return entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .filter((n) => !n.startsWith('.'))
    }

    // Helper to get starter metadata if exists (to show description)
    const getStarterMeta = async (pathStr: string) => {
      const bpPath = path.join(pathStr, 'starter.json')

      if (nodeFs.existsSync(bpPath)) {
        try {
          const bp = JSON.parse(await nodeFs.promises.readFile(bpPath, 'utf-8'))
          const name = bp.name
          const description = bp.description
          return { description, name }
        } catch {
          return {}
        }
      }
      return {}
    }

    let selectedFramework = ''
    let selectedDesignSystem = ''
    let selectedStarter = ''
    let selectedBlueprintName = ''

    while (true) {
      if (selectedBlueprintName) break

      // 1. Select Framework
      const frameworks = await getDirs(startersDir)
      if (frameworks.length === 0) {
        log.error(`No starters found in ${startersDir}`)
        process.exit(1)
      }

      const frameworkChoices = await Promise.all(
        frameworks.map(async (f) => {
          const meta = await getStarterMeta(path.join(startersDir, f))
          return {
            label: meta.name || f.charAt(0).toUpperCase() + f.slice(1),
            value: f,
            hint: meta.description,
          }
        })
      )

      const framework = await select({
        message: 'Select Framework',
        options: frameworkChoices,
      })

      if (isCancel(framework)) {
        cancel('Cancelled')
        process.exit(0)
      }
      selectedFramework = framework as string

      // 2. Select Design System
      while (true) {
        const dsDir = path.join(startersDir, selectedFramework)
        const designSystems = await getDirs(dsDir)

        const dsChoices = await Promise.all(
          designSystems.map(async (d) => {
            const meta = await getStarterMeta(path.join(dsDir, d))
            return {
              label: meta.name || d.charAt(0).toUpperCase() + d.slice(1),
              value: d,
              hint: meta.description,
            }
          })
        )
        dsChoices.unshift({ label: '← Back', value: 'BACK', hint: '' })

        const ds = await select({
          message: 'Select Design System',
          options: dsChoices,
        })

        if (isCancel(ds)) {
          cancel('Cancelled')
          process.exit(0)
        }
        if (ds === 'BACK') {
          selectedFramework = ''
          process.stdout.write('\x1Bc') // clear
          break // break inner loop to go back to framework select
        }
        selectedDesignSystem = ds as string

        // 3. Select Starter
        while (true) {
          const stDir = path.join(dsDir, selectedDesignSystem)
          const starters = await getDirs(stDir)

          const starterChoices = await Promise.all(
            starters.map(async (s) => {
              const meta = await getStarterMeta(path.join(stDir, s))
              return {
                label: meta.name || s.charAt(0).toUpperCase() + s.slice(1),
                value: s,
                hint: meta.description,
              }
            })
          )
          starterChoices.unshift({ label: '← Back', value: 'BACK', hint: '' })

          const starter = await select({
            message: 'Select Starter Template',
            options: starterChoices,
          })

          if (isCancel(starter)) {
            cancel('Cancelled')
            process.exit(0)
          }
          if (starter === 'BACK') {
            selectedDesignSystem = ''
            process.stdout.write('\x1Bc')
            break // break inner loop to go back to DS select
          }

          selectedStarter = starter as string
          selectedBlueprintName = path.join(
            selectedFramework,
            selectedDesignSystem,
            selectedStarter
          )
          break
        }
        if (selectedStarter) break
      }
    }

    if (selectedBlueprintName) {
      const { getStarter } = await import('@kompo/blueprints')
      const starter = getStarter(selectedBlueprintName)
      if (starter) {
        // [SECURITY] Strict Architecture Rule
        // Starters are NOT allowed to overwrite 'libs' directly via files/libs.
        // They must use CLI steps (to register domains/adapters) and hooks (for logic injection).
        if (starter.path) {
          const forbiddenLibsPath = path.join(starter.path, 'files', 'libs')
          if (nodeFs.existsSync(forbiddenLibsPath)) {
            log.error('⛔️  SECURITY VIOLATION: Invalid Starter Structure')
            log.message(
              `The starter "${starter.name}" contains a "files/libs" directory, which is strictly forbidden.`
            )
            log.message(
              '   Reason: Starters must uses CLI steps for structure and hooks for content.'
            )
            log.message(
              '   This ensures that all architecture components are correctly registered.'
            )
            log.message(`   Please move logic to "snippets/libs" and use blueprint hooks.`)
            process.exit(1)
          }
        }

        selectedBlueprint = starter as unknown as BlueprintManifest
        blueprintConfig = starter as unknown as BlueprintManifest
      } else {
        log.error(`Failed to load blueprint: ${selectedBlueprintName}`)
        process.exit(1)
      }
    }
  }

  // Determine Context
  const cwd = process.cwd()
  const repoRoot = (await findRepoRoot(cwd)) || cwd
  const loadedConfig = readKompoConfig(repoRoot)
  const existingOrg =
    loadedConfig?.project?.org ||
    (loadedConfig as KompoConfig & { meta?: { org: string } })?.meta?.org
  const isExistingProject = !!existingOrg

  let org: string
  if (isExistingProject) {
    org = existingOrg
    log.message(`📦 Context: Existing Project (@${org})`)

    // Check if apps already exist to prevent overwriting
    let hasAppsDir = false
    try {
      const appsPath = path.join(repoRoot, 'apps')
      if (await fs.fileExists(appsPath)) {
        const appsContents = await nodeFs.promises.readdir(appsPath, { withFileTypes: true })
        // Check if there is at least one directory inside apps/
        hasAppsDir = appsContents.some((dirent) => dirent.isDirectory())
      }
    } catch {
      // ignore
    }

    if ((loadedConfig?.apps && Object.keys(loadedConfig.apps).length > 0) || hasAppsDir) {
      log.warn(color.yellow('⚠️  Applications already detected in this project.'))
      log.message(
        `   Running ${color.cyan('kompo new')} again might overwrite existing configurations.`
      )
      log.message(`   To add a new application, please use: ${color.green('kompo add app <name>')}`)
      log.message(
        `   To add features to an existing app, use: ${color.green('kompo add feature <name>')}`
      )

      const shouldContinue = await select({
        message: 'How would you like to proceed?',
        options: [
          { value: 'exit', label: 'Exit (Recommended)' },
          { value: 'continue', label: 'Continue anyway (May overwrite files)', hint: 'Unsafe' },
        ],
      })

      if (isCancel(shouldContinue) || shouldContinue === 'exit') {
        process.exit(0)
      }
    }
  } else {
    // If we didn't use a blueprint via flag or interactive selection logic above covered it...
    // WAIT, interactive selection logic DOES NOT cover org. It just picks blueprint.
    // So we need Org prompt here.

    if (options.org) {
      const parsed = parseOrgArg(options.org)
      org = parsed.org || options.org
    } else if (nameArg && !isExistingProject) {
      const parsed = parseOrgArg(nameArg)
      org = parsed.org || nameArg
    } else if (options.yes) {
      org = DEFAULT_ORG
    } else {
      const response = await text({
        message: 'Organization name (namespace for your packages)',
        defaultValue: DEFAULT_ORG,
        placeholder: DEFAULT_ORG,
      })
      if (isCancel(response)) {
        cancel('Operation cancelled.')
        process.exit(0)
      }
      org = (response as string) || DEFAULT_ORG
    }
    initKompoConfig(repoRoot, `${org}-project`, org)
  }

  // 2.5. Process Blueprint Steps (Common for both interactive and flag modes)
  if (selectedBlueprint && 'steps' in selectedBlueprint) {
    const blueprint = selectedBlueprint as unknown as RepoBlueprintConfig
    // Blueprint structure handling with Zod validation
    const parseResult = blueprintValidationSchema.safeParse(blueprint)

    if (!parseResult.success) {
      log.error('❌ Blueprint validation failed')
      console.error(parseResult.error.format())
      process.exit(1)
    }

    const validBlueprint = parseResult.data
    if (validBlueprint.steps) {
      // If interactive mode populated blueprintConfig but not stepsToExecute, do it here
      // Note: Flag mode already does this? No, we should consolidate.
      // If stepsToExecute is empty, we populate it
      if (stepsToExecute.length === 0) {
        stepsToExecute.push(...validBlueprint.steps)
      }
    }

    const extracted = extractPluginsFromSteps((validBlueprint.steps || []) as Step[])

    // Merge if not already done (for interactive mode especially)
    if (blueprintConfig) {
      blueprintConfig.framework = blueprintConfig.framework || extracted.framework
      blueprintConfig.backend = blueprintConfig.backend || extracted.backend
      blueprintConfig.designSystem = blueprintConfig.designSystem || extracted.designSystem
      blueprintConfig.adapters = { ...extracted.adapters, ...(blueprintConfig.adapters || {}) }
      blueprintConfig.drivers = { ...extracted.drivers, ...(blueprintConfig.drivers || {}) }
      blueprintConfig.domains = [...(blueprintConfig.domains || []), ...(extracted.domains || [])]
      blueprintConfig.wirings = [...(blueprintConfig.wirings || []), ...(extracted.wirings || [])]
      blueprintConfig.domainPorts = {
        ...extracted.domainPorts,
        ...(blueprintConfig.domainPorts || {}),
      }
    }
  }

  // 3. Fullstack / Backend Selection Logic
  // Handles Interactive Prompt for "Blank" or "Frontend" starters that support upgrade
  // But ONLY in interactive mode. Non-interactive mode relies strictly on the blueprint.

  // Ensure kompo.catalog.json exists (Smart Check)
  // If apps exist but catalog is missing, regenerate it to preserve state.
  // If no apps, create clean slate.
  const { ensureKompoCatalog, getKompoCatalogPath } = await import('@kompo/kit')
  const { regenerateCatalog } = await import('../utils/catalog.utils')

  const catalogPath = getKompoCatalogPath(repoRoot)
  if (!nodeFs.existsSync(catalogPath)) {
    // Check if we have existing apps to recover from
    if (loadedConfig?.apps && Object.keys(loadedConfig.apps).length > 0) {
      log.message(color.yellow('⚠️  Existing apps detected but kompo.catalog.json is missing.'))
      log.message('♻️  Regenerating catalog from installed components...')
      await regenerateCatalog(repoRoot, { silent: true })
    } else {
      ensureKompoCatalog(repoRoot)
    }
  }

  // Prompt for App Name if applicable
  if (!options.yes) {
    for (const step of stepsToExecute) {
      if (step.command === 'add' && step.type === 'app') {
        const appName = await text({
          message: 'Application Directory Name',
          defaultValue: step.name,
          placeholder: step.name,
          validate: (val) => {
            const error = createKebabCaseValidator('application name', {
              restrictedNames: RESTRICTED_APP_NAMES,
              defaultValue: step.name,
            })(val)
            if (error) return error

            const nameToCheck = val || step.name
            const targetPath = path.join(repoRoot, 'apps', nameToCheck)
            if (nodeFs.existsSync(targetPath)) {
              return `Directory apps/${nameToCheck} already exists. Please choose another name.`
            }
          },
        })

        if (isCancel(appName)) {
          cancel('Operation cancelled.')
          process.exit(0)
        }

        const newName = appName as string
        if (newName !== step.name) {
          const oldName = step.name
          step.name = newName
          // Update references in other steps
          for (const s of stepsToExecute) {
            if (s.app === oldName) {
              s.app = newName
            }
          }
        }
      }
    }
  }

  // Sequencer Execution
  const s = spinner()
  s.start('Executing orchestration sequence...')

  const { runAddApp } = await import('./add/app/app.command')
  const { runAddAdapter } = await import('./add/adapter/adapter.command')
  const { runAddDomain } = await import('./add/domain/domain.command')
  const { runAddPort } = await import('./add/port/port.command')
  const { runAddUseCase } = await import('./add/use-case/use-case.command')
  const { runAddEntity } = await import('./add/entity/entity.command')
  const { runWire } = await import('./wire.command')

  for (const step of stepsToExecute) {
    // s.message(`Step: ${step.command} ${step.type || ''} ${step.name || ''}`)

    if (step.command === 'new' || (step.command === 'add' && step.type === 'app')) {
      await runAddApp(step.name, {
        framework: step.driver || step.framework,
        backend: step.backend || BACKEND_TYPES.NONE,
        design: step.design || step.designSystem || DESIGN_SYSTEMS.VANILLA,
        org,
        yes: true,
        skipInstall: true,
        blueprintPath: selectedBlueprint?.name
          ? path.join(templatesDir, '../starters', selectedBlueprint.name)
          : undefined,
      })
    } else if (step.command === 'add' && step.type === 'domain') {
      await runAddDomain(step.name, { app: step.app, skipEntity: true, nonInteractive: true })
    } else if (step.command === 'add' && step.type === 'port') {
      await runAddPort(step.name, {
        domain: step.domain,
        type: step.portType,
        nonInteractive: true,
      })
    } else if (step.command === 'add' && step.type === 'use-case') {
      await runAddUseCase(step.name, { domain: step.domain, nonInteractive: true })
    } else if (step.command === 'add' && step.type === 'entity') {
      await runAddEntity(step.name, { domain: step.domain, nonInteractive: true })
    } else if (step.command === 'add' && step.type === 'adapter') {
      await runAddAdapter({
        port: step.port,
        provider: step.name,
        name: step.alias,
        domain: step.domain,
        app: step.app,
        capability: step.capability,
        nonInteractive: true,
        skipInstall: true,
      })
    } else if (step.command === 'wire') {
      await runWire(step.name, { app: step.app, nonInteractive: true })
    }
  }

  s.stop(color.green('Orchestration sequence completed.'))

  // Global Finalize
  const sFinal = spinner()
  sFinal.start('Finalizing project...')

  // ... inside runNewCommand, before Finalizing project ...

  // Find primary app name for context
  const primaryAppStep = stepsToExecute.find((s) => s.command === 'add' && s.type === 'app')
  const primaryAppName = primaryAppStep ? primaryAppStep.name : undefined

  // 4. Dynamic Catalog Merging (Phase 7)
  const featuresToSync: string[] = []

  // Helper to merge a catalog if it exists
  const mergeCatalogFor = async (
    name: string,
    type: 'app' | 'feature' | 'design-system' | 'lib' | 'adapter' | 'driver',
    _relativePath: string,
    context: Record<string, any> = {}
  ) => {
    const { getBlueprintCatalogPath } = await import('@kompo/blueprints')
    const candidatePath = getBlueprintCatalogPath(name, type)

    if (candidatePath) {
      mergeBlueprintCatalog(repoRoot, name, candidatePath)
      featuresToSync.push(name)
    }
    // Inject org and app into context
    await mergeScriptsFor(repoRoot, name, type, {
      scope: org,
      app: primaryAppName,
      ...context,
    })
  }

  // Merge Framework Catalog
  if (blueprintConfig?.framework) {
    const fw = blueprintConfig.framework
    // handle naming
    const normalizedFw = fw.includes('next')
      ? FRAMEWORKS.NEXTJS
      : fw.includes('vite')
        ? FRAMEWORKS.VITE
        : fw
    await mergeCatalogFor(normalizedFw, 'app', '', { name: normalizedFw })
  }

  // Merge Shared Libs Catalogs (Core libs)
  const coreLibs = ['config', 'domains', 'utils']
  for (const lib of coreLibs) {
    await mergeCatalogFor(lib, 'lib', '', { name: lib })
  }

  // Merge Design System and its UI lib
  if (blueprintConfig?.designSystem) {
    await mergeCatalogFor(blueprintConfig.designSystem, 'design-system', '', {
      name: blueprintConfig.designSystem,
    })
    await mergeCatalogFor(`ui/${blueprintConfig.designSystem}`, 'lib', '', {
      name: `ui/${blueprintConfig.designSystem}`,
    })
  }

  // Merge Features, Adapters and Drivers from steps
  if (stepsToExecute) {
    for (const step of stepsToExecute) {
      if (step.type === 'feature') {
        await mergeCatalogFor(step.name, 'feature', '', step)
      }
      if (step.type === 'adapter') {
        const cap = step.capability || ''
        const adapterLookup = cap ? `${cap}/${step.name}` : step.name
        await mergeCatalogFor(adapterLookup, 'adapter', '', step)
        if (step.driver) {
          const driverLookup = cap ? `${cap}/${step.driver}` : step.driver
          await mergeCatalogFor(driverLookup, 'driver', '', step)
        }
      }
    }
  }

  // 4b. Merge Selected Blueprint Catalog (Highest Priority)
  // If the user selected a named blueprint (e.g. 'nft-marketplace'), it might have its own catalog.json
  // that should override generic framework versions.
  if (selectedBlueprint?.name) {
    // The path to the blueprint itself.
    // We need to know where 'nft-marketplace' lives.
    // Standard blueprints are in 'packages/blueprints/apps/<name>'
    // We can reuse the logic from mergeCatalogFor but pointing to the blueprint definition location.

    const { getTemplatesDir } = await import('@kompo/blueprints')
    const templatesDir = getTemplatesDir()

    // Assumption: Blueprint name maps to folder in apps/
    // TODO: Make this more robust by getting path from registry?
    const blueprintCatalogPath = path.join(
      templatesDir,
      '../starters',
      selectedBlueprint.name,
      'catalog.json'
    )

    if (nodeFs.existsSync(blueprintCatalogPath)) {
      // Use the blueprint name as the catalog group
      mergeBlueprintCatalog(repoRoot, selectedBlueprint.name, blueprintCatalogPath)
      featuresToSync.push(selectedBlueprint.name)
    }
  }

  updateCatalogFromFeatures(repoRoot, Array.from(new Set(featuresToSync)))

  await installDependencies(repoRoot)
  runSort(repoRoot)
  runFormat(repoRoot)
  sFinal.stop(color.green('Project ready!'))

  outro(color.green('Success!'))
  const msgNote = `${color.reset(color.bgCyan(' Launch Application '))} \n
  ${color.reset(color.white('- pnpm dev or follow directions in README.md'))}\n
${color.reset(color.bgCyan(' Documentation '))} \n
  ${color.reset(color.white('- Getting Started: https://kompo.dev/docs/getting-started/what-is-kompo'))}
  ${color.reset(color.white('- Configuration: https://kompo.dev/docs/configuration/overview'))}\n
${color.reset(color.bgCyan(' Have feedback? '))} \n
  ${color.reset(color.white('- Visit us on Github: https://github.com/kompo-dev/kompo.'))}`
  note(msgNote, color.green(color.bold('Enjoy !')))
}

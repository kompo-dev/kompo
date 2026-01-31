import path from 'node:path'
import { cancel, intro, isCancel, log, note, outro, select } from '@clack/prompts'
import { Command } from 'commander'
import color from 'picocolors'
import { Project, SyntaxKind } from 'ts-morph'
import { createFsEngine } from '../engine/fs-engine'
import type { KompoPluginRegistry } from '../registries/plugin.registry'
import { toCamelCase, toPascalCase } from '../utils'
import { parseAdapterId, registerAppPortUsage } from '../utils/config'
import { runFormat } from '../utils/format'
import { installDependencies } from '../utils/install'
import { DEFAULT_ALIAS, getAdapterFactoryName } from '../utils/naming'
import { ensureProjectContext, getApps, getTemplateEngine } from '../utils/project'

export function createWireCommand(_registry: KompoPluginRegistry): Command {
  const cmd = new Command('wire')
    .description('Wire a Domain to an App by generating imports and dependency injection')
    .argument('<domain>', 'Name of the domain to wire')
    .option('--app <app>', 'Target application')
    .action(runWire)
  return cmd
}

export async function runWire(
  domainName: string,
  options: { app?: string; nonInteractive?: boolean }
) {
  const cwd = process.cwd()
  const { repoRoot, config } = await ensureProjectContext(cwd)

  // Check if domain exists in config
  if (!config.domains || !config.domains[domainName]) {
    log.error(color.red(`✗ Domain ${domainName} not found in kompo.config.json`))
    process.exit(1)
  }

  const apps = await getApps(repoRoot)
  if (apps.length === 0) {
    log.error(color.red('✗ No apps found.'))
    process.exit(1)
  }

  if (!options.nonInteractive) {
    intro(`⚡ Wiring domain "${domainName}"`)
  }

  // Determine selected app
  let selectedApp: string | null = null

  // 1. Check option
  if (options.app) {
    if (apps.includes(options.app)) {
      selectedApp = options.app
    } else {
      log.error(color.red(`✗ App "${options.app}" not found in apps/`))
      process.exit(1)
    }
  }
  // 2. Default if single app
  else if (apps.length === 1) {
    selectedApp = apps[0]
  }
  // 3. Prompt if multiple
  else {
    const appResponse = await select({
      message: 'Select app to wire:',
      options: apps.map((a) => ({ label: a, value: a })),
    })

    if (isCancel(appResponse)) {
      cancel('Operation cancelled.')
      process.exit(0)
    }
    selectedApp = appResponse as string
  }

  if (!selectedApp) {
    log.error(color.red('❌ No app selected.'))
    process.exit(1)
  }

  const fs = createFsEngine()
  const templates = await getTemplateEngine()

  // Identify needed ports from domain config
  const neededPorts = config.domains[domainName].ports || []

  // Find adapters for these ports in the selected app
  // Logic: Look into config.adapters AND config.apps[selectedApp].ports

  const appConfig = config.apps[`apps/${selectedApp}`]
  if (!appConfig) {
    log.error(color.red(`✗ App ${selectedApp} not found in config`))
    process.exit(1)
  }

  const adaptersToWire: Array<{
    portName: string
    factoryName: string
    importPath: string
    variableName: string
    env?: Record<string, unknown>
    configMapping?: Record<string, string>
    isInstance?: boolean
  }> = []

  for (const portName of neededPorts) {
    const name = typeof portName === 'string' ? portName : portName.name
    // Find which adapter satisfies this port for this app
    // appConfig.ports map is: PortName -> AdapterID (or [AdapterIDs])

    let adapterIds: string[] = []
    const portLink = appConfig.ports?.[name]

    if (typeof portLink === 'string') {
      // 1. Try direct ID match
      if (config.adapters?.[portLink]) {
        adapterIds = [portLink]
      } else {
        // 2. Try to find by provider name for this specific port
        const found = Object.entries(config.adapters || {}).find(([id, adapter]) => {
          return (
            adapter.port === name && (adapter.engine === portLink || id.endsWith(`-${portLink}`))
          )
        })
        if (found) {
          adapterIds = [found[0]]
        }
      }
    } else if (Array.isArray(portLink) && portLink.length > 0) {
      adapterIds = portLink
    }

    // Fallback: If no adapter is linked to this port, try to find matching adapters
    if (adapterIds.length === 0 && !options.nonInteractive) {
      const candidates = Object.entries(config.adapters || {}).filter(
        ([_, adapter]) => adapter.port === name
      )

      if (candidates.length === 1) {
        const adapterId = candidates[0][0]
        log.info(color.dim(`ℹ Auto-linking port "${name}" to unique adapter "${adapterId}"`))
        adapterIds = [adapterId]
        registerAppPortUsage(repoRoot, selectedApp, name, adapterId)
      } else if (candidates.length > 1) {
        const choice = await select({
          message: `Select an adapter for port "${name}":`,
          options: candidates.map(([id]) => ({ label: id, value: id })),
        })
        if (isCancel(choice)) {
          cancel('Operation cancelled.')
          process.exit(0)
        }
        const adapterId = choice as string
        adapterIds = [adapterId]
        registerAppPortUsage(repoRoot, selectedApp, name, adapterId)
      }
    }

    if (adapterIds.length > 0) {
      for (const adapterId of adapterIds) {
        const adapterConfig = config.adapters?.[adapterId]
        if (adapterConfig) {
          // Resolve factory name and package name from manifest/package.json
          let explicitFactoryName: string | undefined
          let explicitEnv: Record<string, unknown> | undefined
          let explicitConfigMapping: Record<string, string> | undefined

          const { isSpecialized, alias, baseAdapterName } = parseAdapterId(adapterId)
          let adapterPackageName = `@${config.project.org || 'company'}/${baseAdapterName}`

          try {
            const adapterPath =
              adapterConfig.path || path.join(config?.libsDir || 'libs', 'adapters', adapterId)
            const adapterDir = path.join(repoRoot, adapterPath)

            // 1. Read manifest for factory name
            const manifestPath = path.join(adapterDir, 'adapter.json')
            // Use node:fs directly here as we are in a command
            const { readFile } = await import('node:fs/promises')

            try {
              const manifestContent = await readFile(manifestPath, 'utf-8')
              const manifest = JSON.parse(manifestContent)
              if (manifest.provides?.factory) {
                explicitFactoryName = manifest.provides.factory
              }
              if (manifest.env) {
                explicitEnv = manifest.env
              }
              if (manifest.configMapping) {
                explicitConfigMapping = manifest.configMapping
              }
            } catch (_e) {
              /* ignore manifest missing */
            }

            // 2. Read package.json for package name
            try {
              const pkgPath = path.join(adapterDir, 'package.json')
              const pkgContent = await readFile(pkgPath, 'utf-8')
              const pkg = JSON.parse(pkgContent)
              if (pkg.name) {
                adapterPackageName = pkg.name
              }
            } catch (_e) {
              /* ignore package.json missing */
            }
          } catch (_e) {
            // Ignore if dirs missing
          }

          const factoryName =
            adapterConfig.exportName ||
            (!isSpecialized ? explicitFactoryName : undefined) ||
            getAdapterFactoryName(baseAdapterName, alias)

          // 1. Base is always the full Port Name (camelCase)
          const baseName = toCamelCase(name)

          // 2. Suffix is Alias (PascalCase) if not DEFAULT_ALIAS
          const suffix = alias !== DEFAULT_ALIAS ? toPascalCase(alias) : ''

          // 3. Combine
          const variableName = `${baseName}${suffix}`
          const isInstance = adapterConfig.isInstance || false

          // Also inject dependency into the app
          const { injectDependencies } = await import('../utils/dependencies')
          await injectDependencies({
            repoRoot,
            targets: selectedApp as string,
            dependencies: [adapterPackageName],
            version: 'workspace:*',
          })

          adaptersToWire.push({
            portName: name,
            factoryName,
            importPath: adapterPackageName,
            variableName,
            env: explicitEnv,
            configMapping: explicitConfigMapping,
            isInstance,
          })
        }
      }
    } else {
      log.warn(color.yellow(`⚠ No adapter found for port ${name} in app ${selectedApp}`))
    }
  }

  // Generate composition file
  // Default to 'src/composition' but allow override from config
  const compositionBasePath = config.paths?.composition || 'src/composition'
  const compositionDir = path.join(repoRoot, 'apps', selectedApp, compositionBasePath, 'domains')

  await fs.ensureDir(compositionDir)
  const compositionFile = path.join(compositionDir, `${domainName}.ts`)

  const camelDomainName = toCamelCase(domainName)
  const serviceFactoryName = `create${toPascalCase(domainName)}Service`
  const serviceInstanceName = `${camelDomainName}Service`

  const org = config.project.org || 'company'
  async function extractDependencies(useCaseName: string): Promise<string[]> {
    const root = repoRoot
    if (!root) return []
    const libsDir = config?.libsDir || 'libs'
    const useCasePath = path.join(
      root,
      libsDir,
      'domains',
      'src',
      domainName,
      'use-cases',
      useCaseName,
      `${useCaseName}.use-case.ts`
    )
    if (!(await fs.fileExists(useCasePath))) return []

    try {
      const project = new Project()
      const sourceFile = project.addSourceFileAtPath(useCasePath)

      // Find exported variable declarations
      const exportedVars = sourceFile
        .getVariableStatements()
        .filter((s) => s.isExported())
        .flatMap((s) => s.getDeclarations())

      // Look for the factory function
      const factory = exportedVars.find((d) => {
        const initializer = d.getInitializer()
        return (
          initializer &&
          (initializer.isKind(SyntaxKind.ArrowFunction) ||
            initializer.isKind(SyntaxKind.FunctionExpression))
        )
      })

      if (!factory) return []

      const fn = factory.getInitializer()
      if (!fn) return []

      // We know it's a function per the filter above
      // But we need to check if parameters exist
      const callSig =
        fn.asKind(SyntaxKind.ArrowFunction) || fn.asKind(SyntaxKind.FunctionExpression)
      if (!callSig) return []

      const firstParam = callSig.getParameters()[0]

      if (firstParam) {
        const nameNode = firstParam.getNameNode()
        if (nameNode.isKind(SyntaxKind.ObjectBindingPattern)) {
          return nameNode.getElements().map((e) => e.getName())
        }
      }
    } catch (e) {
      log.warn(`Failed to parse AST for ${useCaseName}: ${e}`)
    }

    return []
  }

  const useCases = await Promise.all(
    (config.domains[domainName].useCases || []).map(async (uc) => {
      const deps = await extractDependencies(uc)
      return {
        name: uc,
        factoryName: toCamelCase(uc),
        pascalName: toPascalCase(uc),
        variableName: toCamelCase(uc),
        dependencies: deps,
      }
    })
  )

  const envImports = new Set<string>()
  for (const adapter of adaptersToWire) {
    if (adapter.configMapping) {
      for (const value of Object.values(adapter.configMapping)) {
        if (value.includes('serverEnv.')) envImports.add('serverEnv')
        if (value.includes('clientEnv.')) envImports.add('clientEnv')
        if (value.includes('nextEnv.')) envImports.add('nextEnv')
        if (value.includes('viteEnv.')) envImports.add('viteEnv')
      }
    }
  }

  await templates.renderFile(
    'shared/composition/composition.eta',
    compositionFile,
    {
      scope: org,
      serviceFactoryName,
      domainName,
      serviceInstanceName,
      adapters: adaptersToWire,
      useCases,
      envImports: Array.from(envImports),
    },
    { merge: false }
  )

  // Update composition/index.ts
  const indexFile = path.join(repoRoot, 'apps', selectedApp, 'src', 'composition', 'index.ts')

  await templates.renderFile(
    'shared/snippets/export-as.eta',
    indexFile,
    {
      as: camelDomainName,
      from: `./domains/${domainName}`,
    },
    { merge: true }
  )

  runFormat(repoRoot)

  // Install dependencies to ensure wirings are usable immediately
  await installDependencies(repoRoot)

  note(
    `Updated: ${color.blueBright(`${selectedApp}/src/composition/domains/${domainName}.ts`)}\n
  Updated: ${color.blueBright(`${selectedApp}/src/composition/index.ts`)}`,
    'Wiring completed'
  )

  if (!options.nonInteractive) {
    outro(color.green('Applications wired successfully'))
  }
}

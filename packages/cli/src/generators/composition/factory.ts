import path from 'node:path'
import { log, spinner } from '@clack/prompts'
import { CLIENT_FRAMEWORKS, type ClientFrameworkId } from '@kompo/config/constants'
import { LIBS_DIR } from '@kompo/kit'
import color from 'picocolors'
import { createFsEngine } from '../../engine/fs-engine'
import type { CapabilityManifest } from '../../registries/capability.registry'
import type { EnvVisibility } from '../../utils/env-naming'
import { installDependencies } from '../../utils/install'
import { getAdapterFactoryName, getDriverPackageName } from '../../utils/naming'
import { getTemplateEngine } from '../../utils/project'
import { toCamelCase, toPascalCase } from '../../utils/string'
import { createPipeline, type PipelineObserver } from './pipeline'
import { stepRegistry } from './step.registry'
import type {
  AdapterGeneratorStep,
  AdapterManifest,
  BaseAdapterGeneratorContext,
  BlueprintManifest,
  GeneratorContext,
  GeneratorUtils,
} from './types'
import { validateAdapterManifest } from './validation'

export interface AdapterGeneratorConfig {
  capability: CapabilityManifest
  customSteps?: string[]
  stepOverrides?: Record<string, Partial<AdapterGeneratorStep>>
  envInjectionPolicy?: 'all' | 'specialized' | 'none'
}

// Helper to create utils. In real app, this might be in a separate file.
const createGeneratorUtils = async (context: GeneratorContext): Promise<GeneratorUtils> => {
  const fs = createFsEngine()
  const templates = await getTemplateEngine()
  const summary: string[] = []

  return {
    fs,
    templates,
    summary,
    addSummary: (msg: string) => summary.push(msg),
    installDependencies: async (cwd) => {
      await installDependencies(cwd)
    },
    injectEnvSchema: async (_templateBase, data) => {
      // Import the injector util dynamically
      const { injectEnvSnippet } = await import('../../utils/env')
      const { generateEnvKey } = await import('../../utils/env-naming')

      // Check if schema needs update to avoid redundant processing
      const schemaPath = path.join(context.repoRoot, 'libs/config/src/schema.ts')
      let _existingSchema = ''
      try {
        _existingSchema = await fs.readFile(schemaPath)
      } catch (_err) {
        // File might not exist yet
      }

      // dynamic generation from manifest metadata (New convention)
      if (context.manifest?.env) {
        const policy = context.envInjectionPolicy || 'specialized'

        if (policy === 'none') return
        if (policy === 'specialized' && !context.isSpecializedClient) return

        const envKeysToCheck: string[] = []
        // Pre-calculate keys to check existence
        for (const [key, meta] of Object.entries(context.manifest.env)) {
          const m = meta as { side?: EnvVisibility }
          envKeysToCheck.push(generateEnvKey(key, data.alias || data.name, m.side))
        }

        // We always proceed to injectEnvSnippet to ensure .env sync,
        // as injectEnvSnippet itself handles duplicate property avoidance in schema.ts.
        const serverLines: string[] = []
        const clientLines: Record<ClientFrameworkId, string[]> = CLIENT_FRAMEWORKS.reduce(
          (acc, fw) => {
            acc[fw] = []
            return acc
          },
          {} as Record<ClientFrameworkId, string[]>
        )
        const envLines: string[] = []

        for (const [key, meta] of Object.entries(context.manifest.env)) {
          const m = meta as {
            side?: EnvVisibility
            validation?: string
            description?: string
            default?: string
          }
          const validation = m.validation
          if (!validation) {
            throw new Error(`❌ Missing validation for env var ${key} in manifest.`)
          }
          const side = m.side
          if (!side) {
            throw new Error(`❌ Missing side for env var ${key} in manifest.`)
          }

          const description = m.description ? `.describe('${m.description}')` : ''
          const defaultValue = m.default ? `.default('${m.default}')` : ''

          if (side === 'client') {
            for (const fw of CLIENT_FRAMEWORKS) {
              const keyName = generateEnvKey(key, data.alias || data.name, 'client', fw)
              clientLines[fw].push(`${keyName}: ${validation}${description}${defaultValue},`)
              envLines.push(`${keyName}=${m.default || ''}`)
            }
          } else {
            const serverKey = generateEnvKey(key, data.alias || data.name, 'server')
            serverLines.push(`${serverKey}: ${validation}${description}${defaultValue},`)
            envLines.push(`${serverKey}=${m.default || ''}`)
          }
        }

        const envBlock = envLines.join('\n')

        if (serverLines.length > 0) {
          await injectEnvSnippet(context.repoRoot, serverLines.join('\n'), 'server', envBlock)
          summary.push('   Dynamically injected server env schema')
        }
        for (const [fw, lines] of Object.entries(clientLines)) {
          if (lines.length > 0) {
            const block = lines.join('\n')
            // Cast fw to any or FrameworkId because Object.entries keys are strings
            await injectEnvSnippet(context.repoRoot, block, fw as ClientFrameworkId, envBlock)
            summary.push(`   Dynamically injected ${fw} env schema`)
          }
        }
      }
    },
    registerInConfig: async (ctx, data) => {
      const { loadBlueprint } = await import('../../utils/blueprints.utils')

      const blueprintManifestTpl = `${ctx.templateBase}/blueprint.json.eta`
      const blueprintManifestStatic = `${ctx.templateBase}/blueprint.json`
      let blueprintMeta: BlueprintManifest = {} as BlueprintManifest
      let sourcePath: string | undefined

      const { getTemplatesDir } = await import('@kompo/blueprints')

      if (await templates.exists(blueprintManifestTpl)) {
        sourcePath = path.join(getTemplatesDir(), blueprintManifestTpl)
      } else if (
        await fs.fileExists(
          path.join(ctx.repoRoot, 'packages/blueprints/elements', blueprintManifestStatic)
        )
      ) {
        sourcePath = path.join(
          ctx.repoRoot,
          'packages/blueprints/elements',
          blueprintManifestStatic
        )
      }

      // Note: loadBlueprint expects a path that templateEngine can handle or an absolute path.
      // previous implementation used templates.render(sourcePath).

      if (sourcePath) {
        try {
          // We cast to BlueprintManifest. Since loadBlueprint validates, we are good.
          blueprintMeta = await loadBlueprint<BlueprintManifest>(sourcePath)
        } catch (e) {
          summary.push(
            `   ⚠️ Failed to load/validate blueprint ${sourcePath}: ${(e as Error).message}`
          )
          // If validation failed, we might want to stop or continue with partial?
          // User requested strict validation. So we probably shouldn't proceed cleanly if invalid.
          // But existing logic had a fallback. For strict mode, we let it be empty/error.
        }
      }

      // Populate manifest in context for subsequent steps (like injectEnvSchema)
      const { provides: blueprintProvides, ...rest } = blueprintMeta
      const manifest: AdapterManifest = {
        ...rest,
        id: blueprintMeta.id || ctx.provider.id,
        name: ctx.name || data.name,
        port: ctx.portName,
        provider: ctx.provider.id,
        driver: ctx.driver?.id,
        sharedDriver: ctx.sharedDriver || ctx.driver?.sharedDriver,
        capability: ctx.capability.id,
        provides: (blueprintProvides as AdapterManifest['provides'] | undefined) || {
          composition: true,
        },
        configMapping: {}, // Initialize generated mapping
      }
      ctx.manifest = manifest

      // Merge Driver Blueprint if available
      if (data.driver) {
        // Paths to check for driver blueprint
        const driverPaths: string[] = []

        // 1. Configured source in blueprint
        const driverManifest = context.provider.drivers?.find((d) => d.id === data.driver)
        const driverIdOrAlias = driverManifest?.blueprint || data.driver

        // Default Convention: libs/drivers/<capability>/<provider>
        const defaultDriverSource = `libs/drivers/${context.capability.id}/${context.provider.id}`
        driverPaths.push(`${defaultDriverSource}/${data.driver}`)
        driverPaths.push(defaultDriverSource)

        // Fallback: shared/drivers/<capability> (e.g. shared/drivers/orm/postgres)
        const sharedDriverSource = `shared/drivers/${context.capability.id}`
        driverPaths.push(`${sharedDriverSource}/${data.driver}`)
        driverPaths.push(sharedDriverSource)

        if (driverIdOrAlias !== data.driver) {
          driverPaths.push(`${defaultDriverSource}/${driverIdOrAlias}`)
          driverPaths.push(`${sharedDriverSource}/${driverIdOrAlias}`)
        }

        for (const driverBase of driverPaths) {
          const blueprintDriverTpl = `${driverBase}/blueprint.json.eta`
          const blueprintDriverStatic = `${driverBase}/blueprint.json`
          let driverManifestContent: string | undefined
          let driverSourcePath: string | undefined

          if (await templates.exists(blueprintDriverTpl)) {
            driverManifestContent = await templates.render(blueprintDriverTpl, data)
            driverSourcePath = blueprintDriverTpl
          } else if (
            await fs.fileExists(
              path.join(ctx.repoRoot, 'packages/blueprints/elements', blueprintDriverStatic)
            )
          ) {
            driverManifestContent = await templates.render(blueprintDriverStatic, data)
            driverSourcePath = blueprintDriverStatic
          }

          if (driverManifestContent) {
            try {
              const driverParsed = JSON.parse(driverManifestContent)
              // Merge env
              if (driverParsed.env) {
                manifest.env = { ...manifest.env, ...driverParsed.env }
              }
              // Merge provides
              if (driverParsed.provides) {
                manifest.provides = { ...manifest.provides, ...driverParsed.provides }
              }
              // Determine which driver ID was actually found
              const baseName = path.basename(driverBase)

              // Set resolved driver path in context for subsequent steps
              ctx.driverTemplatePath = driverBase

              summary.push(
                `   Merged driver blueprint associated to ${data.driver} (resolved as ${baseName}) from ${driverBase}`
              )
              break // Stop after finding the first match
            } catch (e) {
              summary.push(
                `   ⚠️ Failed to parse driver blueprint at ${driverSourcePath}: ${(e as Error).message}`
              )
            }
          }
        }
      }

      // Transform env and configMapping (Consolidated logic)
      if (manifest.env) {
        const { generateEnvKey, getEnvReference } = await import('../../utils/env-naming')
        const transformedMapping: Record<string, string> = {}

        // Derived from env metadata if mapTo is present
        for (const [key, meta] of Object.entries(manifest.env)) {
          if (meta.mapTo) {
            const envKey = generateEnvKey(key, ctx.alias || ctx.name || data.name, meta.side)
            transformedMapping[meta.mapTo] = getEnvReference(envKey)
          }
        }

        // Apply legacy / additional mappings if they refer to agnostics
        for (const [paramName, mappingValue] of Object.entries(transformedMapping)) {
          if (typeof mappingValue === 'string' && !mappingValue.includes('.')) {
            const envMeta = manifest.env?.[mappingValue]
            const side = envMeta?.side || 'client'
            const envKey = generateEnvKey(mappingValue, ctx.alias || ctx.name || data.name, side)
            transformedMapping[paramName] = getEnvReference(envKey)
          }
        }

        manifest.configMapping = transformedMapping
      }

      // Final manifest provides
      manifest.provides = {
        factory: getAdapterFactoryName(ctx.name || data.name, ctx.alias),
        ...blueprintMeta.provides,
      }

      await fs.writeFile(
        path.join(ctx.adapterDir, 'adapter.json'),
        JSON.stringify(manifest, null, 2)
      )
      summary.push('   Generated adapter.json')
    },
    injectComposition: async (_ctx, _dir) => {
      // Placeholder
    },
  }
}

export const createAdapterGenerator = (config: AdapterGeneratorConfig) => {
  const defaultStepIds = [
    'check-overwrite',
    'ensure-directories',
    'ensure-driver',
    'register-in-config',
    'validate-manifest',
    'render-templates',
    'render-specialized-client',
    'inject-environment',
    'install-dependencies',
    'run-composition',
  ]

  const stepIds = [...defaultStepIds, ...(config.customSteps || [])]

  // Returns a function compatible with the old signature but returning GeneratorResult (or ignored void)
  return async (inputContext: BaseAdapterGeneratorContext): Promise<void> => {
    // 1. Bootstrap Context
    const { readKompoConfig } = await import('@kompo/kit')
    const kompoConfig = readKompoConfig(inputContext.repoRoot)
    const scope = kompoConfig?.project?.org

    if (!scope) {
      throw new Error(
        `Organization org(org) is not defined in kompo.config.json. Please run "kompo init" or manually add "project.org" to your config.`
      )
    }

    // Calculate names
    const adapterName =
      inputContext.name ||
      `${inputContext.capability.id}-${inputContext.provider.id}${
        inputContext.driver ? `-${inputContext.driver.id}` : ''
      }`
    const alias = inputContext.alias || adapterName
    const destinationDir = path.join(inputContext.repoRoot, LIBS_DIR, 'adapters', adapterName)

    // Determine Template Path (New Structure Strict)
    // Structure: libs/adapters/<capability>/providers/<id>
    const templatePath = `libs/adapters/${inputContext.capability.id}/providers/${inputContext.provider.id}`

    const templateData: Record<string, unknown> = {
      name: adapterName,
      alias,
      portName: inputContext.portName,
      domainName: inputContext.domainName,
      targetApp: inputContext.targetApp,
      provider: inputContext.provider.id,
      capability: inputContext.capability.id,
      scope,
      pascalName: toPascalCase(adapterName),
      camelName: toCamelCase(adapterName),
      className: toPascalCase(adapterName),
      adapterCamelName: toCamelCase(adapterName),
      portPascalName: toPascalCase(inputContext.portName),
      portCamelName: toCamelCase(inputContext.portName),
      portImportPath: inputContext.domainName
        ? `@${scope}/domains/${inputContext.domainName}`
        : `@${scope}/${inputContext.portName}`,
      packetName: adapterName,
      driver: inputContext.driver?.id,
      sharedDriver: inputContext.sharedDriver || inputContext.driver?.sharedDriver,
      driverPackageName:
        (inputContext.templateData?.driverPackageName as string) ||
        (inputContext.driver?.id ? getDriverPackageName(scope, inputContext.driver.id) : undefined),
      tsconfigPath: path.relative(
        destinationDir,
        path.join(inputContext.repoRoot, 'tsconfig.base.json')
      ),
    }

    // Merge additional template data if provided
    if (inputContext.templateData) {
      Object.assign(templateData, inputContext.templateData)
    }

    // Add naming helpers to templateData for use in .eta templates
    const { generateEnvKey, getEnvReference, getVisibilityHeuristic } = await import(
      '../../utils/env-naming'
    )
    templateData.generateEnvKey = (baseKey: string, visibility: EnvVisibility = 'server') =>
      generateEnvKey(baseKey, alias, visibility)
    templateData.getEnvReference = (fullKey: string) => getEnvReference(fullKey)

    // [New] Smart getEnv helper
    templateData.getEnv = (baseKey: string) => {
      // 1. Try to find config in manifest (available after registerInConfig step)
      // Note: context.manifest is populated during execution, but templateData is passed by reference.
      // So when .eta executes this function, context.manifest should be ready.
      const envMeta = context.manifest?.env?.[baseKey]

      // 2. Determine visibility
      const side = envMeta?.side
      if (!side) {
        // Fallback to heuristic ONLY if not defined in envMeta?
        // So if it's a variable defined in env, it MUST have side.
        // But what if we are accessing a global variable NOT in adapter env?
        // The getEnv helper is primarily for accessing variables *defined* by this adapter.
        // However, if we access an external variable, we might fallback to heuristic.
        // Let's implement strict check if it matches an envMeta entry, otherwise fallback/error.

        if (envMeta) {
          throw new Error(
            `❌ Missing 'side' for env var ${baseKey} in adapter blueprint. It must be explicitly defined.`
          )
        }

        // If it's not in our blueprint env, we might be trying to access a global/standard var.
        // We can allow heuristic or just basic naming.
        return getEnvReference(generateEnvKey(baseKey, alias, getVisibilityHeuristic(baseKey)))
      }

      // 3. Generate key and reference
      const envKey = generateEnvKey(baseKey, alias, side)
      return getEnvReference(envKey)
    }

    // Determine Driver Template Path
    let driverTemplatePath: string | undefined
    if (inputContext.driver) {
      // Candidates
      const candidates = [
        `libs/drivers/${inputContext.capability.id}/${inputContext.provider.id}/${inputContext.driver.id}`,
        `shared/drivers/${inputContext.capability.id}/${inputContext.driver.id}`,
      ]

      for (const candidate of candidates) {
        try {
          const templates = await getTemplateEngine()
          // Check if blueprint exists
          const blueprintPath = path.join(candidate, 'blueprint.json')
          // We can't easily check existence with templates engine if root is unknown,
          // but we can try rendering. If it fails, we try next.
          // Better: use fs check logic relative to repoRoot + blueprints/elements
          // But strict context here, let's try render.

          if (
            (await templates.exists(path.join(candidate, 'blueprint.json'))) ||
            (await createFsEngine().fileExists(
              path.join(
                inputContext.repoRoot,
                'packages/blueprints/elements',
                candidate,
                'blueprint.json'
              )
            ))
          ) {
            driverTemplatePath = candidate
            const rendered = await templates.render(blueprintPath, templateData)
            if (rendered) {
              const blueprint = JSON.parse(rendered)
              templateData.driverConfig = blueprint
              templateData.driverFeatures = blueprint.provides?.features || {}
            }
            break // Found it
          }
        } catch (_e) {
          // Ignore
        }
      }
    }

    // Construct new context
    const context: GeneratorContext = {
      ...inputContext,
      alias,
      scope,
      adapterDir: destinationDir,
      templateBase: templatePath,
      driverTemplatePath,
      templateData,
      manifest: {
        name: inputContext.provider.id,
        provider: inputContext.provider.id,
        driver: inputContext.driver?.id,
        sharedDriver: inputContext.sharedDriver || inputContext.driver?.sharedDriver,
        capability: inputContext.capability.id,
        provides: { composition: true, providers: true }, // Default assumption
        port: inputContext.portName,
        configMapping: {},
      } as unknown as AdapterManifest,
      envInjectionPolicy: config.envInjectionPolicy,
    }

    // 2. Validate Manifest (if present in context)
    if (context.manifest) {
      const validationResult = validateAdapterManifest(context.manifest, config.capability)
      if (!validationResult.valid) {
        throw new Error(
          `Invalid adapter manifest: ${validationResult.errors.map((e) => e.message).join(', ')}`
        )
      }
    }

    // 3. Create & Execute Pipeline
    const pipeline = createPipeline(stepRegistry)
    if (context.verbose) {
      pipeline.addObserver(createLoggingObserver())
    }

    await pipeline.execute(context, stepIds, createGeneratorUtils)
  }
}

// Observer pour le logging
const createLoggingObserver = (): PipelineObserver => {
  const s = spinner()
  return {
    onStepStart: (stepId) => {
      s.start(`Step: ${color.cyan(stepId)}`)
    },
    onStepComplete: (stepId) => {
      s.stop(`Step: ${color.cyan(stepId)} complete`)
    },
    onStepError: (stepId, error) => {
      s.stop(`Step: ${color.red(stepId)} failed`)
      log.error(`❌ ${error.message}`)
    },
  }
}

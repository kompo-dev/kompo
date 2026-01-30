import path from 'node:path'
import { intro, outro, spinner } from '@clack/prompts'
import {
  BACKEND_TYPES,
  type BackendTypeId,
  FRAMEWORKS,
  type FrameworkId,
  getRequiredFeatures,
  LIBS_DIR,
  mergeBlueprintCatalog,
  updateCatalogFromFeatures,
  updateCatalogSources,
} from '@kompo/kit'
import color from 'picocolors'
import { createFsEngine } from '../../engine/fs-engine'
import { regenerateCatalog } from '../../utils/catalog.utils'
import { mergeWithGlobals } from '../../utils/global-variables'
import { getTemplateEngine } from '../../utils/project'

export interface FrameworkGeneratorContext {
  targetDir: string
  framework: FrameworkId
  backendType?: BackendTypeId
  scope: string
  packageName: string
  projectName: string
  frontendAppName: string
  designSystem: string
  ports: string[]
  cwd: string
  blueprintPath?: string
  features?: string[]
  apps?: Record<string, any>
  targetApp?: string
}

export async function generateFramework(ctx: FrameworkGeneratorContext) {
  const {
    framework,
    backendType,
    targetDir,
    scope,
    packageName,
    projectName,
    designSystem,
    ports,
    cwd,
    /* frontendAppName, */
  } = ctx
  const s = spinner()
  const fs = createFsEngine()
  const templates = await getTemplateEngine(ctx.blueprintPath)

  intro(`Setting up framework: ${framework}`)

  const repoRoot = cwd // Assume cwd is repo root
  const libsDir = LIBS_DIR
  const configDir = path.join(repoRoot, libsDir, 'config')

  // 1. Create Shared Config
  if (!(await fs.fileExists(path.join(configDir, 'package.json')))) {
    s.start('Setting up shared configuration')
    // Use universal shared config template
    // libs/config extends tsconfig.base.json at repo root
    const configTsconfigPath = path.relative(configDir, path.join(repoRoot, 'tsconfig.base.json'))
    await templates.renderDir(
      'libs/config/files',
      configDir,
      { scope, framework, tsconfigPath: configTsconfigPath },
      { merge: false }
    )
    s.stop('Setting up shared configuration')
  }

  // 2. Shared Domains are created on-demand via domain.generator.ts

  // 3. Shared Utils are created on-demand via specialized generators

  s.stop('Setting up shared configuration')

  // 4. Create App Files
  const { injectEnvSnippet } = await import('../../utils/env')
  const { getScopedEnvKey, getVisibilityHeuristic } = await import('../../utils/env-naming')

  // Load hooks and env from blueprint.json if available
  // We parse this EARLY so we can use it in templateData
  let hooks: Record<string, string> = {}
  let blueprintConfig: any = null
  const appConfigDir = `apps/${framework}`

  // Base app configuration is now in shared/apps
  const baseAppDir = `shared/apps/${framework}`
  const blueprintJsonPath = `${baseAppDir}/blueprint.json`

  // Preliminary check for availability to init templateData
  const hasBlueprint = await templates.exists(blueprintJsonPath)

  // Prepare template data with global variables first (without getEnv fully operational yet?)
  // No, we need getEnv in templateData.
  // So we must render blueprint.json using partial data?
  // blueprint.json usually doesn't need template vars for *structure*, but maybe for values.
  // Let's create a partial data context for blueprint rendering
  const partialData = mergeWithGlobals({
    packageName,
    projectName,
    scope,
    designSystem: designSystem
      ? {
          id: designSystem,
          path: `${libsDir}/ui/${designSystem}`,
        }
      : null,
    ports,
    framework,
    features: ctx.features || [],
    apps: ctx.apps || {},
    targetApp: ctx.targetApp,
  })

  if (hasBlueprint) {
    // Render the blueprint (in case values depend on template vars), then parse
    try {
      const { loadBlueprint } = await import('../../utils/blueprints.utils')
      const { getTemplatesDir } = await import('@kompo/blueprints')

      const absoluteBlueprintPath = path.join(getTemplatesDir(), blueprintJsonPath)
      blueprintConfig = await loadBlueprint(absoluteBlueprintPath)

      if (blueprintConfig.hooks) {
        hooks = blueprintConfig.hooks
      }
    } catch (e) {
      // Re-throw if it's our validation error (starts with ❌), otherwise warn
      if (e instanceof Error && e.message.startsWith('❌')) throw e
      console.warn(`⚠️  Failed to process blueprint.json for ${framework}:`, e)
    }
  }

  // Load local hooks from project/blueprint path if available (override)
  if (ctx.blueprintPath) {
    const bpJsonPath = path.join(ctx.blueprintPath, 'blueprint.json')
    if (await fs.fileExists(bpJsonPath)) {
      try {
        const bp = await fs.readJson<{ hooks?: Record<string, string>; env?: any }>(bpJsonPath)
        if (bp.hooks) {
          hooks = { ...hooks, ...bp.hooks }
        }
        if (bp.env && blueprintConfig) {
          blueprintConfig.env = { ...blueprintConfig.env, ...bp.env }
        }
      } catch (_e) {
        // ignore error
      }
    }
  }

  // Load Design System Blueprint if available
  if (designSystem) {
    const dsBlueprintPath = `${appConfigDir}/design-systems/${designSystem}/blueprint.json`
    if (await templates.exists(dsBlueprintPath)) {
      try {
        // Might need partialData for DS blueprint too
        const dsJson = await templates.render(dsBlueprintPath, partialData)
        const dsConfig = JSON.parse(dsJson)

        if (dsConfig.hooks) {
          hooks = { ...hooks, ...dsConfig.hooks }
        }
        if (dsConfig.env) {
          if (!blueprintConfig) blueprintConfig = {}
          if (!blueprintConfig.env) blueprintConfig.env = {}
          blueprintConfig.env = { ...blueprintConfig.env, ...dsConfig.env }
        }
      } catch (e) {
        console.warn(`⚠️  Failed to process blueprint.json for design system ${designSystem}:`, e)
      }
    }
  }

  // Now create the FULL template data with the smart getEnv
  const templateData = {
    ...partialData,
    hooks, // Pass hooks to template engine
    // Calculate relative path to libs/config/tsconfig.json
    // Apps extend the shared config package, not tsconfig.base.json directly
    // targetDir is like /repo/apps/my-app (2 levels deep from repo root)
    tsconfigPath: path.relative(targetDir, path.join(repoRoot, 'libs/config/tsconfig.json')),
    getEnv: (fullKey: string) => {
      // 1. Determine configuration
      const envConfig = blueprintConfig?.env?.[fullKey]
      const side = envConfig?.side || getVisibilityHeuristic(fullKey)
      const isScoped = envConfig?.scoped !== false

      // 2. orgthe key
      const scopedKey = isScoped ? getScopedEnvKey(fullKey, projectName) : fullKey

      // 3. Return access string based on framework and side
      if (framework === FRAMEWORKS.NEXTJS) {
        if (side === 'client') {
          return `clientEnv.${scopedKey}`
        }
        return `serverEnv.${scopedKey}`
      }

      if (framework === FRAMEWORKS.VITE) {
        if (side === 'client') {
          // Templates use: import { viteEnv as clientEnv } ...
          return `clientEnv.${scopedKey}`
        }
        // Vite server-side (build time)? Usually serverEnv works there too if using the same config package.
        return `serverEnv.${scopedKey}`
      }

      // Default fallback
      return `serverEnv.${scopedKey}`
    },
  }

  // 5. Handle Environment Variables (Modular Injection via blueprint.json)
  const envFiles = ['.env', '.env.eta', '.env.example', '.env.example.eta', 'blueprint.json']

  if (blueprintConfig?.env) {
    try {
      if (blueprintConfig.env) {
        const envEntries = Object.entries(blueprintConfig.env)
        const clientVars: string[] = []
        const serverVars: string[] = []
        const clientEnvContent: string[] = []
        const serverEnvContent: string[] = []

        for (const [key, config] of envEntries as [
          string,
          { validation: string; default?: string; side: string; scoped?: boolean },
        ][]) {
          const validation = config.validation
          const defaultValue = config.default || ''
          const side = config.side
          const isScoped = config.scoped !== false

          // orgthe key (e.g. NEXT_PUBLIC_APP_NAME -> NEXT_PUBLIC_PROJECT_APP_NAME)
          // unless strictly disabled in blueprint (for shared/global envs)
          const scopedKey = isScoped ? getScopedEnvKey(key, templateData.projectName) : key

          // Process default value for dynamic placeholders
          let processedDefault = defaultValue
          if (typeof processedDefault === 'string') {
            processedDefault = processedDefault.replace('{{projectName}}', templateData.projectName)
          }

          // Construct schema line: KEY: validation,
          const schemaLine = `${scopedKey}: ${validation},`
          const envLine = `${scopedKey}=${processedDefault}`

          if (side === 'server') {
            serverVars.push(schemaLine)
            serverEnvContent.push(envLine)
          } else {
            clientVars.push(schemaLine)
            clientEnvContent.push(envLine)
          }
        }

        if (clientVars.length > 0) {
          await injectEnvSnippet(
            repoRoot,
            clientVars.join('\n'),
            framework as FrameworkId,
            clientEnvContent.join('\n')
          )
        }
        if (serverVars.length > 0) {
          await injectEnvSnippet(
            repoRoot,
            serverVars.join('\n'),
            'server',
            serverEnvContent.join('\n')
          )
        }
      }
    } catch (e) {
      console.warn(`⚠️  Failed to process blueprint.json env for ${framework}:`, e)
    }
  }

  // First, render base framework files (excluding .env as they are injected now)
  const baseTemplateDir = `shared/apps/${framework}`

  if (await templates.exists(`${baseTemplateDir}/files`)) {
    // Check if templates are in files/ subdirectory (new standard)
    await templates.renderDir(`${baseTemplateDir}/files`, targetDir, templateData, {
      merge: false,
      exclude: envFiles,
    })
  } else if (await templates.exists(baseTemplateDir)) {
    await templates.renderDir(baseTemplateDir, targetDir, templateData, {
      merge: false,
      exclude: envFiles,
    })
  } else {
    // Should not happen if base templates are correct, but good safety
    throw new Error(`❌ Missing package.json in base template for ${framework}`)
  }

  // Validate base package.json
  const appPkgPath = path.join(targetDir, 'package.json')
  if (await fs.fileExists(appPkgPath)) {
    const pkg = await fs.readJson<{
      name?: string
      version?: string
      scripts?: Record<string, string>
    }>(appPkgPath)
    if (!pkg.name || !pkg.version || !pkg.scripts) {
      // Cleanup to avoid leaving broken state
      const { rm } = await import('node:fs/promises')
      await rm(targetDir, { recursive: true, force: true }).catch(() => {})

      throw new Error(
        `❌ Invalid base package.json for ${framework}. Missing required fields: name, version, or scripts.`
      )
    }
  }

  const designSystemTemplateDir = `apps/${framework}/design-systems/${designSystem}`

  if (await templates.exists(`${designSystemTemplateDir}/files`)) {
    await templates.renderDir(`${designSystemTemplateDir}/files`, targetDir, templateData, {
      merge: false,
      exclude: envFiles,
    })
  } else if (await templates.exists(designSystemTemplateDir)) {
    await templates.renderDir(designSystemTemplateDir, targetDir, templateData, {
      merge: false,
      exclude: envFiles,
    })
  }

  // Cleanup shared directory if it was copied from template
  const { rm } = await import('node:fs/promises')
  const sharedInApp = path.join(targetDir, 'libs')
  await rm(sharedInApp, { recursive: true, force: true }).catch(() => {})

  // Catalog
  const features = getRequiredFeatures(
    framework === FRAMEWORKS.VITE ? FRAMEWORKS.VITE : FRAMEWORKS.NEXTJS,
    designSystem,
    backendType !== BACKEND_TYPES.NONE && backendType !== BACKEND_TYPES.NEXTJS
      ? backendType
      : undefined
  )

  // [KOMPO] Manual Catalog Sync for App Design System
  // This ensures that catalogs defined in the app blueprint (e.g. apps/nextjs/design-systems/shadcn/catalog.json)
  // are picked up, even if they aren't part of the standard kit features yet.
  if (designSystem) {
    try {
      const { getTemplatesDir } = await import('@kompo/blueprints')
      const dsCatalogPath = path.join(
        getTemplatesDir(),
        `apps/${framework}/design-systems/${designSystem}`,
        'catalog.json'
      )

      if (await fs.fileExists(dsCatalogPath)) {
        const dsGroup = `app-${framework}-${designSystem}`
        mergeBlueprintCatalog(repoRoot, dsGroup, dsCatalogPath)
        // Add to features list so it gets added to pnpm-workspace.yaml
        features.push(dsGroup)
      }
    } catch (_e) {
      // Ignore if blueprint package cannot be loaded or file not found
    }
  }

  // [KOMPO] Manual Catalog Sync for Base App (Shared)
  // Ensures core dependencies (react, next, vite, etc.) from the base template are added.
  try {
    const { getTemplatesDir } = await import('@kompo/blueprints')
    const baseCatalogPath = path.join(getTemplatesDir(), `shared/apps/${framework}`, 'catalog.json')

    if (await fs.fileExists(baseCatalogPath)) {
      const baseGroup = `app-${framework}-base`
      mergeBlueprintCatalog(repoRoot, baseGroup, baseCatalogPath)
      features.push(baseGroup)
    }
  } catch (_e) {
    // Ignore
  }

  updateCatalogFromFeatures(repoRoot, features)
  updateCatalogSources(repoRoot, features)

  // Force regenerate catalog to ensure framework dependencies (react, etc.) are picked up
  // from apps/<framework>/catalog.json
  await regenerateCatalog(repoRoot, { silent: true })

  outro(color.green(`Framework ${framework} setup complete!`))
}

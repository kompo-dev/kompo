import path from 'node:path'
import { cancel, isCancel, log, select, text } from '@clack/prompts'
import {
  addStep,
  BACKEND_TYPES,
  type BackendTypeId,
  type DesignSystemId,
  FRAMEWORKS,
  type FrameworkId,
  getRequiredFeatures,
  mergeBlueprintCatalog,
  updateCatalogFromFeatures,
  updateCatalogSources,
  upsertApp,
} from '@kompo/kit'
import { Command } from 'commander'
import color from 'picocolors'
import { createFsEngine } from '../../../engine/fs-engine'
import { generateDesignSystem } from '../../../generators/apps/design.generator'
import { generateFramework } from '../../../generators/apps/framework.generator'
import { getDesignSystemSelectOptions } from '../../../utils/design-systems'
import { runFormat, runSort } from '../../../utils/format'
import { installDependencies } from '../../../utils/install'
import { ensureProjectContext } from '../../../utils/project'
import { selectWithNavigation } from '../../../utils/prompts'
import {
  createKebabCaseValidator,
  RESTRICTED_APP_NAMES,
} from '../../../validations/naming.validation'

export function createAddAppCommand(): Command {
  return new Command('app')
    .description('Add a new application to the project')
    .argument('[name]', 'Application name')
    .option('--framework <name>', 'Framework (nextjs, vite)')
    .option('--backend <name>', 'Backend (nextjs, express, none)')
    .option('--design <name>', 'Design system (tailwind, shadcn)')
    .option('--org <name>', 'Organization name')
    .option('-y, --yes', 'Skip prompts')
    .action(async (name, options) => {
      await runAddApp(name, options)
    })
}

export interface AddAppOptions {
  framework?: string
  backend?: string
  design?: string
  org?: string
  yes?: boolean
  blueprintPath?: string
  skipInstall?: boolean
}

export async function runAddApp(
  nameArg: string | undefined,
  options: AddAppOptions
): Promise<void> {
  const fs = createFsEngine()
  const cwd = process.cwd()
  const { repoRoot, config } = await ensureProjectContext(cwd)

  const org = options.org || config.project.org || 'company'

  let appName = nameArg
  let targetDir = ''
  let framework = options.framework as FrameworkId | undefined
  let backend = options.backend as BackendTypeId | undefined

  // 1. App Type & Framework Selection (Navigation Loop)
  if (!framework) {
    if (options.yes) {
      // Default to Next.js Fullstack if yes flag is used without args
      framework = FRAMEWORKS.NEXTJS
      backend = BACKEND_TYPES.NEXTJS
    } else {
      const selection = await selectWithNavigation('What kind of application do you want to add?', [
        {
          label: 'Frontend / Fullstack Web App',
          value: 'frontend',
          hint: 'Vite, Next.js',
          submenuMessage: 'What kind of application do you want to add?',
          options: [
            { label: 'Next.js (App Router)', value: FRAMEWORKS.NEXTJS, hint: 'App Router + API' },
            { label: 'React + Vite', value: FRAMEWORKS.VITE, hint: 'SPA' },
          ],
        },
        {
          label: 'Backend API Service',
          value: 'backend',
          hint: 'Node.js, Express',
          submenuMessage: 'What kind of application do you want to add?',
          options: [{ label: 'Node.js (Express)', value: 'express', hint: 'Using Vite for build' }],
        },
      ])

      // Map selection to framework/backend variables
      if (selection === 'express') {
        framework = FRAMEWORKS.VITE
        backend = BACKEND_TYPES.EXPRESS
      } else {
        framework = selection as FrameworkId
        backend = BACKEND_TYPES.NONE
      }

      // Feedback Log
      if (framework) {
        const fwName =
          framework === FRAMEWORKS.NEXTJS
            ? 'Next.js'
            : backend === BACKEND_TYPES.EXPRESS
              ? 'Express (Node.js)'
              : 'React + Vite'

        log.step(`Framework selected: ${color.cyan(fwName)}`)
      }
    }
  }

  // Handle CLI args direct set

  // ensure backend is set if passed via CLI or defaults
  if (!backend && framework) {
    backend = BACKEND_TYPES.NONE
  }

  // 3. App Name Prompt (Loop for validity)
  while (true) {
    if (!appName) {
      if (options.yes) {
        appName = 'web'
      } else {
        const response = await text({
          message: 'Application name',
          defaultValue: 'web',
          placeholder: 'web',
          validate: createKebabCaseValidator('Application name', {
            restrictedNames: RESTRICTED_APP_NAMES,
            defaultValue: 'web',
          }),
        })
        if (isCancel(response)) {
          cancel('Cancelled')
          process.exit(0)
        }
        appName = response as string
      }
    }

    targetDir = path.join(repoRoot, 'apps', appName)
    if (await fs.fileExists(targetDir)) {
      if (options.yes) {
        log.error(color.red(`Directory apps/${appName} already exists`))
        process.exit(1)
      }

      log.error(color.red(`Directory apps/${appName} already exists`))
      appName = '' // Reset so next loop prompts again
      continue
    }

    break
  }

  let designSystem = options.design
  if (!designSystem) {
    if (options.yes) {
      designSystem = 'vanilla'
    } else {
      const response = await select({
        message: 'Design System',
        options: getDesignSystemSelectOptions(),
      })
      if (isCancel(response)) {
        cancel('Cancelled')
        process.exit(0)
      }
      designSystem = response as string
    }
  }

  await generateFramework({
    cwd: repoRoot,
    targetDir,
    framework: (framework === FRAMEWORKS.NEXTJS
      ? FRAMEWORKS.NEXTJS
      : FRAMEWORKS.VITE) as FrameworkId,
    scope: org,
    packageName: `@${org}/${appName}`,
    projectName: appName,
    frontendAppName: appName,
    designSystem,
    ports: ['default'],
    backendType: backend as BackendTypeId,
    apps: {
      ...config.apps,
      [`apps/${appName}`]: {
        framework: (framework === FRAMEWORKS.VITE
          ? FRAMEWORKS.VITE
          : FRAMEWORKS.NEXTJS) as FrameworkId,
      },
    },
    targetApp: `apps/${appName}`,
    blueprintPath: options.blueprintPath,
  })

  if (backend !== 'none' && backend !== 'nextjs') {
    // For express, we might need a separate app, handle later if needed
  }

  await generateDesignSystem({
    targetDir,
    designSystem: designSystem as DesignSystemId,
    scope: org,
    blueprintPath: options.blueprintPath,
  })

  // Update Config
  upsertApp(repoRoot, `apps/${appName}`, {
    packageName: `@${org}/${appName}`,
    frontend: (framework === FRAMEWORKS.VITE ? FRAMEWORKS.VITE : FRAMEWORKS.NEXTJS) as FrameworkId,
    backend: (backend === BACKEND_TYPES.NEXTJS
      ? BACKEND_TYPES.NEXTJS
      : backend === BACKEND_TYPES.EXPRESS
        ? BACKEND_TYPES.EXPRESS
        : BACKEND_TYPES.NONE) as BackendTypeId,
    designSystem: designSystem as DesignSystemId,
    ports: { default: 'default' },
  })

  addStep(repoRoot, {
    command: 'add',
    type: 'app',
    name: appName,
    driver: framework,
    app: `apps/${appName}`,
  })

  // Catalog
  const { getBlueprintCatalogPath } = await import('@kompo/blueprints')
  const { mergeBlueprintScripts } = await import('../../../utils/scripts')

  const mergeCatalogFor = async (
    name: string,
    type: 'app' | 'design-system',
    context: Record<string, any> = {}
  ) => {
    const catalogPath = getBlueprintCatalogPath(name, type)
    if (catalogPath) {
      mergeBlueprintCatalog(repoRoot, name, catalogPath)
      await mergeBlueprintScripts(repoRoot, name, type, {
        scope: org,
        app: appName,
        ...context,
      })
    }
  }

  const frameworkId = framework === FRAMEWORKS.VITE ? FRAMEWORKS.VITE : FRAMEWORKS.NEXTJS
  await mergeCatalogFor(frameworkId, 'app', { name: frameworkId })

  if (designSystem && designSystem !== 'vanilla') {
    await mergeCatalogFor(designSystem, 'design-system', { name: designSystem })
  }
  const features = getRequiredFeatures(
    framework === FRAMEWORKS.VITE ? FRAMEWORKS.VITE : FRAMEWORKS.NEXTJS,
    designSystem,
    backend !== BACKEND_TYPES.NONE && backend !== BACKEND_TYPES.NEXTJS ? backend : undefined
  )
  updateCatalogFromFeatures(repoRoot, features)
  updateCatalogSources(repoRoot, features)

  runSort(repoRoot)
  if (!options.skipInstall) {
    await installDependencies(repoRoot)
    runFormat(repoRoot)
  }
}

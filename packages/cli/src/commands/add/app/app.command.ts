import path from 'node:path'
import { cancel, isCancel, log, select, text } from '@clack/prompts'
import { type DesignSystemId, FRAMEWORKS, type FrameworkId } from '@kompo/config/constants'
import {
  addStep,
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
    .option('--framework <name>', 'Framework (nextjs, vite, express)')
    .option('--design <name>', 'Design system (tailwind, shadcn, vanilla)')
    .option('--org <name>', 'Organization name')
    .option('-y, --yes', 'Skip prompts')
    .option('--verbose', 'Verbose output')
    .action(async (name, options) => {
      await runAddApp(name, options)
    })
}

export interface AddAppOptions {
  framework?: string
  design?: string
  org?: string
  yes?: boolean
  blueprintPath?: string
  skipInstall?: boolean
  verbose?: boolean
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

  // 1. App Type & Framework Selection (Navigation Loop)
  if (!framework) {
    if (options.yes) {
      // Default to Next.js Fullstack if yes flag is used without args
      framework = FRAMEWORKS.NEXTJS
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

      // Map selection to framework variables
      if (selection === 'express') {
        framework = FRAMEWORKS.EXPRESS
      } else {
        framework = selection as FrameworkId
      }

      // Feedback Log
      if (framework) {
        const fwName =
          framework === FRAMEWORKS.NEXTJS
            ? 'Next.js'
            : framework === FRAMEWORKS.EXPRESS
              ? 'Express (Node.js)'
              : 'React + Vite'

        log.step(`Framework selected: ${color.cyan(fwName)}`)
      }
    }
  }

  // Handle CLI args direct set

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

  // 4. Design System (Skip for pure backend frameworks)
  const isBackend = framework === FRAMEWORKS.EXPRESS
  let designSystem = options.design

  if (isBackend) {
    designSystem = designSystem || 'vanilla'
  }

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
    framework: framework as FrameworkId,
    scope: org,
    packageName: `@${org}/${appName}`,
    projectName: appName,
    frontendAppName: appName,
    designSystem,
    ports: ['default'],
    apps: {
      ...config.apps,
      [`apps/${appName}`]: {
        framework: framework as FrameworkId,
      },
    },
    targetApp: `apps/${appName}`,
    blueprintPath: options.blueprintPath,
  })

  await generateDesignSystem({
    targetDir,
    designSystem: designSystem as DesignSystemId,
    scope: org,
    blueprintPath: options.blueprintPath,
  })

  // Update Config
  upsertApp(repoRoot, `apps/${appName}`, {
    packageName: `@${org}/${appName}`,
    framework: framework as FrameworkId,
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
    blueprintPath: string,
    context: Record<string, any> = {}
  ) => {
    const catalogPath = getBlueprintCatalogPath(blueprintPath)
    if (catalogPath) {
      mergeBlueprintCatalog(repoRoot, name, catalogPath)
      await mergeBlueprintScripts(repoRoot, blueprintPath, {
        scope: org,
        app: appName,
        ...context,
      })
    }
  }

  const frameworkId = framework as string
  await mergeCatalogFor(frameworkId, `apps/${frameworkId}/framework`, { name: frameworkId })

  if (designSystem) {
    await mergeCatalogFor(designSystem, `libs/ui/${designSystem}`, { name: designSystem })
  }
  const features = getRequiredFeatures(framework as string, designSystem)
  updateCatalogFromFeatures(repoRoot, features)
  updateCatalogSources(repoRoot, features)

  runSort(repoRoot)
  if (!options.skipInstall) {
    await installDependencies(repoRoot)
    runFormat(repoRoot)
  }
}

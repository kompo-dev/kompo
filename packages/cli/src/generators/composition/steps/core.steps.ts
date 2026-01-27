import path from 'node:path'
import { LIBS_DIR } from '@kompo/kit'
import {
  DEFAULT_ALIAS,
  getAdapterFactoryName,
  getDriverPackageName,
  getInfraDirName,
  getInfraPackageName,
} from '../../../utils/naming'
import type { stepRegistry } from '../step.registry'
import type { AdapterGeneratorStep } from '../types'
import { validateAdapterManifest } from '../validation'

export const ensureDirectoriesStep: AdapterGeneratorStep = {
  id: 'ensure-directories',
  description: 'Create necessary directories',
  execute: async (context, utils) => {
    // Skip if reusing existing adapter files (alias-only flow)
    if (context.skipFiles) return

    const { adapterDir } = context
    await utils.fs.ensureDir(adapterDir)
    await utils.fs.ensureDir(path.join(adapterDir, 'src'))
    utils.addSummary(`✅ Directories created at ${adapterDir}`)
  },
}

export const checkOverwriteStep: AdapterGeneratorStep = {
  id: 'check-overwrite',
  description: 'Check if adapter already exists',
  execute: async (context, utils) => {
    const { adapterDir } = context

    // Skip file regeneration if we're just adding a new alias to an existing adapter
    // But ONLY if the adapter actually exists. If it's a first run with an alias/specialized client,
    // we must still generate the base adapter files.
    if (context.isNewAlias) {
      if (await utils.fs.fileExists(adapterDir)) {
        utils.addSummary('ℹ️ Adding new alias to existing adapter (reusing existing files)')
        context.skipFiles = true
        return
      }
      // If it doesn't exist, proceed to generation (implies creating Base + Specialized)
    }

    if (await utils.fs.fileExists(adapterDir)) {
      const { confirm, isCancel, log } = await import('@clack/prompts')
      const color = (await import('picocolors')).default

      const shouldOverwrite = await confirm({
        message: `${color.redBright('This adapter already exists in')} ${color.cyan(adapterDir)}.\n   ${color.redBright('Do you want to regenerate the files and overwrite any modifications?')}`,
        initialValue: false,
        withGuide: true,
      })

      if (isCancel(shouldOverwrite) || !shouldOverwrite) {
        log.info('Operation cancelled.')
        process.exit(0)
      }
      utils.addSummary('⚠️ Overwriting existing adapter')
    }
  },
}

export const validateManifestStep: AdapterGeneratorStep = {
  id: 'validate-manifest',
  description: 'Validate adapter manifest',
  execute: async (context, utils) => {
    // If manifest was not loaded yet, this step might load it?
    // For this refactor, we assume context.manifest is populated in factory or earlier.
    if (context.manifest) {
      const result = validateAdapterManifest(context.manifest, context.capability)
      if (!result.valid) {
        throw new Error(
          `Manifest validation failed: ${result.errors.map((e) => e.message).join(', ')}`
        )
      }
      utils.addSummary('✅ Manifest validated')
    } else {
      utils.addSummary('⚠️ No manifest to validate')
    }
  },
}

export const renderTemplatesStep: AdapterGeneratorStep = {
  id: 'render-templates',
  description: 'Render adapter templates',
  execute: async (context, utils) => {
    // Skip if reusing existing adapter files (alias-only flow)
    if (context.skipFiles) {
      utils.addSummary('ℹ️ Skipping template rendering (reusing existing files)')
      return
    }

    const { templateBase, adapterDir, templateData } = context

    // Inject hooks from manifest into templateData if available
    if (context.manifest?.hooks) {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic injection
      ;(templateData as any).hooks = context.manifest.hooks
    }

    // Pre-calculate infraPackageName for adapter templates
    const infraAlias = context.alias || context.name || DEFAULT_ALIAS
    const subject = context.capability.defaultSubject
    const infraName = getInfraDirName(subject, infraAlias)
    const infraDest = path.join(context.repoRoot, LIBS_DIR, 'infra', infraName)

    if (!context.scope) {
      throw new Error('Organization scope is required for infrastructure generation.')
    }
    // biome-ignore lint/suspicious/noExplicitAny: inject
    ;(templateData as any).infraPackageName = getInfraPackageName(
      context.scope,
      subject,
      infraAlias
    )
    ;(templateData as any).infraDirName = infraName
    ;(templateData as any).infraAlias = infraAlias

    if (context.driver?.id) {
      ;(templateData as any).driverPackageName = getDriverPackageName(
        context.scope,
        context.driver.id
      )
    }

    // 4. Render Infra (ORM-specific domain config from libs/adapters/<cap>/<prov>/infra)
    const infraSource = path.join(templateBase, 'infra')
    if (await utils.templates.exists(infraSource)) {
      await utils.fs.ensureDir(infraDest)
      await utils.templates.renderDir(infraSource, infraDest, templateData, { merge: true })
      utils.addSummary(`   Rendered infra to libs/infra/${infraName}`)
    }

    // 5. Render Driver (Resolution based on factory)
    // We use context.driverTemplatePath which is resolved in factory (could be shared/ or libs/drivers/)
    if (context.driverTemplatePath && context.driver?.id) {
      const driverId = context.driver.id
      const driverDest = path.join(context.repoRoot, 'libs/drivers', driverId)

      const filesSource = path.join(context.driverTemplatePath, 'files')

      // Ensure files directory exists in the blueprint
      if (
        (await utils.templates.exists(filesSource)) ||
        (await utils.fs.fileExists(
          path.join(context.repoRoot, 'packages/blueprints/elements', filesSource)
        ))
      ) {
        await utils.fs.ensureDir(driverDest)
        await utils.templates.renderDir(filesSource, driverDest, templateData)
        utils.addSummary(
          `   Rendered driver from ${context.driverTemplatePath} to libs/drivers/${driverId}`
        )
      }
    }

    // 6. Render Adapter (1:1 from libs/adapters/<cap>/providers/<prov>/files)
    // Exclude clients/ - those are rendered by renderSpecializedClientStep
    const adapterSource = path.join(templateBase, 'files')

    if (await utils.templates.exists(adapterSource)) {
      await utils.fs.ensureDir(adapterDir)
      try {
        await utils.templates.renderDir(
          adapterSource,
          adapterDir,
          {
            ...templateData,
            infraPackageName: `@${context.scope}/infra-${infraName}`,
          },
          { exclude: ['**/clients/**'] }
        )
      } catch (error) {
        throw error
      }
      utils.addSummary(`   Rendered adapter to libs/adapters/${context.name}`)
    }

    utils.addSummary('✅ Templates rendered')
  },
}

export const renderSpecializedClientStep: AdapterGeneratorStep = {
  id: 'render-specialized-client',
  description: 'Render specialized client for existing adapter',
  execute: async (context, utils) => {
    // Only run for specialized client creation
    if (!context.isSpecializedClient) return

    const { adapterDir, alias, provider, templateBase, scope } = context
    const aliasName = alias || 'service'
    const aliasNameCamel = aliasName.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    const aliasEnvPrefix = aliasName.toUpperCase().replace(/-/g, '_')

    // Create clients directory
    const clientsDir = path.join(adapterDir, 'src', 'clients')
    await utils.fs.ensureDir(clientsDir)

    // Generate specialized client file using template
    const clientFileName = `${aliasName}.client.ts`
    const clientFilePath = path.join(clientsDir, clientFileName)

    // Prepare template data
    const pascalName = (context.name || context.portName)
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')

    const templateData = {
      aliasName,
      aliasNameCamel,
      aliasEnvPrefix,
      pascalName,
      providerName: provider.id,
      scope: scope || 'org',
      adapterName: context.name,
    }

    // Render specialized client from template
    const clientTemplatePath = path.join(templateBase, 'files', 'src', 'clients', 'client.ts.eta')

    if (!(await utils.templates.exists(clientTemplatePath))) {
      throw new Error(
        `Missing client template at ${clientTemplatePath}. Blueprint must include clients/client.ts.eta`
      )
    }

    await utils.templates.renderFile(clientTemplatePath, clientFilePath, templateData)
    utils.addSummary(`   Created specialized client: clients/${clientFileName}`)

    // Update index.ts to export the new client
    const indexPath = path.join(adapterDir, 'src', 'index.ts')
    if (await utils.fs.fileExists(indexPath)) {
      const indexContent = await utils.fs.readFile(indexPath)
      const factoryExportName = getAdapterFactoryName(context.name || context.portName, aliasName)

      const snippetPath = 'shared/snippets/export-named.eta'
      const exportLine = `${await utils.templates.render(snippetPath, {
        name: factoryExportName,
        path: `./clients/${aliasName}.client`,
      })}\n`

      if (!indexContent.includes(exportLine)) {
        await utils.fs.writeFile(indexPath, indexContent + exportLine)
        utils.addSummary(`   Updated index.ts with ${factoryExportName} export`)
      }
    }

    utils.addSummary('✅ Specialized client created')
  },
}

export const installDependenciesStep: AdapterGeneratorStep = {
  id: 'install-dependencies',
  description: 'Install adapter dependencies',
  execute: async (context, utils) => {
    if (!context.skipInstall) {
      await utils.installDependencies(context.repoRoot)
      utils.addSummary('✅ Dependencies installed')
    }
  },
}

export const injectEnvironmentStep: AdapterGeneratorStep = {
  id: 'inject-environment',
  description: 'Inject environment variables',
  execute: async (context, utils) => {
    await utils.injectEnvSchema(context.templateBase, context.templateData)
    utils.addSummary('✅ Environment variables injected')
  },
}

export const registerInConfigStep: AdapterGeneratorStep = {
  id: 'register-in-config',
  description: 'Register adapter in kompo.config.json',
  execute: async (context, utils) => {
    await utils.registerInConfig(context, context.templateData)
    utils.addSummary('✅ Adapter registered in config')
  },
}

export const runCompositionStep: AdapterGeneratorStep = {
  id: 'run-composition',
  description: 'Run composition wiring',
  execute: async (context, utils) => {
    await utils.injectComposition(context, context.adapterDir)
    utils.addSummary('✅ Composition completed')
  },
}

export const registerCoreSteps = (registry: typeof stepRegistry): void => {
  registry.register(checkOverwriteStep)
  registry.register(ensureDirectoriesStep)
  registry.register(validateManifestStep)
  registry.register(renderTemplatesStep)
  registry.register(renderSpecializedClientStep)
  registry.register(installDependenciesStep)
  registry.register(injectEnvironmentStep)
  registry.register(registerInConfigStep)
  registry.register(runCompositionStep)
}

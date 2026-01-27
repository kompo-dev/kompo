import path from 'node:path'
import { getFrameworkCompositionTemplates, hasBlueprintSnippet } from '@kompo/blueprints'
import { createFsEngine } from '../engine/fs-engine'
import { LIBS_DIR, readKompoConfig } from './config'
import { getTemplateEngine } from './project'

/**
 * generateComposition
 *
 * Orchestrates the (re)generation of composition roots for an app.
 * It uses the 'adapters' and 'infras' from kompo.config.json to
 * drive the dynamic inclusion of provider snippets in templates.
 */
export async function generateComposition(
  repoRoot: string,
  targetApp: string,
  blueprintPath?: string
) {
  const fs = createFsEngine()
  const config = readKompoConfig(repoRoot)
  if (!config) return

  const templates = await getTemplateEngine(blueprintPath, repoRoot)
  const appPath = path.join(repoRoot, 'apps', targetApp)
  const compositionDir = path.join(appPath, 'src', 'composition')
  await fs.ensureDir(compositionDir)

  // Use it.framework or similar if needed to find base templates
  // For now we'll assume they are available in the template roots under:
  // apps/<framework>/base/src/composition/
  // But wait, the generateComposition logic in templates needs to know the app path
  // to find the snippets.

  const allAdapters = {
    ...(config.infras || {}),
    ...(config.adapters || {}),
  }

  // Auto-sync dependencies from adapters to targetApp
  const { injectDependencies } = await import('./dependencies')
  const { getDependenciesFromTemplate } = await import('./project')

  // 1. Adapter/Infra dependencies
  for (const adapter of Object.values(allAdapters) as any[]) {
    // Reconstruct blueprint path (e.g. libs/adapters/wallet/rainbowkit)
    // Preference: capability first, then port (fallback)
    const firstSegment = adapter.capability || adapter.port
    const templateSubPath = `libs/adapters/${firstSegment}/${adapter.engine}`

    // Inject path for template rendering
    adapter.path = templateSubPath

    const deps = await getDependenciesFromTemplate(templateSubPath)

    await injectDependencies({
      repoRoot,
      targets: targetApp,
      dependencies: deps,
    })
  }

  // 2. Design System dependencies
  const designSystem = config.apps[targetApp]?.designSystem
  if (designSystem) {
    const dsDeps = await getDependenciesFromTemplate(`${LIBS_DIR}/ui/${designSystem}`)
    await injectDependencies({
      repoRoot,
      targets: targetApp,
      dependencies: dsDeps,
    })
  }

  const templateData = {
    ...config,
    projectName: config.project.name,
    scope: config.project.org,
    targetApp, // Current app being processed
    adapters: allAdapters,
    designSystem: config.apps[targetApp]?.designSystem
      ? {
          id: config.apps[targetApp].designSystem,
          path: `${LIBS_DIR}/ui/${config.apps[targetApp].designSystem}`,
        }
      : null,
    // Add a helper to check snippet existence from within Eta
    hasSnippet: async (sourcePath: string, snippetName: string) => {
      return hasBlueprintSnippet(sourcePath, snippetName)
    },
  }

  // 3. Dynamic Composition Rendering
  const { getFrameworksForTarget } = await import('./config')
  const frameworks = getFrameworksForTarget(repoRoot, targetApp)

  for (const fw of frameworks) {
    const compositionTemplates = getFrameworkCompositionTemplates(fw)

    for (const templatePath of compositionTemplates) {
      if (await templates.exists(templatePath)) {
        // Derive target filename: e.g. 'ClientComposition.tsx.eta' -> 'ClientComposition.tsx'
        const baseName = path.basename(templatePath, '.eta')
        const targetFile = path.join(compositionDir, baseName)

        await templates.renderFile(templatePath, targetFile, templateData)
      }
    }
  }
}

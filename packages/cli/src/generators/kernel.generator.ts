import path from 'node:path'
import { LIBS_DIR, mergeBlueprintCatalog, updateCatalogFromFeatures } from '@kompo/kit'
import { createFsEngine } from '../engine/fs-engine'
import { getTemplateEngine } from '../utils'
import { readKompoConfig } from '../utils/config'
import { injectDependencies } from '../utils/dependencies'

/**
 * generateKernel
 *
 * Ensures the libs/kernel package exists and is registered
 * in all applications and the shared domains library.
 */
export async function generateKernel(repoRoot: string) {
  const fs = createFsEngine()
  const templates = await getTemplateEngine()
  const config = readKompoConfig(repoRoot)
  const org = config?.project.org || 'org'
  const kernelPackage = `@${org}/kernel`

  const kernelDir = path.join(repoRoot, LIBS_DIR, 'kernel')
  const kernelPkg = path.join(kernelDir, 'package.json')

  // 1. Scaffold kernel if it doesn't exist
  if (!(await fs.fileExists(kernelPkg))) {
    await templates.renderDir('libs/kernel/files', kernelDir, {
      org,
    })
  }

  // 2. Align with latest dependency injection methods (Catalogs)
  try {
    const { getBlueprintCatalogPath } = await import('@kompo/blueprints')
    const catalogPath = getBlueprintCatalogPath('libs/kernel')
    if (catalogPath) {
      mergeBlueprintCatalog(repoRoot, 'kernel', catalogPath)
      updateCatalogFromFeatures(repoRoot, ['kernel'])
    }
  } catch (_e) {
    // Ignore catalog errors
  }

  // 3. Inject workspace dependency into all Apps and Domains library
  const { getApps } = await import('../utils/project')
  const allApps = await getApps(repoRoot)

  await injectDependencies({
    repoRoot,
    targets: [...allApps, 'libs/domains'],
    dependencies: [kernelPackage],
    version: 'workspace:*',
  })
}

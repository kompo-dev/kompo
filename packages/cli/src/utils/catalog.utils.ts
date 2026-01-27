import { readFileSync, writeFileSync } from 'node:fs'
import { FRAMEWORKS, getKompoCatalogPath, readKompoConfig, readWorkspaceConfig } from '@kompo/kit'

export async function regenerateCatalog(rootDir: string, options: { silent?: boolean } = {}) {
  const catalogPath = getKompoCatalogPath(rootDir)

  // 1. Load kompo.config.json
  const config = readKompoConfig(rootDir)

  if (!config) {
    if (!options.silent) console.log('No kompo.config.json found. Generating empty catalog.')
    writeFileSync(catalogPath, JSON.stringify({ version: '1.0.0', packages: {} }, null, 2))
    return
  }

  // 2. Load existing versions from pnpm-workspace.yaml
  let workspaceVersions: Record<string, string> = {}
  try {
    const workspaceConfig = readWorkspaceConfig(rootDir)
    if (workspaceConfig.catalog) {
      workspaceVersions = { ...workspaceConfig.catalog }
    }
  } catch (_e) {
    // console.warn('Failed to parse pnpm-workspace.yaml')
  }

  // 3. Identify Catalogs to Merge
  const { getBlueprintCatalogPath } = await import('@kompo/blueprints')
  const catalogsToMerge: Array<{ name: string; path: string }> = []

  // Process Features
  const features = (config as any).features || []
  if (Array.isArray(features)) {
    for (const f of features) {
      const name = typeof f === 'string' ? f : f.name
      const p = getBlueprintCatalogPath(name, 'feature')
      if (p) catalogsToMerge.push({ name, path: p })
    }
  }

  // Process Apps
  if (config.apps) {
    for (const [_appName, appConfig] of Object.entries(config.apps)) {
      const fw = (appConfig as any).frontend || FRAMEWORKS.VITE
      const p = getBlueprintCatalogPath(fw, 'app')
      if (p) catalogsToMerge.push({ name: fw, path: p })
    }
  }

  // Process Adapters
  if (config.adapters) {
    for (const adapterConfig of Object.values(config.adapters) as any[]) {
      const { port, engine } = adapterConfig
      const lookup = `${port}/${engine}`
      const p = getBlueprintCatalogPath(lookup, 'adapter')
      if (p) {
        catalogsToMerge.push({ name: `adapter-${port}-${engine}`, path: p })
      }
    }
  }

  // 4. Merge Logic with Preservation
  const newCatalog = { version: '1.0.0', packages: {} as Record<string, any> }
  // Write initial in case loop fails, but mostly we build object first

  for (const item of catalogsToMerge) {
    const blueprintCatalog = JSON.parse(readFileSync(item.path, 'utf-8'))
    const preservedCatalog = { ...blueprintCatalog }
    for (const [pkg, _version] of Object.entries(preservedCatalog)) {
      if (workspaceVersions[pkg]) {
        preservedCatalog[pkg] = workspaceVersions[pkg]
      }
    }
    newCatalog.packages[item.name] = {
      description: `Restored from ${item.name}`,
      dependencies: preservedCatalog,
      devDependencies: {},
    }
  }

  writeFileSync(catalogPath, JSON.stringify(newCatalog, null, 2))

  return {
    sourceCount: catalogsToMerge.length,
  }
}

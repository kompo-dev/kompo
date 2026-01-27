import path from 'node:path'
import { createFsEngine } from '../engine/fs-engine'

interface InjectDependencyOptions {
  repoRoot: string
  targetApp: string
  dependency: string
  version: string
  dev?: boolean
}

export async function injectDependency(options: InjectDependencyOptions) {
  const { repoRoot, targetApp, dependency, version, dev } = options
  const fs = createFsEngine()

  // 1. Try exact path match (e.g. "apps/web" or "libs/domains")
  let pkgPath = path.join(repoRoot, targetApp, 'package.json')

  // 2. Try short name match for apps
  if (!(await fs.fileExists(pkgPath))) {
    pkgPath = path.join(repoRoot, 'apps', targetApp, 'package.json')
  }

  // 3. Try short name match for libs (if it starts with libs/)
  if (!(await fs.fileExists(pkgPath)) && targetApp.startsWith('libs/')) {
    pkgPath = path.join(repoRoot, targetApp, 'package.json')
  }

  if (!(await fs.fileExists(pkgPath))) {
    throw new Error(`Package.json not found for target: ${targetApp} (checked ${pkgPath})`)
  }

  const pkg = await fs.readJson<any>(pkgPath)
  const key = dev ? 'devDependencies' : 'dependencies'

  if (!pkg[key]) {
    pkg[key] = {}
  }

  pkg[key][dependency] = version

  await fs.writeJson(pkgPath, pkg)
}

interface InjectDependenciesOptions {
  repoRoot: string
  targets?: string | string[]
  dependencies: string[]
  version?: string
}

/**
 * Helper to inject runtime dependencies into one or many apps/libs.
 * If targets is not provided, it injects into all apps found in the workspace.
 */
export async function injectDependencies(options: InjectDependenciesOptions) {
  const { repoRoot, targets, dependencies, version = 'catalog:' } = options
  const { getApps } = await import('./project')

  if (!dependencies || dependencies.length === 0) return

  // Normalize targets to an array
  let normalizedTargets: string[] = []
  if (!targets) {
    normalizedTargets = await getApps(repoRoot)
  } else if (Array.isArray(targets)) {
    normalizedTargets = targets
  } else {
    normalizedTargets = [targets]
  }

  for (const target of normalizedTargets) {
    for (const dependency of dependencies) {
      try {
        await injectDependency({
          repoRoot,
          targetApp: target,
          dependency,
          version,
        })
      } catch (e) {
        // Silently skip if target or package.json not found
      }
    }
  }
}

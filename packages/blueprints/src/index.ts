/**
 * Unified Blueprint Loader for Kompo CLI
 * Supports both Community and Enterprise blueprints
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export function getTemplatesDir(): string {
  // src/index.ts is 1 level deep from root
  return resolve(__dirname, '../elements')
}

// Blueprint directories
const BLUEPRINTS_ROOT = join(__dirname, '..')
const COMMUNITY_APPS = join(BLUEPRINTS_ROOT, 'starters')
const COMMUNITY_FEATURES = join(BLUEPRINTS_ROOT, 'features')
const ENTERPRISE_BLUEPRINTS = join(BLUEPRINTS_ROOT, '..', '..', 'enterprise', 'blueprints')
const ENTERPRISE_APPS = join(ENTERPRISE_BLUEPRINTS, 'starters')
const ENTERPRISE_FEATURES = join(ENTERPRISE_BLUEPRINTS, 'features')

export interface BlueprintConfig {
  version: number
  name: string
  description: string
  category: string
  tags?: string[] // Optional for backward compatibility
  plans?: {
    community: {
      frontend: string[]
      backend: string[]
    }
    enterprise: {
      frontend: string[]
      backend: string[]
    }
  }
  dependencies?: {
    community: string[]
    enterprise: string[]
  }
  steps?: Array<{
    action: string
    plugin?: string
    blueprint?: string
    app: string
    adapter?: string
  }>
  // New unified format
  type?: 'app' | 'feature' | 'plugin'
  path?: string
  stack?: {
    required: string[]
    backend?: string[]
    designSystem: string[]
    optional?: string[]
  }
  blueprint?: string
  domains?: string[]
  domainPorts?: Record<string, string[]>
  adapters?: Record<string, string>
  drivers?: Record<string, string>
  instances?: Record<string, string>
  features?: (string | Record<string, unknown>)[]
  chains?: string[]
}

export interface BlueprintOptions {
  frontend?: string
  backend?: string
  plan?: 'community' | 'enterprise'
}

/**
 * Detect current plan (community/enterprise)
 */
function detectPlan(): 'community' | 'enterprise' {
  // Check if enterprise plugins directory exists
  const enterprisePath = join(process.cwd(), 'packages', 'enterprise')
  return existsSync(enterprisePath) ? 'enterprise' : 'community'
}

/**
 * Load blueprints from a directory (recursively for starters)
 */
function loadBlueprintsFrom(dir: string, maxDepth = 1): BlueprintConfig[] {
  if (!existsSync(dir)) {
    return []
  }

  const blueprints: BlueprintConfig[] = []

  function scan(currentDir: string, currentDepth: number) {
    if (currentDepth > maxDepth) return

    const entries = readdirSync(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = join(currentDir, entry.name)

        // Priority: starter.json (UI/Steps) -> blueprint.json (Technical/Legacy)
        let manifestPath = join(fullPath, 'starter.json')
        if (!existsSync(manifestPath)) {
          manifestPath = join(fullPath, 'blueprint.json')
        }

        if (existsSync(manifestPath)) {
          try {
            const content = readFileSync(manifestPath, 'utf-8')
            const manifest = JSON.parse(content) as BlueprintConfig

            // If we loaded starter.json, check if there is a sibling blueprint.json
            // and merge it (blueprint.json often contains the content/files config)
            if (manifestPath.endsWith('starter.json')) {
              const siblingBlueprintPath = join(fullPath, 'blueprint.json')
              if (existsSync(siblingBlueprintPath)) {
                try {
                  const blueprintContent = JSON.parse(readFileSync(siblingBlueprintPath, 'utf-8'))
                  // Merge: blueprint wins for technical keys, starter wins for UI stuff?
                  // No, starter.json is the Entry Point. It has steps.
                  // blueprint.json has the content definitions (type: app, drivers, etc)
                  // We merge them so the consumer gets a full picture.
                  Object.assign(manifest, blueprintContent, manifest)
                  // (manifest keys overwrite blueprint keys effectively, e.g. title)
                } catch {}
              }
            }

            manifest.path = fullPath
            blueprints.push(manifest)
          } catch {}
        }

        // Recurse
        scan(fullPath, currentDepth + 1)
      }
    }
  }

  scan(dir, 1)
  return blueprints
}

/**
 * List all available blueprints for the current plan
 */
export function listBlueprints(): BlueprintConfig[] {
  const plan = detectPlan()
  const blueprints: BlueprintConfig[] = []

  // Always include community blueprints (Apps and Features)
  blueprints.push(...loadBlueprintsFrom(COMMUNITY_APPS))
  blueprints.push(...loadBlueprintsFrom(COMMUNITY_FEATURES))

  // Include enterprise blueprints if plan is enterprise
  if (plan === 'enterprise') {
    // Check if enterprise uses apps/features structure or flat
    if (existsSync(ENTERPRISE_APPS)) {
      blueprints.push(...loadBlueprintsFrom(ENTERPRISE_APPS))
    }
    if (existsSync(ENTERPRISE_FEATURES)) {
      blueprints.push(...loadBlueprintsFrom(ENTERPRISE_FEATURES))
    }
    // Fallback: load from root if subdirs don't exist (legacy enterprise)
    if (!existsSync(ENTERPRISE_APPS) && !existsSync(ENTERPRISE_FEATURES)) {
      blueprints.push(...loadBlueprintsFrom(ENTERPRISE_BLUEPRINTS))
    }
  }

  return blueprints
}

/**
 * Get a specific starter by name (or path)
 */
export function getStarter(name: string): BlueprintConfig | null {
  const checkOne = (fullDir: string) => {
    const p = join(fullDir, 'starter.json')
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, 'utf-8')
        const manifest = JSON.parse(content) as BlueprintConfig
        manifest.path = dirname(p)
        return manifest
      } catch {
        return null
      }
    }
    return null
  }

  // Normalize name: support dot notation (fw.ds.starter) -> fw/ds/starter
  // This allows explicit addressing: kompo new -b nextjs.shadcn.nft-marketplace
  const relativePath = name.split('.').join('/')

  // 1. Check Community Apps (Starters Root)
  let starter = checkOne(join(COMMUNITY_APPS, relativePath))
  if (starter) return starter

  // 2. Check Community Features
  starter = checkOne(join(COMMUNITY_FEATURES, relativePath))
  if (starter) return starter

  // 3. Check Enterprise
  if (existsSync(join(ENTERPRISE_APPS, relativePath))) {
    const entStarter = checkOne(join(ENTERPRISE_APPS, relativePath))
    if (entStarter) return entStarter
  }
  if (existsSync(join(ENTERPRISE_FEATURES, relativePath))) {
    const entFeat = checkOne(join(ENTERPRISE_FEATURES, relativePath))
    if (entFeat) return entFeat
  }

  // Legacy Enterprise Fallback
  const legacyEntPath = join(ENTERPRISE_BLUEPRINTS, relativePath)
  if (existsSync(legacyEntPath)) {
    return checkOne(legacyEntPath)
  }

  // Support absolute/relative path if passed directly
  if (existsSync(join(name, 'starter.json'))) {
    return checkOne(name)
  }

  return null
}

/**
 * Get a specific blueprint by name
 */
export function getBlueprint(name: string): BlueprintConfig | null {
  // Helper to check a path
  const checkValues = (basePath: string) => {
    // Check for blueprint.json ONLY (Strict separation)
    const p = join(basePath, name, 'blueprint.json')

    if (existsSync(p)) {
      try {
        const content = readFileSync(p, 'utf-8')
        const blueprint = JSON.parse(content) as BlueprintConfig
        blueprint.path = dirname(p)
        return blueprint
      } catch {
        return null
      }
    }
    return null
  }

  // Check Community Apps
  let bp = checkValues(COMMUNITY_APPS)
  if (bp) return bp

  // Check Community Features
  bp = checkValues(COMMUNITY_FEATURES)
  if (bp) return bp

  // Check Enterprise if applicable
  if (existsSync(join(ENTERPRISE_APPS, name))) return checkValues(ENTERPRISE_APPS)
  if (existsSync(join(ENTERPRISE_FEATURES, name))) return checkValues(ENTERPRISE_FEATURES)
  const legacyEntPath = join(ENTERPRISE_BLUEPRINTS, name, 'blueprint.json')
  if (existsSync(legacyEntPath)) {
    try {
      const content = readFileSync(legacyEntPath, 'utf-8')
      const blueprint = JSON.parse(content) as BlueprintConfig
      blueprint.path = dirname(legacyEntPath)
      return blueprint
    } catch {
      return null
    }
  }

  // Support absolute/relative path
  if (existsSync(join(name, 'blueprint.json'))) {
    try {
      const p = join(name, 'blueprint.json')
      const content = readFileSync(p, 'utf-8')
      const blueprint = JSON.parse(content) as BlueprintConfig
      blueprint.path = name
      return blueprint
    } catch {
      return null
    }
  }

  return null
}

/**
 * Check if a blueprint is available for a specific plan
 */
export function isBlueprintAvailableForPlan(
  blueprint: BlueprintConfig,
  plan: 'community' | 'enterprise'
): boolean {
  return plan in (blueprint.plans || {})
}

/**
 * Get blueprints by category
 */
export function getBlueprintsByCategory(category: string): BlueprintConfig[] {
  return listBlueprints().filter((b) => b.category === category)
}

/**
 * Search blueprints by query
 */
export function searchBlueprints(query: string): BlueprintConfig[] {
  const lowerQuery = query.toLowerCase()
  return listBlueprints().filter(
    (b) =>
      b.name.toLowerCase().includes(lowerQuery) ||
      b.description.toLowerCase().includes(lowerQuery) ||
      b.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
  )
}

/**
 * Check if a blueprint is compatible with the current stack
 */
export function checkCompatibility(blueprint: BlueprintConfig, currentStack: string[]): boolean {
  if (!blueprint.stack) return true

  // Check required stack
  const missing = blueprint.stack.required.filter((s) => !currentStack.includes(s))
  if (missing.length > 0) return false

  // Check design system
  const hasDesignSystem = blueprint.stack.designSystem.some((ds) => currentStack.includes(ds))
  if (!hasDesignSystem) return false

  return true
}

/**
 * Get blueprints by type
 */
export function getBlueprintsByType(type: 'app' | 'plugin'): BlueprintConfig[] {
  return listBlueprints().filter((b) => b.type === type)
}

/**
 * Get dependencies from a blueprint's catalog.json
 */
export function getBlueprintDependencies(templatePath: string): string[] {
  const fullPath = join(getTemplatesDir(), templatePath, 'catalog.json')
  if (existsSync(fullPath)) {
    try {
      const content = readFileSync(fullPath, 'utf-8')
      const catalog = JSON.parse(content)
      return Object.keys(catalog)
    } catch {
      return []
    }
  }
  return []
}

/**
 * Check if a blueprint has a specific snippet
 */
export function hasBlueprintSnippet(templatePath: string, snippetName: string): boolean {
  const fullPath = join(getTemplatesDir(), templatePath, 'snippets', `${snippetName}.eta`)
  return existsSync(fullPath)
}

/**
 * Get internal paths for standard composition templates based on framework
 */
export function getFrameworkCompositionTemplates(framework: string): string[] {
  // Map framework aliases to internal blueprint paths
  const frameworkMap: Record<string, string> = {
    nextjs: 'apps/nextjs/base',
    vite: 'apps/vite/base',
  }

  const base = frameworkMap[framework.toLowerCase()]
  if (!base) return []

  return [
    `${base}/src/composition/ClientComposition.tsx.eta`,
    `${base}/src/composition/ServerComposition.tsx.eta`,
  ]
}

/**
 * List all available design systems by scanning the libs/ui directory
 */
export function listDesignSystems(): string[] {
  const uiDir = join(getTemplatesDir(), 'libs', 'ui')
  if (!existsSync(uiDir)) return []

  return readdirSync(uiDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('.'))
    .map((dirent) => dirent.name)
}

/**
 * Resolve the internal path to a catalog.json for various component types
 */
export function getBlueprintCatalogPath(
  name: string,
  type: 'app' | 'feature' | 'design-system' | 'lib' | 'adapter' | 'driver',
  filename = 'catalog.json'
): string | null {
  const templatesDir = getTemplatesDir()
  let candidatePath = ''

  if (type === 'app') {
    candidatePath = join(templatesDir, 'apps', name, filename)
    if (!existsSync(candidatePath)) {
      candidatePath = join(templatesDir, 'apps', name, 'blank', filename)
    }
  } else if (type === 'feature') {
    candidatePath = join(templatesDir, 'features', name, filename)
  } else if (type === 'lib' || type === 'design-system') {
    // Design systems are in libs/ui
    if (type === 'design-system') {
      candidatePath = join(templatesDir, 'libs', 'ui', name, filename)
    } else {
      candidatePath = join(templatesDir, 'libs', name, filename)
    }
  } else if (type === 'adapter') {
    const parts = name.split('/')
    if (parts.length === 2) {
      candidatePath = join(templatesDir, 'libs', 'adapters', parts[0], parts[1], filename)
    } else {
      candidatePath = join(templatesDir, 'libs', 'adapters', name, filename)
    }
  } else if (type === 'driver') {
    // Support arbitrary nesting for drivers (e.g. orm/drizzle/pglite)
    candidatePath = join(templatesDir, 'libs', 'drivers', name, filename)
  }

  return existsSync(candidatePath) ? candidatePath : null
}

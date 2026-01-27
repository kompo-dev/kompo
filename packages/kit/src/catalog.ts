/**
 * Catalog utilities for managing pnpm-workspace.yaml catalog entries
 * Uses kompo.catalog.json as the source of truth for dependency versions
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'

export interface CatalogEntry {
  [key: string]: string
}

export interface WorkspaceConfig {
  packages: string[]
  catalog?: CatalogEntry
  onlyBuiltDependencies?: string[]
}

export interface PackageGroup {
  description?: string
  extends?: string[]
  dependencies: CatalogEntry
  devDependencies: CatalogEntry
}

export interface KompoCatalog {
  version: string
  description?: string
  lastUpdated?: string
  packages: Record<string, PackageGroup>
}

/**
 * Read catalog.yaml from a plugin directory
 */
export function readPluginCatalog(pluginDir: string): CatalogEntry {
  const catalogPath = join(pluginDir, 'catalog.yaml')
  if (!existsSync(catalogPath)) {
    return {}
  }

  const content = readFileSync(catalogPath, 'utf-8')
  const parsed = parse(content) as CatalogEntry | null
  return parsed || {}
}

/**
 * Read the current pnpm-workspace.yaml
 */
export function readWorkspaceConfig(rootDir: string): WorkspaceConfig {
  const workspacePath = join(rootDir, 'pnpm-workspace.yaml')
  const content = readFileSync(workspacePath, 'utf-8')
  return parse(content) as WorkspaceConfig
}

/**
 * Write the pnpm-workspace.yaml
 */
export function writeWorkspaceConfig(rootDir: string, config: WorkspaceConfig): void {
  const workspacePath = join(rootDir, 'pnpm-workspace.yaml')
  const content = stringify(config, { lineWidth: 0 })
  writeFileSync(workspacePath, content)
}

/**
 * Merge multiple catalogs into one
 * Later entries override earlier ones for the same key
 */
export function mergeCatalogs(...catalogs: CatalogEntry[]): CatalogEntry {
  const merged: CatalogEntry = {}

  for (const catalog of catalogs) {
    for (const [pkg, version] of Object.entries(catalog)) {
      if (!merged[pkg]) {
        merged[pkg] = version
        continue
      }

      const existingVersion = merged[pkg]
      // Simple logic: if version strings are different, pick the "higher" one
      // We strip basic semver chars (^, ~) for comparison if needed, but localeCompare matches logical ordering well enough for now
      // e.g. "5.0.0" > "4.0.0"
      // If we really need strict semver, we should add 'semver' package to kit.
      // For now, this is better than random "last write wins".

      // Clean versions for comparison (remove ^, ~)
      const v1 = version.replace(/^[\^~]/, '')
      const v2 = existingVersion.replace(/^[\^~]/, '')

      // Compare
      // -1: v1 < v2 (existing wins)
      // 1: v1 > v2 (new wins)
      // 0: equal
      const cmp = v1.localeCompare(v2, undefined, { numeric: true, sensitivity: 'base' })

      if (cmp > 0) {
        merged[pkg] = version
      }
      // Else keep existing
    }
  }
  return merged
}

/**
 * Get plugin directory path from plugin name
 */
export function getPluginDir(rootDir: string, pluginName: string): string {
  // Convert plugin name to directory name
  // e.g., 'framework-nextjs' -> 'cli-framework-nextjs'
  if (pluginName.startsWith('framework-')) {
    return join(rootDir, 'packages', `cli-${pluginName}`)
  }
  if (pluginName.startsWith('backend-')) {
    return join(rootDir, 'packages', `cli-${pluginName}`)
  }
  if (pluginName.startsWith('port-')) {
    return join(rootDir, 'packages', `cli-${pluginName}`)
  }
  if (pluginName.startsWith('design-')) {
    return join(rootDir, 'packages', `cli-${pluginName}`)
  }
  return join(rootDir, 'packages', `cli-${pluginName}`)
}

/**
 * Update pnpm-workspace.yaml catalog with dependencies from selected plugins
 * @deprecated Use updateCatalogFromFeatures instead
 */
export function updateWorkspaceCatalog(rootDir: string, pluginNames: string[]): void {
  const config = readWorkspaceConfig(rootDir)

  // Collect catalogs from all plugins
  const pluginCatalogs = pluginNames.map((name) => {
    const pluginDir = getPluginDir(rootDir, name)
    return readPluginCatalog(pluginDir)
  })

  // Merge with existing catalog (existing takes precedence for conflicts)
  const mergedCatalog = mergeCatalogs(...pluginCatalogs, config.catalog || {})

  // Update config
  config.catalog = mergedCatalog

  // Write back
  writeWorkspaceConfig(rootDir, config)
}

/**
 * Merge a blueprint's catalog.json into kompo.catalog.json
 */
/**
 * Resolve the path to kompo.catalog.json
 * Priority: libs/config/kompo.catalog.json > kompo.catalog.json
 */
export function getKompoCatalogPath(rootDir: string): string {
  const configPath = join(rootDir, 'libs', 'config', 'kompo.catalog.json')
  if (existsSync(configPath)) return configPath
  return join(rootDir, 'kompo.catalog.json')
}

/**
 * Merge a blueprint's catalog.json into kompo.catalog.json
 */
export function mergeBlueprintCatalog(
  rootDir: string,
  blueprintName: string,
  catalogPath: string
): void {
  if (!existsSync(catalogPath)) return

  const blueprintCatalog = JSON.parse(readFileSync(catalogPath, 'utf-8')) as CatalogEntry
  let kompoCatalog: KompoCatalog
  const kompoCatalogPath = getKompoCatalogPath(rootDir)

  if (existsSync(kompoCatalogPath)) {
    kompoCatalog = readKompoCatalog(rootDir)
  } else {
    kompoCatalog = { version: '1.0.0', packages: {} }
  }

  if (!kompoCatalog.packages) {
    kompoCatalog.packages = {}
  }

  kompoCatalog.packages[blueprintName] = {
    description: `Imported from ${blueprintName}`,
    dependencies: blueprintCatalog,
    devDependencies: {},
  }
  writeFileSync(kompoCatalogPath, JSON.stringify(kompoCatalog, null, 2))
}

/**
 * Read kompo.catalog.json from the root directory or libs/config
 */
export function readKompoCatalog(rootDir: string): KompoCatalog {
  const catalogPath = getKompoCatalogPath(rootDir)
  if (!existsSync(catalogPath)) {
    throw new Error(`kompo.catalog.json not found at ${catalogPath}`)
  }
  const content = readFileSync(catalogPath, 'utf-8')
  return JSON.parse(content) as KompoCatalog
}

/**
 * Ensure kompo.catalog.json exists, creating it if necessary
 * Prefer creating in libs/config if the directory exists
 */
export function ensureKompoCatalog(rootDir: string): void {
  let catalogPath = getKompoCatalogPath(rootDir)

  // If it doesn't exist anywhere, decide where to create it
  if (!existsSync(catalogPath)) {
    const libsConfigDir = join(rootDir, 'libs', 'config')
    if (existsSync(libsConfigDir)) {
      catalogPath = join(libsConfigDir, 'kompo.catalog.json')
    }
  }

  if (!existsSync(catalogPath)) {
    const initialCatalog: KompoCatalog = { version: '1.0.0', packages: {} }
    writeFileSync(catalogPath, JSON.stringify(initialCatalog, null, 2))
  }
}

/**
 * Resolve a package group including its extensions (inheritance)
 */
function resolvePackageGroup(
  catalog: KompoCatalog,
  groupName: string,
  resolved = new Set<string>()
): { dependencies: CatalogEntry; devDependencies: CatalogEntry } {
  if (resolved.has(groupName)) {
    return { dependencies: {}, devDependencies: {} }
  }
  resolved.add(groupName)

  const group = catalog.packages[groupName]
  if (!group) {
    return { dependencies: {}, devDependencies: {} }
  }

  // Start with extended groups
  let dependencies: CatalogEntry = {}
  let devDependencies: CatalogEntry = {}

  if (group.extends) {
    for (const extendName of group.extends) {
      const extended = resolvePackageGroup(catalog, extendName, resolved)
      dependencies = { ...dependencies, ...extended.dependencies }
      devDependencies = { ...devDependencies, ...extended.devDependencies }
    }
  }

  // Add this group's dependencies (override extended)
  dependencies = { ...dependencies, ...group.dependencies }
  devDependencies = { ...devDependencies, ...group.devDependencies }

  return { dependencies, devDependencies }
}

/**
 * Get all catalog entries for a set of features
 */
export function getCatalogEntriesForFeatures(rootDir: string, features: string[]): CatalogEntry {
  const catalog = readKompoCatalog(rootDir)
  let allDeps: CatalogEntry = {}

  for (const feature of features) {
    const resolved = resolvePackageGroup(catalog, feature)
    allDeps = { ...allDeps, ...resolved.dependencies, ...resolved.devDependencies }
  }

  return allDeps
}

/**
 * Update pnpm-workspace.yaml catalog from kompo.catalog.json based on selected features
 */
export function updateCatalogFromFeatures(rootDir: string, features: string[]): void {
  const config = readWorkspaceConfig(rootDir)
  const newEntries = getCatalogEntriesForFeatures(rootDir, features)

  // Merge with existing catalog (new entries added, existing kept)
  config.catalog = { ...(config.catalog || {}), ...newEntries }

  // Sort catalog entries alphabetically for consistency
  const sortedCatalog: CatalogEntry = {}
  for (const key of Object.keys(config.catalog).sort()) {
    sortedCatalog[key] = config.catalog[key]
  }
  config.catalog = sortedCatalog

  writeWorkspaceConfig(rootDir, config)
}

/**
 * Get the list of features needed for a frontend + design system combination
 */
export function getRequiredFeatures(
  frontend: 'vite' | 'nextjs',
  designSystem?: string,
  backend?: string
): string[] {
  const features: string[] = ['core']

  // Frontend
  if (frontend === 'vite') {
    features.push('vite')
  } else if (frontend === 'nextjs') {
    features.push('nextjs')
  }

  // Design system
  if (designSystem) {
    features.push(designSystem)
  }

  // Backend
  if (backend === 'nestjs') {
    features.push('nestjs')
  } else if (backend === 'express') {
    features.push('express')
  }

  return features
}

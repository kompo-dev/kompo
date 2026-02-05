/**
 * Kompo Config utilities for managing libs/config/kompo.config.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DesignSystemId, FrameworkId } from '@kompo/config/constants'

export interface AppConfig {
  packageName: string
  profileId?: string
  framework: FrameworkId
  designSystem?: DesignSystemId
  ports: Record<string, string | string[]>
  chains?: string[]
  createdAt: string
  updatedAt: string
}

export interface AdapterConfig {
  port: string
  engine: string
  driver: string
  path: string
  capability?: string
  exportName?: string
  isInstance?: boolean
  createdAt: string
}

export interface DomainConfig {
  ports: (string | { name: string; type: string })[]
  useCases: string[]
  entities: string[]
}

export interface StepEntry {
  command: 'new' | 'add' | 'remove' | 'wire'
  type: 'app' | 'feature' | 'domain' | 'port' | 'adapter' | 'design-system'
  name: string
  driver?: string
  port?: string // For 'adapter', 'wiring'
  domain?: string // For 'port'
  capability?: string // For 'port' smart naming
  app?: string // For 'wiring', 'design-system' app
  timestamp: string
}

export interface KompoConfig {
  $schema?: string
  version: number
  project: {
    name: string
    org: string
  }
  catalog: {
    lastUpdated: string
    sources: string[]
  }
  adapters?: Record<string, AdapterConfig>
  infras?: Record<string, AdapterConfig>
  domains?: Record<string, DomainConfig>
  apps: Record<string, AppConfig>
  steps: StepEntry[]
  libsDir?: string
  paths?: {
    composition?: string
  }
}

/**
 * The configured libraries directory name.
 * Hardcoded to 'libs' per architectural decision.
 */
export const LIBS_DIR = 'libs'
const CONFIG_FILE = 'kompo.config.json'

/**
 * Get the path to kompo.config.json
 */
export function getConfigPath(rootDir: string): string {
  return join(rootDir, LIBS_DIR, 'config', CONFIG_FILE)
}

/**
 * Ensure libs/config directory exists
 */
export function ensureConfigDir(rootDir: string): void {
  const configDir = join(rootDir, LIBS_DIR, 'config')
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }
}

/**
 * Read kompo.config.json
 */
export function readKompoConfig(rootDir: string): KompoConfig | null {
  const configPath = getConfigPath(rootDir)
  if (!existsSync(configPath)) {
    return null
  }
  const content = readFileSync(configPath, 'utf-8')
  return JSON.parse(content) as KompoConfig
}

/**
 * Write kompo.config.json
 */
export function writeKompoConfig(rootDir: string, config: KompoConfig): void {
  ensureConfigDir(rootDir)
  const configPath = getConfigPath(rootDir)
  const content = JSON.stringify(config, null, 2)
  writeFileSync(configPath, content)
}

/**
 * Initialize a new kompo.config.json
 */
export function initKompoConfig(rootDir: string, projectName: string, org: string): KompoConfig {
  const config: KompoConfig = {
    $schema: '../../packages/blueprints/kompo.config.schema.json',
    version: 1,
    project: {
      name: projectName,
      org,
    },
    catalog: {
      lastUpdated: new Date().toISOString(),
      sources: [],
    },
    apps: {},
    steps: [],
    libsDir: LIBS_DIR,
  }
  writeKompoConfig(rootDir, config)
  return config
}

/**
 * Add or update an app in the config
 */
export function upsertApp(
  rootDir: string,
  appPath: string,
  appConfig: Omit<AppConfig, 'createdAt' | 'updatedAt'>
): void {
  const config = readKompoConfig(rootDir)
  if (!config) {
    throw new Error('kompo.config.json not found. Run kompo init first.')
  }

  const now = new Date().toISOString()
  const existingApp = config.apps[appPath]

  config.apps[appPath] = {
    ...appConfig,
    createdAt: existingApp?.createdAt || now,
    updatedAt: now,
  }

  writeKompoConfig(rootDir, config)
}

/**
 * Add a step entry
 */
export function addStep(rootDir: string, entry: Omit<StepEntry, 'timestamp'>): void {
  const config = readKompoConfig(rootDir)
  if (!config) {
    throw new Error('kompo.config.json not found. Run kompo init first.')
  }

  config.steps.push({
    ...entry,
    timestamp: new Date().toISOString(),
  })

  writeKompoConfig(rootDir, config)
}

/**
 * Update catalog sources
 */
export function updateCatalogSources(rootDir: string, sources: string[]): void {
  const config = readKompoConfig(rootDir)
  if (!config) {
    throw new Error('kompo.config.json not found. Run kompo init first.')
  }

  // Merge with existing sources (no duplicates)
  const allSources = [...new Set([...config.catalog.sources, ...sources])]

  config.catalog = {
    lastUpdated: new Date().toISOString(),
    sources: allSources,
  }

  writeKompoConfig(rootDir, config)
}

/**
 * Generate a profile ID from app config
 */
export function generateProfileId(appConfig: Partial<AppConfig>): string {
  const parts = [appConfig.framework, appConfig.designSystem].filter(Boolean)

  const hash = Math.random().toString(36).substring(2, 10)
  return `${parts.join('-')}-${hash}`
}

/**
 * Get steps for replay (for kompo apply)
 */
export function getStepsForReplay(rootDir: string): StepEntry[] {
  const config = readKompoConfig(rootDir)
  if (!config) {
    return []
  }
  const steps = config.steps
  // Return steps sorted by timestamp
  return [...steps].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
}

import type { AdapterBlueprint } from '@kompo/blueprints'
import type { FsEngine, TemplateEngine } from '@kompo/kit'
import type {
  CapabilityManifest,
  DriverManifest,
  ProviderManifest,
} from '../../registries/capability.registry'

export type BlueprintManifest = AdapterBlueprint

export interface AdapterManifest extends BlueprintManifest {
  port: string
  provider: string
  driver?: string
  sharedDriver?: string
  configMapping: Record<string, string>
}

export interface TemplateData {
  [key: string]: any
}

// Minimal definition to avoid circular imports or heavy deps if possible
export interface BaseAdapterGeneratorContext {
  cwd: string
  repoRoot: string
  portName: string
  capability: CapabilityManifest
  provider: ProviderManifest
  driver?: DriverManifest
  sharedDriver?: string
  name?: string
  alias?: string
  blueprintPath?: string
  tableName?: string
  domainName?: string
  targetApp?: string
  skipInstall?: boolean
  scope?: string
  /** True when adding a new alias to an existing adapter (skip file regeneration) */
  isNewAlias?: boolean
  /** True when creating a specialized client for an existing adapter */
  isSpecializedClient?: boolean
  templateData?: Record<string, unknown>
}

export interface AdapterGeneratorContext extends BaseAdapterGeneratorContext {
  // Computed/Added during pipeline or setup
  adapterDir: string
  templateBase: string
  manifest?: AdapterManifest
  templateData: TemplateData
  driverTemplatePath?: string
  /** When true, skip file generation steps (used for alias-only flows) */
  skipFiles?: boolean
  /** Policy for environment variable injection */
  envInjectionPolicy?: 'all' | 'specialized' | 'none'
}

export interface GeneratorUtils {
  fs: FsEngine
  templates: TemplateEngine
  summary: string[]
  addSummary: (message: string) => void
  installDependencies: (cwd: string) => Promise<void>
  injectEnvSchema: (templateBase: string, data: TemplateData) => Promise<void>
  registerInConfig: (context: AdapterGeneratorContext, data: TemplateData) => Promise<void>
  injectComposition: (context: AdapterGeneratorContext, adapterDir: string) => Promise<void>
}

export type AdapterGeneratorStepExecutor = (
  context: AdapterGeneratorContext,
  utils: GeneratorUtils
) => Promise<any>

export interface AdapterGeneratorStep {
  id: string
  description?: string
  execute: AdapterGeneratorStepExecutor
}

export interface GeneratorResult {
  success: boolean
  results: Record<string, any>
  context: AdapterGeneratorContext
}

export interface GeneratorContext extends AdapterGeneratorContext {}

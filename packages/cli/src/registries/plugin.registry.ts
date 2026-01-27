// ... imports ...
import type { KompoPlugin, PluginRegistry, Question, Step, TemplateDefinition } from '@kompo/kit'
import { readKompoConfig } from '@kompo/kit'

export interface KompoPluginRegistry extends PluginRegistry {
  registerPlugin(plugin: KompoPlugin): void
  setRepoRoot(root: string): void
  setInstallPortHandler(
    handler: (portId: string, options?: { silent?: boolean }) => Promise<void>
  ): void
  getPlugins(): KompoPlugin[]
  getPlugin(name: string): KompoPlugin | undefined
  getPluginsForCommand(command: 'new' | 'add'): KompoPlugin[]
  getSteps(): Step[]
  getQuestions(): Question[]
  getTemplates(): TemplateDefinition[]
  clear(): void
}

export function createPluginRegistry(): KompoPluginRegistry {
  let steps: Step[] = []
  let questions: Question[] = []
  let templates: TemplateDefinition[] = []
  const plugins = new Map<string, KompoPlugin>()

  // Context for port dependency checks
  let repoRoot: string | null = null
  let installPortHandler:
    | ((portId: string, options?: { silent?: boolean }) => Promise<void>)
    | null = null

  return {
    setRepoRoot(root: string): void {
      repoRoot = root
    },

    setInstallPortHandler(
      handler: (portId: string, options?: { silent?: boolean }) => Promise<void>
    ): void {
      installPortHandler = handler
    },

    registerQuestion(question: Question): void {
      questions.push(question)
    },

    registerStep(step: Step): void {
      steps.push(step)
    },

    registerTemplate(template: TemplateDefinition): void {
      templates.push(template)
    },

    registerPlugin(plugin: KompoPlugin): void {
      if (plugins.has(plugin.name)) {
        throw new Error(`Plugin ${plugin.name} is already registered`)
      }
      plugins.set(plugin.name, plugin)
      plugin.register(this)
    },

    getSteps(): Step[] {
      return steps
    },

    getQuestions(): Question[] {
      return questions
    },

    getTemplates(): TemplateDefinition[] {
      return templates
    },

    getPlugins(): KompoPlugin[] {
      return Array.from(plugins.values())
    },

    getPlugin(name: string): KompoPlugin | undefined {
      return plugins.get(name)
    },

    getPluginsForCommand(command: 'new' | 'add'): KompoPlugin[] {
      return Array.from(plugins.values()).filter((p) => p.supports.includes(command))
    },

    clear(): void {
      steps = []
      questions = []
      templates = []
      plugins.clear()
    },

    isPortInstalled(portId: string): boolean {
      if (!repoRoot) return false

      const config = readKompoConfig(repoRoot)
      if (!config) return false

      // Check if any app has this port installed
      for (const appConfig of Object.values(config.apps)) {
        if (appConfig.ports && portId in appConfig.ports) {
          return true
        }
      }

      // Also check adapters registry
      if (config.adapters) {
        for (const adapter of Object.values(config.adapters)) {
          if (adapter.port === portId) {
            return true
          }
        }
      }

      return false
    },

    getInstalledPorts(): string[] {
      if (!repoRoot) return []

      const config = readKompoConfig(repoRoot)
      if (!config) return []

      const ports = new Set<string>()

      // Collect from all apps
      for (const appConfig of Object.values(config.apps)) {
        if (appConfig.ports) {
          for (const portId of Object.keys(appConfig.ports)) {
            ports.add(portId)
          }
        }
      }

      // Also collect from adapters registry
      if (config.adapters) {
        for (const adapter of Object.values(config.adapters)) {
          ports.add(adapter.port)
        }
      }

      return Array.from(ports)
    },

    async installPort(portId: string, options?: { silent?: boolean }): Promise<void> {
      if (!installPortHandler) {
        throw new Error('installPort handler not configured. Cannot install dependent port.')
      }

      if (!options?.silent) {
        console.log(`\n📦 Installing required dependency: ${portId}`)
      }

      await installPortHandler(portId, options)
    },
  }
}

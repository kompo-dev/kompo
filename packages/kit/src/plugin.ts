/**
 * Core plugin interface for Kompo CLI
 */

import type { Question, Step, TemplateDefinition } from './step'

export interface KompoPlugin {
  /** Unique plugin name */
  name: string

  /** Which commands this plugin supports */
  supports: ('new' | 'add')[]

  /** Register plugin capabilities with the registry */
  register(registry: PluginRegistry): void
}

/**
 * Registry interface for plugins to register their capabilities
 */
export interface PluginRegistry {
  registerQuestion(question: Question): void
  registerStep(step: Step): void
  registerTemplate(template: TemplateDefinition): void

  /**
   * Check if a port is installed in the current project
   */
  isPortInstalled(portId: string): boolean

  /**
   * Get all installed ports in the current project
   */
  getInstalledPorts(): string[]

  /**
   * Install a port dependency (triggers the port's question/step flow)
   * @param portId - The port to install (e.g., 'orm', 'wallet')
   * @param options - Installation options
   */
  installPort(portId: string, options?: { silent?: boolean }): Promise<void>
}

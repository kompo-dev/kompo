/**
 * Helper function to define a Kompo plugin
 */

import type { KompoPlugin, PluginRegistry } from './plugin'

export function defineKompoPlugin(config: {
  name: string
  supports: ('new' | 'add')[]
  setup: (registry: PluginRegistry) => void
}): KompoPlugin {
  return {
    name: config.name,
    supports: config.supports,
    register: config.setup,
  }
}

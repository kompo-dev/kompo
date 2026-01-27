/**
 * Blueprints command for Kompo CLI
 * Lists available project blueprints
 */

import { log } from '@clack/prompts'
import { listBlueprints } from '@kompo/blueprints'
import { Command } from 'commander'
import color from 'picocolors'
import type { KompoPluginRegistry } from '../registries/plugin.registry'

export function createBlueprintsCommand(_registry: KompoPluginRegistry): Command {
  const cmd = new Command('blueprints')
    .description('List available project blueprints')
    .showHelpAfterError(true)
    .action(() => {
      const blueprints = listBlueprints()

      const appBlueprints = blueprints.filter((b) => !b.type || b.type === 'app')
      const featureBlueprints = blueprints.filter((b) => b.type === 'feature')

      if (appBlueprints.length > 0) {
        log.info(color.bgBlue('📦 Project Blueprints (kompo new):'))
        for (const b of appBlueprints) {
          log.message(`  ${color.cyan(b.name.padEnd(20))} ${b.description}`)
          const tags = b.tags || []
          log.message(
            `  ${''.padEnd(20)} ${color.dim(`Category: ${b.category}`)}${tags.length ? color.dim(` | Tags: ${tags.join(', ')}`) : ''}\n`
          )
        }
      }

      if (featureBlueprints.length > 0) {
        log.info(color.bgBlue('🧩 Feature Blueprints (kompo add feature):'))
        for (const b of featureBlueprints) {
          log.message(`  ${color.cyan(b.name.padEnd(20))} ${b.description}`)
          const tags = b.tags || []
          log.message(
            `  ${''.padEnd(20)} ${color.dim(`Category: ${b.category}`)}${tags.length ? color.dim(` | Tags: ${tags.join(', ')}`) : ''}\n`
          )
        }
      }

      log.message(color.dim('Usage: kompo new <name> --blueprint <blueprint-name>'))
      log.message(color.dim('Usage: kompo add feature <feature-name>\n'))
    })

  return cmd
}

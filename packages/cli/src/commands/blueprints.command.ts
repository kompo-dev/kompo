/**
 * Blueprints command for Kompo CLI
 * Lists available project blueprints
 */

import { log } from '@clack/prompts'
import { listBlueprints, listFeatures } from '@kompo/blueprints'
import { Command } from 'commander'
import color from 'picocolors'

export function createBlueprintsCommand(): Command {
  const cmd = new Command('blueprints')
    .description('List available project blueprints')
    .showHelpAfterError(true)
    .action(() => {
      const blueprints = listBlueprints()
      const features = listFeatures()

      const appBlueprints = blueprints.filter((b) => !b.type || b.type === 'app')

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

      if (features.length > 0) {
        log.info(color.bgBlue('🧩 Feature Blueprints (kompo add feature):'))
        for (const b of features) {
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

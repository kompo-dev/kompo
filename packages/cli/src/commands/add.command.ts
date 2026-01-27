/**
 * Add command for Kompo CLI
 * Adds ports, adapters, use-cases, and entities to the hexagonal architecture
 */

import { Command } from 'commander'
import color from 'picocolors'
import type { KompoPluginRegistry } from '../registries/plugin.registry'
import { runAddAdapter } from './add/adapter/adapter.command'
import { createAddAppCommand } from './add/app/app.command'
import { createAddDomainCommand } from './add/domain/domain.command'
import { runAddEntity } from './add/entity/entity.command'
import { runAddFeature } from './add/feature/feature.command'
import { runAddPort } from './add/port/port.command'
import { runAddUseCase } from './add/use-case/use-case.command'
import { runAddValueObject } from './add/value-object/value-object.command'

export function createAddCommand(_registry: KompoPluginRegistry): Command {
  const cmd = new Command('add')
    .description('Add features to your Kompo application')
    .showHelpAfterError(true)

  cmd.addCommand(createAddDomainCommand())

  cmd
    .command('use-case')
    .alias('uc')
    .description('Create a Use Case in a Domain')
    .argument('<name>', 'Name of the use case (e.g. signin-with-wallet)')
    .usage(`${color.cyan('<name>')} ${color.yellow('[options]')}`)
    .option('-d, --domain <name>', 'Target domain')
    .action(runAddUseCase)

  cmd
    .command('port')
    .description('Create a new Port (interface) for a Domain')
    .argument('<name>', 'Name of the port (e.g. wallet-port)')
    .usage(`${color.cyan('<name>')} ${color.yellow('[options]')}`)
    .option('-d, --domain <name>', 'Target domain')
    .action(async (name, options) => {
      await runAddPort(name, options)
    })

  cmd
    .command('adapter')
    .description(
      'Adapter implements the link between a Domain Port and a specific Technology Driver'
    )
    .usage(`${color.yellow('[options]')}`)
    .option('-p, --port <name>', 'Port to implement (interactive selection if omitted)')
    .option('--capability <name>', 'Capability to use (e.g. orm, http)')
    .option('--provider <name>', 'Provider to use (e.g. drizzle, axios)')
    .option('--driver <name>', 'Driver to use (e.g. pglite, postgres)')
    .option('--shared-driver <name>', 'Shared driver to use')
    .option('-d, --domain <name>', 'Target domain')
    .option('-a, --app <name>', 'Target app')
    .option('-n, --name <name>', 'Adapter name (defaults to port-provider)')
    .option('--alias <alias>', 'Alias for the adapter (e.g., main, coingecko)')
    .option('--skip-tests', 'Skip generating test files')
    .option('--skip-install', 'Skip installing dependencies')
    .option('--non-interactive', 'Run without user interaction')
    .allowExcessArguments(false)
    .allowUnknownOption(false)
    .action(async (options) => {
      await runAddAdapter(options)
    })

  cmd
    .command('entity')
    .description('Create an Entity in a Domain')
    .argument('<name>', 'Name of the entity (lowercase, hyphenated, e.g. user-wallet)')
    .usage(`${color.cyan('<name>')} ${color.yellow('[options]')}`)
    .option('--fields <fields>', 'Comma-separated fields (e.g. userId,address)')
    .option('--vo <id>', 'Generate a Value Object for the ID')
    .option('-d, --domain <name>', 'Target domain')
    .option('--skip-tests', 'Skip generating test file')
    .action(runAddEntity)

  cmd
    .command('feature')
    .description('Add a complete feature defined by a manifest')
    .argument('<manifest>', 'Path to feature manifest JSON or name')
    .usage(`${color.cyan('<manifest>')} ${color.yellow('[options]')}`)
    .action(runAddFeature)

  cmd
    .command('value-object')
    .alias('vo')
    .description('Create a Value Object')
    .argument('<name>', 'Name of the Value Object (e.g. UserId, Money)')
    .usage(`${color.cyan('<name>')} ${color.yellow('[options]')}`)
    .option('-d, --domain <name>', 'Target domain')
    .action(runAddValueObject)

  cmd.addCommand(createAddAppCommand())

  return cmd
}

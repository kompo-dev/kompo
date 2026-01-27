#!/usr/bin/env node

import { Command } from 'commander'

import color from 'picocolors'
import { loadEnterpriseExtensions } from '../bootstrap/load-plugins'
import { createAddCommand } from '../commands/add.command'
import { aiCommand } from '../commands/ai/ai.command'
import { createBlueprintsCommand } from '../commands/blueprints.command'
import { createCatalogCommand } from '../commands/catalog.command'
import { createDoctorCommand } from '../commands/doctor.command'
import { createInstallCommand } from '../commands/install.command'
import { createListCommand } from '../commands/list.command'
import { createNewCommand } from '../commands/new.command'
import { createRemoveCommand } from '../commands/remove.command'
import { createUpgradeCommand } from '../commands/upgrade.command'
import { createWireCommand } from '../commands/wire.command'
import { createPluginRegistry } from '../registries/plugin.registry'
import { applyHelpTheme, showHeader } from '../styles'
import { getVersion } from '../utils'
import { findRepoRoot } from '../utils/project'

async function main() {
  const program = new Command()
  // outputError is configured recursively later
  const registry = createPluginRegistry()

  // Try to find repo root and load enterprise extensions
  const cwd = process.cwd()
  const repoRoot = await findRepoRoot(cwd)
  if (repoRoot) {
    await loadEnterpriseExtensions(repoRoot)
  }

  // Setup commands
  program
    .name('kompo')
    .description('Web3 Code as a Service CLI')
    .version(getVersion())
    .option('-D, --debug', 'Show debug output')
    .showHelpAfterError(true)
    .addHelpText('beforeAll', showHeader())

  program.addCommand(createNewCommand(registry))
  program.addCommand(createInstallCommand(registry))
  program.addCommand(createAddCommand(registry))
  program.addCommand(createRemoveCommand(registry))
  program.addCommand(createListCommand(registry))
  program.addCommand(createDoctorCommand(registry))
  program.addCommand(createUpgradeCommand())
  program.addCommand(createWireCommand(registry))
  program.addCommand(createBlueprintsCommand(registry))
  program.addCommand(createCatalogCommand())
  program.addCommand(aiCommand)

  // Apply help theme to all commands
  applyHelpTheme(program)

  // Recursively apply error styling to all commands
  applyStyleRecursively(program)

  // Parse and run
  await program.parseAsync(process.argv)
}

function applyStyleRecursively(cmd: Command) {
  cmd.configureOutput({
    outputError: (str, write) => {
      const red = (s: string) => color.red(s)
      write(red(str))
    },
  })
  cmd.commands.forEach((subCmd) => {
    applyStyleRecursively(subCmd)
  })
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

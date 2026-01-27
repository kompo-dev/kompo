import { Command } from 'commander'
import color from 'picocolors'
import type { KompoPluginRegistry } from '../registries/plugin.registry'

export function createRemoveCommand(_registry: KompoPluginRegistry): Command {
  const cmd = new Command('remove')
    .alias('rm')
    .description('Remove features from your Kompo application')

  cmd
    .command('port')
    .description('Remove a port (capability)')
    .argument('<port>', 'Port to remove')
    .action(async (port) => {
      console.log(color.yellow('🚧 kompo remove port is coming soon'))
      console.log(color.dim(`Requested: ${port}`))
    })

  cmd
    .command('adapter')
    .description('Remove an adapter')
    .argument('<adapter>', 'Adapter to remove')
    .action(async (adapter) => {
      console.log(color.yellow('🚧 kompo remove adapter is coming soon'))
      console.log(color.dim(`Requested: ${adapter}`))
    })

  return cmd
}

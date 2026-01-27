import type { Argument, Command } from 'commander'
import color from 'picocolors'

export const helpTheme = {
  sortSubcommands: false,
  sortOptions: true,
  subcommandTerm: (cmd: Command) => color.cyan(cmd.name() + (cmd.alias() ? `|${cmd.alias()}` : '')),
  subcommandDescription: (cmd: Command) => color.dim(cmd.description()),
  argumentTerm: (arg: Argument) => color.cyan(arg.name()),
  argumentDescription: (arg: Argument) => color.dim(arg.description),
  optionTerm: (option: { flags: string }) => color.yellow(option.flags),
  optionDescription: (option: { description: string }) => color.dim(option.description),
  commandUsage: (cmd: Command) => color.greenBright(`${cmd.name()} ${cmd.usage()}`),
}

export function applyHelpTheme(cmd: Command) {
  cmd.configureHelp(helpTheme)
  for (const subCmd of cmd.commands) {
    applyHelpTheme(subCmd)
  }
}

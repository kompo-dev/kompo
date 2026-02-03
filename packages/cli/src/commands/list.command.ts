import { intro, log, outro } from '@clack/prompts'
import { readKompoConfig } from '@kompo/kit'
import { Command } from 'commander'
import color from 'picocolors'
import { getCapabilities } from '../registries/capability.registry'
import type { KompoPluginRegistry } from '../registries/plugin.registry'

interface ListPortOptions {
  all?: boolean
  installed?: boolean
  available?: boolean
  comingSoon?: boolean
  enterprise?: boolean
}

export function createListCommand(_registry: KompoPluginRegistry): Command {
  const cmd = new Command('list')
    .alias('ls')
    .description('List domains, ports, adapters and starters')

  cmd
    .command('domains')
    .alias('d')
    .description('List configured domains')
    .action(async () => {
      const cwd = process.cwd()
      const config = readKompoConfig(cwd)

      if (!config) {
        log.error(color.red('No kompo.config.json found. Run kompo new first.'))
        return
      }

      intro(color.bgBlueBright('🏰 Configured Domains'))

      if (!config.domains || Object.keys(config.domains).length === 0) {
        log.message('No domains found.')
        return
      }

      for (const [name, domain] of Object.entries(config.domains)) {
        log.message(color.bold(`  ${name}`))
        if (domain.useCases?.length) {
          log.message(`    Use Cases: ${color.dim(domain.useCases.length)}`, { spacing: 0 })
        }
        if (domain.ports?.length) {
          log.message(`    Ports: ${color.dim(domain.ports.length)}`, { spacing: 0 })
        }
        if (domain.entities?.length) {
          log.message(`    Entities: ${color.dim(domain.entities.length)}`, { spacing: 0 })
        }
      }
      outro(
        color.dim(
          `${Object.entries(config.domains).length} domain${Object.entries(config.domains).length === 1 ? '' : 's'} found`
        )
      )
    })

  cmd
    .command('ports')
    .alias('p')
    .description('List installed ports')
    .action(async () => {
      const cwd = process.cwd()
      const config = readKompoConfig(cwd)

      if (!config) {
        log.error(color.red('No kompo.config.json found. Run kompo new first.'))
        return
      }

      if (!config.apps && !config.domains) {
        log.error('No apps or domains configuration found')
        return
      }

      intro(color.bgBlueBright('📦 Kompo Ports Catalog'))

      let totalPorts = 0

      // 1. Installed Domain Ports (Primary)
      if (config.domains) {
        let hasPorts = false
        for (const [domainName, domain] of Object.entries(config.domains)) {
          if (domain.ports?.length > 0) {
            hasPorts = true
            log.message(color.bold(`  Domain: ${color.cyan(domainName)}`))
            for (const port of domain.ports) {
              totalPorts++
              const portName = typeof port === 'string' ? port : port.name
              const portType = typeof port === 'string' ? 'unknown' : port.type
              log.message(
                `    ${color.green('●')} ${color.green(portName.padEnd(20))} ${color.dim(portType)}`,
                { spacing: 0 }
              )
            }
            log.message()
          }
        }

        // App ports (legacy / infra)
        if (config.apps) {
          for (const [appPath, app] of Object.entries(config.apps)) {
            const portEntries = Object.entries(app.ports || {})
            // Filter out default/empty ports
            const validPorts = portEntries.filter(([k, v]) => k !== 'default' || v !== 'default')

            if (validPorts.length > 0) {
              hasPorts = true
              log.message(color.bold(`  App: ${color.cyan(appPath)}`))
              for (const [portId, adapter] of validPorts) {
                totalPorts++
                const adapterList = Array.isArray(adapter) ? adapter : [adapter]
                log.message(
                  `    ${color.green('●')} ${color.green(portId.padEnd(15))} ${color.dim(adapterList.join(', '))}`,
                  { spacing: 0 }
                )
              }
            }
          }
        }

        if (!hasPorts) {
          log.message(color.dim('  No ports installed.'))
        }
      }

      outro(color.dim(`${totalPorts} port${totalPorts === 1 ? '' : 's'} found.`))
    })

  cmd
    .command('adapters')
    .alias('a')
    .description('List installed adapters')
    .option('-a, --all', 'Show all adapters (installed, available, coming soon)')
    .option('--installed', 'Show only installed adapters')
    .option('--available', 'Show available adapters')
    .option('--coming-soon', 'Show adapters coming soon')
    .action(async (options: ListPortOptions) => {
      const cwd = process.cwd()
      const config = readKompoConfig(cwd)
      const capabilities = await getCapabilities()

      if (!config) {
        log.error(color.red('No kompo.config.json found. Run kompo new first.'))
        return
      }

      const showAll =
        options.all ||
        (!options.installed && !options.available && !options.comingSoon && !options.enterprise)
      const showInstalled =
        options.all ||
        options.installed ||
        (!options.available && !options.comingSoon && !options.enterprise)
      const showAvailable = options.all || options.available
      const showComingSoon = options.all || options.comingSoon

      intro(color.bgBlue('🔌 Installed Adapters'))

      // 1. Installed Adapters
      if (showInstalled) {
        if (!config.adapters || Object.keys(config.adapters).length === 0) {
          if (!showAll) outro(color.dim('No adapters found.'))
        } else {
          for (const [id, adapter] of Object.entries(config.adapters)) {
            log.message(`\n  ${color.cyan(id)}`, { spacing: 0 })
            log.message(`    Capability: ${color.white(adapter.port)}`, { spacing: 0 })
            log.message(`    Engine: ${color.dim(adapter.engine)}`, { spacing: 0 })
            log.message(`    Driver: ${color.dim(adapter.driver)}`, { spacing: 0 })
            log.message(`    Path: ${color.dim(adapter.path)}`, { spacing: 0 })
            log.message()
          }
        }
      }

      // 2. Available Adapters (Capabilities)
      if (showAvailable) {
        if (capabilities.length > 0) {
          log.message(color.bold('  Available Adapter Types:'))
          for (const p of capabilities) {
            if (p.status === 'coming-soon') continue
            log.message(`    ${color.cyan('○')} ${color.cyan(p.id.padEnd(15))} ${p.description}`)
            if (p.providers) {
              for (const provider of p.providers) {
                if (provider.drivers && provider.drivers.length > 0) {
                  const driverNames = provider.drivers.map((d) => d.name).join(', ')
                  log.message(`      ${color.dim(`└─ ${provider.name}: ${driverNames}`)}`)
                } else {
                  log.message(`      ${color.dim(`└─ ${provider.name}`)}`)
                }
              }
            }
          }
          log.message()
        }
      }

      // 3. Coming Soon
      if (showComingSoon) {
        const comingSoonCapabilities = capabilities.filter((c) => c.status === 'coming-soon')
        if (comingSoonCapabilities.length > 0) {
          log.message(color.bold('  Coming Soon:'))
          for (const c of comingSoonCapabilities) {
            log.message(
              `    ${color.yellow('⚠')} ${color.yellow(c.id.padEnd(15))} ${c.description || '(Planned)'}`
            )
          }
          log.message()
        }
      }

      if (showAvailable || showComingSoon) {
        outro(
          `${color.dim('Legend: ')} ${color.green('● Installed ')} ${color.cyan(
            '○ Available '
          )} ${color.yellow('⚠ Coming Soon')}`
        )
      } else {
        const count = config.adapters ? Object.keys(config.adapters).length : 0
        outro(color.dim(`${count} adapter${count === 1 ? '' : 's'} found.`))
      }
    })

  cmd
    .command('entities')
    .alias('e')
    .description('List domain entities')
    .action(async () => {
      const cwd = process.cwd()
      const config = readKompoConfig(cwd)

      if (!config) {
        log.error(color.red('No kompo.config.json found. Run kompo new first.'))
        return
      }

      intro(color.bgBlue('🧩 Domain Entities'))

      if (!config.domains || Object.keys(config.domains).length === 0) {
        outro(color.dim('No domains configured.'))
        return
      }

      let hasEntities = false
      for (const [name, domain] of Object.entries(config.domains)) {
        if (domain.entities && domain.entities.length > 0) {
          hasEntities = true
          log.message(color.bold(`  Domain: ${color.cyan(name)}`))
          for (const entity of domain.entities) {
            log.message(`    - ${entity}`, { spacing: 0 })
          }
          log.message()
        }
      }

      if (!hasEntities) {
        outro(color.dim('No entities found.'))
      } else {
        outro(color.dim('Entities listed by domain.'))
      }
    })

  cmd
    .command('use-cases')
    .alias('u')
    .alias('uc')
    .description('List use cases')
    .action(async () => {
      const cwd = process.cwd()
      const config = readKompoConfig(cwd)

      if (!config) {
        log.error(color.red('No kompo.config.json found. Run kompo new first.'))
        return
      }

      intro(color.bgBlue('⚡ Use Cases'))

      if (!config.domains || Object.keys(config.domains).length === 0) {
        outro(color.dim('No domains configured.'))
        return
      }

      let hasUseCases = false
      for (const [name, domain] of Object.entries(config.domains)) {
        if (domain.useCases && domain.useCases.length > 0) {
          hasUseCases = true
          log.message(color.bold(`  Domain: ${color.cyan(name)}`))
          for (const uc of domain.useCases) {
            log.message(`    - ${uc}`, { spacing: 0 })
          }
          log.message()
        }
      }

      if (!hasUseCases) {
        outro(color.dim('No use cases found.'))
      } else {
        outro(color.dim('Use cases listed by domain.'))
      }
    })

  cmd
    .command('starters')
    .alias('s')
    .description('List available starter templates')
    .action(async () => {
      const { listStarters, getTemplatesDir } = await import('@kompo/blueprints')
      const path = await import('node:path')

      intro(color.bgMagenta('🚀 Available Starters'))

      // 1. Get all starters using unified loader
      const starters = listStarters()

      if (starters.length === 0) {
        outro(color.dim('No starters found.'))
        return
      }

      // 2. Enrich for display (Framework / Design System derivation)
      const templatesDir = getTemplatesDir()
      const startersRoot = path.join(templatesDir, '../starters')

      // Helper to infer hierarchy from path
      const getStarterInfo = (s: (typeof starters)[0]) => {
        let framework = 'Unknown'
        let designSystem = 'Unknown'
        const template = s.name

        if (s.path) {
          // Compute relative path from starters root
          // Expected: framework/design-system/template-name/starter.json
          // s.path is the directory containing starter.json
          const rel = path.relative(startersRoot, s.path)
          const parts = rel.split(path.sep)

          if (parts.length >= 1) framework = parts[0]
          if (parts.length >= 2) designSystem = parts[1]
        }

        // Capitalize info
        const cap = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)

        return {
          ...s,
          framework: cap(framework),
          designSystem: cap(designSystem),
          template,
        }
      }

      const enrichedStarters = starters.map(getStarterInfo)

      // 3. Group by Template Name -> Design System -> Framework
      // Structure: { templateName: { designSystem: { framework: starter } } }
      const grouped: Record<
        string,
        Record<string, Record<string, (typeof enrichedStarters)[0]>>
      > = {}

      for (const s of enrichedStarters) {
        // Extract template name from path (last directory before starter.json)
        const templateName = s.template.toLowerCase()
        const ds = s.designSystem.toLowerCase()
        const fw = s.framework.toLowerCase()

        if (!grouped[templateName]) grouped[templateName] = {}
        if (!grouped[templateName][ds]) grouped[templateName][ds] = {}
        grouped[templateName][ds][fw] = s
      }

      // 4. Display - Template first, then design systems, then frameworks
      const cap = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)

      for (const [templateName, designSystems] of Object.entries(grouped)) {
        // Get any starter for description (they should be similar across variants)
        const anyStarter = Object.values(Object.values(designSystems)[0])[0]
        const desc = anyStarter.description ? color.dim(` - ${anyStarter.description}`) : ''

        log.message(color.bold(`\n  ${color.green(cap(templateName))}${desc}`))

        for (const [ds, frameworks] of Object.entries(designSystems)) {
          const fwList = Object.keys(frameworks).map((fw) => cap(fw))
          const fwDisplay = fwList.map((fw) => color.cyan(fw)).join(' │ ')

          // Build the full IDs for each framework
          const ids = Object.entries(frameworks)
            .map(([_, s]) => color.blue(s.id))
            .join(', ')

          log.message(`    └─ ${color.yellow(cap(ds))} → ${fwDisplay}`, { spacing: 0 })
          log.message(`       ${color.dim(`IDs: ${ids}`)}`, { spacing: 0 })
        }
      }

      outro(`${starters.length} starters found. Use: ${color.blue('kompo new -t <id>')}`)
    })

  return cmd
}

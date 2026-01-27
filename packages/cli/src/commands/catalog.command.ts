import { Command } from 'commander'
import { generateCatalog } from './catalog/generate.command'

export function createCatalogCommand() {
  const catalog = new Command('catalog').description('Manage kompo.catalog.json')

  catalog
    .command('generate')
    .description('Generate or regenerate kompo.catalog.json with default versions')
    .action(async () => {
      await generateCatalog()
    })

  return catalog
}

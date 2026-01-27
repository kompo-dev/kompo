import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { confirm, intro, outro, spinner } from '@clack/prompts'
import { findRepoRoot } from '../../utils/project'

export async function generateCatalog() {
  intro('Generating kompo.catalog.json')

  const s = spinner()
  s.start('Checking workspace')

  const cwd = process.cwd()
  const rootDir = await findRepoRoot(cwd)

  if (!rootDir) {
    s.stop('Checking workspace')
    console.error('❌ Could not find repository root. Are you in a Kompo project?')
    process.exit(1)
  }

  const catalogPath = join(rootDir, 'kompo.catalog.json')

  s.stop('Checking workspace')

  if (existsSync(catalogPath)) {
    const shouldOverwrite = await confirm({
      message:
        'kompo.catalog.json already exists. Do you want to overwrite it with default values?',
      initialValue: false,
    })

    if (!shouldOverwrite) {
      outro('Operation cancelled')
      return
    }
  }

  s.start('Writing catalog file')

  try {
    const { regenerateCatalog } = await import('../../utils/catalog.utils')
    const result = await regenerateCatalog(rootDir)

    s.stop('Catalog regenerated')
    outro(
      `Successfully regenerated kompo.catalog.json from ${result?.sourceCount || 'unknown'} sources.`
    )
  } catch (error) {
    s.stop('Failed to regenerate catalog')
    console.error(error)
    process.exit(1)
  }
}

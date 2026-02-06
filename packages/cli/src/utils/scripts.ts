import path from 'node:path'
import { log } from '@clack/prompts'
import color from 'picocolors'
import { createFsEngine } from '../engine/fs-engine'

export async function addPackageScript(repoRoot: string, scripts: Record<string, string>) {
  const fs = createFsEngine()
  const pkgPath = path.join(repoRoot, 'package.json')

  if (!(await fs.fileExists(pkgPath))) {
    return
  }

  const pkg = await fs.readJson<any>(pkgPath)
  if (!pkg.scripts) {
    pkg.scripts = {}
  }

  let added = false
  for (const [key, value] of Object.entries(scripts)) {
    if (pkg.scripts[key] !== value) {
      pkg.scripts[key] = value
      added = true
    }
  }

  if (added) {
    await fs.writeJson(pkgPath, pkg)
    // Optional: Log explicitly? Or keep it silent/stepped
    log.step(color.green(`Updated root scripts: ${Object.keys(scripts).join(', ')}`))
  }
}

import { Eta } from 'eta'

export async function mergeBlueprintScripts(
  repoRoot: string,
  blueprintPath: string,
  context: Record<string, any> = {}
) {
  try {
    const { getTemplatesDir } = await import('@kompo/blueprints')
    const blueprintDir = path.join(getTemplatesDir(), blueprintPath)
    const fs = createFsEngine()

    // 1. Check for snippets/root-scripts.eta
    const templatePath = path.join(blueprintDir, 'snippets', 'root-scripts.eta')

    if (await fs.fileExists(templatePath)) {
      const templateContent = await fs.readFile(templatePath)
      const eta = new Eta({ views: path.join(blueprintDir, 'snippets') })

      try {
        // Render template with context
        const rendered = eta.renderString(templateContent, context)
        // Parse as JSON
        const scripts = JSON.parse(rendered)

        await addPackageScript(repoRoot, scripts)
      } catch (e) {
        log.warn(`Failed to process root-scripts.eta for ${blueprintPath}: ${e}`)
      }
    }
  } catch (_error) {
    // Fail silently on script merging to avoid blocking main flow
  }
}

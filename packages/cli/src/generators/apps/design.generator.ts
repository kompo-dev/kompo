import path from 'node:path'
import { intro, log, outro } from '@clack/prompts'
import { LIBS_DIR } from '@kompo/kit'
import { createFsEngine } from '../../engine/fs-engine'
import type { DesignSystemId } from '../../utils/design-systems'
import { getTemplateEngine } from '../../utils/project'

export interface DesignGeneratorContext {
  targetDir: string
  designSystem: DesignSystemId
  scope: string
  blueprintPath?: string
}

export async function generateDesignSystem(ctx: DesignGeneratorContext) {
  const { targetDir, designSystem, scope } = ctx

  if (designSystem === 'vanilla') {
    return
  }

  intro(`Setting up design system: ${designSystem}`)

  const fs = createFsEngine()
  const templates = await getTemplateEngine(ctx.blueprintPath)

  // Get repo root (parent of apps/)
  // targetDir is usually .../apps/app-name
  const repoRoot = path.dirname(path.dirname(targetDir))
  const libsDir = LIBS_DIR
  const libsUiDir = path.join(repoRoot, libsDir, 'ui')

  // Render templates
  // Template path: libs/ui/${designSystem}
  const templatePath = path.join('libs', 'ui', designSystem)
  const specificUiDir = path.join(libsUiDir, designSystem)

  if (
    (await templates.exists(path.join(templatePath, 'files'))) &&
    !(await fs.fileExists(path.join(specificUiDir, 'package.json')))
  ) {
    await templates.renderDir(
      path.join(templatePath, 'files'),
      libsUiDir,
      { scope },
      { merge: false }
    )
  } else if (!(await templates.exists(templatePath))) {
    // For design systems without shared templates (like MUI), skip shared UI generation
    log.warn(`No shared UI template found for ${designSystem}, skipping...`)
  }

  // Check for workspace-scripts snippet in blueprint
  outro(`Design system ${designSystem} setup complete!`)
}

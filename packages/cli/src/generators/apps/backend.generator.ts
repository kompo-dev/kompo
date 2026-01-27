import path from 'node:path'
import { intro, outro, spinner } from '@clack/prompts'
import { LIBS_DIR } from '@kompo/kit'
import { createFsEngine } from '../../engine/fs-engine'
import { mergeWithGlobals } from '../../utils/global-variables'
import { getTemplateEngine } from '../../utils/project'

export interface BackendGeneratorContext {
  backend: 'express' | 'nextjs'
  backendAppName: string
  scope: string
  cwd: string
  blueprintPath?: string
}

export async function generateBackend(ctx: BackendGeneratorContext) {
  const { backend, backendAppName, scope, cwd } = ctx
  if (!backendAppName) return // Should not happen if confirmed

  const s = spinner()
  const fs = createFsEngine()
  const templates = await getTemplateEngine(ctx.blueprintPath)

  intro(`Setting up backend: ${backend}`)

  const backendDir = path.join(cwd, 'apps', backendAppName)
  const packageName = `@${scope}/${backendAppName}`

  // 1. Create Structure
  s.start('Creating backend structure')

  if (backend === 'express') {
    await fs.ensureDir(path.join(backendDir, 'src/routes'))
    await fs.ensureDir(path.join(backendDir, 'src/middleware'))
    await fs.ensureDir(path.join(backendDir, 'src/controllers'))
  }

  s.stop('Creating backend structure')

  // 2. Create Files
  s.start('Generating backend files')

  // Template path: new/backend/${backend}
  const templateData = mergeWithGlobals({
    packageName,
    projectName: backendAppName,
    scope,
  })

  // Check for composed app structure (e.g. Next.js which has base + design-systems)
  const baseTemplateDir = `shared/apps/${backend}`
  if (await templates.exists(baseTemplateDir)) {
    // 1. Render Base
    await templates.renderDir(baseTemplateDir, backendDir, templateData)

    // 2. Render specific parts for backend (Next.js needs package.json from design-system)
    // NO: We now have a package.json in apps/nextjs/base so we don't need to force a design system.
    // This keeps the backend clean of UI dependencies.

    // 3. Cleanup libs directory if it was copied from template
    // It should only exist at workspace root, not app root
    const { rm } = await import('node:fs/promises')
    const libsInApp = path.join(backendDir, LIBS_DIR)
    await rm(libsInApp, { recursive: true, force: true }).catch(() => {})
    // Legacy cleanup
    const sharedInApp = path.join(backendDir, 'libs')
    await rm(sharedInApp, { recursive: true, force: true }).catch(() => {})
  } else {
    // Flat structure (Express, NestJS)
    await templates.renderDir(`apps/${backend}`, backendDir, templateData)
  }

  s.stop('Generating backend files')

  outro(`Backend ${backend} setup complete!`)
}

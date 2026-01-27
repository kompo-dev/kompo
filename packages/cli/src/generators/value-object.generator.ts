import path from 'node:path'
import color from 'picocolors'
import { createFsEngine } from '../engine/fs-engine'
import { toPascalCase } from '../utils'
import { registerValueObject } from '../utils/config'
import { syncDomainIndex } from '../utils/domain'
import { getDomainPath, getTemplateEngine } from '../utils/project'

interface GenerateValueObjectOptions {
  voName: string
  parentEntityName: string // e.g. "user" or "user-profile"
  domain: string
  repoRoot: string
  quiet?: boolean
}

import { DOMAIN_BLUEPRINT_SRC } from '../constants/blueprints'

export async function generateValueObject(options: GenerateValueObjectOptions) {
  const { voName, parentEntityName, domain, repoRoot, quiet = false } = options

  const fs = createFsEngine()
  const templates = await getTemplateEngine()

  const domainDir = await getDomainPath(repoRoot, domain)
  // VOs are typically in entities/<entity>/value-objects/<VoName>.ts
  const entityDir = path.join(domainDir, 'entities', parentEntityName)
  // Wait, if we enforce nested entities (Section 3 of refactor plan), entityDir is .../entities/parent/
  // Default entity generator in plan says nested. So yes.

  const voDir = path.join(entityDir, 'value-objects')
  await fs.ensureDir(voDir)

  const voPascal = toPascalCase(voName)
  const voFilename = `${voPascal}.ts`
  const voFile = path.join(voDir, voFilename)

  if (await fs.fileExists(voFile)) {
    if (!quiet) console.log(color.yellow(`ℹ️  Value Object ${voPascal} already exists. Skipping.`))
    return
  }

  await templates.renderFile(
    `${DOMAIN_BLUEPRINT_SRC}/entities/value-object.eta`,
    voFile,
    {
      name: voPascal,
      factoryName: `create${voPascal}`,
    },
    { merge: true }
  )

  if (!quiet) {
    console.log(color.green(`⚡ Value Object ${voPascal} created`))
  }

  // Update config
  registerValueObject(repoRoot, domain, parentEntityName, voName)

  // Sync index (VOs are usually exported by entity index, but we sync domain index just in case or for consistency)
  await syncDomainIndex(repoRoot, domain)
}

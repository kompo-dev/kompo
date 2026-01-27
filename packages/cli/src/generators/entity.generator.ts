import path from 'node:path'
import { log } from '@clack/prompts'
import color from 'picocolors'
import { createFsEngine } from '../engine/fs-engine'
import { toKebabCase, toPascalCase } from '../utils'
import { registerEntity } from '../utils/config'
import { syncDomainIndex } from '../utils/domain'
import { getDomainPath, getTemplateEngine } from '../utils/project'
import { generateValueObject } from './value-object.generator'

interface GenerateEntityOptions {
  entityName: string
  domain: string
  repoRoot: string
  fields?: string[]
  vo?: string
  skipTests?: boolean
  quiet?: boolean
  blueprintPath?: string
}

import { DOMAIN_BLUEPRINT_SRC } from '../constants/blueprints'

export async function generateEntity(options: GenerateEntityOptions) {
  let {
    entityName,
    domain,
    repoRoot,
    fields = [],
    vo,
    skipTests = false,
    quiet = false,
    blueprintPath,
  } = options

  // Normalize to kebab-case
  entityName = toKebabCase(entityName)

  const fs = createFsEngine()
  const templates = await getTemplateEngine(blueprintPath)

  const domainDir = await getDomainPath(repoRoot, domain)
  // Strict nesting: entities/<name>/<name>.entity.ts
  const entityDir = path.join(domainDir, 'entities', entityName)
  const entityFile = path.join(entityDir, `${entityName}.entity.ts`)

  await fs.ensureDir(entityDir)

  // VO Logic
  let idType = 'string'
  let idValue = 'uuid()'
  let voImport = false
  let voType = ''
  let voFactory = ''
  let voFile = ''

  if (vo) {
    const voName = toPascalCase(vo)
    // Delegate to VO generator
    await generateValueObject({
      voName,
      parentEntityName: entityName,
      domain,
      repoRoot,
      quiet,
    })

    idType = voName
    idValue = `create${voName}(uuid())`
    voImport = true
    voType = voName
    voFactory = `create${voName}`
    voFile = voName
  }

  await templates.renderFile(
    `${DOMAIN_BLUEPRINT_SRC}/entities/entity.eta`,
    entityFile,
    {
      name: entityName,
      pascalName: toPascalCase(entityName),
      pName: toPascalCase(entityName), // Ensure pName is available
      camelName: `create${toPascalCase(entityName)}`,
      fields,
      idType,
      idValue,
      voImport,
      voType,
      voFactory,
      voFile,
      domain,
    },
    { merge: true }
  )

  // Test generation
  if (!skipTests) {
    const testFile = path.join(entityDir, `${entityName}.entity.test.ts`)
    const testContent = await templates.render(`${DOMAIN_BLUEPRINT_SRC}/entities/entity.test.eta`, {
      name: entityName,
      pascalName: toPascalCase(entityName),
      fields,
    })

    if (!(await fs.fileExists(testFile))) {
      await fs.writeFile(testFile, testContent)
    }
  }

  // Update config
  registerEntity(repoRoot, domain, entityName)

  // Domain Index Update
  await syncDomainIndex(repoRoot, domain)

  if (!quiet) {
    log.success(color.green(`⚡ Entity: ${entityName}`))
    log.info(
      `created in ${color.blue(`domains/${domain}/entities/${entityName}/${entityName}.entity.ts`)}`
    )
  }
}

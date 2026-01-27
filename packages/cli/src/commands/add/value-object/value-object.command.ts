import path from 'node:path'
import { cancel, isCancel, log, select } from '@clack/prompts'
import { LIBS_DIR, readKompoConfig } from '@kompo/kit'
import color from 'picocolors'
import { createFsEngine } from '../../../engine/fs-engine'
import { toPascalCase } from '../../../utils'
import { runFormat } from '../../../utils/format'
import {
  ensureProjectContext,
  getDomainPath,
  getDomains,
  getTemplateEngine,
} from '../../../utils/project'
import { validateValueObjectName } from '../../../validations/naming.validation'

export async function runAddValueObject(
  voName: string,
  options: { domain?: string; quiet?: boolean } = {}
) {
  const cwd = process.cwd()
  const { repoRoot } = await ensureProjectContext(cwd)

  const error = validateValueObjectName(voName)
  if (error) {
    console.error(color.red(`✗ ${error}`))
    process.exit(1)
  }

  const domains = await getDomains(repoRoot)
  if (domains.length === 0) {
    console.error(color.red('✗ No domains found.'))
    process.exit(1)
  }

  let domain = options.domain
  if (domain) {
    if (!domains.includes(domain)) {
      console.error(color.red(`✗ Domain "${domain}" not found.`))
      console.log(color.dim(`Available domains: ${domains.join(', ')}`))
      process.exit(1)
    }
  } else {
    const response = await select({
      message: 'Select domain:',
      options: domains.map((d) => ({ label: d, value: d })),
    })

    if (isCancel(response)) {
      cancel('Operation cancelled.')
      process.exit(0)
    }
    domain = response as string
  }

  if (!domain) process.exit(1)

  const fs = createFsEngine()
  const templates = await getTemplateEngine()

  const domainDir = await getDomainPath(repoRoot, domain)
  // Value Objects usually live in 'entities/value-objects' or shared 'value-objects'?
  // Based on entity.command.ts: entities/{entityName}/value-objects
  // BUT a standalone VO might not belong to a specific entity folder yet.
  // Standard Hexagonal: maybe just 'domain/value-objects'?
  // Let's ask: "Is this VO generic for the domain, or attached to a specific Entity?"
  // IF generic: domains/xyz/value-objects/VoName.ts
  // IF entity: domains/xyz/entities/EntityName/value-objects/VoName.ts

  // For simplicity and "Connected Graph", let's offer:
  // 1. Generic (Domain Root)
  // 2. Attached to existing Entity
  // 3. Shared Kernel (Global)

  const entities = readKompoConfig(repoRoot)?.domains?.[domain]?.entities || []
  let targetDir = path.join(domainDir, 'value-objects')

  // Prepare options
  const scopeOptions = [
    { label: 'Domain Shared (domains/src/value-objects)', value: 'domain-shared' },
    { label: `Global Shared Kernel (${LIBS_DIR}/kernel)`, value: 'global-shared' },
  ]

  if (entities.length > 0) {
    scopeOptions.push(...entities.map((e) => ({ label: `Entity: ${e}`, value: e })))
  }

  const scopeResponse = await select({
    message: 'Where should this Value Object live?',
    options: scopeOptions,
  })

  if (isCancel(scopeResponse)) {
    process.exit(0)
  }

  if (scopeResponse === 'global-shared') {
    targetDir = path.join(repoRoot, LIBS_DIR, 'kernel', 'src')

    const { generateKernel } = await import('../../../generators/kernel.generator')
    await generateKernel(repoRoot)
  } else if (scopeResponse !== 'domain-shared') {
    targetDir = path.join(domainDir, 'entities', scopeResponse as string, 'value-objects')
  }

  // Ensure target dir exists
  await fs.ensureDir(targetDir)

  const voPascal = toPascalCase(voName)
  const voFilename = `${voPascal}.ts`
  const voFile = path.join(targetDir, voFilename)

  if (await fs.fileExists(voFile)) {
    log.error(color.red(`✗ Value Object ${voPascal} already exists in ${targetDir}`))
    process.exit(1)
  }

  const content = await templates.render('domains/entities/value-object.eta', {
    name: voPascal,
    factoryName: `create${voPascal}`,
  })

  await fs.writeFile(voFile, content)

  if (!options.quiet) {
    log.success(color.green(`⚡ Value Object: ${voPascal}`))
    log.info(`created in ${color.blue(path.relative(repoRoot, voFile))}`)
  }

  runFormat(repoRoot)
}

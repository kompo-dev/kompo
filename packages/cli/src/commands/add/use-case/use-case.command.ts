import path from 'node:path'
import { cancel, confirm, isCancel, log, multiselect, select, text } from '@clack/prompts'
import { readKompoConfig } from '@kompo/kit'
import type { Command } from 'commander'
import color from 'picocolors'
import { createFsEngine } from '../../../engine/fs-engine'
import { generateUseCase } from '../../../generators/use-case.generator'
import { toCamelCase, toKebabCase, toPascalCase } from '../../../utils'
import { runFormat } from '../../../utils/format'
import { ensureProjectContext, getDomainPath, getDomains } from '../../../utils/project'
import {
  createKebabCaseValidator,
  validateUseCaseName,
} from '../../../validations/naming.validation'
import { runAddEntity } from '../entity/entity.command'
import { runAddPort } from '../port/port.command'

export async function runAddUseCase(
  useCaseName: string,
  options: { domain?: string; quiet?: boolean; nonInteractive?: boolean } = {}
) {
  const cwd = process.cwd()

  try {
    useCaseName = await validateUseCaseName(useCaseName)
  } catch (error) {
    if (error instanceof Error) {
      console.error(color.red(`✗ ${error.message}`))
    }
    process.exit(1)
  }

  const { repoRoot } = await ensureProjectContext(cwd)

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

  const domainDir = await getDomainPath(repoRoot, domain)
  const ucDir = path.join(domainDir, 'use-cases', useCaseName)

  await fs.ensureDir(ucDir)

  const injectedImports: string[] = []
  const injectedDependencies: string[] = []

  if (options.nonInteractive) {
    await generateUseCase({
      useCaseName,
      domain,
      repoRoot,
      injectedImports,
      injectedDependencies,
      quiet: options.quiet,
    })
    runFormat(repoRoot as string)
    return
  }

  // --- Connected Graph: Smart Suggestions ---
  const conf = readKompoConfig(repoRoot)
  const existingEntities = conf?.domains?.[domain]?.entities || []

  // 1. Analyze Use Case Name (e.g. register-user -> user)
  const parts = useCaseName.split('-')
  const potentialEntity = parts.length > 1 ? parts[parts.length - 1] : parts[0]
  const entityPascal = toPascalCase(potentialEntity)

  if (!existingEntities.includes(toKebabCase(potentialEntity))) {
    const shouldCreateEntity = await confirm({
      message: `Use Case '${color.cyan(useCaseName)}' likely implies Entity '${entityPascal}'. Create it?`,
      initialValue: true,
    })

    if (!isCancel(shouldCreateEntity) && shouldCreateEntity) {
      log.message(color.blueBright(`🔗 Triggering Entity Creation for ${potentialEntity}...`))
      await runAddEntity(potentialEntity, { domain }, {} as Command)
    }
  }

  // 2. Propose Capabilities (Ports)
  const domainPorts = conf?.domains?.[domain]?.ports || []
  if (domainPorts.length > 0) {
    log.message(color.dim(`Existing Ports in '${color.cyanBright(domain)}':`))
    domainPorts.forEach((p) => {
      const pName = typeof p === 'string' ? p : p.name
      const pType = typeof p === 'string' ? '?' : p.type
      log.message(color.dim(` - ${color.cyanBright(pName)} (${pType})`))
    })
  }

  const shouldAddPort = await confirm({
    message: `Does '${color.cyan(useCaseName)}' require a ${color.yellow('NEW')} Port (e.g. Gateway, Notifier)?`,
    initialValue: false,
  })

  if (!isCancel(shouldAddPort) && shouldAddPort) {
    const pName = await text({
      message: 'Enter Port Subject (e.g. "wallet", "nft", "payment") - Suffix determined by Type:',
      validate: createKebabCaseValidator('Port Subject'),
    })

    if (!isCancel(pName)) {
      await runAddPort(pName as string, { domain, autoWire: false })
    }
  }

  // --- Inter-domain Injection ---
  const otherDomains = Object.keys(conf?.domains || {}).filter((d) => d !== domain)
  const availableExternalPorts: { label: string; value: { domain: string; port: string } }[] = []

  otherDomains.forEach((d) => {
    const dPorts = conf?.domains?.[d]?.ports || []
    dPorts.forEach((p) => {
      const pName = typeof p === 'string' ? p : p.name
      availableExternalPorts.push({
        label: `${d} : ${pName}`,
        value: { domain: d, port: pName },
      })
    })
  })

  if (availableExternalPorts.length > 0) {
    const selectedExternalPorts = await multiselect({
      message: 'Inject services from OTHER domains? (Shared Kernel / Inter-domain)',
      options: availableExternalPorts,
      required: false,
    })

    if (isCancel(selectedExternalPorts)) {
      cancel('Operation cancelled.')
      process.exit(0)
    }

    const selected = selectedExternalPorts as { domain: string; port: string }[]

    selected.forEach((item) => {
      injectedImports.push(`import { ${item.port} } from '@org/domains/${item.domain}'`)
      injectedDependencies.push(`${toCamelCase(item.port)}: ${item.port}`)
    })
  }

  // --- Rendering ---
  await generateUseCase({
    useCaseName,
    domain,
    repoRoot,
    injectedImports,
    injectedDependencies,
    quiet: options.quiet,
  })

  // generateUseCase handles logging, file creation, test creation, config update, and index update.
  runFormat(repoRoot as string)
}

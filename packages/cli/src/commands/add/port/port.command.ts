import path from 'node:path'
import { cancel, confirm, isCancel, log, note, select, text } from '@clack/prompts'
import { PORT_DEFINITIONS, readKompoConfig } from '@kompo/kit'
import color from 'picocolors'
import { Project, SyntaxKind } from 'ts-morph'
import { createFsEngine } from '../../../engine/fs-engine'
import { generateDomain } from '../../../generators/domain.generator'
import { generatePort } from '../../../generators/port.generator'
import { toPascalCase } from '../../../utils'
import { runFormat } from '../../../utils/format'
import { ensureProjectContext, getDomainPath, getDomains } from '../../../utils/project'
import {
  createKebabCaseValidator,
  createPortNameValidator,
  validatePortName,
} from '../../../validations/naming.validation'
import { runAddAdapter } from '../adapter/adapter.command'

export async function runAddPort(
  portName?: string,
  options: {
    skipTests?: boolean
    domain?: string
    type?: string
    quiet?: boolean
    autoWire?: boolean
    nonInteractive?: boolean
    skipAdapterPrompt?: boolean
  } = {}
): Promise<{ domain: string; portName: string } | undefined> {
  const cwd = process.cwd()
  const { repoRoot } = await ensureProjectContext(cwd)

  // 1. Resolve Domain First
  let domain = options.domain
  const domains = await getDomains(repoRoot)

  // Interactive Domain Selection
  if (!domain && !options.nonInteractive) {
    if (domains.length === 0) {
      // Auto-create domain flow for empty project
      const newDomain = await text({
        message: 'Domain name:',
        validate: createKebabCaseValidator('Domain name'),
      })

      if (isCancel(newDomain)) {
        cancel('Operation cancelled.')
        process.exit(0)
      }
      domain = newDomain as string

      // Auto-create domain logic...
      const config = readKompoConfig(repoRoot)

      if (!config?.project?.org) {
        log.error('Organization name (scope) is missing in kompo.config.json')
        process.exit(1)
      }

      await generateDomain({
        domainName: domain,
        scope: config.project.org,
        repoRoot,
        skipEntity: true,
        skipUseCase: true,
        entityName: domain,
        portName: '',
        ucName: domain,
      })
      log.success(`Domain ${domain} created.`)
      domains.push(domain)
    } else {
      const domainOptions: { label: string; value: string }[] = domains.map((d) => ({
        label: d,
        value: d,
      }))
      domainOptions.unshift({
        label: color.green('+ Create New Domain'),
        value: 'CREATE_NEW',
      })

      const response = await select({
        message: 'Select domain:',
        options: domainOptions,
      })
      if (isCancel(response)) process.exit(0)

      if (response === 'CREATE_NEW') {
        const newDomain = await text({
          message: 'Domain name:',
          validate: createKebabCaseValidator('Domain name'),
        })

        if (isCancel(newDomain)) {
          cancel('Operation cancelled.')
          process.exit(0)
        }
        domain = newDomain as string

        const config = readKompoConfig(repoRoot)

        if (!config?.project?.org) {
          log.error('Organization name (scope) is missing in kompo.config.json')
          process.exit(1)
        }

        await generateDomain({
          domainName: domain,
          scope: config.project.org,
          repoRoot,
          skipEntity: true,
          skipUseCase: true,
          entityName: domain,
          portName: '',
          ucName: domain,
        })
        log.success(`Domain ${domain} created.`)
        domains.push(domain)
      } else {
        domain = response as string
      }
    }
  } else if (!domain && domains.length > 0) {
    // Non-interactive fallback
    domain = domains[0]
  }

  // Auto-create domain if specified but missing
  if (domain && !domains.includes(domain)) {
    // ... (logic to create if forced? or fail. keeping fail for strictness)
    log.error(color.red(`✗ Domain "${domain}" not found.`))
    process.exit(1)
  }

  if (!domain) process.exit(1)

  // 2. Resolve Port Type
  let portType = options.type
  if (!portType) {
    if (options.nonInteractive) {
      portType = 'other'
    } else {
      const typeResponse = await select({
        message: 'Select Port Type:',
        options: PORT_DEFINITIONS.map((def) => ({
          label: def.icon ? `${def.icon} ${def.label}` : def.label,
          value: def.value,
          hint: def.hint,
        })),
        initialValue: 'other',
      })
      if (isCancel(typeResponse)) process.exit(0)
      portType = typeResponse as string
    }
  }

  // 3. Resolve Port Name (with Smart Suffix Strategy)
  const portDefinition = PORT_DEFINITIONS.find((p) => p.value === portType)
  const suffix = portDefinition?.suffix

  // If provided strictly as arg
  let finalPortName = portName

  if (!finalPortName) {
    if (options.nonInteractive) {
      throw new Error('Port name required in non-interactive mode')
    }

    if (suffix) {
      const msgNote = `${color.reset(`Suffix ${color.greenBright(suffix)} will be added automatically.`)}
${color.reset(`Example: Input ${color.yellowBright(domain)} → Port Name will be ${color.greenBright(`${domain}-${suffix}`)}`)}`
      note(msgNote, color.bgBlue(' Info '))
    }

    const nameResponse = await text({
      withGuide: true,
      message: suffix ? 'Port Name (prefix)' : 'Port Name:',
      placeholder: domain,
      defaultValue: domain,
      validate: createPortNameValidator({ defaultValue: domain }),
    })

    if (isCancel(nameResponse)) process.exit(0)
    finalPortName = (nameResponse as string) || domain
  }

  validatePortName(finalPortName, /^[a-z0-9-]+$/, 'Port')

  // Apply suffix rule automatically
  if (suffix && !finalPortName.endsWith(`-${suffix}`)) {
    const suggestedName = `${finalPortName}-${suffix}`
    finalPortName = suggestedName

    if (!options.nonInteractive) {
      log.info(color.dim(`Auto-suffixed port name to: ${color.cyan(finalPortName)}`))
    }
  }

  const fs = createFsEngine()

  // Create file
  const domainDir = await getDomainPath(repoRoot, domain)
  const portDir = path.join(domainDir, 'ports', finalPortName)
  const portFile = path.join(portDir, `${finalPortName}.port.ts`) // e.g. user-repository.port.ts

  await fs.ensureDir(portDir)

  // ... (Existing implementation for file existence check / automatic method addition)
  if (await fs.fileExists(portFile)) {
    log.warning(color.yellow(`Port ${finalPortName} already exists in ${domain}`))
    // Simplified logic: Just exit or support method addition logic from before
    // Keeping method addition logic but ensuring it uses finalPortName
    const shouldAddMethod = options.nonInteractive
      ? false
      : await confirm({
          message: 'Do you want to add a new capability (method) to this port?',
          initialValue: true,
        })

    if (isCancel(shouldAddMethod) || !shouldAddMethod) {
      // If we don't add a method, maybe we still want to add an adapter?
      // Let's fall through to wiring check if user just wants to re-run wiring for existing port
    } else {
      const methodName = await text({
        message: 'Method Name (e.g. delete):',
        validate: (val) => (!val ? 'Required' : undefined),
      })
      if (isCancel(methodName)) process.exit(0)

      const args = await text({
        message: 'Arguments (e.g. id: string):',
        initialValue: '',
      })
      if (isCancel(args)) process.exit(0)

      const returnType = await text({
        message: 'Return Type:',
        initialValue: 'Promise<void>',
      })
      if (isCancel(returnType)) process.exit(0)

      try {
        const project = new Project()
        const sourceFile = project.addSourceFileAtPath(portFile)
        const portPascal = toPascalCase(finalPortName)
        const portTypeAlias = sourceFile.getTypeAlias(portPascal)

        if (!portTypeAlias) {
          log.error(`Could not find type alias ${portPascal} in ${portFile}`)
          process.exit(1)
        }

        const typeNode = portTypeAlias.getTypeNode()
        if (typeNode?.isKind(SyntaxKind.TypeLiteral)) {
          typeNode.addMember(`${methodName as string}(${args as string}): ${returnType as string};`)
          sourceFile.saveSync()
          log.success(`Added method ${methodName} to ${finalPortName}`)
          runFormat(repoRoot as string)
          // Continue to wiring check
        } else {
          log.error(`Port type is not a TypeLiteral, cannot add member automatically.`)
          process.exit(1)
        }
      } catch (e) {
        log.error(`Failed to update port: ${e}`)
        process.exit(1)
      }
    }
  } else {
    // Only generate if does not exist
    await generatePort({
      portName: finalPortName,
      domain,
      repoRoot,
      portType,
      skipTests: options.skipTests,
      quiet: options.quiet,
    })
  }

  // Config update, logging, and index update handled by generator.
  // Method addition logic above handles existing files.

  // --- Auto-Wiring Strategy ---
  // Prompt to generate adapter immediately
  if (options.nonInteractive) {
    return { domain, portName: finalPortName }
  }

  let shouldWire = options.autoWire

  if (!shouldWire && !options.skipAdapterPrompt) {
    shouldWire = (await confirm({
      message: `Would you like to generate an Adapter for '${finalPortName}' now?`,
      initialValue: true,
    })) as boolean
  }

  if (!isCancel(shouldWire) && shouldWire) {
    log.info(color.blueBright(`🔌 Launching Adapter Wizard for ${finalPortName}...`))
    // Call runAddAdapter
    // We need to resolve basic adapter options if possible
    // But runAddAdapter usually prompts. We just seed it with the port.
    await runAddAdapter({
      port: finalPortName,
      allowedCapabilities: portDefinition?.capabilities,
      domain,
      // We don't force driver/app, let the user choose in the wizard
    })
  }

  runFormat(repoRoot as string)
  return { domain, portName: finalPortName }
}

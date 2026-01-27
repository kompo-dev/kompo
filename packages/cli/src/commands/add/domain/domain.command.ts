import { confirm, intro, isCancel, log, outro, select, spinner, text } from '@clack/prompts'
import { LIBS_DIR, writeKompoConfig } from '@kompo/kit'
import { Command } from 'commander'
import color from 'picocolors'
import { createFsEngine } from '../../../engine/fs-engine'
import { generateDomain } from '../../../generators/domain.generator'
import { runFormat } from '../../../utils/format'
import { ensureProjectContext, getDomainPath } from '../../../utils/project'
import { toPascalCase } from '../../../utils/string'
import {
  createKebabCaseValidator,
  validateEntityName,
  validateKebabCase,
  validateValueObjectName,
} from '../../../validations/naming.validation'
import { runAddAdapter } from '../adapter/adapter.command'
import { runAddEntity } from '../entity/entity.command'
import { runAddPort } from '../port/port.command'
import { runAddUseCase } from '../use-case/use-case.command'
import { runAddValueObject } from '../value-object/value-object.command'

export function createAddDomainCommand(): Command {
  const cmd = new Command('domain')
    .description('Create a new Domain')
    .argument('<name>', 'Name of the domain (lowercase, hyphenated, e.g. my-domain)')
    .option('-e, --skip-entity', 'Skip adding a default entity to the domain')
    .option('-a, --app <name>', 'Target app to inject domain dependency into')
    .action(runAddDomain)
  return cmd
}

export async function runAddDomain(
  domainName: string,
  options: { skipEntity?: boolean; app?: string; nonInteractive?: boolean },
  command: Command
) {
  const error = validateKebabCase(domainName, 'Domain name')
  if (error) {
    log.error(color.red(`✗ ${error}`))
    command.help()
  }

  const cwd = process.cwd()
  const { repoRoot, config } = await ensureProjectContext(cwd)

  const fs = createFsEngine()
  const domainDir = await getDomainPath(repoRoot, domainName)
  // Check existence EARLY
  if (await fs.fileExists(domainDir)) {
    const libsDir = LIBS_DIR
    log.error(color.red(`✗ Domain ${domainName} already exists`))
    log.message(`Look for domains in ${color.blueBright(`/${libsDir}/domains/src`)} directory.`)
    process.exit(1)
  }

  intro(color.bgBlue(color.white(`⚡ Creating new domain: ${domainName}`)))

  // --- Step 1: Scaffold Domain ---
  const s = spinner()
  s.start('Initializing Domain Structure')

  // Update config
  if (!config.domains) config.domains = {}
  if (!config.domains[domainName]) {
    config.domains[domainName] = {
      ports: [],
      useCases: [],
      entities: [],
    }
  }
  writeKompoConfig(repoRoot, config)

  // Generate basic structure
  // We pass empty strings for components as we want to create them via specific commands later
  await generateDomain({
    domainName,
    scope: config.project.org,
    repoRoot,
    skipEntity: true,
    skipUseCase: true, // Explicitly skip use-case creation during scaffold
    entityName: '',
    portName: '',
    ucName: '',
    targetApp: options.app,
  })
  s.stop('Initialized Domain')

  // --- Step 2: Connected Graph Entry Point ---
  log.info(color.green(`✅ Domain "${domainName}" created!`))

  if (options.nonInteractive) {
    return
  }

  const shouldAddPort = await confirm({
    message: `Would you like to create a Port for the '${domainName}' domain now?`,
    initialValue: true,
  })

  if (!isCancel(shouldAddPort) && shouldAddPort) {
    const pName = await text({
      message: 'Port Subject (e.g. user):',
      placeholder: domainName,
      defaultValue: domainName,
      validate: createKebabCaseValidator('Port Subject', { defaultValue: domainName }),
    })
    if (!isCancel(pName)) {
      await runAddPort(pName as string, { domain: domainName })
      outro(color.bgCyan(color.bold(' Domain setup completed ')))
      return
    }
  }

  const nextAction = await select({
    message: 'What else would you like to add?',
    options: [
      { label: 'Use Case (Feature-first)', value: 'use-case' },
      { label: 'Entity (Data-first)', value: 'entity' },
      { label: 'Value Object (Domain Model)', value: 'value-object' },
      { label: 'Port (Contract-first)', value: 'port' },
      { label: 'Adapter (Infra-first)', value: 'adapter' },
      { label: 'Nothing (Exit)', value: 'exit' },
    ],
  })

  if (isCancel(nextAction) || nextAction === 'exit') {
    outro('Done.')
    return
  }

  // Delegate
  if (nextAction === 'use-case') {
    const ucName = await text({
      message: 'Use Case Name (e.g. register-user):',
      validate: createKebabCaseValidator('Use Case Name'),
    })
    if (!isCancel(ucName)) {
      await runAddUseCase(ucName as string, { domain: domainName })
    }
  } else if (nextAction === 'entity') {
    const suggestedEntity = toPascalCase(domainName)
    const entName = await text({
      message: 'Entity Name (e.g. User):',
      placeholder: suggestedEntity,
      defaultValue: suggestedEntity,
      validate: validateEntityName,
    })
    if (!isCancel(entName)) {
      // We pass empty object for options as we want interactive mode
      await runAddEntity(entName as string, { domain: domainName }, {} as Command)
    }
  } else if (nextAction === 'value-object') {
    const suggestedVO = toPascalCase(domainName)
    const voName = await text({
      message: 'Value Object Name (e.g. UserId):',
      placeholder: suggestedVO,
      defaultValue: suggestedVO,
      validate: validateValueObjectName,
    })
    if (!isCancel(voName)) {
      await runAddValueObject(voName as string, { domain: domainName })
    }
  } else if (nextAction === 'port') {
    const pName = await text({
      message: 'Port Subject (e.g. user):',
      placeholder: domainName,
      defaultValue: domainName,
      validate: createKebabCaseValidator('Port Subject', { defaultValue: domainName }),
    })
    if (!isCancel(pName)) {
      await runAddPort(pName as string, { domain: domainName })
    }
  } else if (nextAction === 'adapter') {
    // Adapter command handles port selection/creation internally
    await runAddAdapter({ skipTests: false })
  }

  runFormat(repoRoot)
  outro(color.bgCyan(color.bold(' Domain setup completed ')))
}

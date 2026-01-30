import { cancel, confirm, isCancel, select } from '@clack/prompts'
import type { Command } from 'commander'
import color from 'picocolors'
import { generateEntity } from '../../../generators/entity.generator'
import { toKebabCase } from '../../../utils'
import { runFormat } from '../../../utils/format'
import { ensureProjectContext, getDomains } from '../../../utils/project'
import { validateEntityName } from '../../../validations/naming.validation'
import { runAddPort } from '../port/port.command'

export async function runAddEntity(
  entityName: string,
  options: {
    fields?: string
    vo?: string
    skipTests?: boolean
    domain?: string
    quiet?: boolean
    nonInteractive?: boolean
  },
  command?: Command
) {
  // Use consolidated validator
  const error = validateEntityName(entityName)
  if (error) {
    console.error(color.red(`✗ ${error}`))
    command?.help()
  }

  // Normalize to kebab-case for file system usage
  // e.g. "UserProfile" -> "user-profile"
  // e.g. "user-profile" -> "user-profile"
  // e.g. "User" -> "user"
  entityName = toKebabCase(entityName)

  const { repoRoot } = await ensureProjectContext(process.cwd())

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

  await generateEntity({
    entityName,
    domain,
    repoRoot,
    fields: options.fields ? options.fields.split(',').map((f) => f.trim()) : undefined,
    vo: options.vo,
    skipTests: options.skipTests,
    quiet: options.quiet,
  })
  // --- Connected Graph: Port Generation ---
  // We propose to create a port with the same name as the entity (e.g. 'user')
  // The 'add port' command will then ask for the Type (Repository, Notifier...) and specify the suffix.

  if (options.nonInteractive) {
    return
  }

  const shouldCreatePort = await confirm({
    message: `Generate a Port for '${color.cyan(entityName)}'?`,
    initialValue: true,
  })

  if (!isCancel(shouldCreatePort) && shouldCreatePort) {
    console.log(color.blueBright(`🔗 Triggering Port Creation...`))
    await runAddPort(entityName, {
      domain,
      // We do NOT force type: 'repository' anymore.
      // User can choose 'Notifier', 'Repository', etc. in the next step.
      skipTests: options.skipTests,
    })
  }

  runFormat(repoRoot)
}

import { existsSync } from 'node:fs'
import path from 'node:path'
import { log } from '@clack/prompts'
import color from 'picocolors'
import { createFsEngine } from '../engine/fs-engine'
import { toCamelCase, toPascalCase } from '../utils'
import { registerPort } from '../utils/config'
import { syncDomainIndex } from '../utils/domain'
import { getDomainPath, getTemplateEngine } from '../utils/project'

interface GeneratePortOptions {
  portName: string
  domain: string
  repoRoot: string
  portType?: string
  skipTests?: boolean
  quiet?: boolean
  blueprintPath?: string
  force?: boolean
}

import { DOMAIN_BLUEPRINT_SRC } from '../constants/blueprints'

export async function generatePort(options: GeneratePortOptions) {
  const {
    portName,
    domain,
    repoRoot,
    portType = 'other',
    skipTests = false,
    quiet = false,
    blueprintPath,
    force = false,
  } = options

  const fs = createFsEngine()
  const templates = await getTemplateEngine(blueprintPath)

  const domainDir = await getDomainPath(repoRoot, domain)
  // Ensure nested structure: ports/<name>/<name>.port.ts
  const portDir = path.join(domainDir, 'ports', portName)
  const portFile = path.join(portDir, `${portName}.port.ts`)

  await fs.ensureDir(portDir)

  if ((await fs.fileExists(portFile)) && !force) {
    if (!quiet) log.warning(color.yellow(`Port ${portName} already exists in ${domain}`))
    return // Or handle method addition logic if we move it here?
    // For now, let's keep generator focused on file creation.
    // Command handles interactive updates.
  }

  // Auto-discover snippets from capability-level snippets/ directory
  // Structure: <capability>/providers/<provider>/blueprint.json
  // Snippets:  <capability>/snippets/
  let snippetsPath: string | undefined
  if (blueprintPath) {
    // Go up from <capability>/providers/<provider> to <capability>/snippets
    const capabilityDir = path.dirname(path.dirname(blueprintPath))
    const potentialSnippets = path.join(capabilityDir, 'snippets')
    if (existsSync(potentialSnippets)) {
      snippetsPath = potentialSnippets
    }
  }

  // Construct hooks pointing to discovered snippets
  const hooks: Record<string, string> = {}
  if (snippetsPath) {
    const afterImports = path.join(snippetsPath, 'after-imports.eta')
    const portInterface = path.join(snippetsPath, 'port-interface.eta')
    if (await fs.fileExists(afterImports)) {
      hooks['after-imports'] = afterImports
    }
    if (await fs.fileExists(portInterface)) {
      hooks['port-interface'] = portInterface
    }
  }

  await templates.renderFile(
    `${DOMAIN_BLUEPRINT_SRC}/ports/port.eta`,
    portFile,
    {
      name: portName,
      pascalName: toPascalCase(portName),
      camelName: toCamelCase(portName),
      type: portType,
      domain,
      skipDefaults: !!blueprintPath,
      hooks,
    },
    { merge: true }
  )

  // Unit Test file generation
  if (!skipTests) {
    const testFile = path.join(portDir, `${portName}.test.ts`)
    const testContent = await templates.render(`${DOMAIN_BLUEPRINT_SRC}/ports/port.test.eta`, {
      name: portName,
      pascalName: toPascalCase(portName),
      camelName: toCamelCase(portName),
      type: portType,
    })

    if (!(await fs.fileExists(testFile))) {
      await fs.writeFile(testFile, testContent)
    }
  }

  // Update config
  registerPort(repoRoot, domain, portName, portType)

  // Domain Index Update
  await syncDomainIndex(repoRoot, domain)

  if (!quiet) {
    log.success(color.green(`⚡ Port: ${portName}`))
    log.info(`created in ${color.blue(`domains/${domain}/ports/${portName}/${portName}.port.ts`)}`)
  }
}

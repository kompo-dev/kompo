import path from 'node:path'
import { log } from '@clack/prompts'
import color from 'picocolors'
import { createFsEngine } from '../engine/fs-engine'
import { toCamelCase, toPascalCase } from '../utils'
import { registerUseCase } from '../utils/config'
import { syncDomainIndex } from '../utils/domain'
import { getDomainPath, getTemplateEngine } from '../utils/project'

interface GenerateUseCaseOptions {
  useCaseName: string
  domain: string
  repoRoot: string
  injectedImports?: string[]
  injectedDependencies?: string[]
  quiet?: boolean
  blueprintPath?: string
}

import { DOMAIN_BLUEPRINT_SRC } from '../constants/blueprints'

export async function generateUseCase(options: GenerateUseCaseOptions) {
  const {
    useCaseName,
    domain,
    repoRoot,
    injectedImports = [],
    injectedDependencies = [],
    quiet = false,
    blueprintPath,
  } = options

  const fs = createFsEngine()
  const templates = await getTemplateEngine(blueprintPath)

  const domainDir = await getDomainPath(repoRoot, domain)
  // Ensure nested structure: use-cases/<name>/<name>.use-case.ts
  const ucDir = path.join(domainDir, 'use-cases', useCaseName)
  const ucFile = path.join(ucDir, `${useCaseName}.use-case.ts`)

  await fs.ensureDir(ucDir)

  if (await fs.fileExists(ucFile)) {
    // If not quiet, maybe warn? But usually generators should be idempotent or fail.
    // existing command exited with error.
    if (!quiet) console.error(color.red(`✗ Use-case ${useCaseName} already exists`))
    return // Just return to avoid overwrite
  }

  await templates.renderFile(
    `${DOMAIN_BLUEPRINT_SRC}/use-cases/use-case.eta`,
    ucFile,
    {
      name: useCaseName,
      pascalName: toPascalCase(useCaseName),
      pName: toPascalCase(useCaseName),
      camelName: toCamelCase(useCaseName),
      imports: injectedImports,
      dependencies: injectedDependencies,
    },
    { merge: true }
  )

  // Test file
  const testFile = path.join(ucDir, `${useCaseName}.use-case.test.ts`)
  const testContent = await templates.render(
    `${DOMAIN_BLUEPRINT_SRC}/use-cases/use-case.test.eta`,
    {
      name: useCaseName,
      pascalName: toPascalCase(useCaseName),
      camelName: toCamelCase(useCaseName),
    }
  )

  if (!(await fs.fileExists(testFile))) {
    await fs.writeFile(testFile, testContent)
  }

  // Update Config
  registerUseCase(repoRoot, domain, useCaseName)

  // Domain Index Update
  await syncDomainIndex(repoRoot, domain)

  if (!quiet) {
    log.success(color.green(`⚡ Use-case: ${useCaseName}`))
    log.info(`created in ${color.blue(`domains/${domain}/use-cases/${useCaseName}.use-case.ts`)}`)
  }
}

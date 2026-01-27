import path from 'node:path'
import { LIBS_DIR } from '@kompo/kit'
import { createFsEngine } from '../engine/fs-engine'
import { getTemplateEngine } from '../utils'
import { injectDependencies } from '../utils/dependencies'
import { generateEntity } from './entity.generator'
import { generatePort } from './port.generator'
import { generateUseCase } from './use-case.generator'

interface GenerateDomainOptions {
  domainName: string
  scope: string
  repoRoot: string
  skipEntity?: boolean
  skipUseCase?: boolean
  entityName?: string
  portName?: string
  ucName?: string
  blueprintPath?: string
  skipInstall?: boolean
  targetApp?: string
}

import { DOMAIN_BLUEPRINT_ROOT } from '../constants/blueprints'

export async function generateDomain(options: GenerateDomainOptions) {
  const fs = createFsEngine()
  const {
    domainName,
    scope,
    repoRoot,
    skipEntity,
    skipUseCase,
    entityName,
    portName,
    ucName,
    blueprintPath,
    targetApp,
  } = options
  const templates = await getTemplateEngine(blueprintPath)

  const domainsDir = await ensureDomainsLibrary(fs, templates, repoRoot, scope)
  const domainSrcDir = path.join(domainsDir, 'src', domainName)

  // 5. Generate Domain Files in src/<domainName>
  await fs.ensureDir(domainSrcDir)

  // Ensure index.ts exists (generators will append exports)
  const indexFile = path.join(domainSrcDir, 'index.ts')
  if (!(await fs.fileExists(indexFile))) {
    await fs.writeFile(indexFile, '')
  }

  // Generate Entity
  if (!skipEntity) {
    await generateEntity({
      entityName: entityName || domainName,
      domain: domainName,
      repoRoot,
      blueprintPath,
    })
  }

  // Generate UseCase
  if (!skipUseCase) {
    await generateUseCase({
      useCaseName: ucName || domainName,
      domain: domainName,
      repoRoot,
      blueprintPath,
    })
  }

  // Generate Port (only if portName provided, typically from 'kompo new')
  if (portName) {
    await generatePort({
      portName,
      domain: domainName,
      repoRoot,
      // Simple inference for default 'user-repository' case logic
      portType: portName.includes('repository') ? 'repository' : 'other',
      blueprintPath,
    })
  }

  if (targetApp) {
    await injectDependencies({
      repoRoot,
      targets: targetApp,
      dependencies: [`@${scope}/domains`],
      version: 'workspace:*',
    })
  }
}

async function ensureDomainsLibrary(fs: any, templates: any, repoRoot: string, scope: string) {
  const domainsDir = path.join(repoRoot, LIBS_DIR, 'domains')

  // Ensure domains directory exists
  await fs.ensureDir(domainsDir)

  const files = [
    {
      file: 'package.json',
      template: `${DOMAIN_BLUEPRINT_ROOT}/package.json.eta`,
      data: { scope },
    },
    {
      file: 'tsconfig.json',
      template: `${DOMAIN_BLUEPRINT_ROOT}/tsconfig.json.eta`,
      data: {
        tsconfigPath: path.relative(domainsDir, path.join(LIBS_DIR, 'config/tsconfig.json')),
      },
    },
  ]

  for (const { file, template, data } of files) {
    const filePath = path.join(domainsDir, file)
    if (!(await fs.fileExists(filePath))) {
      await templates.renderFile(template, filePath, data)
    }
  }

  return domainsDir
}

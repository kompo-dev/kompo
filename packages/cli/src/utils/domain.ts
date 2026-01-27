import path from 'node:path'
import { readKompoConfig } from '@kompo/kit'
import { DOMAIN_BLUEPRINT_SRC } from '../constants/blueprints'
import { createFsEngine } from '../engine/fs-engine'
import { getDomainPath, getTemplateEngine } from './project'

export async function syncDomainIndex(repoRoot: string, domainName: string) {
  const fs = createFsEngine()
  const templates = await getTemplateEngine()
  const config = readKompoConfig(repoRoot)

  if (!config || !config.domains || !config.domains[domainName]) {
    return
  }

  const domainConfig = config.domains[domainName]
  const domainDir = await getDomainPath(repoRoot, domainName)

  // 1. Root index.ts
  const indexFile = path.join(domainDir, 'index.ts')
  const rootContent = await templates.render(`${DOMAIN_BLUEPRINT_SRC}/index.ts.eta`, {
    entities: domainConfig.entities || [],
    ports: domainConfig.ports || [],
    useCases: domainConfig.useCases || [],
  })
  await fs.writeFile(indexFile, rootContent)

  // 2. entities/index.ts
  if (domainConfig.entities?.length) {
    const entitiesDir = path.join(domainDir, 'entities')
    await fs.ensureDir(entitiesDir)
    const entitiesIndexFile = path.join(entitiesDir, 'index.ts')
    const entitiesContent = await templates.render(
      `${DOMAIN_BLUEPRINT_SRC}/entities/index.ts.eta`,
      {
        entities: domainConfig.entities,
      }
    )
    await fs.writeFile(entitiesIndexFile, entitiesContent)
  }

  // 3. ports/index.ts
  if (domainConfig.ports?.length) {
    const portsDir = path.join(domainDir, 'ports')
    await fs.ensureDir(portsDir)
    const portsIndexFile = path.join(portsDir, 'index.ts')
    const portsContent = await templates.render(`${DOMAIN_BLUEPRINT_SRC}/ports/index.ts.eta`, {
      ports: domainConfig.ports,
    })
    await fs.writeFile(portsIndexFile, portsContent)
  }

  // 4. use-cases/index.ts
  if (domainConfig.useCases?.length) {
    const useCasesDir = path.join(domainDir, 'use-cases')
    await fs.ensureDir(useCasesDir)
    const useCasesIndexFile = path.join(useCasesDir, 'index.ts')
    const useCasesContent = await templates.render(
      `${DOMAIN_BLUEPRINT_SRC}/use-cases/index.ts.eta`,
      {
        useCases: domainConfig.useCases,
      }
    )
    await fs.writeFile(useCasesIndexFile, useCasesContent)
  }
}

/**
 * Discover domain components from disk and update config
 */
export async function discoverDomain(repoRoot: string, domainName: string) {
  const fs = createFsEngine()
  const domainDir = await getDomainPath(repoRoot, domainName)
  const nodeFs = await import('node:fs/promises')

  const config = readKompoConfig(repoRoot)
  if (!config) return

  // 1. Entities
  const entitiesDir = path.join(domainDir, 'entities')
  if (await fs.fileExists(entitiesDir)) {
    const entries = await nodeFs.readdir(entitiesDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const { registerEntity } = await import('./config')
        registerEntity(repoRoot, domainName, entry.name)
      }
    }
  }

  // 2. Ports
  const portsDir = path.join(domainDir, 'ports')
  if (await fs.fileExists(portsDir)) {
    const entries = await nodeFs.readdir(portsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const { registerPort } = await import('./config')
        registerPort(repoRoot, domainName, entry.name)
      } else if (entry.name.endsWith('.port.ts') && !entry.name.endsWith('.test.ts')) {
        const portName = entry.name.replace('.port.ts', '')
        const { registerPort } = await import('./config')
        registerPort(repoRoot, domainName, portName)
      }
    }
  }

  // 3. Use Cases
  const useCasesDir = path.join(domainDir, 'use-cases')
  if (await fs.fileExists(useCasesDir)) {
    const entries = await nodeFs.readdir(useCasesDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const { registerUseCase } = await import('./config')
        registerUseCase(repoRoot, domainName, entry.name)
      }
    }
  }

  // 4. Finally Sync Indices
  await syncDomainIndex(repoRoot, domainName)
}

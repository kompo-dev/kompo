/**
 * Project and repository utilities
 */
import path from 'node:path'
import { log } from '@clack/prompts'
import { type KompoConfig, LIBS_DIR, readKompoConfig, type TemplateEngine } from '@kompo/kit'
import color from 'picocolors'
import { createFsEngine } from '../engine/fs-engine'
import { createTemplateEngine } from '../engine/template-engine'

export async function ensureProjectContext(
  cwd: string = process.cwd()
): Promise<{ repoRoot: string; config: KompoConfig }> {
  const repoRoot = await findRepoRoot(cwd)

  if (!repoRoot) {
    log.error(color.red('❌ Not in a Kompo monorepo.'))
    process.exit(1)
  }

  const config = readKompoConfig(repoRoot)

  if (!config) {
    log.error(color.red('❌ Project not initialized.'))
    log.message('This command must be run inside an existing Kompo project.')
    log.message(
      `\nTo create a new project, run:\n  ${color.cyan('pnpm kompo new <project-name>')}\n`
    )
    process.exit(1)
  }

  return { repoRoot, config }
}

export async function findRepoRoot(cwd: string): Promise<string | null> {
  const fs = createFsEngine()
  let current = cwd

  while (current !== path.dirname(current)) {
    const workspacePath = path.join(current, 'pnpm-workspace.yaml')
    if (await fs.fileExists(workspacePath)) {
      return current
    }
    current = path.dirname(current)
  }

  return null
}

export async function getDomainPath(repoRoot: string, domainName: string): Promise<string> {
  // Always enforce single package structure
  return path.join(repoRoot, LIBS_DIR, 'domains', 'src', domainName)
}

export async function getDomains(repoRoot: string): Promise<string[]> {
  const fs = createFsEngine()
  const domainsSrcDir = path.join(repoRoot, LIBS_DIR, 'domains', 'src')

  if (!(await fs.fileExists(domainsSrcDir))) {
    return []
  }

  const entries = await import('node:fs/promises').then((m) =>
    m.readdir(domainsSrcDir, { withFileTypes: true })
  )

  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
}

export async function getApps(repoRoot: string): Promise<string[]> {
  const fs = createFsEngine()
  const appsDir = path.join(repoRoot, 'apps')

  if (!(await fs.fileExists(appsDir))) {
    return []
  }

  const entries = await import('node:fs/promises').then((m) =>
    m.readdir(appsDir, { withFileTypes: true })
  )

  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
}

export async function getAvailablePorts(repoRoot: string): Promise<string[]> {
  const ports = new Set<string>()
  const fs = createFsEngine()

  // 1. From Config
  const config = readKompoConfig(repoRoot)
  if (config?.domains) {
    Object.values(config.domains).forEach((domain) => {
      if (domain.ports) {
        domain.ports.forEach((p) => {
          if (typeof p === 'string') {
            ports.add(p)
          } else {
            ports.add(p.name)
          }
        })
      }
    })
  }

  // 2. From File System (Source of Truth)
  const domains = await getDomains(repoRoot)
  for (const domain of domains) {
    const domainDir = await getDomainPath(repoRoot, domain)
    const portsDir = path.join(domainDir, 'ports')
    if (await fs.fileExists(portsDir)) {
      const entries = await import('node:fs/promises').then((m) =>
        m.readdir(portsDir, { withFileTypes: true })
      )

      entries.forEach((e) => {
        if (e.isDirectory()) {
          ports.add(e.name)
        } else if (e.isFile() && e.name.endsWith('.port.ts') && !e.name.endsWith('.test.ts')) {
          const portName = e.name.replace('.port.ts', '')
          ports.add(portName)
        }
      })
    }
  }

  return Array.from(ports).sort()
}

export async function getPortRegistry(
  repoRoot: string
): Promise<{ domain: string; name: string; type?: string }[]> {
  const registry: { domain: string; name: string; type?: string }[] = []
  const fs = createFsEngine()
  const config = readKompoConfig(repoRoot)

  const domains = await getDomains(repoRoot)
  for (const domain of domains) {
    const domainDir = await getDomainPath(repoRoot, domain)
    const portsDir = path.join(domainDir, 'ports')
    if (await fs.fileExists(portsDir)) {
      const entries = await import('node:fs/promises').then((m) =>
        m.readdir(portsDir, { withFileTypes: true })
      )

      entries.forEach((e) => {
        let portName = ''
        if (e.isDirectory()) {
          portName = e.name
        } else if (e.isFile() && e.name.endsWith('.port.ts') && !e.name.endsWith('.test.ts')) {
          portName = e.name.replace('.port.ts', '')
        }

        if (portName) {
          // Look up type from config
          let portType: string | undefined
          if (config?.domains?.[domain]?.ports) {
            const portEntry = config.domains[domain].ports.find((p) => {
              const pName = typeof p === 'string' ? p : p.name
              return pName === portName
            })
            if (portEntry && typeof portEntry !== 'string') {
              portType = portEntry.type
            }
          }
          registry.push({ domain, name: portName, type: portType })
        }
      })
    }
  }

  return registry.sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name))
}

export async function findDomainForPort(cwd: string, portName: string): Promise<string | null> {
  const repoRoot = (await findRepoRoot(cwd)) || cwd
  const fs = createFsEngine()
  const domains = await getDomains(repoRoot)

  for (const domain of domains) {
    const domainDir = await getDomainPath(repoRoot, domain)
    const portsDir = path.join(domainDir, 'ports')
    // Check if port directory exists
    if (await fs.fileExists(path.join(portsDir, portName))) {
      return domain
    }
    // Check if port file exists (legacy/flat structure)
    if (await fs.fileExists(path.join(portsDir, `${portName}.port.ts`))) {
      return domain
    }
  }

  return null
}

export async function findCliRoot(): Promise<string> {
  // Assuming we are running from dist/src/commands/add or src/commands/add
  // We want to find the package.json of the CLI
  const fs = createFsEngine()
  // Start from current file location - we can't use __dirname easily in ESM if not defined
  // But we know findRepoRoot implementation.
  // Let's assume we can traverse up from process.argv[1] or similar?
  // A safer way is typically checking where this file is.
  // Since we are compiled, let's assume standard relative paths from the executing script is flaky if we don't know build structure.

  // However, we are in a monorepo. config.json logic uses repo root.
  // The templates are in packages/cli/templates.
  // If we can find repo root, we can find packages/cli/templates.

  // BUT, if the CLI is installed globally or as a dependency, repo root logic might differ (user project root vs cli package root).
  // For now, assuming we are running the CLI from within the monorepo dev environment or linked.

  // Better strategy: Use __dirname if available or import.meta.url
  const currentDir = path.dirname(new URL(import.meta.url).pathname)
  let current = currentDir
  while (current !== path.dirname(current)) {
    if (await fs.fileExists(path.join(current, 'package.json'))) {
      // Check if name is @kompo/cli
      const content = await fs.readJson<{ name: string }>(path.join(current, 'package.json'))
      if (content.name === '@kompo/cli') {
        return current
      }
    }
    current = path.dirname(current)
  }
  throw new Error('Could not find @kompo/cli root')
}

export async function getTemplateEngine(
  blueprintPath?: string,
  repoRoot?: string
): Promise<TemplateEngine> {
  const fs = createFsEngine()
  // Use templates from centrally managed blueprints package
  const { getTemplatesDir } = await import('@kompo/blueprints')
  const templatesDir = getTemplatesDir()

  const roots = [templatesDir]
  if (repoRoot) {
    roots.push(repoRoot)
  }

  if (blueprintPath) {
    const blueprintTemplatesDir = path.join(blueprintPath, 'templates')
    if (await fs.fileExists(blueprintTemplatesDir)) {
      roots.unshift(blueprintTemplatesDir)
    }
  }

  return createTemplateEngine(fs, roots, blueprintPath)
}

export const onCancel = () => {
  console.log('\n\n❌ Operation cancelled by user.')
  process.exit(0)
}

/**
 * Resolves dependencies from a template's catalog.json
 */
export async function getDependenciesFromTemplate(templatePath: string): Promise<string[]> {
  const { getBlueprintDependencies } = await import('@kompo/blueprints')
  return getBlueprintDependencies(templatePath)
}

/**
 * Test utilities for Kompo CLI plugins
 * Provides mocks for KompoContext, filesystem, and templates
 */

import type { FsEngine, KompoContext, TemplateEngine } from '../context'

export interface MockFsEngine extends FsEngine {
  files: Map<string, string>
  dirs: Set<string>
}

export interface MockTemplateEngine extends TemplateEngine {
  rendered: Array<{ template: string; dest: string; data: Record<string, unknown> }>
}

/**
 * In-memory filesystem for testing
 */
export function createMockFs(): MockFsEngine {
  const files = new Map<string, string>()
  const dirs = new Set<string>()

  return {
    files,
    dirs,
    async fileExists(path: string): Promise<boolean> {
      return files.has(path) || dirs.has(path)
    },
    async readFile(path: string): Promise<string> {
      const content = files.get(path)
      if (content === undefined) {
        throw new Error(`File not found: ${path}`)
      }
      return content
    },
    async writeFile(path: string, content: string): Promise<void> {
      files.set(path, content)
    },
    async writeJson(path: string, data: unknown): Promise<void> {
      files.set(path, JSON.stringify(data, null, 2))
    },
    async readJson<T = unknown>(path: string): Promise<T> {
      const content = files.get(path)
      if (content === undefined) {
        throw new Error(`File not found: ${path}`)
      }
      return JSON.parse(content) as T
    },
    async ensureDir(path: string): Promise<void> {
      dirs.add(path)
    },
    async copyFile(_src: string, _dest: string): Promise<void> {
      // No-op for tests
    },
    async renameFile(_oldPath: string, _newPath: string): Promise<void> {
      // No-op for tests
    },
    async readDir(dirPath: string): Promise<string[]> {
      // Return files that start with the given directory path
      const result: string[] = []
      for (const filePath of files.keys()) {
        if (filePath.startsWith(dirPath + '/')) {
          const relativePath = filePath.slice(dirPath.length + 1)
          const firstSegment = relativePath.split('/')[0]
          if (!result.includes(firstSegment)) {
            result.push(firstSegment)
          }
        }
      }
      return result
    },
    async remove(_path: string): Promise<void> {
      // No-op for tests or implement removal
      // simplistic
      files.delete(_path)
      dirs.delete(_path)
    },
  }
}

/**
 * Mock template engine for testing
 */
export function createMockTemplates(): MockTemplateEngine {
  const rendered: Array<{ template: string; dest: string; data: Record<string, unknown> }> = []

  return {
    rendered,
    async render(_templatePath: string, _data: unknown): Promise<string> {
      return '/* rendered template */'
    },
    async renderFile(template: string, dest: string, data: Record<string, unknown>): Promise<void> {
      rendered.push({ template, dest, data })
    },
    async renderDir(template: string, dest: string, data: Record<string, unknown>): Promise<void> {
      rendered.push({ template, dest, data })
    },
    async exists(_templatePath: string): Promise<boolean> {
      return true
    },
    async renderString(template: string, _data: unknown): Promise<string> {
      return template
    },
    dir: '',
  }
}

/**
 * Create a mock KompoContext for testing
 */
export function createMockContext(
  overrides: Partial<{
    answers: Record<string, unknown>
    targetDir: string
    repoRoot: string
    command: 'new' | 'add'
  }>
): KompoContext & {
  mockFs: MockFsEngine
  mockTemplates: MockTemplateEngine
} {
  const mockFs = createMockFs()
  const mockTemplates = createMockTemplates()
  const repoRoot = overrides.repoRoot || '/tmp/test-project'
  const targetDir = overrides.targetDir || `${repoRoot}/apps/web`

  return {
    cwd: repoRoot,
    command: overrides.command || 'add',
    answers: overrides.answers || {},
    features: new Set<string>(),
    fs: mockFs,
    templates: mockTemplates,
    pluginData: new Map(),
    targetDir,
    mockFs,
    mockTemplates,
  }
}

/**
 * Helper to set up common test fixtures
 */
export function setupTestFixtures(mockFs: ReturnType<typeof createMockFs>, repoRoot: string) {
  // Create basic .env file
  mockFs.files.set(`${repoRoot}/.env`, '# Environment variables\n')

  // Create empty docker-compose.yml
  mockFs.files.set(`${repoRoot}/runtime/docker-compose.yml`, 'services:\n\nvolumes:\n')

  // Create pnpm-workspace.yaml
  mockFs.files.set(
    `${repoRoot}/pnpm-workspace.yaml`,
    `packages:
  - "apps/*"
  - "packages/*"
  - "libs/*"

catalog:
`
  )
}

/**
 * Helper to extract env vars from .env content
 */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1]
        let value = match[2]
        // Remove quotes
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        result[key] = value
      }
    }
  }

  return result
}

/**
 * Helper to check if docker-compose contains a service
 */
export function dockerComposeHasService(content: string, serviceName: string): boolean {
  const pattern = new RegExp(`^\\s*${serviceName}:`, 'm')
  return pattern.test(content)
}

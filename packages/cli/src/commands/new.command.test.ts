import * as prompts from '@clack/prompts'
import * as kit from '@kompo/kit'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as projectUtils from '../utils/project'
import { runNewCommand } from './new.command'

// Hoist mocks
const { mockFs } = vi.hoisted(() => ({
  mockFs: {
    ensureDir: vi.fn(),
    fileExists: vi.fn().mockResolvedValue(false),
    readJson: vi.fn(),
    writeFile: vi.fn(),
  },
}))

// Mock dependencies
vi.mock('@clack/prompts', async (importOriginal) => {
  const actual = await importOriginal<typeof prompts>()
  return {
    ...actual,
    select: vi.fn(),
    text: vi.fn(),
    intro: vi.fn(),
    outro: vi.fn(),
    log: {
      message: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    },
    spinner: () => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() }),
    taskLog: () => ({ message: vi.fn(), success: vi.fn(), error: vi.fn() }),
  }
})

vi.mock('../engine/fs-engine', () => ({
  createFsEngine: () => mockFs,
}))

vi.mock('../utils/project', async (importOriginal) => {
  const actual = await importOriginal<typeof projectUtils>()
  return {
    ...actual,
    findRepoRoot: vi.fn().mockResolvedValue(null), // Simulate new project (no root yet)
  }
})

vi.mock('@kompo/kit', async (importOriginal) => {
  const actual = await importOriginal<typeof kit>()
  return {
    ...actual,
    readKompoConfig: vi.fn().mockReturnValue(null), // No config yet
    initKompoConfig: vi.fn(),
    upsertApp: vi.fn(),
    getRequiredFeatures: vi.fn().mockReturnValue(['nextjs', 'vite']),
    updateCatalogFromFeatures: vi.fn(),
    addHistoryEntry: vi.fn(),
    updateCatalogSources: vi.fn(),
  }
})

vi.mock('../generators/apps/framework.generator', () => ({
  generateFramework: vi.fn(),
}))

vi.mock('../generators/apps/design.generator', () => ({
  generateDesignSystem: vi.fn(),
}))

vi.mock('../generators/apps/backend.generator', () => ({
  generateBackend: vi.fn(),
}))

vi.mock('node:child_process', () => ({
  spawn: vi.fn().mockReturnValue({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event, cb) => {
      if (event === 'close') cb(0) // Success
    }),
  }),
}))

vi.mock('./add/app/app.command', () => ({
  runAddApp: vi.fn(),
}))

vi.mock('./add/adapter/adapter.command', () => ({
  runAddAdapter: vi.fn(),
}))

vi.mock('./wire.command', () => ({
  runWire: vi.fn(),
}))

// Mock Registry to return valid blueprints
vi.mock('../registries/template.registry', () => ({
  registerBlueprintProvider: vi.fn(),
  getBlueprint: vi.fn().mockImplementation(async (name) => {
    return {
      name,
      description: 'Mock Blueprint',
      version: '1.0.0',
      type: 'app',
      category: 'app',
      framework: name === 'vite' ? 'vite' : 'nextjs', // Infer framework from name
      steps: [
        { command: 'add', type: 'app', name: 'app', driver: name === 'vite' ? 'vite' : 'nextjs' },
        { command: 'add', type: 'design-system', name: 'tailwind', app: 'app' },
      ],
    }
  }),
}))

vi.mock('../utils/format')

describe('runNewCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prompts.select).mockReset()
    vi.mocked(prompts.text).mockReset()

    vi.mocked(kit.getRequiredFeatures).mockReturnValue(['nextjs', 'vite'])
    // Default mocks for prompts to allow flow to complete
    vi.mocked(prompts.text).mockResolvedValue('test-project') // Org Name
    vi.mocked(prompts.select).mockResolvedValue('nextjs-fullstack') // Frontend
    // Backend selected implicitly for fullstack
    // App Name selected implicitly or prompted?
    vi.mocked(prompts.text)
      .mockResolvedValueOnce('test-org') // Org
      .mockResolvedValueOnce('web') // App Name

    // Mock FS fileExists
    vi.mocked(mockFs.fileExists).mockImplementation(async (path: string) => {
      if (path.endsWith('apps')) return true // /apps dir exists
      return false // defaults (target dir does not exist)
    })
  })

  it('should normalize nextjs-fullstack to nextjs when getting required features', async () => {
    // Setup
    vi.mocked(prompts.select).mockResolvedValueOnce('nextjs-fullstack') // Frontend
    vi.mocked(prompts.select).mockResolvedValueOnce('tailwind') // Design System

    await runNewCommand(undefined, {}, {} as any)

    // Verify
    expect(kit.getRequiredFeatures).not.toHaveBeenCalled()

    expect(kit.updateCatalogFromFeatures).toHaveBeenCalled()
  })

  it('should normalize vite to vite', async () => {
    vi.mocked(prompts.text).mockResolvedValueOnce('test-org').mockResolvedValueOnce('web') // Frontend App Name

    vi.mocked(prompts.select)
      .mockResolvedValueOnce('vite') // Frontend
      .mockResolvedValueOnce('none') // Backend (Vite asks for backend)
      .mockResolvedValueOnce('tailwind') // Design System

    await runNewCommand(undefined, {}, {} as any)

    expect(kit.updateCatalogFromFeatures).toHaveBeenCalledWith(
      expect.anything(), // repoRoot
      expect.arrayContaining(['vite', 'tailwind'])
    )
  })
})

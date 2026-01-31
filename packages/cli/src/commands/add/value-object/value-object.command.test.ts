import * as prompts from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as projectUtils from '../../../utils/project'
import { runAddValueObject } from './value-object.command'

// Mock dependencies
vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn((val) => val === Symbol.for('clack:cancel')),
  log: {
    message: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  spinner: () => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() }),
}))

vi.mock('../../../utils/format', () => ({
  runFormat: vi.fn(),
}))

vi.mock('@kompo/kit', () => ({
  readKompoConfig: vi.fn(),
  LIBS_DIR: 'libs',
}))

vi.mock('../../../utils/project', () => ({
  ensureProjectContext: vi.fn(),
  findRepoRoot: vi.fn(),
  getDomains: vi.fn(),
  getDomainPath: vi.fn(),
  getApps: vi.fn().mockResolvedValue([]),
  getTemplateEngine: vi.fn(),
}))

const { mockFs, mockTemplates } = vi.hoisted(() => ({
  mockFs: {
    ensureDir: vi.fn(),
    fileExists: vi.fn().mockResolvedValue(false),
    writeFile: vi.fn(),
  },
  mockTemplates: {
    render: vi.fn().mockResolvedValue('mock-content'),
    renderDir: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../../engine/fs-engine', () => ({
  createFsEngine: () => mockFs,
}))

describe('runAddValueObject', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(projectUtils.ensureProjectContext).mockResolvedValue({
      repoRoot: '/mock/root',
      config: {
        version: 1,
        project: { name: 'test', org: 'test-org' },
        catalog: { lastUpdated: '2024-01-01', sources: [] },
        apps: {},
        steps: [],
        domains: {
          'test-domain': {
            entities: ['user'],
            ports: [],
            useCases: [],
          },
        },
      },
    } as any)

    vi.mocked(projectUtils.getDomains).mockResolvedValue(['test-domain'])
    vi.mocked(projectUtils.getDomainPath).mockResolvedValue('/mock/root/domains/test-domain')
    vi.mocked(projectUtils.getTemplateEngine).mockResolvedValue(mockTemplates as any)

    mockFs.fileExists.mockResolvedValue(false)
  })

  it('should create generic domain shared VO', async () => {
    vi.mocked(prompts.select)
      .mockResolvedValueOnce('test-domain') // Domain
      .mockResolvedValueOnce('domain-shared') // Scope

    await runAddValueObject('email-address', {})

    expect(mockFs.ensureDir).toHaveBeenCalledWith(
      expect.stringContaining('/domains/test-domain/value-objects')
    )
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('EmailAddress.ts'),
      'mock-content'
    )
  })

  it('should create entity specific VO', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('user')

    await runAddValueObject('password', { domain: 'test-domain' })

    expect(mockFs.ensureDir).toHaveBeenCalledWith(
      expect.stringContaining('/entities/user/value-objects')
    )
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('Password.ts'),
      'mock-content'
    )
  })

  it('should create global shared kernel VO', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('global-shared')

    await runAddValueObject('money', { domain: 'test-domain' })

    expect(mockFs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('/libs/kernel/src'))
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('Money.ts'),
      'mock-content'
    )
  })
})

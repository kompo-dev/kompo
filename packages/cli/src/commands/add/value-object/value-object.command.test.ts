import * as prompts from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as projectUtils from '../../../utils/project'
import { runAddValueObject } from './value-object.command'

// Mock dependencies
vi.mock('@clack/prompts', async (importOriginal) => {
  const actual = await importOriginal<typeof prompts>()
  return {
    ...actual,
    select: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(),
    isCancel: vi.fn((val) => val === Symbol.for('clack:cancel')),
  }
})

vi.mock('../../../utils/format')

// Mock kit
vi.mock('@kompo/kit', () => ({
  readKompoConfig: vi.fn(() => ({
    domains: {
      'test-domain': {
        entities: ['user'],
      },
    },
  })),
}))

const { mockFs, mockTemplates } = vi.hoisted(() => ({
  mockFs: {
    ensureDir: vi.fn(),
    fileExists: vi.fn().mockResolvedValue(false),
    writeFile: vi.fn(),
  },
  mockTemplates: {
    render: vi.fn().mockResolvedValue('mock-content'),
  },
}))

vi.mock('../../../engine/fs-engine', () => ({
  createFsEngine: () => mockFs,
}))

vi.mock('../../../utils/project', async (importOriginal) => {
  const actual = await importOriginal<typeof projectUtils>()
  return {
    ...actual,
    findRepoRoot: vi.fn().mockResolvedValue('/mock/root'),
    getDomains: vi.fn().mockResolvedValue(['test-domain']),
    getDomainPath: vi.fn().mockResolvedValue('/mock/root/domains/test-domain'),
    getTemplateEngine: vi.fn().mockResolvedValue(mockTemplates),
  }
})

describe('runAddValueObject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(projectUtils.findRepoRoot).mockResolvedValue('/mock/root')
    vi.mocked(projectUtils.getDomains).mockResolvedValue(['test-domain'])
    vi.mocked(projectUtils.getDomainPath).mockResolvedValue('/mock/root/domains/test-domain')
    mockFs.fileExists.mockResolvedValue(false)
  })

  it('should create generic domain shared VO', async () => {
    vi.mocked(prompts.select)
      .mockResolvedValueOnce('test-domain') // Domain
      .mockResolvedValueOnce('domain-shared') // Scope

    await runAddValueObject('email-address', {})

    // domains/test-domain/value-objects/EmailAddress.ts
    expect(mockFs.ensureDir).toHaveBeenCalledWith(
      expect.stringContaining('/domains/test-domain/value-objects')
    )
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('EmailAddress.ts'),
      'mock-content'
    )
  })

  it('should create entity specific VO', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('user') // Entity org(Domain skipped)

    await runAddValueObject('password', { domain: 'test-domain' })

    // domains/test-domain/entities/user/value-objects/Password.ts
    expect(mockFs.ensureDir).toHaveBeenCalledWith(
      expect.stringContaining('/entities/user/value-objects')
    )
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('Password.ts'),
      'mock-content'
    )
  })

  it('should create global shared kernel VO', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('global-shared') // org(Domain skipped)

    await runAddValueObject('money', { domain: 'test-domain' })

    // libs/kernel/src/Money.ts
    expect(mockFs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('/libs/kernel/src'))
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('Money.ts'),
      'mock-content'
    )
  })
})

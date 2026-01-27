import * as prompts from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as domainGenerator from '../../../generators/domain.generator'
import * as projectUtils from '../../../utils/project'
import { runAddAdapter } from '../adapter/adapter.command'
import { runAddPort } from './port.command'

// Mock dependencies
vi.mock('@clack/prompts', async (importOriginal) => {
  const actual = await importOriginal<typeof prompts>()
  return {
    ...actual,
    select: vi.fn(),
    text: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(),
    isCancel: vi.fn((val) => val === Symbol.for('clack:cancel')),
    log: {
      error: vi.fn(),
      message: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
    },
    intro: vi.fn(),
    outro: vi.fn(),
    spinner: () => ({
      start: vi.fn(),
      stop: vi.fn(),
    }),
  }
})

vi.mock('../../../utils/project')
vi.mock('../../../generators/domain.generator')
vi.mock('../../../utils/format')
vi.mock('../adapter/adapter.command')

// Mock kit
vi.mock('@kompo/kit', () => ({
  readKompoConfig: vi.fn(() => ({
    project: { org: 'test-org' },
    domains: {},
  })),
  writeKompoConfig: vi.fn(),
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

// Mock FS and Template Engine
vi.mock('../../../engine/fs-engine', () => ({
  createFsEngine: () => mockFs,
}))

vi.mock('../../../utils/project', async (importOriginal) => {
  const actual = await importOriginal<typeof projectUtils>()
  return {
    ...actual,
    findRepoRoot: vi.fn().mockResolvedValue('/mock/root'),
    getDomains: vi.fn().mockResolvedValue(['existing-domain']),
    getDomainPath: vi.fn().mockResolvedValue('/mock/root/domains/existing-domain'),
    getTemplateEngine: vi.fn().mockResolvedValue(mockTemplates),
  }
})

describe('runAddPort', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset default mocks
    vi.mocked(projectUtils.findRepoRoot).mockResolvedValue('/mock/root')
    vi.mocked(projectUtils.getDomains).mockResolvedValue(['existing-domain'])
    vi.mocked(projectUtils.getDomainPath).mockResolvedValue('/mock/root/domains/existing-domain')
    mockFs.fileExists.mockResolvedValue(false)
  })

  it('should create a port in an existing domain', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('repository') // Select Repository
    vi.mocked(prompts.confirm).mockResolvedValue(false) // Don't autowire

    const _fs = (await import('../../../engine/fs-engine')).createFsEngine()

    await runAddPort('user-repository', { domain: 'existing-domain' })

    // Verify FS writes
    expect(mockFs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('user-repository'))
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('user-repository.port.ts'),
      'mock-content'
    )
  })

  it('should prompt to create domain if none exist, and then create port', async () => {
    vi.mocked(projectUtils.getDomains).mockResolvedValue([])

    vi.mocked(prompts.confirm).mockResolvedValueOnce(true) // Create domain? Yes
    vi.mocked(prompts.text).mockResolvedValueOnce('new-domain') // Domain Name

    vi.mocked(prompts.select).mockResolvedValueOnce('repository') // Port Type
    vi.mocked(prompts.confirm).mockResolvedValueOnce(false) // Autowire? No

    vi.mocked(projectUtils.getDomainPath).mockResolvedValue('/mock/root/domains/new-domain')

    const _fs = (await import('../../../engine/fs-engine')).createFsEngine()

    await runAddPort('user-repository', {})

    expect(domainGenerator.generateDomain).toHaveBeenCalledWith(
      expect.objectContaining({
        domainName: 'new-domain',
        skipEntity: true,
      })
    )

    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('user-repository.port.ts'),
      expect.any(String)
    )
  })

  it('should trigger adapter wizard if autoLink is confirmed', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('repository')
    vi.mocked(prompts.confirm).mockResolvedValueOnce(true) // Autowire? Yes

    await runAddPort('user-repository', { domain: 'existing-domain' })

    expect(runAddAdapter).toHaveBeenCalledWith(
      'user-repository',
      expect.objectContaining({
        allowedCapabilities: expect.any(Array),
      })
    )
  })
})

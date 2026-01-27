import * as prompts from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as projectUtils from '../../../utils/project'
import * as portCommand from '../port/port.command'
import { runAddEntity } from './entity.command'

// Mock dependencies
vi.mock('@clack/prompts', async (importOriginal) => {
  const actual = await importOriginal<typeof prompts>()
  return {
    ...actual,
    select: vi.fn(),
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
  }
})

vi.mock('../port/port.command')
vi.mock('../../../utils/format')

// Mock kit
vi.mock('@kompo/kit', () => ({
  readKompoConfig: vi.fn(() => ({
    domains: {
      'test-domain': {
        entities: [],
      },
    },
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
    getDomains: vi.fn().mockResolvedValue(['test-domain']),
    getDomainPath: vi.fn().mockResolvedValue('/mock/root/domains/test-domain'),
    getTemplateEngine: vi.fn().mockResolvedValue(mockTemplates),
  }
})

describe('runAddEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(projectUtils.findRepoRoot).mockResolvedValue('/mock/root')
    vi.mocked(projectUtils.getDomains).mockResolvedValue(['test-domain'])
    mockFs.fileExists.mockResolvedValue(false)
  })

  it('should create entity in specified domain', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('test-domain')
    vi.mocked(prompts.confirm).mockResolvedValueOnce(false) // Don't create port

    await runAddEntity('user-profile', {}, {} as any)

    expect(mockFs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('user-profile'))
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('user-profile.entity.ts'),
      'mock-content'
    )
  })

  it('should generate VO if requested', async () => {
    vi.mocked(prompts.confirm).mockResolvedValueOnce(false) // Don't create port

    await runAddEntity('order', { domain: 'test-domain', vo: 'order-id' }, {} as any)

    expect(mockFs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('value-objects'))
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('OrderId.ts'),
      'mock-content'
    )
  })

  it('should trigger port creation if confirmed', async () => {
    vi.mocked(prompts.confirm).mockResolvedValueOnce(true) // Create port? Yes

    await runAddEntity('product', { domain: 'test-domain' }, {} as any)

    expect(portCommand.runAddPort).toHaveBeenCalledWith(
      'product',
      expect.objectContaining({ domain: 'test-domain' })
    )
  })
})

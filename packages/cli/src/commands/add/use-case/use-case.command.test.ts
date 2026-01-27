import * as prompts from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as projectUtils from '../../../utils/project'
import * as entityCommand from '../entity/entity.command'
import { runAddUseCase } from './use-case.command'

// Mock dependencies
vi.mock('@clack/prompts', async (importOriginal) => {
  const actual = await importOriginal<typeof prompts>()
  return {
    ...actual,
    select: vi.fn(),
    confirm: vi.fn(),
    multiselect: vi.fn(),
    text: vi.fn(),
    cancel: vi.fn(),
    isCancel: vi.fn((val) => val === Symbol.for('clack:cancel')),
    log: { message: vi.fn() },
  }
})

vi.mock('../entity/entity.command')
vi.mock('../port/port.command')
vi.mock('../../../utils/format')

// Mock kit
vi.mock('@kompo/kit', () => ({
  readKompoConfig: vi.fn(() => ({
    domains: {
      'test-domain': {
        entities: ['user'], // 'user' exists
        ports: ['user-repository'],
        useCases: [],
      },
      'other-domain': {
        ports: ['payment-gateway'],
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
    readFile: vi.fn().mockResolvedValue(''),
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
    getDomains: vi.fn().mockResolvedValue(['test-domain', 'other-domain']),
    getDomainPath: vi.fn().mockResolvedValue('/mock/root/domains/test-domain'),
    getTemplateEngine: vi.fn().mockResolvedValue(mockTemplates),
  }
})

describe('runAddUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(projectUtils.findRepoRoot).mockResolvedValue('/mock/root')
    vi.mocked(projectUtils.getDomains).mockResolvedValue(['test-domain'])
    vi.mocked(prompts.multiselect).mockResolvedValue([]) // Default empty selection
    mockFs.fileExists.mockResolvedValue(false)
  })

  it('should create use-case in domain', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('test-domain')
    vi.mocked(prompts.confirm).mockResolvedValue(false) // No new entity/port

    await runAddUseCase('register-user', {})

    expect(mockFs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('register-user'))
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('register-user.use-case.ts'),
      'mock-content'
    )
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('register-user.use-case.test.ts'),
      'mock-content'
    )
  })

  it('should suggest creating implied entity if missing', async () => {
    // 'register-vehicle' -> implies 'vehicle' entity
    // 'vehicle' is NOT in mocked config entities ['user']
    vi.mocked(prompts.confirm)
      .mockResolvedValueOnce(true) // Create Entity 'Vehicle'?
      .mockResolvedValueOnce(false) // Create Port?

    await runAddUseCase('register-vehicle', { domain: 'test-domain' })

    expect(entityCommand.runAddEntity).toHaveBeenCalledWith(
      'vehicle',
      expect.objectContaining({ domain: 'test-domain' }),
      expect.anything()
    )
  })

  it('should support inter-domain injection', async () => {
    vi.mocked(prompts.confirm).mockResolvedValue(false)
    vi.mocked(prompts.multiselect).mockResolvedValueOnce([
      { domain: 'other-domain', port: 'payment-gateway' },
    ])

    await runAddUseCase('process-payment', { domain: 'test-domain' })

    expect(mockTemplates.render).toHaveBeenCalledWith(
      expect.stringContaining('use-case.eta'),
      expect.objectContaining({
        imports: expect.arrayContaining([
          expect.stringContaining("from '@org/domains/other-domain'"),
        ]),
        dependencies: expect.arrayContaining([
          expect.stringContaining('paymentGateway: payment-gateway'),
        ]), // Mock logic check
      })
    )
  })
})

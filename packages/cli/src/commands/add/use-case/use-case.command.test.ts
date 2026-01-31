import * as prompts from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as projectUtils from '../../../utils/project'
import * as entityCommand from '../entity/entity.command'
import { runAddUseCase } from './use-case.command'

// Mock dependencies
vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  confirm: vi.fn(),
  multiselect: vi.fn(),
  text: vi.fn(),
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

vi.mock('../entity/entity.command')
vi.mock('../port/port.command')
vi.mock('../../../utils/format')

// Mock kit
vi.mock('@kompo/kit', () => ({
  readKompoConfig: vi.fn(() => ({
    version: 1,
    project: { name: 'test', org: 'test-org' },
    catalog: { lastUpdated: '2024-01-01', sources: [] },
    apps: {},
    steps: [],
    domains: {
      'test-domain': {
        entities: ['user'], // 'user' exists
        ports: ['user-repository'],
        useCases: [],
      },
      'other-domain': {
        entities: [],
        ports: ['payment-gateway'],
        useCases: [],
      },
    },
  })),
  writeKompoConfig: vi.fn(),
  LIBS_DIR: 'libs',
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
    renderDir: vi.fn().mockResolvedValue(undefined),
    renderFile: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../../engine/fs-engine', () => ({
  createFsEngine: () => mockFs,
}))

vi.mock('../../../utils/project', () => ({
  findRepoRoot: vi.fn(),
  ensureProjectContext: vi.fn(),
  getDomains: vi.fn(),
  getDomainPath: vi.fn(),
  getTemplateEngine: vi.fn(),
  getApps: vi.fn().mockResolvedValue([]),
}))

describe('runAddUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(projectUtils.findRepoRoot).mockResolvedValue('/mock/root')
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
            ports: ['user-repository'],
            useCases: [],
          },
        },
      },
    } as any)
    vi.mocked(projectUtils.getDomains).mockResolvedValue(['test-domain'])
    vi.mocked(projectUtils.getDomainPath).mockResolvedValue('/mock/root/domains/test-domain')
    vi.mocked(projectUtils.getTemplateEngine).mockResolvedValue(mockTemplates as any)
    vi.mocked(prompts.multiselect).mockResolvedValue([])
    mockFs.fileExists.mockResolvedValue(false)
  })

  it('should create use-case in domain', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('test-domain')
    vi.mocked(prompts.confirm).mockResolvedValue(false)

    await runAddUseCase('register-user', {})

    expect(mockFs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('register-user'))
    expect(mockTemplates.renderFile).toHaveBeenCalledWith(
      expect.stringContaining('use-case.eta'),
      expect.stringContaining('register-user.use-case.ts'),
      expect.anything(),
      expect.anything()
    )
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('register-user.use-case.test.ts'),
      expect.any(String)
    )
  })

  it('should suggest creating implied entity if missing', async () => {
    vi.mocked(prompts.confirm).mockResolvedValueOnce(true).mockResolvedValueOnce(false)

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

    expect(mockTemplates.renderFile).toHaveBeenCalledWith(
      expect.stringContaining('use-case.eta'),
      expect.anything(),
      expect.objectContaining({
        imports: expect.arrayContaining([
          expect.stringContaining("from '@org/domains/other-domain'"),
        ]),
        dependencies: expect.arrayContaining([
          expect.stringContaining('paymentGateway: payment-gateway'),
        ]),
      }),
      expect.anything()
    )
  })
})

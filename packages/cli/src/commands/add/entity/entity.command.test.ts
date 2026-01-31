import * as prompts from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as projectUtils from '../../../utils/project'
import * as portCommand from '../port/port.command'
import { runAddEntity } from './entity.command'

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
        entities: [],
        ports: [],
        useCases: [],
      },
    },
  })),
  writeKompoConfig: vi.fn(),
  LIBS_DIR: 'libs',
}))

const { mockFs, mockTemplates } = vi.hoisted(() => ({
  mockFs: {
    ensureDir: vi.fn().mockResolvedValue(undefined),
    fileExists: vi.fn().mockResolvedValue(false),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
  mockTemplates: {
    render: vi.fn().mockResolvedValue('mock-content'),
    renderDir: vi.fn().mockResolvedValue(undefined),
    renderFile: vi.fn().mockResolvedValue(undefined),
  },
}))

// Mock FS and Template Engine
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

describe('runAddEntity', () => {
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
            entities: [],
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

  it('should create entity in specified domain', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('test-domain')
    vi.mocked(prompts.confirm).mockResolvedValueOnce(false)

    await runAddEntity('user-profile', {}, {} as any)

    expect(mockFs.ensureDir).toHaveBeenCalled()
    expect(mockTemplates.renderFile).toHaveBeenCalledWith(
      expect.stringContaining('entity.eta'),
      expect.stringContaining('user-profile.entity.ts'),
      expect.anything(),
      expect.anything()
    )
  })

  it('should generate VO if requested', async () => {
    vi.mocked(prompts.confirm).mockResolvedValueOnce(false)

    await runAddEntity('order', { domain: 'test-domain', vo: 'order-id' }, {} as any)

    expect(mockTemplates.renderFile).toHaveBeenCalledWith(
      expect.stringContaining('value-object.eta'),
      expect.stringContaining('OrderId.ts'),
      expect.anything(),
      expect.anything()
    )
  })

  it('should trigger port creation if confirmed', async () => {
    vi.mocked(prompts.confirm).mockResolvedValueOnce(true)

    await runAddEntity('product', { domain: 'test-domain' }, {} as any)

    expect(portCommand.runAddPort).toHaveBeenCalled()
  })
})

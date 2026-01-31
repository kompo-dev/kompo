import * as prompts from '@clack/prompts'
import { Command } from 'commander'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as domainGenerator from '../../../generators/domain.generator'
import * as projectUtils from '../../../utils/project'
import { runAddEntity } from '../entity/entity.command'
import { runAddUseCase } from '../use-case/use-case.command'
import { runAddDomain } from './domain.command'

// Mock dependencies
vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn((val) => val === Symbol.for('clack:cancel')),
  log: {
    message: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  intro: vi.fn(),
  outro: vi.fn(),
  spinner: () => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() }),
}))

vi.mock('../../../utils/project', () => ({
  findRepoRoot: vi.fn(),
  ensureProjectContext: vi.fn(),
  getDomains: vi.fn(),
  getDomainPath: vi.fn(),
  getTemplateEngine: vi.fn(),
  getApps: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../../generators/domain.generator')
vi.mock('../../../utils/format')
vi.mock('@kompo/kit', () => ({
  readKompoConfig: vi.fn(() => ({
    version: 1,
    project: { name: 'test', org: 'test-org' },
    catalog: { lastUpdated: '2024-01-01', sources: [] },
    apps: {},
    steps: [],
    domains: {},
  })),
  writeKompoConfig: vi.fn(),
  LIBS_DIR: 'libs',
}))
vi.mock('../entity/entity.command')
vi.mock('../port/port.command')
vi.mock('../use-case/use-case.command')
vi.mock('../value-object/value-object.command')
vi.mock('../adapter/adapter.command')
vi.mock('../../../engine/fs-engine', () => ({
  createFsEngine: () => ({
    fileExists: vi.fn().mockResolvedValue(false),
  }),
}))

describe('runAddDomain', () => {
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
        domains: {},
      },
    } as any)
    vi.mocked(projectUtils.getDomainPath).mockResolvedValue('/mock/root/domains/src/test-domain')
    vi.mocked(prompts.confirm).mockResolvedValue(false)
  })

  it('should create domain and trigger runAddUseCase when selected', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('use-case')
    vi.mocked(prompts.text).mockResolvedValueOnce('register-user')
    vi.mocked(prompts.confirm).mockResolvedValue(false)

    await runAddDomain('test-domain', {}, new Command())

    expect(domainGenerator.generateDomain).toHaveBeenCalledWith(
      expect.objectContaining({
        domainName: 'test-domain',
        skipEntity: true,
      })
    )

    expect(runAddUseCase).toHaveBeenCalledWith('register-user', { domain: 'test-domain' })
  })

  it('should create domain and trigger runAddEntity when selected', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('entity')
    vi.mocked(prompts.text).mockResolvedValueOnce('User')
    vi.mocked(prompts.confirm).mockResolvedValue(false)

    await runAddDomain('test-domain', {}, new Command())

    expect(runAddEntity).toHaveBeenCalledWith('User', { domain: 'test-domain' }, expect.anything())
  })
})

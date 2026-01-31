// 3. Imports
import * as prompts from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as portGenerator from '../../../generators/port.generator'
import * as projectUtils from '../../../utils/project'
import { runAddAdapter } from '../adapter/adapter.command'
import { runAddPort } from './port.command'

// 1. Stable Mock Objects
const mockFs = {
  ensureDir: vi.fn().mockResolvedValue(undefined),
  fileExists: vi.fn().mockResolvedValue(false),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readJson: vi.fn().mockResolvedValue({}),
  readFile: vi.fn().mockResolvedValue(''),
}

// 2. Hoist Mocks
vi.mock('../../../engine/fs-engine', () => ({
  createFsEngine: vi.fn(() => mockFs),
}))

vi.mock('../../../generators/domain.generator', () => ({
  generateDomain: vi.fn(),
}))
vi.mock('../../../generators/port.generator', () => ({
  generatePort: vi.fn(),
}))
vi.mock('../adapter/adapter.command', () => ({
  runAddAdapter: vi.fn(),
}))
vi.mock('../../../utils/project', () => ({
  findRepoRoot: vi.fn(),
  ensureProjectContext: vi.fn(),
  getDomains: vi.fn(),
  getDomainPath: vi.fn(),
  getTemplateEngine: vi.fn(),
  getApps: vi.fn().mockResolvedValue([]),
}))
vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  text: vi.fn(),
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
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  spinner: () => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() }),
}))

// Mock kit
vi.mock('@kompo/kit', () => ({
  readKompoConfig: vi.fn(),
  writeKompoConfig: vi.fn(),
  LIBS_DIR: 'libs',
  PORT_DEFINITIONS: [
    { value: 'repository', icon: '📦', label: 'Repository', capabilities: ['orm'] },
    { value: 'other', icon: '🔌', label: 'Other' },
  ],
}))

describe('runAddPort', () => {
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
          'existing-domain': {
            entities: [],
            ports: [],
            useCases: [],
          },
        },
      },
    } as any)
    vi.mocked(projectUtils.getDomains).mockResolvedValue(['existing-domain'])
    vi.mocked(projectUtils.getDomainPath).mockResolvedValue('/mock/root/domains/existing-domain')

    vi.mocked(prompts.confirm).mockResolvedValue(false)
    vi.mocked(prompts.select).mockResolvedValue('other')
  })

  it('should create a port in an existing domain', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('repository')
    vi.mocked(prompts.confirm).mockResolvedValue(false)

    await runAddPort('user-repository', { domain: 'existing-domain' })

    expect(portGenerator.generatePort).toHaveBeenCalled()
  })

  it('should trigger adapter wizard if autoLink is confirmed', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('repository')
    vi.mocked(prompts.confirm).mockResolvedValueOnce(true) // Autowire? Yes

    await runAddPort('user-repository', { domain: 'existing-domain' })

    expect(runAddAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 'user-repository',
      })
    )
  })
})

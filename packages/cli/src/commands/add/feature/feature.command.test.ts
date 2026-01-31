import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as featureRegistry from '../../../registries/feature.registry'
import * as projectUtils from '../../../utils/project'
import { runAddDomain } from '../domain/domain.command'
import { runAddEntity } from '../entity/entity.command'
import { runAddFeature } from './feature.command'

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

vi.mock('../domain/domain.command', () => ({ runAddDomain: vi.fn() }))
vi.mock('../entity/entity.command', () => ({ runAddEntity: vi.fn() }))
vi.mock('../port/port.command', () => ({ runAddPort: vi.fn() }))
vi.mock('../use-case/use-case.command', () => ({ runAddUseCase: vi.fn() }))
vi.mock('../adapter/adapter.command', () => ({ runAddAdapter: vi.fn() }))
vi.mock('../../wire.command', () => ({ runWire: vi.fn() }))

vi.mock('../../../utils/project', () => ({
  ensureProjectContext: vi.fn(),
  findRepoRoot: vi.fn(),
}))

vi.mock('../../../registries/feature.registry', () => ({
  getFeature: vi.fn(),
  registerFeatureProvider: vi.fn(),
}))

vi.mock('@clack/prompts', () => ({
  log: {
    message: vi.fn(),
    success: vi.fn(),
  },
}))

describe('runAddFeature', () => {
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
        domains: {},
      },
    } as any)
    mockFs.fileExists.mockResolvedValue(false)
    vi.mocked(featureRegistry.getFeature).mockResolvedValue(null)
  })

  it('should install feature from registry', async () => {
    const mockFeature = {
      id: 'auth',
      name: 'auth',
      type: 'feature',
      steps: [
        { command: 'add', type: 'domain', name: 'auth' },
        { command: 'add', type: 'entity', name: 'user', domain: 'auth' },
      ],
    }

    vi.mocked(featureRegistry.getFeature).mockResolvedValue(mockFeature as any)

    await runAddFeature('auth')

    expect(runAddDomain).toHaveBeenCalledWith('auth', expect.objectContaining({ skipEntity: true }))
    expect(runAddEntity).toHaveBeenCalled()
  })

  it('should install feature from local file', async () => {
    mockFs.fileExists.mockImplementation(async (p) => p.endsWith('my-feature.json'))
    mockFs.readJson.mockResolvedValue({
      id: 'custom',
      name: 'custom',
      type: 'feature',
      steps: [{ command: 'add', type: 'domain', name: 'blog' }],
    })

    await runAddFeature('my-feature.json')

    expect(runAddDomain).toHaveBeenCalledWith('blog', expect.objectContaining({ skipEntity: true }))
  })
})

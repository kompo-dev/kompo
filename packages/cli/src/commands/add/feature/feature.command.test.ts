import { describe, expect, it, vi } from 'vitest'
import * as featureRegistry from '../../../registries/feature.registry'
import * as projectUtils from '../../../utils/project'
import * as adapterCommand from '../adapter/adapter.command'
import * as domainCommand from '../domain/domain.command'
import * as entityCommand from '../entity/entity.command'
import * as portCommand from '../port/port.command'
import * as useCaseCommand from '../use-case/use-case.command'
import { runAddFeature } from './feature.command'

// Mock dependencies
vi.mock('../../../utils/project')
vi.mock('../../../registries/feature.registry')
vi.mock('../adapter/adapter.command')
vi.mock('../domain/domain.command')
vi.mock('../entity/entity.command')
vi.mock('../port/port.command')
vi.mock('../use-case/use-case.command')

const { mockFs } = vi.hoisted(() => ({
  mockFs: {
    fileExists: vi.fn(),
    readJson: vi.fn(),
  },
}))

vi.mock('../../../engine/fs-engine', () => ({
  createFsEngine: () => mockFs,
}))

describe('runAddFeature', () => {
  vi.mocked(projectUtils.findRepoRoot).mockResolvedValue('/mock/root')

  it('should install feature from registry', async () => {
    const mockFeature = {
      name: 'auth',
      domains: [
        {
          name: 'auth',
          entities: ['user', 'session'],
          ports: ['user-repository'],
          'use-cases': ['login', 'register'],
        },
      ],
      adapters: [{ name: 'pg-adapter', port: 'user-repository', driver: 'postgres', app: 'web' }],
    }

    vi.mocked(featureRegistry.getFeature).mockResolvedValue(mockFeature as any)

    await runAddFeature('auth')

    // Verify sub-commands call
    expect(domainCommand.runAddDomain).toHaveBeenCalledWith(
      'auth',
      expect.objectContaining({ skipEntity: true }),
      expect.anything()
    )
    expect(entityCommand.runAddEntity).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({ domain: 'auth' }),
      expect.anything()
    )
    expect(entityCommand.runAddEntity).toHaveBeenCalledWith(
      'session',
      expect.objectContaining({ domain: 'auth' }),
      expect.anything()
    )
    expect(portCommand.runAddPort).toHaveBeenCalledWith(
      'user-repository',
      expect.objectContaining({ domain: 'auth' })
    )
    expect(useCaseCommand.runAddUseCase).toHaveBeenCalledWith(
      'login',
      expect.objectContaining({ domain: 'auth' })
    )
    expect(adapterCommand.runAddAdapter).toHaveBeenCalledWith(
      'user-repository',
      expect.objectContaining({ driver: 'postgres', name: 'pg-adapter' })
    )
  })

  it('should install feature from local file', async () => {
    mockFs.fileExists.mockImplementation(async (p) => p.endsWith('my-feature.json'))
    mockFs.readJson.mockResolvedValue({
      name: 'custom',
      domains: [{ name: 'blog' }],
    })

    await runAddFeature('my-feature.json')

    expect(domainCommand.runAddDomain).toHaveBeenCalledWith(
      'blog',
      expect.objectContaining({ skipEntity: true }),
      expect.anything()
    )
  })
})

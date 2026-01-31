import * as prompts from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as adapterRegistry from '../../../registries/adapter.registry'
import * as projectUtils from '../../../utils/project'
import { runAddPort } from '../port/port.command'
import { runAddAdapter } from './adapter.command'

// Hoist mocks
const { mockGenerator } = vi.hoisted(() => ({
  mockGenerator: vi.fn(),
}))

// Mock dependencies
vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
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

vi.mock('../../../utils/project', () => ({
  findRepoRoot: vi.fn(),
  ensureProjectContext: vi.fn(),
  getAvailablePorts: vi.fn(),
  getPortRegistry: vi.fn(),
  getDomains: vi.fn(),
  getDomainPath: vi.fn(),
  getTemplateEngine: vi.fn(),
  getApps: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../../registries/adapter.registry', () => ({
  getRegisteredAdapters: vi.fn(),
  registerAdapterGenerator: vi.fn(),
}))

vi.mock('@kompo/kit', () => ({
  readKompoConfig: vi.fn(),
  writeKompoConfig: vi.fn(),
  LIBS_DIR: 'libs',
  PORT_DEFINITIONS: [
    {
      value: 'repository',
      icon: '📦',
      label: 'Repository',
      suffix: 'repository',
      capabilities: ['orm'],
    },
    { value: 'other', icon: '🔌', label: 'Other' },
  ],
}))

vi.mock('../port/port.command', () => ({
  runAddPort: vi.fn(),
}))

vi.mock('../../../utils/format')

describe('runAddAdapter', () => {
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
            ports: [{ name: 'user-repository', type: 'repository' }],
            useCases: [],
          },
        },
      },
    } as any)
    vi.mocked(projectUtils.getAvailablePorts).mockResolvedValue(['user-repository'])
    vi.mocked(projectUtils.getPortRegistry).mockResolvedValue([
      { name: 'user-repository', domain: 'test-domain', type: 'repository' },
    ])
    vi.mocked(adapterRegistry.getRegisteredAdapters).mockReturnValue([
      {
        capability: {
          id: 'orm',
          name: 'ORM',
          kind: 'repository',
          defaultSubject: 'db',
          description: 'ORM',
          plan: 'community',
          status: 'available',
          providers: [
            {
              id: 'drizzle',
              name: 'Drizzle',
              plan: 'community',
              status: 'available',
              description: 'Drizzle ORM',
              drivers: [{ id: 'pglite', name: 'PGLite', plan: 'community', status: 'available' }],
            },
          ],
        },
        generator: mockGenerator,
      },
    ])
  })

  it('should allow selecting an existing port and generating adapter', async () => {
    // EXISTING:domain:name:type
    vi.mocked(prompts.select).mockResolvedValueOnce(
      'EXISTING:test-domain:user-repository:repository'
    )
    vi.mocked(prompts.select).mockResolvedValueOnce('orm')
    vi.mocked(prompts.select).mockResolvedValueOnce('drizzle')

    await runAddAdapter({})

    expect(mockGenerator).toHaveBeenCalled()
  })

  it('should switch to port creation if "CREATE_NEW" is selected', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('CREATE_NEW')
    vi.mocked(runAddPort).mockResolvedValueOnce({ domain: 'test-domain', portName: 'new-port' })

    // Step 3: select capability
    vi.mocked(prompts.select).mockResolvedValueOnce('orm')
    // Step 4: select provider
    vi.mocked(prompts.select).mockResolvedValueOnce('drizzle')

    await runAddAdapter({})

    expect(runAddPort).toHaveBeenCalled()
    expect(mockGenerator).toHaveBeenCalled()
  })
})

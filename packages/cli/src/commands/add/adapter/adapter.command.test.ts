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
vi.mock('@clack/prompts', async (importOriginal) => {
  const actual = await importOriginal<typeof prompts>()
  return {
    ...actual,
    select: vi.fn(),
    text: vi.fn(),
    isCancel: vi.fn((val) => val === Symbol.for('clack:cancel')),
    cancel: vi.fn(),
  }
})

vi.mock('../../../utils/project', async (importOriginal) => {
  const actual = await importOriginal<typeof projectUtils>()
  return {
    ...actual,
    findRepoRoot: vi.fn().mockResolvedValue('/mock/root'),
    getAvailablePorts: vi.fn().mockResolvedValue(['user-repository']),
  }
})

vi.mock('../../../registries/adapter.registry', () => ({
  getRegisteredAdapters: vi.fn().mockReturnValue([
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
            drivers: [
              { id: 'pglite', name: 'PGLite', plan: 'community', status: 'available' },
              { id: 'postgres', name: 'Postgres', plan: 'community', status: 'available' },
            ],
          },
        ],
      },
      generator: mockGenerator,
    },
  ]),
  registerAdapterGenerator: vi.fn(),
}))

vi.mock('@kompo/kit', () => ({
  readKompoConfig: vi.fn(() => ({
    domains: {
      'test-domain': {
        ports: [{ name: 'user-repository', type: 'repository' }],
      },
    },
  })),
}))

vi.mock('../port/port.command')
vi.mock('../../../utils/format')

describe('runAddAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(projectUtils.findRepoRoot).mockResolvedValue('/mock/root')
    vi.mocked(projectUtils.getAvailablePorts).mockResolvedValue(['user-repository'])
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
    // 1. Select Port -> 'user-repository'
    vi.mocked(prompts.select).mockResolvedValueOnce('user-repository')

    // 2. Select Capability -> 'orm'
    vi.mocked(prompts.select).mockResolvedValueOnce('orm')

    // 3. Select Provider -> 'drizzle'
    vi.mocked(prompts.select).mockResolvedValueOnce('drizzle')

    // 4. Select Driver -> 'pglite'
    // Since only 1 driver is mocked in beforeEach defaults ( wait, I redefined it in beforeEach),
    // logic in adapter.command lines 203+ checks if drivers > 1.
    // In my beforeEach mock I defined 1 driver 'pglite'. So it should skip driver select.

    await runAddAdapter({})

    expect(mockGenerator).toHaveBeenCalledWith(
      expect.objectContaining({
        portName: 'user-repository',
        provider: expect.objectContaining({ id: 'drizzle' }),
        driverStr: 'pglite',
      })
    )
  })

  it('should switch to port creation if "Create New Port" is selected', async () => {
    // 1. Select Port -> 'new'
    vi.mocked(prompts.select).mockResolvedValueOnce('new')

    // 2. Enter Port Name -> 'new-port'
    vi.mocked(prompts.text).mockResolvedValueOnce('new-port')

    await runAddAdapter({})

    expect(runAddPort).toHaveBeenCalledWith('new-port', expect.objectContaining({ autoWire: true }))
    expect(mockGenerator).not.toHaveBeenCalled()
  })

  it('should filter capabilities if allowedCapabilities provided', async () => {
    // Start with empty dependencies to test filter logic? No, mocks are provided.
    // If I pass allowedCapabilities: ['orm'], accessing non-orm should be filtered.
    // Let's add another capability to registry mock first to prove filtering.
    vi.mocked(adapterRegistry.getRegisteredAdapters).mockReturnValue([
      {
        capability: {
          id: 'orm',
          name: 'ORM',
          kind: 'adapter',
          defaultSubject: 'db',
          description: 'desc',
          providers: [
            {
              id: 'p1',
              name: 'P1',
              plan: 'community',
              status: 'available',
              description: 'desc',
              drivers: [
                {
                  id: 'd1',
                  name: 'D1',
                  plan: 'community',
                  status: 'available',
                },
              ],
            },
          ],
        },
        generator: mockGenerator,
      },
      {
        capability: {
          id: 'wallet',
          name: 'Wallet',
          kind: 'adapter',
          defaultSubject: 'wallet',
          description: 'desc',
          plan: 'community',
          status: 'available',
          providers: [],
        },
        generator: mockGenerator,
      },
    ])

    // Mock capability AND provider/driver selection
    vi.mocked(prompts.select)
      .mockResolvedValueOnce('orm') // Capability
      .mockResolvedValueOnce('p1') // Provider
    // .mockResolvedValueOnce('d1') // Driver (implicit if only 1 driver? Logic says if drivers > 1 ask, else auto. Here 1 driver in provider)
    // Actually if 1 driver, provider prompt is enough?
    // Logic: select Provider. Then if provider.drivers.length > 1 select Driver.
    // My mock provider has 1 driver. So it should not ask for driver.

    await runAddAdapter({ port: 'user-repository', allowedCapabilities: ['orm'] })

    expect(mockGenerator).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: expect.objectContaining({ id: 'orm' }),
        provider: expect.objectContaining({ id: 'p1' }),
      })
    )
  })

  it('should infer capability from port type if not provided', async () => {
    // Port: 'user-repository' -> Type: 'repository' -> Capabilities: ['orm', ...]

    // ensure capabilities are filtered to ORM
    vi.mocked(adapterRegistry.getRegisteredAdapters).mockReturnValue([
      {
        capability: {
          id: 'orm',
          name: 'ORM',
          kind: 'adapter',
          defaultSubject: 'db',
          description: 'desc',
          plan: 'community',
          status: 'available',
          providers: [
            {
              id: 'p1',
              name: 'P1',
              plan: 'community',
              status: 'available',
              description: 'desc',
              drivers: [
                {
                  id: 'd1',
                  name: 'D1',
                  plan: 'community',
                  status: 'available',
                },
              ],
            },
          ],
        },
        generator: mockGenerator,
      },
      {
        capability: {
          id: 'rpc',
          name: 'RPC',
          kind: 'adapter',
          defaultSubject: 'subject',
          description: 'desc',
          plan: 'community',
          status: 'available',
          providers: [],
        },
        generator: mockGenerator,
      },
    ])

    // Select Capability -> 'orm'
    vi.mocked(prompts.select)
      .mockResolvedValueOnce('orm') // Capability
      .mockResolvedValueOnce('p1') // Provider

    await runAddAdapter({ port: 'user-repository' })

    expect(mockGenerator).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: expect.objectContaining({ id: 'orm' }),
      })
    )
  })
})

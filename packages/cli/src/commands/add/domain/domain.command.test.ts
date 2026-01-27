import * as prompts from '@clack/prompts'
import { Command } from 'commander'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as domainGenerator from '../../../generators/domain.generator'
import * as projectUtils from '../../../utils/project'
import { runAddAdapter } from '../adapter/adapter.command'
import { runAddEntity } from '../entity/entity.command'
import { runAddPort } from '../port/port.command'
import { runAddUseCase } from '../use-case/use-case.command'
import { runAddValueObject } from '../value-object/value-object.command'
import { runAddDomain } from './domain.command'

// Mock dependencies
vi.mock('@clack/prompts', async (importOriginal) => {
  const actual = await importOriginal<typeof prompts>()
  return {
    ...actual,
    select: vi.fn(),
    text: vi.fn(),
    isCancel: vi.fn((val) => val === Symbol.for('clack:cancel')),
    log: {
      error: vi.fn(),
      message: vi.fn(),
      info: vi.fn(),
    },
    intro: vi.fn(),
    outro: vi.fn(),
    spinner: () => ({
      start: vi.fn(),
      stop: vi.fn(),
    }),
  }
})
vi.mock('../../../utils/project')
vi.mock('../../../generators/domain.generator')
vi.mock('../../../utils/format')
vi.mock('@kompo/kit', () => ({
  readKompoConfig: vi.fn(() => ({
    project: { org: 'test-org' },
    domains: {},
  })),
  writeKompoConfig: vi.fn(),
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
    // Default mocks
    vi.mocked(projectUtils.findRepoRoot).mockResolvedValue('/mock/root')
    vi.mocked(projectUtils.getDomainPath).mockResolvedValue('/mock/root/domains/src/test-domain')
  })

  it('should create domain and trigger runAddUseCase when selected', async () => {
    // 1. Mock Prompt Responses for the "Connected Graph" flow
    vi.mocked(prompts.select).mockResolvedValueOnce('use-case') // Select 'Use Case'
    vi.mocked(prompts.text).mockResolvedValueOnce('register-user') // Enter use case name

    // 2. Run Command
    await runAddDomain('test-domain', {}, new Command())

    // 3. Verify Domain Generation was called
    expect(domainGenerator.generateDomain).toHaveBeenCalledWith(
      expect.objectContaining({
        domainName: 'test-domain',
        skipEntity: true,
      })
    )

    // 4. Verify runAddUseCase was triggered with correct args
    expect(runAddUseCase).toHaveBeenCalledWith('register-user', { domain: 'test-domain' })

    // 5. Verify others were NOT called
    expect(runAddEntity).not.toHaveBeenCalled()
  })

  it('should create domain and trigger runAddEntity when selected', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('entity')
    vi.mocked(prompts.text).mockResolvedValueOnce('User')

    await runAddDomain('test-domain', {}, new Command())

    expect(runAddEntity).toHaveBeenCalledWith('User', { domain: 'test-domain' }, expect.anything())
  })

  it('should create domain and trigger runAddValueObject when selected', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('value-object')
    vi.mocked(prompts.text).mockResolvedValueOnce('UserId')

    await runAddDomain('test-domain', {}, new Command())

    expect(runAddValueObject).toHaveBeenCalledWith('UserId', { domain: 'test-domain' })
  })

  it('should create domain and trigger runAddPort when selected', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('port')
    vi.mocked(prompts.text).mockResolvedValueOnce('user')

    await runAddDomain('test-domain', {}, new Command())

    expect(runAddPort).toHaveBeenCalledWith('user', { domain: 'test-domain' })
  })

  it('should create domain and trigger runAddAdapter when selected', async () => {
    vi.mocked(prompts.select).mockResolvedValueOnce('adapter')

    await runAddDomain('test-domain', {}, new Command())

    expect(runAddAdapter).toHaveBeenCalledWith({ skipTests: false })
  })
})

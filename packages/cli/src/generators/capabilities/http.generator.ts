import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { getPortPrefix } from '../../utils/naming'
import { createHttpAliasValidator } from '../../validations/naming.validation'
import { createAdapterGenerator } from '../composition/factory'
import { stepRegistry } from '../composition/step.registry'
import { registerCoreSteps } from '../composition/steps/core.steps'

registerCoreSteps(stepRegistry)

export const httpCapability: CapabilityManifest = {
  id: 'http',
  name: 'HTTP',
  kind: 'adapter',
  icon: '☁️ ',
  description: 'HTTP Client Adapters (Axios, Fetch)',
  defaultSubject: 'http-client',
  providers: loadProvidersFromBlueprints('http'),
  configure: async ({ repoRoot, portName, providerId }) => {
    const { text, isCancel, cancel } = await import('@clack/prompts')
    const { getSimilarAdaptersForPort } = await import('../../utils/config')

    // Check existing
    const existingAdapters = getSimilarAdaptersForPort(
      repoRoot,
      portName,
      httpCapability.id,
      providerId
    )
    const usedAliases = existingAdapters.map((a) => a.alias)

    // We always want a specialized client (Service/API) to enforce DDD
    // Use the port prefix as suggested alias (e.g. nft-gateway -> nft)
    const portPrefix = getPortPrefix(portName)
    let suggestedAlias = portPrefix
    let counter = 2
    while (usedAliases.includes(suggestedAlias)) {
      suggestedAlias = `${portPrefix}-${counter}`
      counter++
    }

    const validator = createHttpAliasValidator(usedAliases, suggestedAlias)

    const aliasResponse = await text({
      message: 'What is the name of this Service/API?',
      placeholder: suggestedAlias,
      defaultValue: suggestedAlias,
      validate: validator,
    })

    if (isCancel(aliasResponse)) {
      cancel('Operation cancelled.')
      process.exit(0)
    }

    return {
      isSpecializedClient: true,
      alias: aliasResponse as string,
    }
  },
}

export const generateHttpAdapter = createAdapterGenerator({
  capability: httpCapability,
  envInjectionPolicy: 'specialized',
})

registerAdapterGenerator(httpCapability, generateHttpAdapter)

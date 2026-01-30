import path from 'node:path'
import { LIBS_DIR } from '@kompo/kit'
import { registerAdapterGenerator } from '../../registries/adapter.registry'
import type { CapabilityManifest } from '../../registries/capability.registry'
import { loadProvidersFromBlueprints } from '../../utils/blueprints.utils'
import { getInfraDirName } from '../../utils/naming'
import { createAdapterGenerator } from '../composition/factory'
import { stepRegistry } from '../composition/step.registry'
import { registerCoreSteps } from '../composition/steps/core.steps'
import type { AdapterGeneratorContext, GeneratorUtils } from '../composition/types'

registerCoreSteps(stepRegistry)

stepRegistry.register({
  id: 'orm:generate-schema',
  execute: async (context: AdapterGeneratorContext, utils: GeneratorUtils) => {
    const { templateBase, templateData } = context
    const subject = context.capability.defaultSubject
    const infraName = getInfraDirName(subject, templateData.alias as string)
    const infraDest = path.join(context.repoRoot, LIBS_DIR, 'infra', infraName)

    const schemaName = (templateData.domainName as string) || (templateData.portCamelName as string)
    const schemaDest = path.join(infraDest, 'src/schemas', `${schemaName}.ts`)
    const schemaSnippetPath = path.join(templateBase, 'snippets', 'schema-definition.ts.eta')

    if (await utils.templates.exists(schemaSnippetPath)) {
      await utils.fs.ensureDir(path.dirname(schemaDest))
      await utils.templates.renderFile(schemaSnippetPath, schemaDest, templateData)
      utils.addSummary(
        `   Generated centralized schema: libs/infra/${infraName}/src/schemas/${schemaName}.ts`
      )

      // Update infra barrel schema.ts to re-export the new schema using merging
      const infraSchemaPath = path.join(infraDest, 'src/schema.ts')
      const exportSnippetPath = path.join(templateBase, 'snippets', 'infra-schema-export.ts.eta')
      if (await utils.templates.exists(exportSnippetPath)) {
        await utils.templates.renderFile(exportSnippetPath, infraSchemaPath, templateData, {
          merge: true,
        })
        utils.addSummary(`   Updated re-exports: libs/infra/${infraName}/src/schema.ts`)
      }
    }
  },
})

export const ormCapability: CapabilityManifest = {
  id: 'orm',
  name: 'ORM',
  kind: 'repository',
  icon: '🗄️ ',
  description: 'Object-Relational Mapping',
  hint: 'Database Access (Drizzle, Prisma)',
  defaultSubject: 'db',
  providers: loadProvidersFromBlueprints('orm'),
  configure: async () => {
    // Scope is now handled globally in adapter.command.ts
    return {}
  },
}

export const generateOrmAdapter = createAdapterGenerator({
  capability: ormCapability,
  envInjectionPolicy: 'all',
  customSteps: ['orm:generate-schema'],
})

registerAdapterGenerator(ormCapability, generateOrmAdapter)

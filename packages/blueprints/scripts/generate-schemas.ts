import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { blueprintSchema, featureManifestSchema, starterManifestSchema } from '../src/index'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT_DIR = join(__dirname, '..')

const schemas = [
  {
    schema: blueprintSchema,
    name: 'blueprint.schema.json',
    title: 'Kompo Blueprint Schema',
  },
  {
    schema: starterManifestSchema,
    name: 'starter.schema.json',
    title: 'Kompo Starter Schema',
  },
  {
    schema: featureManifestSchema,
    name: 'feature.schema.json',
    title: 'Kompo Feature Schema',
  },
]

console.log('🚀 Generating JSON schemas from Zod definitions...')

for (const { schema, name, title } of schemas) {
  const jsonSchema = zodToJsonSchema(schema, {
    basePath: ['#'],
    name: title,
    definitionPath: 'definitions',
  })

  const outputPath = join(ROOT_DIR, name)
  writeFileSync(outputPath, JSON.stringify(jsonSchema, null, 2))
  console.log(`✅ Generated ${name}`)
}

console.log('✨ All schemas generated successfully!')

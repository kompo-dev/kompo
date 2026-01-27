import { Project, SyntaxKind } from 'ts-morph'
import { z } from 'zod'
import { validateKebabCase } from '../validations/naming.validation'

const project = new Project({ useInMemoryFileSystem: true })
const validZodMethods = ['string', 'number', 'boolean', 'object', 'array', 'url', 'enum']

function validateZodStringSafe(expr: string): boolean {
  if (!expr.startsWith('z.')) return false
  try {
    const sourceFile = project.createSourceFile(`temp_${Math.random()}.ts`, expr)
    const statement = sourceFile.getStatements()[0]

    if (!statement || !statement.isKind(SyntaxKind.ExpressionStatement)) return false

    const callExpr = statement.getExpression()
    if (!callExpr || !callExpr.isKind(SyntaxKind.CallExpression)) return false

    const access = callExpr.getExpression()
    if (!access || !access.isKind(SyntaxKind.PropertyAccessExpression)) return false

    const obj = access.getExpression()
    const prop = access.getName()

    const isValid = obj.getText() === 'z' && validZodMethods.includes(prop)

    sourceFile.delete()
    return isValid
  } catch {
    return false
  }
}

export const adapterBlueprintSchema = z.object({
  id: z
    .string()
    .min(1, 'ID is required')
    .regex(/^[a-z0-9-]+$/, 'ID must be kebab-case'),
  name: z
    .string()
    .min(1, 'Adapter name is required')
    .refine((val) => !validateKebabCase(val), {
      message: 'Name must be kebab-case',
    }),
  version: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(['app', 'adapter', 'driver', 'feature', 'starter']),
  category: z.string().optional(),
  capability: z.string().optional(),
  sharedDriver: z.string().optional(),
  drivers: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        runtime: z.boolean().optional(),
        sharedDriver: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .optional(),
  provides: z.object({
    providers: z.boolean().optional(),
    composition: z.boolean().optional(),
    factory: z.string().optional(),
    exports: z.array(z.string()).optional(),
    driver: z.string().optional(),
  }),
  env: z
    .record(
      z.object({
        side: z.enum(['client', 'server']).default('server'),
        description: z.string().optional(),
        validation: z.string().refine((val) => validateZodStringSafe(val), {
          message: 'Invalid Zod validation string (must be like z.string(), z.number(), etc.)',
        }),
        default: z.string().optional(),
        mapTo: z.string().optional(),
        scoped: z.boolean().optional().default(true),
      })
    )
    .optional(),
  hooks: z.record(z.string()).optional(),
})

export type AdapterBlueprint = z.infer<typeof adapterBlueprintSchema>

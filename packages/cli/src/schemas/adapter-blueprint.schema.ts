import { z } from 'zod'
import { validateKebabCase } from '../validations/naming.validation'

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
  provides: z
    .object({
      providers: z.boolean().optional(),
      composition: z.boolean().optional(),
      factory: z.string().optional(),
      exports: z.array(z.string()).optional(),
      driver: z.string().optional(),
    })
    .optional(),
  env: z
    .record(
      z.object({
        side: z.enum(['client', 'server']),
        description: z.string().optional(),
        validation: z.string().refine((val) => val.startsWith('z.'), {
          message: 'Invalid Zod validation string (must start with "z.")',
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

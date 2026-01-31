import { z } from 'zod'

export const baseBlueprintSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required'),
  version: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  path: z.string().optional(),
})

export const appBlueprintSchema = baseBlueprintSchema.extend({
  type: z.literal('app'),
  framework: z.string().optional(),
  category: z.string().optional(),
  env: z.record(z.string(), z.any()).optional(),
})

export const adapterBlueprintSchema = baseBlueprintSchema.extend({
  type: z.literal('adapter'),
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
      z.string(),
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
  hooks: z.record(z.string(), z.string()).optional(),
})

export const driverBlueprintSchema = baseBlueprintSchema.extend({
  type: z.literal('driver'),
  sharedDriver: z.string(),
  env: z.record(z.string(), z.any()).optional(),
})

export const blueprintSchema = z.discriminatedUnion('type', [
  appBlueprintSchema,
  adapterBlueprintSchema,
  driverBlueprintSchema,
])

export type Blueprint = z.infer<typeof blueprintSchema>
export type AppBlueprint = z.infer<typeof appBlueprintSchema>
export type AdapterBlueprint = z.infer<typeof adapterBlueprintSchema>
export type DriverBlueprint = z.infer<typeof driverBlueprintSchema>

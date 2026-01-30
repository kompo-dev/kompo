import { z } from 'zod'
import { stepSchema } from './step.schema'

export const featureManifestSchema = z
  .object({
    id: z.string().min(1, 'ID is required'),
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    type: z.literal('feature'),
    tags: z.array(z.string()).optional(),
    path: z.string().optional(),
    features: z.array(z.string()).optional(),
    steps: z.array(stepSchema).optional(),
    category: z.string().optional(),
    env: z.record(z.string(), z.any()).optional(),
  })
  .catchall(z.any())

export type FeatureManifest = z.infer<typeof featureManifestSchema>

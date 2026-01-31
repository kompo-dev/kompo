import { z } from 'zod'
import { stepSchema } from './step.schema'

export const starterManifestSchema = z
  .object({
    id: z.string().min(1, 'ID is required'),
    name: z.string().min(1, 'Name is required'),
    description: z.string().min(1, 'Description is required'),
    steps: z.array(stepSchema).min(1, 'Starter must have at least one step'),
    path: z.string().optional(),
  })
  .catchall(z.any()) // Allow extra fields at root

export type StarterManifest = z.infer<typeof starterManifestSchema>

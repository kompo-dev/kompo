import { z } from 'zod'

/**
 * Validation schema for a single orchestration step.
 * Unified source of truth for all components.
 */
export const stepSchema = z
  .object({
    command: z.enum(['new', 'add', 'remove', 'wire', 'generate']),
    type: z.enum([
      'app',
      'feature',
      'domain',
      'port',
      'adapter',
      'case',
      'entity',
      'driver',
      'design-system',
      'use-case', // Added to match some actual usages if any, or normalize it
    ]),
    name: z.string().min(1, 'Name is required'),
    // Step-specific fields
    driver: z.string().optional(),
    sharedDriver: z.string().optional(),
    port: z.string().optional(),
    domain: z.string().optional(),
    capability: z.string().optional(),
    app: z.string().optional(),
    alias: z.string().optional(),
    designSystem: z.string().optional(),
    design: z.string().optional(),
    portType: z.string().optional(),
    framework: z.string().optional(),
  })
  .catchall(z.any())

export type Step = z.infer<typeof stepSchema>

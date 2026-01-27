import { z } from 'zod'

/**
 * Strict validation schema for a single orchestration step.
 * Corresponds to StepEntry in @kompo/kit.
 */
export const stepSchema = z
  .object({
    command: z.enum(['new', 'add', 'remove', 'wire']),
    type: z.enum(['app', 'feature', 'domain', 'port', 'adapter', 'design-system']),
    name: z.string().min(1, 'Name is required'),
    // Step-specific fields (optional but typed)
    driver: z.string().optional(),
    port: z.string().optional(),
    domain: z.string().optional(),
    capability: z.string().optional(),
    app: z.string().optional(),
    alias: z.string().optional(), // Used in adapter steps for specific instance names
    designSystem: z.string().optional(),
    design: z.string().optional(),
    portType: z.string().optional(),
  })
  .strict() // Disallow unknown keys to catch typos in blueprints

export type Step = z.infer<typeof stepSchema>

/**
 * Partial validation schema for Blueprint manifests.
 * Focuses on ensuring the 'steps' array is valid.
 */
export const blueprintValidationSchema = z
  .object({
    name: z.string().min(1, 'Blueprint name is required'),
    version: z.string().optional(),
    description: z.string().optional(),
    type: z.enum(['app', 'feature']).optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    framework: z.string().optional(),
    features: z.array(z.string()).optional(),
    steps: z.array(stepSchema).min(1, 'Blueprint must have at least one step'),
    // Allow other blueprint fields to pass through without strict validation (adapters, etc.)
  })
  .passthrough()

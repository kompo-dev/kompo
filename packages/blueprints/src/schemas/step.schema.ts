import { z } from 'zod'

/**
 * Validation schema for a single orchestration step.
 * Unified source of truth for all components.
 */
const commonFields = {
  command: z.enum(['new', 'add', 'remove', 'wire', 'generate']),
  name: z.string().min(1, 'Name is required'),
  // Optional fields valid for any step
  driver: z.string().optional(),
  sharedDriver: z.string().optional(),
  port: z.string().optional(),
  domain: z.string().optional(),
  capability: z
    .enum([
      'account',
      'ai',
      'analytics',
      'auth',
      'cache',
      'events',
      'explorer',
      'flags',
      'gateway',
      'graphql',
      'http',
      'identity',
      'indexer',
      'jobs',
      'media',
      'nosql',
      'notifications',
      'observability',
      'orm',
      'payments',
      'rpc',
      'search',
      'storage',
      'wallet',
    ])
    .optional(),
  app: z.string().optional(),
  alias: z.string().optional(),
  designSystem: z.string().optional(),
  design: z.string().optional(),
  framework: z.string().optional(),
}

const portTypeEnum = z.enum([
  'repository',
  'index',
  'cache',
  'gateway',
  'http',
  'graphql',
  'processor',
  'provider',
  'bus',
  'sender',
  'monitor',
  'executor',
  'other',
])

// Use discriminatedUnion to force a strict 'oneOf' in JSON schema
export const stepSchema = z.discriminatedUnion('type', [
  z.object({
    ...commonFields,
    type: z.literal('port'),
    portType: portTypeEnum, // Required
  }),
  z.object({
    ...commonFields,
    type: z.enum([
      'app',
      'feature',
      'domain',
      'adapter',
      'case',
      'entity',
      'driver',
      'design-system',
      'use-case',
    ]),
    portType: portTypeEnum.optional(),
  }),
])

export type Step = z.infer<typeof stepSchema>

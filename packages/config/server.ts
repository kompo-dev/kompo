import { createEnv as t3CreateEnv } from '@t3-oss/env-core'
import { z } from 'zod'
import type { InferEnvSchema } from './index'

export { z }
export * from './index'

// ---------------------------------------------------
// 1. Find monorepo root and load .env (single file convention)
// ---------------------------------------------------
import { loadEnvSync } from './loader'

// Auto-load on import if in Node
if (typeof process !== 'undefined' && process.versions?.node) {
  loadEnvSync()
}

/**
 * Create server-side validated environment.
 */
export function createEnv<
  TServer extends Record<string, z.ZodTypeAny>,
  TClient extends Record<string, z.ZodTypeAny> = Record<string, never>,
>(options: {
  server: TServer
  client?: TClient
  clientPrefix?: string
  runtimeEnv?: Record<string, string | undefined>
  skipValidation?: boolean
}): Readonly<InferEnvSchema<TServer> & InferEnvSchema<TClient>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runtimeEnv = options.runtimeEnv ?? (globalThis as any).process?.env ?? {}
  const skipValidation =
    options.skipValidation ?? (globalThis as any).process?.env?.SKIP_ENV_VALIDATION === 'true'

  return t3CreateEnv({
    server: options.server as any,
    client: (options.client ?? {}) as any,
    clientPrefix: options.clientPrefix ?? '', // Empty string allows server to access any prefix in 'client' schema
    runtimeEnv,
    skipValidation,
    emptyStringAsUndefined: true,
  } as any) as any
}

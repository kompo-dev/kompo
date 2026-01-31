import { createEnv } from '@t3-oss/env-core'
import { type ZodTypeAny, z } from 'zod'
import type { InferEnvSchema } from './index'

export { z }

export interface ClientEnvOptions<TClient extends Record<string, ZodTypeAny>> {
  client: TClient
  clientPrefix?: string
  runtimeEnv: Record<string, string | undefined>
}

/**
 * Universal client environment factory.
 * Wraps @t3-oss/env-core with simplified options for Kompo apps.
 */
export function getClientEnv<TClient extends Record<string, ZodTypeAny>>(
  options: ClientEnvOptions<TClient>
): Readonly<InferEnvSchema<TClient>> {
  const { client, clientPrefix, runtimeEnv } = options

  return createEnv({
    clientPrefix: clientPrefix ?? 'NEXT_PUBLIC_',
    client,
    server: {}, // Client-only
    runtimeEnv,
    emptyStringAsUndefined: true,
  }) as any
}

export function createEnvFactory<
  ViteSchema extends Record<string, ZodTypeAny>,
  NextSchema extends Record<string, ZodTypeAny>,
>(options: {
  schemas: { vite: ViteSchema; nextjs: NextSchema }
  runtimeEnv: Record<string, string | undefined>
}) {
  function getAppEnv(framework: 'vite'): Readonly<InferEnvSchema<ViteSchema>>
  function getAppEnv(framework: 'nextjs'): Readonly<InferEnvSchema<NextSchema>>
  function getAppEnv(
    framework?: 'vite' | 'nextjs'
  ): Readonly<InferEnvSchema<ViteSchema | NextSchema>>
  function getAppEnv(framework?: 'vite' | 'nextjs') {
    if (framework === 'vite') {
      return getClientEnv({
        client: options.schemas.vite,
        clientPrefix: 'VITE_',
        runtimeEnv: options.runtimeEnv,
      })
    }
    if (framework === 'nextjs') {
      return getClientEnv({
        client: options.schemas.nextjs,
        clientPrefix: 'NEXT_PUBLIC_',
        runtimeEnv: options.runtimeEnv,
      })
    }
    // Default fallback or union if needed
    return getClientEnv({
      client: { ...options.schemas.vite, ...options.schemas.nextjs },
      clientPrefix: '', // mixed
      runtimeEnv: options.runtimeEnv,
    })
  }

  return { getClientEnv: getAppEnv }
}

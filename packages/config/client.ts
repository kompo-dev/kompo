import { createEnv } from '@t3-oss/env-core'
import { type ZodTypeAny, z } from 'zod'
import { type ClientFrameworkId, FRAMEWORKS } from './constants'
import type { InferEnvSchema } from './index'

export { z }

export interface ClientEnvOptions<TClient extends Record<string, ZodTypeAny>> {
  client: TClient
  clientPrefix: string
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

  if (!clientPrefix && clientPrefix !== '') {
    throw new Error('clientPrefix is required')
  }

  return createEnv({
    clientPrefix,
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
  schemas: { [FRAMEWORKS.VITE]: ViteSchema; [FRAMEWORKS.NEXTJS]: NextSchema }
  runtimeEnv: Record<string, string | undefined>
}) {
  function getAppEnv(framework: typeof FRAMEWORKS.VITE): Readonly<InferEnvSchema<ViteSchema>>
  function getAppEnv(framework: typeof FRAMEWORKS.NEXTJS): Readonly<InferEnvSchema<NextSchema>>
  function getAppEnv(
    framework?: ClientFrameworkId
  ): Readonly<InferEnvSchema<ViteSchema | NextSchema>>
  function getAppEnv(framework?: ClientFrameworkId) {
    if (framework === FRAMEWORKS.VITE) {
      return getClientEnv({
        client: options.schemas[FRAMEWORKS.VITE],
        clientPrefix: 'VITE_',
        runtimeEnv: options.runtimeEnv,
      })
    }
    if (framework === FRAMEWORKS.NEXTJS) {
      return getClientEnv({
        client: options.schemas[FRAMEWORKS.NEXTJS],
        clientPrefix: 'NEXT_PUBLIC_',
        runtimeEnv: options.runtimeEnv,
      })
    }
    // Default fallback or union if needed
    return getClientEnv({
      client: { ...options.schemas[FRAMEWORKS.VITE], ...options.schemas[FRAMEWORKS.NEXTJS] },
      clientPrefix: '', // mixed
      runtimeEnv: options.runtimeEnv,
    })
  }

  return { getClientEnv: getAppEnv }
}

/**
 * Type Helpers for Unified Env
 */
export type StripPrefix<T, P extends string> = {
  [K in keyof T as K extends `${P}${infer R}` ? R : K]: T[K]
}

export type UnifiedEnv<V, N> = StripPrefix<V, 'VITE_'> & StripPrefix<N, 'NEXT_PUBLIC_'>

/**
 * Creates a unified proxy that attempts to resolve variables from multiple sources.
 */
export function createUnifiedEnv<V extends Record<string, any>, N extends Record<string, any>>(
  viteEnv: V,
  nextEnv: N
): UnifiedEnv<V, N> {
  return new Proxy({} as UnifiedEnv<V, N>, {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined

      // 1. Try accessing directly
      try {
        const v = viteEnv[prop]
        if (v !== undefined) return v
      } catch {}

      // 2. Try resolving with VITE_ prefix
      try {
        const v = viteEnv[`VITE_${prop}`]
        if (v !== undefined) return v
      } catch {}

      // 3. Try resolving with NEXT_PUBLIC_ prefix
      try {
        const v = nextEnv[`NEXT_PUBLIC_${prop}`]
        if (v !== undefined) return v
      } catch {}

      return undefined
    },
  })
}

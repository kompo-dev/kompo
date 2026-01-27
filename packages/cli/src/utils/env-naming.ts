import { toSnakeCase } from './string'

export type EnvVisibility = 'client' | 'server'

/**
 * Generates a framework-specific environment variable key.
 *
 * @param baseKey - The agnostic key (e.g. "PROJECT_ID")
 * @param alias - The adapter alias (e.g. "my-wallet")
 * @param visibility - Whether the variable should be public or private
 * @param framework - The target framework (nextjs or vite)
 */
export function generateEnvKey(
  baseKey: string,
  alias: string,
  visibility: EnvVisibility = 'server',
  framework: 'nextjs' | 'vite' = 'nextjs'
): string {
  const normalizedAlias = toSnakeCase(alias).toUpperCase()
  const normalizedKey = toSnakeCase(baseKey).toUpperCase()

  const fullKey = `${normalizedAlias}_${normalizedKey}`

  if (visibility === 'client') {
    return framework === 'nextjs' ? `NEXT_PUBLIC_${fullKey}` : `VITE_${fullKey}`
  }

  return fullKey
}

/**
 * Returns the code reference for an environment variable.
 *
 * @param fullKey - The final variable key (e.g. "NEXT_PUBLIC_ALIASED_KEY")
 */
export function getEnvReference(fullKey: string): string {
  if (fullKey.startsWith('NEXT_PUBLIC_') || fullKey.startsWith('VITE_')) {
    return `clientEnv.${fullKey}`
  }
  return `serverEnv.${fullKey}`
}

/**
 * Heuristic to determine visibility if not explicitly provided.
 * Most Provider adapters (UI) use client envs.
 * Repositories/Gateways usually use server envs.
 */
export function getVisibilityHeuristic(baseKey: string, capability?: string): EnvVisibility {
  if (baseKey.startsWith('NEXT_PUBLIC_') || baseKey.startsWith('VITE_')) return 'client'
  // Capability based heuristics could be added here
  return 'server'
}

/**
 * Scopes an environment variable key with a project name.
 * Handles framework-specific prefixes (NEXT_PUBLIC_, VITE_).
 *
 * Example:
 * getScopedEnvKey('NEXT_PUBLIC_APP_NAME', 'my-project') -> 'NEXT_PUBLIC_MY_PROJECT_APP_NAME'
 * getScopedEnvKey('API_KEY', 'my-project') -> 'MY_PROJECT_API_KEY'
 */
export function getScopedEnvKey(key: string, projectName: string): string {
  const normalizedProject = projectName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()

  if (key.startsWith('NEXT_PUBLIC_')) {
    const suffix = key.replace('NEXT_PUBLIC_', '')
    return `NEXT_PUBLIC_${normalizedProject}_${suffix}`
  }

  if (key.startsWith('VITE_')) {
    const suffix = key.replace('VITE_', '')
    return `VITE_${normalizedProject}_${suffix}`
  }

  // Fallback for other vars (server-side, or un-prefixed)
  return `${normalizedProject}_${key}`
}

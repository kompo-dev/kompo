import { toPascalCase } from './string'

export const DEFAULT_ALIAS = 'main'

/**
 * Common naming conventions for Kompo infrastructure packages.
 */

/**
 * Returns the directory name for an infrastructure package.
 * Example: ('database', 'main') -> 'database-main', ('http', 'main') -> 'http-main'
 */
export function getInfraDirName(subject: string, alias: string): string {
  if (!subject) {
    throw new Error('Infrastructure subject (prefix) is required for naming.')
  }
  return `${subject}-${alias}`
}

/**
 * Returns the full npm package name for an infrastructure package.
 * Example: ('org', 'database', 'main') -> '@org/infra-database-main'
 */
export function getInfraPackageName(scope: string, subject: string, alias: string): string {
  return `@${scope}/infra-${getInfraDirName(subject, alias)}`
}

/**
 * Returns the full npm package name for a driver package.
 * Example: ('org', 'http-axios') -> '@org/driver-http-axios'
 */
export function getDriverPackageName(scope: string, driverId: string): string {
  return `@${scope}/driver-${driverId}`
}

/**
 * Standardized logic for creating adapter factory function names.
 * Pattern: create{PascalAdapterName}{PascalAlias}Adapter
 *
 * @param adapterName The base name of the adapter (e.g. "nft-http-client-axios")
 * @param alias Optional alias for specialized instances (e.g. "coingecko")
 * @returns The factory function name (e.g. "createNftHttpClientAxiosCoingeckoAdapter")
 */
export function getAdapterFactoryName(adapterName: string, alias?: string): string {
  const pascalName = toPascalCase(adapterName)

  let suffix = ''
  if (alias && alias !== DEFAULT_ALIAS) {
    suffix = toPascalCase(alias)
  }

  return `create${pascalName}${suffix}Adapter`
}

/**
 * Extracts the prefix (subject) from a port name.
 * Example: 'nft-repository' -> 'nft', 'user-gateway' -> 'user'
 */
export function getPortPrefix(portName: string): string {
  return portName.split('-')[0]
}

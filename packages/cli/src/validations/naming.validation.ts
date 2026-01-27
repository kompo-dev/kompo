import { isCancel, log, text } from '@clack/prompts'
import color from 'picocolors'
import { DEFAULT_ALIAS } from '../utils/naming'

export const RESTRICTED_APP_NAMES = ['vite', 'next', 'react', 'kompo', 'app', 'public']

export interface ValidationOptions {
  restrictedNames?: string[]
}

export const validateKebabCase = (
  value: string,
  subject: string = 'name',
  options: ValidationOptions = {}
): string | undefined => {
  const { restrictedNames = [] } = options

  if (!/^[a-z0-9-]+$/.test(value)) {
    const label = subject.charAt(0).toUpperCase() + subject.slice(1)
    return `${label} must be kebab-case (lowercase, numbers, and hyphens only).`
  }

  if (restrictedNames.includes(value)) {
    return `"${value}" is a reserved name. Please choose another name.`
  }
}

export interface ValidatorOptions {
  restrictedNames?: string[]
  defaultValue?: string
}

/**
 * Creates a standard validator for kebab-case names
 */
export const createKebabCaseValidator = (subject: string, options: ValidatorOptions = {}) => {
  const { restrictedNames = [], defaultValue } = options

  return (value: string | undefined) => {
    const val = value || defaultValue
    if (!val) {
      return 'Required'
    }
    return validateKebabCase(val, subject, { restrictedNames })
  }
}

/**
 * Utility to apply a validator function and throw if it fails.
 * Useful for non-interactive flows or pre-validating defaults.
 */
export function applyValidator(
  value: string,
  validator: (val: string | undefined) => string | undefined
): string {
  const error = validator(value)
  if (error) {
    throw new Error(error)
  }
  return value
}

// --- Port Validations ---

export function validatePortName(name: string, pattern: RegExp, type: string) {
  if (!pattern.test(name)) {
    console.error(
      color.red(`\n❌ Invalid ${type} name: "${name}". It must match pattern ${pattern}\n\n`)
    )
    process.exit(1)
  }
}

export const createPortNameValidator = (options: ValidatorOptions = {}) => {
  return createKebabCaseValidator('Port name', options)
}

// --- HTTP Validations ---

/**
 * Validator for HTTP Service/API aliases
 */
export const createHttpAliasValidator = (usedAliases: string[] = [], defaultValue?: string) => {
  return (val: string | undefined) => {
    const value = val || defaultValue
    if (!value) return 'Name is required'
    if (!/^[a-z0-9-]+$/.test(value)) return 'Only lowercase letters, numbers and hyphens allowed'
    if (value === DEFAULT_ALIAS) return `"${DEFAULT_ALIAS}" is reserved for the base adapter`
    if (usedAliases.includes(value)) return `"${value}" is already used for this port`
    return undefined
  }
}

// --- Use Case Validations ---

export const ALLOWED_USE_CASE_VERBS = [
  'approve',
  'authenticate',
  'bridge',
  'burn',
  'buy',
  'cancel',
  'check',
  'claim',
  'connect',
  'create',
  'decrease',
  'delegate',
  'delete',
  'deposit',
  'execute',
  'fetch',
  'finalize',
  'find',
  'get',
  'increase',
  'initiate',
  'list',
  'liquidate',
  'manage',
  'mint',
  'place',
  'process',
  'query',
  'redeem',
  'register',
  'reject',
  'remove',
  'retrieve',
  'revoke',
  'search',
  'send',
  'sell',
  'sign',
  'stake',
  'submit',
  'swap',
  'sync',
  'transfer',
  'trigger',
  'unstake',
  'update',
  'validate',
  'verify',
  'vote',
  'withdraw',
]

export const FORBIDDEN_USE_CASE_SUFFIXES = [
  'service',
  'manager',
  'handler',
  'controller',
  'provider',
  'utils',
  'helper',
  'repository',
]

export async function validateUseCaseName(
  name: string,
  context?: { retryCount: number; originalInput: string }
): Promise<string> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)+$/.test(name)) {
    throw new Error('Invalid format. Use kebab-case: <verb>-<domain-concept>')
  }

  if (FORBIDDEN_USE_CASE_SUFFIXES.some((w) => name.endsWith(`-${w}`))) {
    throw new Error(
      'Invalid use-case name.\nA use-case must describe a business action, not a technical abstraction.'
    )
  }

  const [verb] = name.split('-')
  if (!ALLOWED_USE_CASE_VERBS.includes(verb)) {
    // If it's a retry and name is identical, user insists -> allow
    if (context?.retryCount && context.retryCount > 0 && name === context.originalInput) {
      return name
    }

    log.warn(
      color.yellow(
        `"${verb}" is not a common business verb.\n` +
          'Ensure this use-case expresses a clear domain intention.\n'
      )
    )

    const confirmedName = await text({
      message: 'Confirm or correct the use-case name:',
      initialValue: name,
      validate: (val) => {
        if (!val) return 'Name is required'
        if (!/^[a-z0-9]+(-[a-z0-9]+)+$/.test(val)) return 'Invalid format. Use kebab-case.'
        return
      },
    })

    if (isCancel(confirmedName)) {
      process.exit(0)
    }

    return validateUseCaseName(confirmedName as string, {
      retryCount: (context?.retryCount || 0) + 1,
      originalInput: name,
    })
  }

  return name
}

// --- Blueprint Validations ---

export const validateBlueprintName = (value: string): string | undefined => {
  if (!/^[a-z0-9.-]+$/.test(value)) {
    return 'Blueprint name must contain only lowercase letters, numbers, hyphens, and dots (e.g. "nextjs.shadcn.base"). Slashes are not allowed.'
  }
}

// --- Specific Domain Validations ---

export const validatePascalCase = (value: string, subject: string = 'name'): string | undefined => {
  if (!/^[A-Z][a-zA-Z0-9]*$/.test(value)) {
    const label = subject.charAt(0).toUpperCase() + subject.slice(1)
    return `${label} must be PascalCase (starts with uppercase, letters and numbers only).`
  }
}

export const createPascalCaseValidator = (subject: string, options: ValidatorOptions = {}) => {
  const { defaultValue } = options
  return (value: string | undefined) => {
    const val = value || defaultValue
    if (!val) return 'Required'
    return validatePascalCase(val, subject)
  }
}

/**
 * Validates Entity names (Allows PascalCase or kebab-case, letters and hyphens only)
 */
export const validateEntityName = (val: string | undefined): string | undefined => {
  if (!val) return 'Required'
  if (!/^[a-zA-Z-]+$/.test(val)) {
    return 'Entity name must contain only letters and hyphens (PascalCase or kebab-case).'
  }
}

/**
 * Validates Value Object names (Allows PascalCase or kebab-case, letters and hyphens only)
 */
export const validateValueObjectName = (val: string | undefined): string | undefined => {
  if (!val) return 'Required'
  if (!/^[a-zA-Z-]+$/.test(val)) {
    return 'Value Object name must contain only letters and hyphens (PascalCase or kebab-case).'
  }
}

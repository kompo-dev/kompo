/**
 * String manipulation utilities
 */

export function toPascalCase(s: string): string {
  return s
    .split(/[^a-zA-Z0-9]+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('')
}

export function toCamelCase(s: string): string {
  return s
    .split(/[^a-zA-Z0-9]+/)
    .map((s, i) =>
      i === 0 ? s.toLowerCase() : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
    )
    .join('')
}

export function toKebabCase(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
}

export function toSnakeCase(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase()
}

/**
 * Core Framework Constants
 */
export const FRAMEWORKS = {
  NEXTJS: 'nextjs',
  VITE: 'vite',
} as const

export type FrameworkId = (typeof FRAMEWORKS)[keyof typeof FRAMEWORKS]

/**
 * Design System Constants
 */
export const DESIGN_SYSTEMS = {
  VANILLA: 'vanilla',
  TAILWIND: 'tailwind',
  SHADCN: 'shadcn',
  MUI: 'mui',
  CHAKRA: 'chakra',
  RADIX: 'radix',
  ANTD: 'antd',
} as const

export type DesignSystemId = (typeof DESIGN_SYSTEMS)[keyof typeof DESIGN_SYSTEMS]

/**
 * Backend Type Constants
 */
export const BACKEND_TYPES = {
  NEXTJS: 'nextjs',
  EXPRESS: 'express',
  NONE: 'none',
} as const

export type BackendTypeId = (typeof BACKEND_TYPES)[keyof typeof BACKEND_TYPES]

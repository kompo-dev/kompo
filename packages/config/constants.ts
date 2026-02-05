/**
 * Core Framework Constants
 * Copied from @kompo/kit to avoid dependency cycles
 */
export const FRAMEWORKS = {
  NEXTJS: 'nextjs',
  VITE: 'vite',
  EXPRESS: 'express',
} as const

export type FrameworkId = (typeof FRAMEWORKS)[keyof typeof FRAMEWORKS]

export const CLIENT_FRAMEWORKS = [FRAMEWORKS.VITE, FRAMEWORKS.NEXTJS] as const
export type ClientFrameworkId = (typeof CLIENT_FRAMEWORKS)[number]

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

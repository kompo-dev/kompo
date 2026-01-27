import { createAdapterGenerator } from './composition/factory'
import type { BaseAdapterGeneratorContext } from './composition/types'

// Re-export context type for compatibility if needed, or just use the one from types
export type AdapterGeneratorContext = BaseAdapterGeneratorContext

export type AdapterGenerator = (context: AdapterGeneratorContext) => Promise<void>

/**
 * Standard Adapter Generator
 * Scaffolds an adapter from the blueprints library.
 * Now delegates to the composition factory for standardized generation.
 */
export const generateAdapter: AdapterGenerator = async (context) => {
  const generator = createAdapterGenerator({
    capability: context.capability,
  })

  await generator(context)
}

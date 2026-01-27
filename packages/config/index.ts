import { z } from 'zod'

export { z }

export type InferEnvSchema<TSchema extends Record<string, z.ZodTypeAny>> = {
  [K in keyof TSchema]: z.infer<TSchema[K]>
}

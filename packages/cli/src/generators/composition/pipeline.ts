import type { StepRegistry } from './step.registry'
import type { GeneratorContext, GeneratorResult, GeneratorUtils } from './types'

// We need to implement createGeneratorUtils here or import it
// Since it depends on context, let's include a helper to create it.
// Ideally this should be passed in or created by the factory.
// For now, let's assume we can create it inside execute or pass it.
// The user's code had `createGeneratorUtils(context)`

export interface PipelineObserver {
  onStepStart?: (stepId: string, context: GeneratorContext) => void
  onStepComplete?: (stepId: string, result: any) => void
  onStepError?: (stepId: string, error: Error) => void
}

export interface Pipeline {
  addObserver: (observer: PipelineObserver) => void
  execute: (
    context: GeneratorContext,
    stepIds: string[],
    utilsFactory: (context: GeneratorContext) => Promise<GeneratorUtils>
  ) => Promise<GeneratorResult>
}

export const createPipeline = (registry: StepRegistry): Pipeline => {
  const observers: PipelineObserver[] = []

  const notifyStepStart = (stepId: string, context: GeneratorContext): void => {
    observers.forEach((observer) => {
      observer.onStepStart?.(stepId, context)
    })
  }

  const notifyStepComplete = (stepId: string, result: any): void => {
    observers.forEach((observer) => {
      observer.onStepComplete?.(stepId, result)
    })
  }

  const notifyStepError = (stepId: string, error: Error): void => {
    observers.forEach((observer) => {
      observer.onStepError?.(stepId, error)
    })
  }

  return {
    addObserver: (observer: PipelineObserver): void => {
      observers.push(observer)
    },

    execute: async (
      context: GeneratorContext,
      stepIds: string[],
      utilsFactory: (context: GeneratorContext) => Promise<GeneratorUtils>
    ): Promise<GeneratorResult> => {
      const steps = registry.getOrderedSteps(stepIds)
      const results: Record<string, any> = {}

      // Initialize utils once
      const utils = await utilsFactory(context)

      for (const step of steps) {
        try {
          notifyStepStart(step.id, context)

          const result = await step.execute(context, utils)
          results[step.id] = result

          notifyStepComplete(step.id, result)
        } catch (error) {
          notifyStepError(step.id, error as Error)
          throw new Error(`Step ${step.id} failed: ${error}`)
        }
      }

      return {
        success: true,
        results,
        context,
      }
    },
  }
}

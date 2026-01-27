import type { AdapterGeneratorStep } from './types'

export interface StepRegistry {
  register: (step: AdapterGeneratorStep) => void
  get: (id: string) => AdapterGeneratorStep | undefined
  list: () => AdapterGeneratorStep[]
  getOrderedSteps: (stepIds: string[]) => AdapterGeneratorStep[]
}

export const createStepRegistry = (): StepRegistry => {
  const steps = new Map<string, AdapterGeneratorStep>()

  return {
    register: (step: AdapterGeneratorStep): void => {
      steps.set(step.id, step)
    },

    get: (id: string): AdapterGeneratorStep | undefined => {
      return steps.get(id)
    },

    list: (): AdapterGeneratorStep[] => {
      return Array.from(steps.values())
    },

    getOrderedSteps: (stepIds: string[]): AdapterGeneratorStep[] => {
      return stepIds
        .map((id) => steps.get(id))
        .filter((step): step is AdapterGeneratorStep => step !== undefined)
    },
  }
}

// Global registry instance
export const stepRegistry = createStepRegistry()

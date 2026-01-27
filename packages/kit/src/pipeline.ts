/**
 * Pipeline for orchestrating step execution
 */

import type { KompoContext } from './context'
import type { Question, Step } from './step'

export interface Pipeline {
  /** Add a step to the pipeline */
  addStep(step: Step): void

  /** Add a question to the pipeline */
  addQuestion(question: Question): void

  /** Execute all questions and collect answers */
  askQuestions(ctx: KompoContext): Promise<void>

  /** Execute all steps in order */
  execute(ctx: KompoContext): Promise<void>

  /** Get all registered steps */
  getSteps(): Step[]

  /** Get all registered questions */
  getQuestions(): Question[]
}

export interface PipelineBuilder {
  /** Build a pipeline for a specific command */
  build(command: 'new' | 'add'): Pipeline
}

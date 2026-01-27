/**
 * Step interface for pipeline execution
 */

import type { KompoContext } from './context'

export interface Step {
  /** Unique step identifier */
  id: string

  /** Optional step description */
  description?: string

  /** Execute the step */
  run(ctx: KompoContext): Promise<void>

  /** Optional condition to determine if step should run */
  when?(ctx: KompoContext): boolean
}

/**
 * Question interface for interactive prompts
 */
export interface Question<T = any> {
  /** Unique question identifier */
  id?: string

  /** Question name used as key in answers */
  name?: string

  /** Question type */
  type?: 'select' | 'confirm' | 'input' | 'text' | 'multiselect'

  /** Question message */
  message?: string

  /** Available choices for select/multiselect */
  choices?:
    | Array<{ title: string; value: string; description?: string; disabled?: boolean }>
    | string[]

  /** Default value */
  default?: T

  /** Initial value for text input */
  initial?: T

  /** Condition to determine if question should be asked */
  when?(ctx: KompoContext): boolean

  /** Validation function */
  validate?(value: T): boolean | string

  /** Static prompt config or dynamic prompt builder */
  prompt?: PromptConfig | ((ctx: KompoContext) => PromptConfig)
}

export interface PromptConfig {
  type: 'select' | 'confirm' | 'input' | 'text' | 'multiselect'
  name: string
  message: string
  choices?:
    | Array<{ title: string; value: string; description?: string; disabled?: boolean }>
    | string[]
  initial?: any
}

/**
 * Template definition for plugin templates
 */
export interface TemplateDefinition {
  /** Template name */
  name: string

  /** Template directory path (relative to plugin) */
  path: string

  /** Variables required by this template */
  variables: string[]
}

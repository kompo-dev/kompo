/**
 * Pipeline implementation for orchestrating steps
 */

import { cancel, isCancel, multiselect, select, text } from '@clack/prompts'
import type { KompoContext, Pipeline, Question, Step } from '@kompo/kit'

export function createPipeline(): Pipeline {
  const steps: Step[] = []
  const questions: Question[] = []

  return {
    addStep(step: Step): void {
      steps.push(step)
    },

    addQuestion(question: Question): void {
      questions.push(question)
    },

    async askQuestions(ctx: KompoContext): Promise<void> {
      const filteredQuestions = questions.filter((q) => !q.when || q.when(ctx))

      for (const question of filteredQuestions) {
        // Handle new prompt-based questions
        let promptType = question.type
        let promptName = question.name
        let promptMessage = question.message
        let promptInitial = question.initial ?? question.default
        let promptChoices = question.choices
        const promptValidate = question.validate

        if (question.prompt) {
          const promptConfig =
            typeof question.prompt === 'function' ? question.prompt(ctx) : question.prompt
          promptType = promptConfig.type
          promptName = promptConfig.name
          promptMessage = promptConfig.message
          promptInitial = promptConfig.initial
          promptChoices = promptConfig.choices as
            | {
                title: string
                value: string
                description?: string
                disabled?: boolean
              }[]
            | string[]
          // Clack prompts usually don't have validators in config object same way but let's assume standard
        }

        // Map type
        const type = promptType === 'input' ? 'text' : promptType

        let response: unknown

        if (type === 'text') {
          response = await text({
            message: promptMessage || '',
            initialValue: typeof promptInitial === 'string' ? promptInitial : undefined,
            validate: promptValidate
              ? (value) => {
                  const result = promptValidate?.(value)
                  if (result === true) return
                  return result as string
                }
              : undefined,
          })
        } else if (type === 'select') {
          const options = promptChoices?.map((c: unknown) => {
            if (typeof c === 'string') return { label: c, value: c }
            const choice = c as {
              title?: string
              message?: string
              name?: string
              value?: string
              description?: string
              hint?: string
            }
            return {
              label: choice.title || choice.message || choice.name || '',
              value: choice.value || choice.name || '',
              hint: choice.description || choice.hint,
            }
          })

          response = await select({
            message: promptMessage || '',
            options: options || [],
            initialValue: promptInitial as string,
          })
        } else if (type === 'multiselect') {
          const options = promptChoices?.map((c: unknown) => {
            if (typeof c === 'string') return { label: c, value: c }
            const choice = c as {
              title?: string
              message?: string
              name?: string
              value?: string
              description?: string
              hint?: string
            }
            return {
              label: choice.title || choice.message || choice.name || '',
              value: choice.value || choice.name || '',
              hint: choice.description || choice.hint,
            }
          })

          response = await multiselect({
            message: promptMessage || '',
            options: options || [],
            initialValues: promptInitial as string[],
          })
        } else {
          // Fallback for types not explicitly handled or 'confirm' -> select yes/no
          if (type === 'confirm') {
            response = await select({
              message: promptMessage || '',
              options: [
                { label: 'Yes', value: true },
                { label: 'No', value: false },
              ],
              initialValue: promptInitial === true,
            })
          }
        }

        if (isCancel(response)) {
          cancel('Operation cancelled.')
          process.exit(0)
        }

        if (response !== undefined && promptName) {
          ctx.answers[promptName] = response
        }
      }
    },

    async execute(ctx: KompoContext): Promise<void> {
      const filteredSteps = steps.filter((step) => !step.when || step.when(ctx))

      for (const step of filteredSteps) {
        if (ctx.debug) console.log(`\n⏳ Running step: ${step.description || step.id}`)
        await step.run(ctx)
        if (ctx.debug) console.log(`✅ Completed: ${step.description || step.id}`)
      }
    },

    getSteps(): Step[] {
      return steps
    },

    getQuestions(): Question[] {
      return questions
    },
  }
}

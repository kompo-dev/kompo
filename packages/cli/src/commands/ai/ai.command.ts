import * as p from '@clack/prompts'
import { Command } from 'commander'
import 'dotenv/config' // Load .env from cwd automatically
import { OpenAI } from 'openai'
import color from 'picocolors'

export const aiCommand = new Command('ai')
  .description('Chat with an AI assistant (OpenAI or Ollama)')
  .action(async () => {
    const apiKey = process.env.KOMPO_AI_API_KEY || 'ollama' // Default to dummy key for Ollama
    const baseURL = process.env.KOMPO_AI_BASE_URL || 'http://localhost:11434/v1'
    let model = process.env.KOMPO_AI_MODEL || 'llama3'

    const openai = new OpenAI({
      apiKey,
      baseURL,
    })

    // Initial check for model availability
    try {
      model = await ensureModel(openai, model)
    } catch (error) {
      // If ensureModel fails (e.g. no connection or user cancelled), we exit gracefully
      p.log.error(error instanceof Error ? error.message : String(error))
      return
    }

    try {
      await chatLoop(openai, model)
    } catch (error) {
      // This catch block handles errors that bubble up from chatLoop and are NOT handled there
      p.log.error(error instanceof Error ? error.message : String(error))
      p.outro('An error occurred.')
    }
  })

/**
 * Ensures the requested model exists.
 * If not, tries to list available models and asks user to select one.
 * Returns the valid model name.
 */
async function ensureModel(openai: OpenAI, model: string): Promise<string> {
  const s = p.spinner()
  s.start(`Checking model '${model}' availability...`)

  try {
    // For standard OpenAI, retrieving a specific model is GET /models/{model}
    // For Ollama (openai compat), this should work too if the model exists.
    await openai.models.retrieve(model)
    s.stop(`Model '${model}' is ready.`)
    return model
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error)

    // Check if it's a 404 (Model not found)
    if (msg.includes('404') || error.status === 404) {
      s.stop(`Model '${model}' not found.`) // Consolidate spinner stop and log warning

      try {
        const s2 = p.spinner()
        s2.start('Fetching available models...')
        const list = await openai.models.list()
        s2.stop('Available models found.') // Minimal message

        if (list.data.length > 0) {
          const selected = await p.select({
            message: 'Select an available model to use:',
            options: list.data.map((m) => ({ value: m.id, label: m.id })),
          })

          if (p.isCancel(selected)) {
            p.outro('Operation cancelled.')
            process.exit(0)
          }

          p.note(`Using model: ${selected}`, 'Config Updated')
          return selected as string
        } else {
          p.log.error('No models found on the server.')
        }
      } catch (_listError) {
        p.log.error('Failed to list models.')
      }

      p.log.message(`👉 Try running: ${color.cyan(`ollama pull ${model}`)}`)
      throw new Error(`Model '${model}' not found and no alternative selected.`)
    } else {
      // Other error (connection, auth, etc)
      throw error
    }
  }
}

async function chatLoop(openai: OpenAI, model: string) {
  p.intro(
    `${color.bgCyan(color.black(' kompo ai '))}${color.bgMagenta(` ${color.bold(color.white(model))} `)}`
  )

  while (true) {
    try {
      const input = await p.text({
        message: 'kompo ai >',
        placeholder: 'Type your message (or "exit" to quit)',
      })

      if (
        p.isCancel(input) ||
        (typeof input === 'string' &&
          (input.toLowerCase() === 'exit' ||
            input.trim() === '\\exit' ||
            input.trim() === '\\quit'))
      ) {
        p.outro('Bye!')
        process.exit(0)
      }

      if (typeof input === 'string' && input.trim()) {
        await runStream(openai, model, input)
      }
    } catch (error) {
      // Since we checked model at startup, runtime errors are likely transient or critical.
      const msg = error instanceof Error ? error.message : String(error)
      p.log.error(msg)
      // We continue the loop to allow retrying
    }
  }
}

async function runStream(openai: OpenAI, model: string, userContent: string) {
  const s = p.spinner()
  s.start('Thinking...')

  let stream: any
  try {
    stream = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: userContent }],
      stream: true,
    })
    s.stop('Connected')
  } catch (error) {
    s.stop('Error')
    throw error
  }

  await p.stream.step(
    (async function* () {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || ''
        yield delta
      }
    })()
  )
}

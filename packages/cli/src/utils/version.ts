import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const getVersion = () => {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)

  const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'))
  return packageJson.version
}

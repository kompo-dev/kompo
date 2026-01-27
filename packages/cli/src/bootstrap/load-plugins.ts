import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { log } from '@clack/prompts'
import color from 'picocolors'

export async function loadEnterpriseExtensions(repoRoot: string) {
  const enterprisePath = path.join(repoRoot, 'packages/enterprise')

  if (fs.existsSync(enterprisePath)) {
    // List of extensions to attempt loading
    const extensions = ['backend', 'cli', 'blueprints', 'drivers']

    for (const extension of extensions) {
      const extensionEntry = path.join(enterprisePath, `${extension}/index.ts`)

      if (fs.existsSync(extensionEntry)) {
        try {
          // Dynamic import
          await import(pathToFileURL(extensionEntry).href)
          log.message(color.dim(`🔌 Loaded Enterprise ${extension} extension`))
        } catch (e) {
          log.warning(color.yellow(`Failed to load Enterprise ${extension} extension:`), e as any)
        }
      }
    }
  }
}

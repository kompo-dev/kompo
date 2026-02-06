import fs from 'node:fs'

/**
 * Ensures that a package is excluded from Vite's optimization bundle.
 * Modifies vite.config.ts to add optimizeDeps.exclude if not present.
 */
export async function ensureOptimizeDepsExclude(configPath: string, packageName: string) {
  if (!fs.existsSync(configPath)) return

  let content = await fs.promises.readFile(configPath, 'utf-8')

  // Check if already excluded
  if (content.includes(`'${packageName}'`) || content.includes(`"${packageName}"`)) {
    // Simple check, might result in false negatives if registered elsewhere, but safe to skip specific string
    if (content.includes(`exclude:`) && content.includes(packageName)) {
      return // Already present likely
    }
  }

  // Naive but effective injection: find `defineConfig({` or `export default defineConfig({`
  // And try to inject or merge optimizeDeps.

  // Case 1: optimizeDeps already exists
  if (content.includes('optimizeDeps:')) {
    if (content.includes('exclude: [')) {
      // Insert into existing exclude array
      content = content.replace(/exclude:\s*\[/, `exclude: ['${packageName}', `)
    } else {
      // Add exclude to optimizeDeps
      content = content.replace(
        /optimizeDeps:\s*\{/,
        `optimizeDeps: {\n    exclude: ['${packageName}'],`
      )
    }
  } else {
    // Case 2: No optimizeDeps, inject into defineConfig object
    const injectionPoint = content.lastIndexOf('})')
    if (injectionPoint !== -1) {
      content =
        content.substring(0, injectionPoint) +
        `  optimizeDeps: {
    exclude: ['${packageName}'],
  },
` +
        content.substring(injectionPoint)
    }
  }

  await fs.promises.writeFile(configPath, content, 'utf-8')
}

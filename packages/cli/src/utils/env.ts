// env
import path from 'node:path'
import type { FrameworkId } from '@kompo/kit'
import { Project, SyntaxKind } from 'ts-morph'
import { createFsEngine } from '../engine/fs-engine'

/**
 * Injects environment variables into the workspace's .env and .env.example files.
 * Appends the content only if the keys don't already exist.
 *
 * @param repoRoot - The root directory of the repository
 * @param envEntry - Alternatively provide the raw env string content to inject
 */
export async function injectEnvVariables(repoRoot: string, envEntry: string) {
  if (!envEntry || !envEntry.trim()) return

  const fs = createFsEngine()
  const envPath = path.join(repoRoot, '.env')
  const envExamplePath = path.join(repoRoot, '.env.example')

  // Helper to append unique variables
  const appendUnique = async (filePath: string, contentToAdd: string) => {
    // Check for each key specifically
    const lines = contentToAdd.split('\n')
    const finalLines = []

    if (await fs.fileExists(filePath)) {
      const existingContent = await fs.readFile(filePath)
      for (const line of lines) {
        const key = line.split('=')[0].trim()
        if (key && !existingContent.includes(`${key}=`)) {
          finalLines.push(line)
        }
      }

      if (finalLines.length > 0) {
        const separator = existingContent.endsWith('\n') ? '' : '\n'
        await fs.writeFile(filePath, `${existingContent}${separator}${finalLines.join('\n')}\n`)
      }
    } else {
      await fs.writeFile(filePath, contentToAdd)
    }
  }

  await appendUnique(envPath, envEntry)
  await appendUnique(envExamplePath, envEntry)
}

/**
 * Injects a snippet of environment variables into libs/config/{server|client}.ts
 * Uses ts-morph for safer AST manipulation and strict conflict checking.
 * Also automatically appends keys to .env and .env.example
 *
 * @param envContent - Optional explicit env content to skip comment parsing
 */
export async function injectEnvSnippet(
  repoRoot: string,
  snippet: string,
  target: FrameworkId | 'server' = 'server',
  envContent?: string
) {
  const configPath = path.join(repoRoot, 'libs', 'config', 'src', 'schema.ts')
  const schemaVarName =
    target === 'server'
      ? 'serverSchema'
      : target === 'vite'
        ? 'viteClientSchema'
        : 'nextClientSchema'

  const fs = createFsEngine()

  if (!(await fs.fileExists(configPath))) return

  // Initialize ts-morph project
  const project = new Project({
    tsConfigFilePath: path.join(repoRoot, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
  })

  // Add config file to project
  const sourceFile = project.addSourceFileAtPath(configPath)

  // Find the schema variable declaration
  const varDec = sourceFile.getVariableDeclaration(schemaVarName)

  if (!varDec) {
    throw new Error(`Could not find ${schemaVarName} declaration in schema.ts`)
  }

  // Get the object literal initializer
  const objectLiteral = varDec.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression)
  if (!objectLiteral) {
    throw new Error(`${schemaVarName} initializer must be an object literal`)
  }

  // Parse the snippet to extract keys for conflict checking
  // We use a dummy source file to parse the snippet
  const tempFile = project.createSourceFile(
    `temp_${Date.now()}.ts`,
    `const temp = {\n${snippet}\n}`
  )
  const tempObject = tempFile
    .getVariableDeclaration('temp')
    ?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression)

  if (!tempObject) {
    throw new Error('Invalid snippet format. Must be valid object literal properties.')
  }

  const newProperties = tempObject.getProperties()
  const validKeys: string[] = []
  const structureToInject: Array<{ name: string; initializer: string }> = []

  for (const prop of newProperties) {
    if (prop.isKind(SyntaxKind.PropertyAssignment)) {
      const keyName = prop.getName()

      // Skip if it already exists (check manually to be robust)
      const exists = objectLiteral.getProperties().some((p) => {
        if (p.isKind(SyntaxKind.SpreadAssignment)) return false

        let name = p.getName()
        // Handle quoted names if necessary (though getName() usually handles it)
        if (
          (name.startsWith("'") && name.endsWith("'")) ||
          (name.startsWith('"') && name.endsWith('"'))
        ) {
          name = name.slice(1, -1)
        }
        return name === keyName
      })

      if (exists) {
        continue
      }

      // If NO explicit envContent is provided, we default to empty value
      if (!envContent) {
        validKeys.push(`${keyName}=`)
      }

      structureToInject.push({
        name: keyName,
        initializer: prop.getInitializer()?.getText() || '',
      })
    }
  }

  if (structureToInject.length > 0) {
    // Apply changes to Config File
    objectLiteral.addPropertyAssignments(structureToInject)
    await sourceFile.save()
  }

  // Inject keys into .env and .env.example
  if (envContent) {
    await injectEnvVariables(repoRoot, envContent)
  } else if (validKeys.length > 0) {
    const envBlock = validKeys.join('\n')
    await injectEnvVariables(repoRoot, envBlock)
  }
}

/**
 * Template engine implementation using Eta
 */

import nodeFs from 'node:fs'
import path from 'node:path'
import { hasBlueprintSnippet } from '@kompo/blueprints'
import type { FsEngine, TemplateEngine } from '@kompo/kit'
import { Eta } from 'eta'
import { glob } from 'glob'
import { type ExportDeclaration, Project, type SourceFile, SyntaxKind } from 'ts-morph'

export function createTemplateEngine(
  fs: FsEngine,
  templateRoots: string[],
  blueprintPath?: string
): TemplateEngine {
  const eta = new Eta({
    views: templateRoots[0], // Primary root
    tags: ['<%', '%>'],
    autoEscape: false,
    autoTrim: false,
  })

  // Override resolvePath to search across all roots (Eta calls this synchronously)
  const originalResolvePath = eta.resolvePath.bind(eta)

  eta.resolvePath = (template: string, options?: any) => {
    if (path.isAbsolute(template)) return template

    for (const root of templateRoots) {
      const fullPath = path.join(root, template)
      if (nodeFs.existsSync(fullPath)) {
        return fullPath
      }
      // Retry with .eta extension if missing
      if (!template.endsWith('.eta') && nodeFs.existsSync(`${fullPath}.eta`)) {
        return `${fullPath}.eta`
      }
    }

    return originalResolvePath(template, options)
  }

  function isBinaryFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    const binaryExtensions = [
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.svg',
      '.ico',
      '.pdf',
      '.zip',
      '.tar',
      '.gz',
      '.woff',
      '.woff2',
      '.ttf',
      '.eot',
      '.mp3',
      '.mp4',
      '.avi',
      '.mov',
      '.png',
    ]
    return binaryExtensions.includes(ext)
  }

  function mergeEnvContent(existing: string, newContent: string): string {
    const existingLines = existing.split('\n')
    const newLines = newContent.split('\n')
    const existingKeys = new Set<string>()

    for (const line of existingLines) {
      const match = line.match(/^\s*([\w_.-]+)\s*=/)
      if (match) {
        existingKeys.add(match[1])
      }
    }

    const mergedLines = [...existingLines]
    // Ensure newline separation
    if (mergedLines.length > 0 && mergedLines[mergedLines.length - 1].trim() !== '') {
      mergedLines.push('')
    }

    for (const line of newLines) {
      const match = line.match(/^\s*([\w_.-]+)\s*=/)
      if (match) {
        const key = match[1]
        if (!existingKeys.has(key)) {
          mergedLines.push(line)
        }
      }
    }

    return mergedLines.join('\n')
  }

  function mergePackageJsonContent(existing: string, newContent: string): string {
    try {
      const existingJson = JSON.parse(existing)
      const newJson = JSON.parse(newContent)

      const merged = { ...existingJson }

      // Merge dependencies
      if (newJson.dependencies) {
        merged.dependencies = {
          ...merged.dependencies,
          ...newJson.dependencies,
        }
      }

      // Merge devDependencies
      if (newJson.devDependencies) {
        merged.devDependencies = {
          ...merged.devDependencies,
          ...newJson.devDependencies,
        }
      }

      // Merge peerDependencies
      if (newJson.peerDependencies) {
        merged.peerDependencies = {
          ...merged.peerDependencies,
          ...newJson.peerDependencies,
        }
      }

      // Merge scripts
      if (newJson.scripts) {
        merged.scripts = {
          ...merged.scripts,
          ...newJson.scripts,
        }
      }

      return JSON.stringify(merged, null, 2)
    } catch (e) {
      throw new Error(`Failed to merge JSON: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  function mergeTypeScriptContent(existing: string, newContent: string): string {
    const project = new Project({ useInMemoryFileSystem: true })
    const existingFile = project.createSourceFile('existing.ts', existing)
    const newFile = project.createSourceFile('new.ts', newContent)

    // 1. Merge and deduplicate imports
    const existingImports = existingFile.getImportDeclarations()
    const newImports = newFile.getImportDeclarations()

    for (const newImport of newImports) {
      const moduleSpecifier = newImport.getModuleSpecifierValue()
      const existingImport = existingImports.find(
        (i) => i.getModuleSpecifierValue() === moduleSpecifier
      )

      if (existingImport) {
        // Merge named imports
        const newNamedImports = newImport.getNamedImports()
        for (const named of newNamedImports) {
          const name = named.getName()
          if (!existingImport.getNamedImports().some((i) => i.getName() === name)) {
            existingImport.addNamedImport(name)
          }
        }
        // Handle namespace import if exists
        const newNamespaceImport = newImport.getNamespaceImport()
        if (newNamespaceImport && !existingImport.getNamespaceImport()) {
          existingImport.setNamespaceImport(newNamespaceImport.getText())
        }
        // Handle default import
        const newDefaultImport = newImport.getDefaultImport()
        if (newDefaultImport && !existingImport.getDefaultImport()) {
          existingImport.setDefaultImport(newDefaultImport.getText())
        }
      } else {
        existingFile.addImportDeclaration(newImport.getStructure())
      }
    }

    // 1b. Merge and deduplicate re-exports (export * from '...' or export * as ns from '...')
    const getReExports = (file: SourceFile) =>
      file
        .getStatements()
        .filter((s) => s.getKind() === SyntaxKind.ExportDeclaration)
        .map((s) => s as ExportDeclaration)
        .filter((e) => e.hasModuleSpecifier()) // Re-exports must have a module specifier
        .filter((e) => e.getNamedExports().length === 0) // Focus on star/namespace re-exports

    const existingExports = getReExports(existingFile)
    const newExports = getReExports(newFile)

    for (const newExport of newExports) {
      const moduleSpecifier = newExport.getModuleSpecifierValue()
      const newNamespace = newExport.getNamespaceExport()?.getName()

      const exists = existingExports.some((e) => {
        const sameModule = e.getModuleSpecifierValue() === moduleSpecifier
        const sameNamespace = e.getNamespaceExport()?.getName() === newNamespace
        return sameModule && sameNamespace
      })

      if (!exists) {
        existingFile.addExportDeclaration(newExport.getStructure())
      }
    }

    const collisions = new Set<string>()
    let newHasDefaultExport = false

    // 2. Identify all top-level names in the new file
    const newStatements = newFile.getStatements()
    for (const statement of newStatements) {
      if (statement.getKind() === SyntaxKind.ExportAssignment) {
        newHasDefaultExport = true
      } else if (
        statement.getKind() === SyntaxKind.FunctionDeclaration ||
        statement.getKind() === SyntaxKind.ClassDeclaration ||
        statement.getKind() === SyntaxKind.InterfaceDeclaration ||
        statement.getKind() === SyntaxKind.TypeAliasDeclaration
      ) {
        const name = (statement as any).getName()
        if (name) collisions.add(name)
      } else if (statement.getKind() === SyntaxKind.VariableStatement) {
        const declarations = (statement as any).getDeclarations()
        for (const decl of declarations) {
          collisions.add(decl.getName())
        }
      }
    }

    const mergedNames = new Set<string>()
    const statements = existingFile.getStatements()

    for (const statement of statements) {
      let shouldComment = false

      // Check for named export collisions
      if (statement.getKind() !== SyntaxKind.ExportAssignment) {
        let name: string | undefined
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let declaration: any

        if (
          statement.getKind() === SyntaxKind.FunctionDeclaration ||
          statement.getKind() === SyntaxKind.ClassDeclaration ||
          statement.getKind() === SyntaxKind.InterfaceDeclaration ||
          statement.getKind() === SyntaxKind.TypeAliasDeclaration
        ) {
          name = (statement as any).getName()
          declaration = statement
        } else if (statement.getKind() === SyntaxKind.VariableStatement) {
          const declarations = (statement as any).getDeclarations()
          if (declarations.length > 0) {
            name = declarations[0].getName()
            declaration = declarations[0]
          }
        }

        if (name && collisions.has(name) && (statement as any).isExported()) {
          // Attempt to merge object literals
          let merged = false
          if (
            statement.getKind() === SyntaxKind.VariableStatement &&
            declaration.getInitializer()?.getKind() === SyntaxKind.ObjectLiteralExpression
          ) {
            const newStatement = newStatements.find((s) => {
              if (s.getKind() === SyntaxKind.VariableStatement) {
                const decls = (s as any).getDeclarations()
                return decls.length > 0 && decls[0].getName() === name
              }
              return false
            })

            if (newStatement) {
              const newDecl = (newStatement as any).getDeclarations()[0]
              if (newDecl.getInitializer()?.getKind() === SyntaxKind.ObjectLiteralExpression) {
                const existingObj = declaration.getInitializer()
                const newObj = newDecl.getInitializer()

                for (const prop of newObj.getProperties()) {
                  // Avoid duplication if key already exists
                  const propText = prop.getText()
                  const propName = prop.getName ? prop.getName() : propText.split(':')[0].trim()

                  if (!existingObj.getProperty(propName)) {
                    // Add new property
                    // We need to parse property carefully or just use text
                    // Simple add for property assignment
                    if ((prop as any).getInitializer) {
                      existingObj.addPropertyAssignment({
                        name: propName,
                        initializer: (prop as any).getInitializer().getText(),
                      })
                    } else {
                      // shorthands or methods: simple append
                      // fallback to direct text insertion for complex props
                      // but standard schema uses property assignments
                      existingObj.addMember(prop.getText())
                    }
                  }
                }
                merged = true
                mergedNames.add(name)
              }
            }
          }
          // Merge Type Aliases (e.g. Ports)
          else if (
            statement.getKind() === SyntaxKind.TypeAliasDeclaration &&
            declaration.getTypeNode()?.getKind() === SyntaxKind.TypeLiteral
          ) {
            const newStatement = newStatements.find(
              (s) =>
                s.getKind() === SyntaxKind.TypeAliasDeclaration && (s as any).getName() === name
            )

            if (newStatement) {
              const newTypeNode = (newStatement as any).getTypeNode()
              if (newTypeNode?.getKind() === SyntaxKind.TypeLiteral) {
                const existingTypeLiteral = declaration.getTypeNode()
                const newMembers = newTypeNode.getMembers()

                for (const member of newMembers) {
                  // Basic deduplication by text or name
                  // Ideally we check if a member with same signature exists.
                  // For simplicity: check if a member with same Name exists.
                  // (MethodSignature or PropertySignature)
                  const memberName = (member as any).getName ? (member as any).getName() : null

                  // If we can't extract name easily, rely on full text? No, risky.
                  // Port methods usually have names.

                  let exists = false
                  if (memberName) {
                    exists = existingTypeLiteral
                      .getMembers()
                      .some((m: any) => m.getName && m.getName() === memberName)
                  }

                  if (!exists) {
                    existingTypeLiteral.addMember(member.getText())
                  }
                }
                merged = true
                mergedNames.add(name)
              }
            }
          }

          if (!merged) {
            shouldComment = true
          }
        }
      }
      // Check for default export collision
      else if (newHasDefaultExport) {
        shouldComment = true
      }

      if (shouldComment) {
        const text = statement.getText()
        statement.replaceWithText(`/* [KOMPO] COLLISION: The following export was commented out because a newer version was added.
${text}
*/`)
      }
    }

    // 3. Append new non-import/non-export-star content
    for (const statement of newStatements) {
      if (statement.getKind() === SyntaxKind.ImportDeclaration) continue
      if (
        statement.getKind() === SyntaxKind.ExportDeclaration &&
        (statement as ExportDeclaration).hasModuleSpecifier() &&
        (statement as ExportDeclaration).getNamedExports().length === 0
      )
        continue

      let name: string | undefined
      if (
        statement.getKind() === SyntaxKind.FunctionDeclaration ||
        statement.getKind() === SyntaxKind.ClassDeclaration ||
        statement.getKind() === SyntaxKind.InterfaceDeclaration ||
        statement.getKind() === SyntaxKind.TypeAliasDeclaration
      ) {
        name = (statement as any).getName()
      } else if (statement.getKind() === SyntaxKind.VariableStatement) {
        const declarations = (statement as any).getDeclarations()
        if (declarations.length > 0) {
          name = declarations[0].getName()
        }
      }

      if (name && mergedNames.has(name)) {
        continue // Skip appending if merged
      }

      existingFile.addStatements(statement.getText())
    }

    return existingFile.getFullText()
  }

  async function processOutputFile(
    targetPath: string,
    content: string,
    options: { merge?: boolean } = {}
  ): Promise<void> {
    const filename = path.basename(targetPath)
    const exists = await fs.fileExists(targetPath)

    if (!exists) {
      await fs.writeFile(targetPath, content)
      return
    }

    // 1. Forced merge for standard config files
    if (
      filename === 'package.json' ||
      filename.endsWith('.env') ||
      filename === 'kompo.config.json'
    ) {
      const existingContent = await fs.readFile(targetPath)
      let merged = content
      try {
        if (filename === 'package.json' || filename === 'kompo.config.json') {
          merged = mergePackageJsonContent(existingContent, content)
        } else if (filename.endsWith('.env')) {
          merged = mergeEnvContent(existingContent, content)
        }
        await fs.writeFile(targetPath, merged)
      } catch (_e) {
        await fs.writeFile(targetPath, content)
      }
      return
    }

    // 2. Opt-in merge for TypeScript
    const isTS = filename.endsWith('.ts') || filename.endsWith('.tsx')
    if (options.merge === true && isTS) {
      const existingContent = await fs.readFile(targetPath)
      try {
        const mergedContent = mergeTypeScriptContent(existingContent, content)
        await fs.writeFile(targetPath, mergedContent)
      } catch (_e) {
        await fs.writeFile(targetPath, content)
      }
      return
    }

    // 3. Default: Overwrite
    await fs.writeFile(targetPath, content)
  }

  // Define helper for rendering content with hooks
  const renderContent = async (content: string, data: Record<string, unknown>): Promise<string> => {
    const hook = async (name: string): Promise<string> => {
      const hooksRegistry = (data as Record<string, unknown>).hooks as
        | Record<string, string>
        | undefined
      if (hooksRegistry?.[name]) {
        const snippetPath = hooksRegistry[name]

        if (snippetPath && (await fs.fileExists(snippetPath))) {
          const snippetContent = await fs.readFile(snippetPath)
          return await eta.renderStringAsync(snippetContent, {
            ...data,
            hook,
            hasSnippet: hasBlueprintSnippet,
          })
        }
        return ''
      }
      return ''
    }

    return await eta.renderStringAsync(content, {
      ...data,
      hook,
      hasSnippet: hasBlueprintSnippet,
    })
  }

  return {
    get dir(): string {
      return templateRoots[0]
    },

    async render(templatePath: string, data: Record<string, unknown>): Promise<string> {
      // 0. Support absolute paths directly
      if (path.isAbsolute(templatePath) && (await fs.fileExists(templatePath))) {
        const content = await fs.readFile(templatePath)
        return await renderContent(content, data)
      }

      // Try each template root until we find the file
      for (const root of templateRoots) {
        const fullPath = path.join(root, templatePath)
        if (await fs.fileExists(fullPath)) {
          const content = await fs.readFile(fullPath)
          return await renderContent(content, data)
        }
      }
      throw new Error(`Template not found: ${templatePath}`)
    },

    async renderString(template: string, data: Record<string, unknown>): Promise<string> {
      return await renderContent(template, data)
    },

    async renderFile(
      templatePath: string,
      targetPath: string,
      data: any,
      options?: { merge?: boolean }
    ): Promise<void> {
      const content = await this.render(templatePath, data)
      await processOutputFile(targetPath, content, options)
    },

    async renderDir(
      srcDir: string,
      targetDir: string,
      data: Record<string, unknown>,
      options: { exclude?: string[]; merge?: boolean } = { merge: false }
    ): Promise<void> {
      let fullSrcDir = ''

      if (path.isAbsolute(srcDir)) {
        if (await fs.fileExists(srcDir)) {
          fullSrcDir = srcDir
        }
      } else {
        // Find the template root that contains this directory
        for (const root of templateRoots) {
          const checkDir = path.join(root, srcDir)
          if (await fs.fileExists(checkDir)) {
            fullSrcDir = checkDir
            break
          }
        }
      }

      if (!fullSrcDir) {
        return // Template directory not found, skip silently
      }

      // Find all template files relative to fullSrcDir
      // Using cwd option ensures patterns work relatively
      const ignorePatterns = ['**/node_modules/**', '**/catalog.json', '**/snippets/**']

      if (options?.exclude && Array.isArray(options.exclude)) {
        options.exclude.forEach((ex) => {
          // Simplify exclusion logic: if we use relative glob, we can just pass the user's pattern
          // But we need to handle if the user passed 'apps' hoping to exclude 'apps/**'
          ignorePatterns.push(ex)

          // If it's a directory name without glob magic, assume recursive ignore
          if (!ex.includes('*')) {
            ignorePatterns.push(`${ex}/**`)
          }
        })
      }

      const files = await glob('**/*', {
        cwd: fullSrcDir,
        nodir: true,
        ignore: ignorePatterns,
        dot: true, // include hidden files like .env
      })

      for (const file of files) {
        // file is already relative path because of cwd option
        const relativePath = file

        // Skip binary files that shouldn't be processed
        // We need full path for existing check functions if they use it
        const fullPath = path.join(fullSrcDir, relativePath)

        if (isBinaryFile(fullPath)) {
          const targetPath = path.join(targetDir, relativePath)
          await fs.copyFile(fullPath, targetPath)
          continue
        }

        // Render all template files with Eta
        const content = await fs.readFile(fullPath)

        // Prepare hook helper for this specific template in the directory
        const templateRelativePath = path.join(srcDir, relativePath)
        const hook = async (name: string): Promise<string> => {
          if (!blueprintPath) return ''

          // 1. Registry Lookup (New Declarative Way)
          const hooksRegistry = (data as any).hooks as Record<string, string> | undefined
          if (hooksRegistry?.[name]) {
            const relativePath = hooksRegistry[name]
            // Resolve relative to blueprint path
            const snippetPath = path.join(blueprintPath, relativePath)

            if (await fs.fileExists(snippetPath)) {
              const snippetContent = await fs.readFile(snippetPath)
              return await eta.renderStringAsync(snippetContent, {
                ...data,
                hook, // Pass recursive hook helper
                hasSnippet: hasBlueprintSnippet,
              })
            }
            // If registry defines it but file missing, warn? or return empty?
            // For now standard behavior: return empty if missing.
            return ''
          }

          // 2. Default Path (Legacy)
          // Snippets are located in [blueprint]/snippets/[relative-template-path-without-ext]/[hook-name].eta
          const relativeBase = templateRelativePath.replace(/\.(eta|tpl)$/, '')
          const snippetPath = path.join(blueprintPath, 'snippets', relativeBase, `${name}.eta`)

          if (await fs.fileExists(snippetPath)) {
            const snippetContent = await fs.readFile(snippetPath)
            // Recursively render snippet
            return await eta.renderStringAsync(snippetContent, {
              ...data,
              hook,
              hasSnippet: hasBlueprintSnippet,
            })
          }
          return ''
        }

        const renderedContent = await eta.renderStringAsync(content, {
          ...data,
          hook,
          hasSnippet: hasBlueprintSnippet,
        })

        // Remove .tpl or .eta extension to get the final filename
        const targetRelativePath = relativePath.replace(/\.(tpl|eta)$/, '')
        // Support templates in filenames
        const renderedRelativePath = await eta.renderStringAsync(targetRelativePath, data)
        const targetPath = path.join(targetDir, renderedRelativePath)

        await processOutputFile(targetPath, renderedContent, options)
      }
    },

    async exists(templatePath: string): Promise<boolean> {
      for (const root of templateRoots) {
        const fullPath = path.join(root, templatePath)
        if (await fs.fileExists(fullPath)) {
          return true
        }
      }
      return false
    },
  }
}

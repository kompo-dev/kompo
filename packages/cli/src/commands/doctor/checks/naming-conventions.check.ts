import path from 'node:path'
import { LIBS_DIR } from '@kompo/kit'
import { glob } from 'glob'
import ts from 'typescript'
import type { DoctorCheckResult } from '../doctor.check'
import { registerDoctorCheck } from '../doctor.registry'

registerDoctorCheck({
  id: 'naming-conventions',
  description: 'Enforce Kompo naming conventions',
  async run({ repoRoot, fs }): Promise<DoctorCheckResult[]> {
    const issues: DoctorCheckResult[] = []
    const libsDir = LIBS_DIR

    // Helper to check PascalCase
    const isPascalCase = (s: string) => /^[A-Z][a-zA-Z0-9]*$/.test(s)
    // Helper to check camelCase
    const isCamelCase = (s: string) => /^[a-z][a-zA-Z0-9]*$/.test(s)
    // Helper to convert to PascalCase
    const toPascalCase = (s: string) =>
      s.replace(/(^\w|-\w)/g, (m) => m.replace('-', '').toUpperCase())
    // Helper to convert to camelCase
    const toCamelCase = (s: string) => s.replace(/-\w/g, (m) => m[1].toUpperCase())
    // Helper to convert to kebab-case
    const toKebabCase = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()

    // 1. Check Value Objects
    const voFiles = await glob(
      path.join(repoRoot, libsDir, 'domains/*/value-objects/*.ts').replace(/\\/g, '/')
    )
    for (const file of voFiles) {
      const filename = path.basename(file, '.ts')

      if (!isPascalCase(filename)) {
        issues.push({
          status: 'error',
          message: `Value Object file "${filename}.ts" should be PascalCase (e.g. UserId.ts)`,
          suggestion: `Rename to ${toPascalCase(filename)}.ts`,
        })
      }

      const content = await fs.readFile(file)
      const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext, true)
      let hasMatchingTypeExport = false

      ts.forEachChild(sourceFile, (node) => {
        if (ts.isTypeAliasDeclaration(node)) {
          if (
            node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
            node.name.text === filename
          ) {
            hasMatchingTypeExport = true
          }
        }
      })

      if (!hasMatchingTypeExport) {
        issues.push({
          status: 'error',
          message: `Value Object "${filename}.ts" must export a type named "${filename}"`,
          suggestion: `export type ${filename} = ...`,
        })
      }
    }

    // 2. Check Entities
    const entityFiles = await glob(
      path.join(repoRoot, libsDir, 'domains/*/entities/*.ts').replace(/\\/g, '/')
    )
    for (const file of entityFiles) {
      const filename = path.basename(file, '.ts')

      // Check for suffix .entity
      if (filename.includes('.entity')) {
        issues.push({
          status: 'error',
          message: `Entity file "${filename}.ts" should not have .entity suffix`,
          suggestion: `Rename to ${toPascalCase(filename.replace('.entity', ''))}.ts`,
        })
      } else if (!isPascalCase(filename)) {
        issues.push({
          status: 'error',
          message: `Entity file "${filename}.ts" should be PascalCase (e.g. User.ts)`,
          suggestion: `Rename to ${toPascalCase(filename)}.ts`,
        })
      }

      if (isPascalCase(filename) && !filename.includes('.entity')) {
        const content = await fs.readFile(file)
        const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext, true)
        let hasMatchingTypeExport = false

        ts.forEachChild(sourceFile, (node) => {
          if (ts.isTypeAliasDeclaration(node)) {
            if (
              node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
              node.name.text === filename
            ) {
              hasMatchingTypeExport = true
            }
          }
        })

        if (!hasMatchingTypeExport) {
          issues.push({
            status: 'error',
            message: `Entity "${filename}.ts" must export a type named "${filename}"`,
            suggestion: `export type ${filename} = ...`,
          })
        }
      }
    }

    // 3. Check Ports
    const portFiles = await glob(
      path.join(repoRoot, libsDir, 'domains/*/ports/*.ts').replace(/\\/g, '/')
    )
    for (const file of portFiles) {
      const filename = path.basename(file, '.ts')

      if (filename.includes('.port')) {
        issues.push({
          status: 'error',
          message: `Port file "${filename}.ts" should not have .port suffix`,
          suggestion: `Rename to ${toPascalCase(filename.replace('.port', ''))}Port.ts`,
        })
      } else if (!isPascalCase(filename)) {
        issues.push({
          status: 'error',
          message: `Port file "${filename}.ts" should be PascalCase (e.g. WalletPort.ts)`,
        })
      }

      if (isPascalCase(filename) && !filename.includes('.port')) {
        const content = await fs.readFile(file)
        const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext, true)
        let hasMatchingTypeExport = false

        ts.forEachChild(sourceFile, (node) => {
          if (ts.isTypeAliasDeclaration(node)) {
            if (
              node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
              node.name.text === filename
            ) {
              hasMatchingTypeExport = true
            }
          }
          // Check validation interface logic if needed
          if (ts.isInterfaceDeclaration(node)) {
            if (
              node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
              node.name.text === filename
            ) {
              issues.push({
                status: 'error',
                message: `Port "${filename}.ts" uses Interface for "${filename}" but should use Type`,
                suggestion: `Convert interface ${filename} to type ${filename} = { ... }`,
              })
            }
          }
        })

        if (!hasMatchingTypeExport) {
          // We only complain if we didn't already complain about interface
          const hasInterface = issues.some(
            (i) => i.status !== 'ok' && i.message?.includes(`Interface for "${filename}"`)
          )
          if (!hasInterface) {
            issues.push({
              status: 'error',
              message: `Port "${filename}.ts" must export a TYPE named "${filename}"`,
              suggestion: `export type ${filename} = ...`,
            })
          }
        }
      }
    }

    // 4. Check Use Cases
    const useCaseFiles = await glob(
      path.join(repoRoot, libsDir, 'domains/*/{use-cases,usecases}/*.ts').replace(/\\/g, '/')
    )
    for (const file of useCaseFiles) {
      const filename = path.basename(file, '.ts')
      if (filename === 'index') continue

      if (filename.includes('.usecase')) {
        issues.push({
          status: 'error',
          message: `Use-case file "${filename}.ts" should not have .usecase suffix`,
          suggestion: `Rename to ${toCamelCase(filename.replace('.usecase', ''))}.ts`,
        })
      } else if (!isCamelCase(filename)) {
        issues.push({
          status: 'error',
          message: `Use-case file "${filename}.ts" should be camelCase function name`,
        })
      }

      if (isCamelCase(filename) && !filename.includes('.usecase')) {
        const content = await fs.readFile(file)
        const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext, true)
        let hasMatchingFuncExport = false

        ts.forEachChild(sourceFile, (node) => {
          if (ts.isFunctionDeclaration(node)) {
            if (
              node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
              node.name?.text === filename
            ) {
              hasMatchingFuncExport = true
            }
          }
        })

        if (!hasMatchingFuncExport) {
          issues.push({
            status: 'error',
            message: `Use-case "${filename}.ts" must export a function named "${filename}"`,
            suggestion: `export function ${filename}(...) {}`,
          })
        }
      }
    }

    // 5. Check No Classes
    const domainFiles = await glob(
      path.join(repoRoot, libsDir, 'domains/**/*.ts').replace(/\\/g, '/')
    )
    for (const file of domainFiles) {
      if (file.includes('.test.') || file.includes('.spec.')) continue

      const content = await fs.readFile(file)
      // Quick check before parsing
      if (content.includes('class ')) {
        const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext, true)
        let hasClass = false
        ts.forEachChild(sourceFile, (node) => {
          if (ts.isClassDeclaration(node)) {
            hasClass = true
          }
        })
        if (hasClass) {
          issues.push({
            status: 'error',
            message: `Class detected in "${path.relative(repoRoot, file)}"`,
            suggestion: `Kompo prefers Functional Programming. Use types and functions.`,
          })
        }
      }
    }

    // 6. Check Adapters (Basic check: if it looks like a factory, ensure file is camelCase.adapter.ts)
    const adapterFiles = await glob(
      path.join(repoRoot, libsDir, 'adapters/**/*.ts').replace(/\\/g, '/'),
      {
        ignore: ['**/node_modules/**', '**/*.json', '**/*.d.ts'],
      }
    )

    for (const file of adapterFiles) {
      const filename = path.basename(file, '.ts')
      if (['index', 'client', 'schema', 'seed', 'config', 'provider'].includes(filename)) continue

      const content = await fs.readFile(file)
      // Check for factory function
      if (content.includes('create') && content.includes('Adapter')) {
        const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext, true)
        ts.forEachChild(sourceFile, (node) => {
          if (
            ts.isFunctionDeclaration(node) &&
            node.name?.text.startsWith('create') &&
            (node.name?.text.endsWith('Adapter') ||
              node.name?.text.endsWith('Repository') ||
              node.name?.text.endsWith('Gateway'))
          ) {
            // Found a factory. Check filename.
            if (!filename.endsWith('.adapter')) {
              issues.push({
                status: 'warning',
                message: `The file "${path.relative(repoRoot, file)}" contains an adapter factory but lacks the ".adapter.ts" suffix.`,
                suggestion: `Rename the file to "${toKebabCase(node.name.text.replace('create', ''))}.adapter.ts" to follow conventions.`,
              })
            }
          }
        })
      }
    }

    if (issues.length === 0) {
      return [{ status: 'ok' }]
    }
    return issues
  },
})

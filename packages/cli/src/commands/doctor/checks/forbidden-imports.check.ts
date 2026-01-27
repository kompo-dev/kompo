import path from 'node:path'
import { glob } from 'glob'
import ts from 'typescript'
import type { DoctorCheckResult } from '../doctor.check'
import { registerDoctorCheck } from '../doctor.registry'

const FORBIDDEN_DOMAIN_IMPORTS = ['wagmi', 'viem', 'ethers', 'react', 'next', 'prisma', '@tanstack']

registerDoctorCheck({
  id: 'forbidden-domain-imports',
  description: 'Check for forbidden imports in Domain Layer',
  async run({ repoRoot, fs }): Promise<DoctorCheckResult[]> {
    const issues: DoctorCheckResult[] = []

    // Find all files in domains/src/**/*.ts
    const pattern = path.join(repoRoot, 'domains', 'src', '**', '*.ts').replace(/\\/g, '/')
    const files = await glob(pattern, {
      ignore: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**'],
    })

    for (const file of files) {
      const content = await fs.readFile(file)
      const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext, true)

      for (const stmt of sourceFile.statements) {
        if (ts.isImportDeclaration(stmt)) {
          const importClause = stmt.importClause
          const isTypeOnly = importClause?.isTypeOnly

          const moduleSpecifier = stmt.moduleSpecifier as ts.StringLiteral
          const moduleName = moduleSpecifier.text

          if (
            !isTypeOnly &&
            FORBIDDEN_DOMAIN_IMPORTS.some(
              (pkg) => moduleName.startsWith(pkg) || moduleName.includes(`/${pkg}`)
            )
          ) {
            issues.push({
              status: 'error',
              message: `Forbidden runtime import "${moduleName}" in ${path.relative(repoRoot, file)}`,
              suggestion:
                'Domain code should remain infrastructure-agnostic. Move this logic to an adapter or use "import type".',
            })
          }
        }
      }
    }

    if (issues.length === 0) {
      return [{ status: 'ok' }]
    }
    return issues
  },
})

import fs from 'node:fs'
import path from 'node:path'
import { cancel, isCancel, log, text } from '@clack/prompts'
import { Command } from 'commander'
import { installDependencies } from '../utils/install'

export function createUpgradeCommand() {
  // Hardcoded license validation for testing
  async function validateLicense(key: string): Promise<boolean> {
    // For testing: accept any key containing "enterprise" or "test"
    return (
      key.toLowerCase().includes('enterprise') ||
      key.toLowerCase().includes('test') ||
      key === 'demo-key-12345'
    )
  }

  return new Command('upgrade')
    .description('Upgrade to Enterprise tier')
    .argument('<tier>', 'Tier to upgrade to (enterprise)')
    .action(async (tier) => {
      if (tier !== 'enterprise') {
        log.error(`Invalid tier: ${tier}. Only 'enterprise' is supported.`)
        process.exit(1)
      }

      log.info(`🚀 Upgrading to Kompo Enterprise...`)

      // 1. Ask for license key
      const license = await text({
        message: 'Enter your Enterprise license key:',
        placeholder: 'xxx-xxx-xxx',
        validate: (value) => {
          if (!value) return 'License key is required'
          if (value.length < 10) return 'Invalid license key format'
          return undefined
        },
      })

      if (isCancel(license)) {
        cancel('Operation cancelled.')
        process.exit(0)
      }

      // 2. Validate license (hardcoded for testing)
      const isValid = await validateLicense(license as string)

      if (!isValid) {
        log.error(`❌ Invalid license key: ${license}`)
        process.exit(1)
      }

      log.success(`✅ License validated`)

      // 3. Create enterprise directory
      const enterpriseDir = path.join(process.cwd(), 'packages', 'enterprise')

      if (!fs.existsSync(enterpriseDir)) {
        fs.mkdirSync(enterpriseDir, { recursive: true })
        log.success(`✅ Created ${enterpriseDir}`)
      }

      // 4. Create enterprise backend plugin
      const backendDir = path.join(enterpriseDir, 'backend')
      if (!fs.existsSync(backendDir)) {
        fs.mkdirSync(backendDir, { recursive: true })

        // Create enterprise backend plugin
        const pluginContent = `
import { registerCapability } from '@kompo/kit'

// Enterprise backend capabilities
registerCapability('backend', {
  id: 'nestjs',
  name: 'NestJS',
  description: 'Enterprise Node.js framework',
  category: 'backend',
  framework: true,
  plan: 'enterprise',
  status: 'available',
  runtime: false,
})

registerCapability('backend', {
  id: 'tRPC',
  name: 'tRPC',
  description: 'End-to-end typesafe APIs',
  category: 'backend',
  framework: true,
  plan: 'enterprise',
  status: 'available',
  runtime: false,
})
`.trim()

        fs.writeFileSync(path.join(backendDir, 'index.ts'), pluginContent)
        log.success(`✅ Created enterprise backend plugin`)
      }

      // 5. Save license file
      const licenseFile = path.join(process.cwd(), '.kompo-license')
      fs.writeFileSync(
        licenseFile,
        JSON.stringify(
          {
            key: license,
            tier: 'enterprise',
            validatedAt: new Date().toISOString(),
          },
          null,
          2
        )
      )
      log.success(`✅ License saved to ${licenseFile}`)

      // 6. Install dependencies
      try {
        await installDependencies(process.cwd())
      } catch (_error) {
        // Error handled inside tool
      }

      // 7. Success message
      log.success(`\n🎉 Successfully upgraded to Kompo Enterprise!`)
      log.info(`\nNext steps:`)
      log.info(`  • Run 'pnpm kompo new my-app' to see Enterprise options`)
      log.info(`  • NestJS and tRPC are now available as backends`)
      log.info(`  • More Enterprise features will be unlocked soon\n`)
    })
}

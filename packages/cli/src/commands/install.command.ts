import fs from 'node:fs/promises'
import path from 'node:path'
import { cancel, isCancel, select } from '@clack/prompts'
import { checkCompatibility, getBlueprint, getBlueprintsByType } from '@kompo/blueprints'
import { readKompoConfig } from '@kompo/kit'
import { Command } from 'commander'
import color from 'picocolors'
import type { KompoPluginRegistry } from '../registries/plugin.registry'
import { ensureProjectContext } from '../utils/project'

// Helper function to check if path exists
async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

export async function runInstall(
  blueprintName: string,
  options: { app?: string; quiet?: boolean }
) {
  const cwd = process.cwd()
  const { repoRoot } = await ensureProjectContext(cwd)

  // Get the blueprint
  let selectedBlueprint = getBlueprint(blueprintName)

  if (!selectedBlueprint) {
    // If no blueprint specified, show available plugins
    if (!blueprintName) {
      const plugins = getBlueprintsByType('plugin')
      const choices = plugins.map((b) => ({
        value: b.name,
        label: `${b.name} - ${b.description}`,
      }))

      const blueprint = await select({
        message: 'Select a plugin to install:',
        options: choices,
      })

      if (isCancel(blueprint)) {
        cancel('Installation cancelled.')
        process.exit(0)
      }

      selectedBlueprint = getBlueprint(blueprint as string)
    }

    if (!selectedBlueprint) {
      console.error(color.red(`✗ Blueprint "${blueprintName}" not found.`))
      console.log(color.dim('Available blueprints:'))
      const plugins = getBlueprintsByType('plugin')
      plugins.forEach((b) => {
        console.log(color.dim(`  • ${b.name} - ${b.description}`))
      })
      process.exit(1)
    }
  }

  // Check if it's a plugin type
  if (selectedBlueprint.type !== 'plugin') {
    console.error(
      color.red(`✗ "${selectedBlueprint.name}" is an app blueprint. Use 'kompo new' instead.`)
    )
    process.exit(1)
  }

  // Determine target app
  let targetApp = options.app
  if (!targetApp) {
    // Read kompo.json to find apps
    const config = await readKompoConfig(repoRoot)
    if (config?.apps) {
      const appChoices = Object.keys(config.apps).map((app) => ({
        value: app,
        label: app,
      }))

      targetApp = (await select({
        message: 'Select target app:',
        options: appChoices,
      })) as string

      if (isCancel(targetApp)) {
        cancel('Installation cancelled.')
        process.exit(0)
      }
    } else {
      console.error(color.red('✗ No apps found. Please specify --app <app-name>.'))
      process.exit(1)
    }
  }

  // Check compatibility
  const config = await readKompoConfig(repoRoot)
  const currentStack = []

  if (config?.apps[targetApp]) {
    const appConfig = config.apps[targetApp]
    if (appConfig.frontend) currentStack.push(appConfig.frontend)
    if (appConfig.backend) currentStack.push(appConfig.backend)
    if (appConfig.designSystem) currentStack.push(appConfig.designSystem)
  }

  if (!checkCompatibility(selectedBlueprint, currentStack)) {
    console.error(
      color.red(`✗ Blueprint "${selectedBlueprint.name}" is not compatible with current stack.`)
    )
    console.log(color.dim(`Required: ${selectedBlueprint.stack?.required.join(', ')}`))
    console.log(color.dim(`Current: ${currentStack.join(', ')}`))
    process.exit(1)
  }

  // Install the template
  const targetDir = path.join(repoRoot, 'apps', targetApp)

  if (!(await pathExists(targetDir))) {
    console.error(color.red(`✗ App "${targetApp}" does not exist.`))
    process.exit(1)
  }

  // Copy blueprint
  const blueprintPath = path.join(selectedBlueprint.blueprint || '', '.')
  if (await pathExists(blueprintPath)) {
    console.log(color.cyan(`\n📦 Installing ${selectedBlueprint.name}...`))

    // Simple copy for now (can be enhanced with blueprint rendering)
    await copyRecursive(blueprintPath, targetDir)

    console.log(color.green(`✅ Plugin "${selectedBlueprint.name}" installed successfully!`))
  } else {
    console.error(color.red(`✗ Blueprint not found for blueprint "${selectedBlueprint.name}"`))
    process.exit(1)
  }
}

// Helper function to copy directories recursively
async function copyRecursive(src: string, dest: string) {
  const stat = await fs.stat(src)

  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true })
    const items = await fs.readdir(src)

    for (const item of items) {
      const srcPath = path.join(src, item)
      const destPath = path.join(dest, item)
      await copyRecursive(srcPath, destPath)
    }
  } else {
    await fs.copyFile(src, dest)
  }
}

export function createInstallCommand(_registry: KompoPluginRegistry): Command {
  const cmd = new Command('install')
    .description('Install a plugin into an existing app')
    .argument('[blueprint]', 'Plugin name to install')
    .option('--app <app>', 'Target app name')
    .option('--quiet', 'Suppress output')
    .showHelpAfterError(true)
    .action(async (template, options) => {
      try {
        await runInstall(template || '', options)
      } catch (error) {
        console.error(color.red('Error:'), error)
        process.exit(1)
      }
    })

  return cmd
}

import fs from 'node:fs'
import path from 'node:path'
import { cancel, intro, isCancel, note, outro, spinner, text } from '@clack/prompts'
import { Command } from 'commander'
import { execa } from 'execa'
import { downloadTemplate } from 'giget'
import color from 'picocolors'

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'))

const program = new Command('create-kompo')

program
  .version(packageJson.version)
  .argument('[directory]', 'Project directory')
  .option('-t, --template <name>', 'Template to use')
  .action(async (directory, options) => {
    console.clear()
    intro(color.bgBlue(color.white(' create-kompo ')))

    if (!directory) {
      const dir = await text({
        message: 'Where should we create your project?',
        placeholder: './my-kompo-app',
        initialValue: './my-kompo-app',
      })

      if (isCancel(dir)) {
        cancel('Operation cancelled.')
        process.exit(0)
      }

      directory = dir
    }

    const targetDir = path.resolve(process.cwd(), directory)
    const relativeDir = path.relative(process.cwd(), targetDir)

    if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
      cancel(`Directory ${relativeDir} is not empty. Please choose another one.`)
      process.exit(1)
    }

    const s = spinner()

    // 1. Clone Template
    s.start(`Downloading template (v${packageJson.version})...`)
    try {
      await downloadTemplate(`github:kompo-dev/kompo#v${packageJson.version}`, {
        dir: targetDir,
        force: true, // since we checked it's empty or doesn't exist (mostly)
      })
      s.stop('Template downloaded!')
    } catch (e) {
      s.stop('Failed to download template')
      console.error(e)
      process.exit(1)
    }

    // 2. Install Dependencies
    s.start('Installing dependencies...')
    try {
      await execa('pnpm', ['install'], { cwd: targetDir })
      s.stop('Dependencies installed!')
    } catch (e) {
      s.stop('Failed to install dependencies')
      console.error('Make sure you have pnpm installed.')
      console.error(e)
      process.exit(1)
    }

    // 3. Initialize Project (Kompo New)
    s.stop('Dependencies installed!')

    console.log('') // Spacer
    intro(color.bgGreen(color.black(' INITIALIZING PROJECT ')))

    try {
      const args = ['kompo', 'new']
      if (options.template) {
        args.push('--yes', '--template', options.template)
        console.log(color.dim(`Applying template: ${options.template}...`))
      } else {
        console.log(color.dim('Running interactive setup...'))
      }

      await execa('pnpm', args, {
        cwd: targetDir,
        stdio: 'inherit',
      })
    } catch (e) {
      console.error(color.red('Failed to initialize project.'))
      console.error(e)
      // Don't exit 1, let the user see the error and maybe try manually
    }

    const nextSteps = [`cd ${relativeDir}`, 'pnpm dev']

    note(nextSteps.join('\n'), 'Next steps')

    outro('You are all set!')
  })

program.parse()

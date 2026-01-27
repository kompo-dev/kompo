import path from 'node:path'
import { log } from '@clack/prompts'
import { getBlueprint } from '@kompo/blueprints'

import { Command } from 'commander'
import color from 'picocolors'
import { createFsEngine } from '../../../engine/fs-engine'
import {
  type FeatureBlueprint,
  getFeature as getFeatureFromRegistry,
  registerFeatureProvider,
} from '../../../registries/feature.registry'
import { ensureProjectContext } from '../../../utils/project'
import { runAddAdapter } from '../adapter/adapter.command'
import { runAddDomain } from '../domain/domain.command'
import { runAddEntity } from '../entity/entity.command'
import { runAddPort } from '../port/port.command'
import { runAddUseCase } from '../use-case/use-case.command'

// Register OSS Features Provider
registerFeatureProvider({
  name: 'OSS Features',
  getFeature: async (name) => {
    const bp = getBlueprint(name)
    if (bp && (bp.type === 'feature' || !bp.type)) {
      // Allow conversion or usage of blueprint as feature manifest
      // Requires blueprint.json to match FeatureBlueprint schema OR be adapted
      return bp as unknown as FeatureBlueprint
    }
    return null
  },
})

export async function runAddFeature(manifestOrPath: string | FeatureBlueprint) {
  const cwd = process.cwd()
  await ensureProjectContext(cwd)

  const fs = createFsEngine()
  let manifest: FeatureBlueprint
  let featureName = 'feature'

  // 1. Resolve manifest
  if (typeof manifestOrPath === 'string') {
    featureName = manifestOrPath
    const manifestPath = manifestOrPath

    // Check if it's likely a file path (explicit extension or existing file)
    let isFile = false
    let resolvedPath = manifestPath

    if (await fs.fileExists(resolvedPath)) {
      isFile = true
    } else if (await fs.fileExists(`${resolvedPath}.json`)) {
      isFile = true
      resolvedPath = `${resolvedPath}.json`
    } else if (resolvedPath.endsWith('.json')) {
      // Explicit json but not found
      // Maybe error, or maybe fell through
    }

    // If not a local file, try registry
    if (!isFile) {
      // Try path resolution just in case it was a relative path not passed to fileExists correctly?
      // fs.fileExists uses absolute? FsEngine check.
      // fs.fileExists implementation usually expects absolute.
      const absPath = path.isAbsolute(resolvedPath) ? resolvedPath : path.join(cwd, resolvedPath)
      if (await fs.fileExists(absPath)) {
        resolvedPath = absPath
        isFile = true
      } else if (await fs.fileExists(`${absPath}.json`)) {
        resolvedPath = `${absPath}.json`
        isFile = true
      }
    }

    if (isFile) {
      manifest = await fs.readJson<FeatureBlueprint>(resolvedPath)
    } else {
      // Not a file, check registry
      const feature = await getFeatureFromRegistry(featureName)
      if (feature) {
        manifest = feature
      } else {
        console.error(color.red(`✗ Feature "${featureName}" not found locally or in registry.`))
        process.exit(1)
      }
    }
  } else {
    manifest = manifestOrPath
    featureName = 'custom-feature'
  }

  console.log(color.blue(`🚀 Installing feature...`))

  // 2. Add Domains
  for (const domain of manifest.domains) {
    console.log(color.dim(`\n--- Domain: ${domain.name} ---`))
    await runAddDomain(domain.name, { skipEntity: true }, new Command())

    // Add Entities
    if (domain.entities) {
      for (const entity of domain.entities) {
        await runAddEntity(
          entity,
          {
            domain: domain.name,
            skipTests: false,
          },
          new Command()
        )
      }
    }

    // Add Ports
    if (domain.ports) {
      for (const port of domain.ports) {
        await runAddPort(port, {
          domain: domain.name,
          skipTests: false,
        })
      }
    }

    // Add Use Cases
    const useCases = domain['use-cases']
    if (useCases) {
      for (const uc of useCases) {
        await runAddUseCase(uc, {
          domain: domain.name,
        })
      }
    }
  }

  // 3. Add Adapters
  if (manifest.adapters) {
    console.log(color.dim(`\n--- Adapters ---`))
    for (const adapter of manifest.adapters) {
      // Start creation.
      // Note: Adapter creation currently prompts for App if not provided.
      // The manifest in example doesn't have "app".
      // We should probably require "app" in manifest OR accept it as CLI arg for the whole feature?
      // But feature might span apps?
      // Let's assume strict manifest for now or fail if missing.

      // Example manifest has "orm-backend" name. "port": "UserRepository".
      // If "app" is missing, we can try to guess or prompt ONCE?
      // But `runAddAdapter` prompts. So valid.

      // Actually `runAddAdapter` now accepts options.
      // We need to pass app if known.

      await runAddAdapter({
        port: adapter.port,
        driver: adapter.driver,
        app: adapter.app,
        name: adapter.name,
        skipTests: false,
        nonInteractive: true,
        skipInstall: true,
      })
    }
  }

  // 4. Wire
  // Should we wire?
  // "Optionnel kompo wire"
  // Let's try to wire each domain mentioned?
  // But usage of wire depends on target app.
  // If adapter defines app, we can wire.

  log.message(color.green(`✅ Feature added successfully!`))
}

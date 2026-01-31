import path from 'node:path'
import { log } from '@clack/prompts'

import type { FeatureManifest } from '@kompo/blueprints/types'
import color from 'picocolors'
import { createFsEngine } from '../../../engine/fs-engine'
import {
  getFeature as getFeatureFromRegistry,
  registerFeatureProvider,
} from '../../../registries/feature.registry'
import { ensureProjectContext } from '../../../utils/project'
import { runWire } from '../../wire.command'
import { runAddAdapter } from '../adapter/adapter.command'
import { runAddDomain } from '../domain/domain.command'
import { runAddEntity } from '../entity/entity.command'
import { runAddPort } from '../port/port.command'
import { runAddUseCase } from '../use-case/use-case.command'

// Register OSS Features Provider
registerFeatureProvider({
  name: 'OSS Features',
  getFeature: async (name) => {
    const { getFeature } = await import('@kompo/blueprints')
    const feature = getFeature(name)
    if (feature) return feature
    return null
  },
})

export async function runAddFeature(
  manifestOrPath: string | FeatureManifest,
  options: { app?: string } = {}
) {
  const cwd = process.cwd()
  await ensureProjectContext(cwd)

  const fs = createFsEngine()
  let manifest: FeatureManifest
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
    } else if (await fs.fileExists(path.join(resolvedPath, 'features.json'))) {
      isFile = true
      resolvedPath = path.join(resolvedPath, 'features.json')
    } else if (await fs.fileExists(path.join(resolvedPath, 'blueprint.json'))) {
      isFile = true
      resolvedPath = path.join(resolvedPath, 'blueprint.json')
    } else if (resolvedPath.endsWith('.json')) {
      // Explicit json but not found
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
      manifest = await fs.readJson<FeatureManifest>(resolvedPath)
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

  // 2. Process Blueprint Steps
  if (manifest.steps) {
    for (const step of manifest.steps) {
      if (step.command === 'add' && step.type === 'domain') {
        await runAddDomain(step.name, { app: options.app, skipEntity: true, nonInteractive: true })
      } else if (step.command === 'add' && step.type === 'port') {
        await runAddPort(step.name, {
          domain: step.domain,
          type: step.portType,
          nonInteractive: true,
        })
      } else if (step.command === 'add' && step.type === 'case') {
        await runAddUseCase(step.name, { domain: step.domain, nonInteractive: true })
      } else if (step.command === 'add' && step.type === 'entity') {
        await runAddEntity(step.name, { domain: step.domain, nonInteractive: true })
      } else if (step.command === 'add' && step.type === 'adapter') {
        await runAddAdapter({
          port: step.port,
          provider: step.name,
          name: step.alias,
          domain: step.domain,
          app: options.app,
          capability: step.capability,
          nonInteractive: true,
          skipInstall: true,
        })
      } else if (step.command === 'wire') {
        await runWire(step.name, { app: options.app, nonInteractive: true })
      }
    }
  }

  // 3. Recursive Feature Installation via 'features' list or steps
  // Note: features list is for composition (other features), steps can also add features.
  // We handle 'features' property for composition.
  if (manifest.features) {
    for (const subFeature of manifest.features) {
      await runAddFeature(subFeature, options)
    }
  }

  log.message(color.green(`✅ Feature added successfully!`))
}

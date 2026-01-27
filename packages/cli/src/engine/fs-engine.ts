/**
 * File system engine implementation
 */

import { exec } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import type { FsEngine } from '@kompo/kit'

const execAsync = promisify(exec)

// ... imports ...

export function createFsEngine(): FsEngine {
  async function ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true })
  }

  async function writeFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath)
    await ensureDir(dir)
    await fs.writeFile(filePath, content, 'utf-8')

    try {
      // Automatically format the generated file
      await execAsync(`pnpm biome check --write "${filePath}"`)
    } catch {
      // Ignore formatting errors (e.g. biome not found or syntax error in template)
    }
  }

  async function writeJson(filePath: string, data: unknown): Promise<void> {
    const content = JSON.stringify(data, null, 2)
    await writeFile(filePath, content)
  }

  async function fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  async function readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8')
  }

  async function readJson<T = unknown>(filePath: string): Promise<T> {
    const content = await readFile(filePath)
    return JSON.parse(content)
  }

  async function copyFile(src: string, dest: string): Promise<void> {
    const dir = path.dirname(dest)
    await ensureDir(dir)
    await fs.copyFile(src, dest)
  }

  async function renameFile(oldPath: string, newPath: string): Promise<void> {
    const dir = path.dirname(newPath)
    await ensureDir(dir)
    await fs.rename(oldPath, newPath)
  }

  async function readDir(dirPath: string): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries.map((entry) => entry.name)
  }

  async function remove(filePath: string): Promise<void> {
    await fs.rm(filePath, { recursive: true, force: true })
  }

  return {
    ensureDir,
    writeFile,
    writeJson,
    fileExists,
    readFile,
    readJson,
    copyFile,
    readDir,
    renameFile,
    remove,
  }
}

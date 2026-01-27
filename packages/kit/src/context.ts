/**
 * Shared context passed to all steps and questions
 */

export interface KompoContext {
  /** Current working directory */
  cwd: string

  /** Command being executed */
  command: 'new' | 'add'

  /** User answers from questions */
  answers: Record<string, any>

  /** Enabled features/capabilities */
  features: Set<string>

  /** File system operations */
  fs: FsEngine

  /** Template rendering operations */
  templates: TemplateEngine

  /** Plugin-specific data */
  pluginData: Map<string, any>

  /** Target project directory */
  targetDir: string

  /** Debug mode enabled */
  debug?: boolean
}

/**
 * File system engine interface
 */
export interface FsEngine {
  ensureDir(path: string): Promise<void>
  writeFile(path: string, content: string): Promise<void>
  writeJson(path: string, data: unknown): Promise<void>
  fileExists(path: string): Promise<boolean>
  readFile(path: string): Promise<string>
  readJson<T = unknown>(path: string): Promise<T>
  copyFile(src: string, dest: string): Promise<void>
  readDir(path: string): Promise<string[]>
  renameFile(oldPath: string, newPath: string): Promise<void>
  remove(path: string): Promise<void>
}

/**
 * Template engine interface
 */
export interface TemplateEngine {
  /** Render a single template file */
  render(templatePath: string, data: any): Promise<string>

  /** Render a string template */
  renderString(template: string, data: any): Promise<string>

  /** Render a template directly to a file */
  renderFile(
    templatePath: string,
    targetPath: string,
    data: any,
    options?: { merge?: boolean }
  ): Promise<void>

  /** Render an entire directory */
  renderDir(
    srcDir: string,
    targetDir: string,
    data: any,
    options?: { exclude?: string[]; merge?: boolean }
  ): Promise<void>

  /** Check if template exists */
  exists(templatePath: string): Promise<boolean>

  /** Base directory for templates */
  dir: string
}

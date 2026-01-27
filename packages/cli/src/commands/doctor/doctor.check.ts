import type { FsEngine } from '@kompo/kit'

export type DoctorCheckContext = {
  repoRoot: string
  // config: KompoConfig // Making config optional for now or need to import it properly.
  // Let's stick effectively to what we need. The user provided interface used 'config'.
  // But runDoctor used readKompoConfig inside. I'll pass it if possible, or just repoRoot for now as it's the minimal requirement for existing checks.
  // Actually, let's keep it close to user request.
  // config: KompoConfig
  fs: FsEngine
}

export type DoctorCheckResult =
  | { status: 'ok' }
  | { status: 'warning'; message: string; suggestion?: string; fix?: string }
  | { status: 'error'; message: string; suggestion?: string; fix?: string }
  | { status: 'info'; message: string; suggestion?: string }

export interface DoctorCheck {
  id: string
  description: string
  run(ctx: DoctorCheckContext): Promise<DoctorCheckResult | DoctorCheckResult[]>
}

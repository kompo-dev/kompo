import type { DoctorCheck } from './doctor.check'

const checks: DoctorCheck[] = []

export function registerDoctorCheck(check: DoctorCheck) {
  checks.push(check)
}

export function getDoctorChecks(): DoctorCheck[] {
  return [...checks]
}

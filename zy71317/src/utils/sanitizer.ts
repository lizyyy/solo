import { SENSITIVE_FIELDS } from "@/types"
import type { ExperimentRecord } from "@/types"

const MASK = "****"

export function sanitizeRecord(
  record: ExperimentRecord,
  mode: "display" | "export" | "log"
): ExperimentRecord {
  const sanitized = { ...record }

  if (mode === "display") {
    for (const field of SENSITIVE_FIELDS) {
      const val = sanitized[field]
      if (val && typeof val === "string" && val.length > 0) {
        (sanitized as Record<string, unknown>)[field] = `${val.slice(0, 2)}${MASK}`
      }
    }
  }

  if (mode === "export") {
    for (const field of SENSITIVE_FIELDS) {
      const val = sanitized[field]
      if (val && typeof val === "string" && val.length > 0) {
        (sanitized as Record<string, unknown>)[field] = MASK
      }
    }
  }

  if (mode === "log") {
    for (const field of SENSITIVE_FIELDS) {
      (sanitized as Record<string, unknown>)[field] = MASK
    }
  }

  return sanitized
}

export function sanitizeValue(value: unknown, fieldName: string): unknown {
  if (SENSITIVE_FIELDS.includes(fieldName as keyof ExperimentRecord)) {
    return MASK
  }
  return value
}

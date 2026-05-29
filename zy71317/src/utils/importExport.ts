import type { ExperimentRecord, ParamState, StabilityResult } from "@/types"
import { determineStability } from "./physics"
import { sanitizeRecord } from "./sanitizer"
import { logger } from "./logger"

const STORAGE_KEY = "maglev_records"

export function loadRecords(): ExperimentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveRecords(records: ExperimentRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function generateId(): string {
  return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function createRecord(params: ParamState, manualNote?: string): ExperimentRecord {
  const result = determineStability(params)
  const record: ExperimentRecord = {
    id: generateId(),
    ...params,
    manualNote,
    result,
    createdAt: new Date().toISOString(),
  }
  logger.info("create_record", `status=${result.status}`, record)
  return record
}

export function importCSV(csvText: string): ExperimentRecord[] {
  const lines = csvText.trim().split("\n")
  if (lines.length < 2) return []

  const headers = lines[0].split(",").map((h) => h.trim())
  const records: ExperimentRecord[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim())
    if (values.length < headers.length) continue

    const rawFields: Record<string, unknown> = {}
    headers.forEach((h, idx) => {
      rawFields[h] = values[idx]
    })

    const params: ParamState = {
      magnetSpacing: parseFloat(rawFields["magnetSpacing"] as string) || 0,
      vehicleMass: parseFloat(rawFields["vehicleMass"] as string) || 0,
      trackLength: parseFloat(rawFields["trackLength"] as string) || 0,
      current: parseFloat(rawFields["current"] as string) || 0,
      disturbance: parseFloat(rawFields["disturbance"] as string) || 0,
    }

    const result = determineStability(params)
    const record: ExperimentRecord = {
      id: (rawFields["id"] as string) || generateId(),
      ...params,
      stabilityReport: (rawFields["stabilityReport"] as string) || undefined,
      manualNote: (rawFields["manualNote"] as string) || undefined,
      rawFields,
      result,
      createdAt: (rawFields["createdAt"] as string) || new Date().toISOString(),
    }

    records.push(record)
  }

  logger.info("import_csv", `count=${records.length}`)
  return records
}

export function importJSON(jsonText: string): ExperimentRecord[] {
  try {
    const items = JSON.parse(jsonText)
    if (!Array.isArray(items)) return []

    const records: ExperimentRecord[] = items.map((item: Record<string, unknown>) => {
      const rawFields = { ...item }

      const params: ParamState = {
        magnetSpacing: Number(item.magnetSpacing) || 0,
        vehicleMass: Number(item.vehicleMass) || 0,
        trackLength: Number(item.trackLength) || 0,
        current: Number(item.current) || 0,
        disturbance: Number(item.disturbance) || 0,
      }

      const result = determineStability(params)

      return {
        id: (item.id as string) || generateId(),
        ...params,
        stabilityReport: (item.stabilityReport as string) || undefined,
        manualNote: (item.manualNote as string) || undefined,
        rawFields,
        result,
        createdAt: (item.createdAt as string) || new Date().toISOString(),
      } satisfies ExperimentRecord
    })

    logger.info("import_json", `count=${records.length}`)
    return records
  } catch {
    logger.error("import_json", "parse_error")
    return []
  }
}

function recordToCSVRow(record: ExperimentRecord): string {
  const sanitized = sanitizeRecord(record, "export")
  return [
    sanitized.id,
    sanitized.magnetSpacing,
    sanitized.vehicleMass,
    sanitized.trackLength,
    sanitized.current,
    sanitized.disturbance,
    sanitized.stabilityReport || "",
    sanitized.manualNote || "",
    sanitized.result.status,
    sanitized.result.magneticForce.toFixed(6),
    sanitized.result.gravityForce.toFixed(6),
    sanitized.result.netForce.toFixed(6),
    sanitized.result.ratio.toFixed(4),
    sanitized.result.oscillationAmplitude.toFixed(2),
    sanitized.result.anomalyType || "",
    sanitized.result.anomalyReason || "",
    sanitized.createdAt,
  ].join(",")
}

export function exportCSV(records: ExperimentRecord[]): string {
  const header = [
    "id",
    "magnetSpacing",
    "vehicleMass",
    "trackLength",
    "current",
    "disturbance",
    "stabilityReport",
    "manualNote",
    "status",
    "magneticForce",
    "gravityForce",
    "netForce",
    "ratio",
    "oscillationAmplitude",
    "anomalyType",
    "anomalyReason",
    "createdAt",
  ].join(",")

  const rows = records.map(recordToCSVRow)
  logger.info("export_csv", `count=${records.length}`)
  return [header, ...rows].join("\n")
}

export function exportJSON(records: ExperimentRecord[]): string {
  const sanitized = records.map((r) => sanitizeRecord(r, "export"))
  logger.info("export_json", `count=${records.length}`)
  return JSON.stringify(sanitized, null, 2)
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function mergeRecords(
  existing: ExperimentRecord[],
  incoming: ExperimentRecord[]
): ExperimentRecord[] {
  const existingIds = new Set(existing.map((r) => r.id))
  const newRecords = incoming.filter((r) => !existingIds.has(r.id))
  logger.info("merge_records", `new=${newRecords.length}, existing=${existing.length}`)
  return [...existing, ...newRecords]
}

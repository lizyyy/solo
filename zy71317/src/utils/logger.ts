import { sanitizeRecord } from "./sanitizer"
import type { ExperimentRecord } from "@/types"

type LogLevel = "info" | "warn" | "error"

interface LogEntry {
  timestamp: string
  level: LogLevel
  action: string
  detail?: string
  recordId?: string
}

const LOG_KEY = "maglev_logs"

function readLogs(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeLogs(logs: LogEntry[]): void {
  localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(-500)))
}

function log(level: LogLevel, action: string, detail?: string, record?: ExperimentRecord): void {
  const logs = readLogs()
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    action,
    detail,
    recordId: record?.id,
  }

  if (record) {
    sanitizeRecord(record, "log")
  }

  logs.push(entry)
  writeLogs(logs)
}

export const logger = {
  info: (action: string, detail?: string, record?: ExperimentRecord) =>
    log("info", action, detail, record),
  warn: (action: string, detail?: string, record?: ExperimentRecord) =>
    log("warn", action, detail, record),
  error: (action: string, detail?: string, record?: ExperimentRecord) =>
    log("error", action, detail, record),
  getAll: readLogs,
}

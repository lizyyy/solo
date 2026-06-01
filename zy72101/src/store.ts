import { create } from 'zustand'
import type {
  SensorRecord,
  ThresholdVersion,
  DiagnosisReport,
  RoomDimensions,
} from '@/types'
import {
  getDefaultThreshold,
  parseSensorLog,
  findGapIntervals,
  calculateStandingWaveModes,
  judgeRecord,
} from '@/utils/engine'

interface AppState {
  records: SensorRecord[]
  thresholds: ThresholdVersion[]
  currentThresholdVersion: number
  reports: DiagnosisReport[]
  roomDimensions: RoomDimensions

  loadSampleData: () => void
  importLog: (text: string) => void
  supplementLog: (text: string) => void
  addThreshold: (reason: string, modifiedBy: string, bands: ThresholdVersion['bands']) => void
  setRoomDimensions: (dims: RoomDimensions) => void
  runDiagnosis: () => void
  deleteReport: (id: string) => void
  clearRecords: () => void

  getCurrentThreshold: () => ThresholdVersion
}

const STORAGE_KEYS = {
  thresholds: 'swd_thresholds',
  reports: 'swd_reports',
  records: 'swd_records',
  currentVersion: 'swd_current_threshold_version',
  roomDims: 'swd_room_dimensions',
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return fallback
}

function saveToStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* ignore */ }
}

let _reportCounter = 0
function genReportId(): string {
  _reportCounter += 1
  return `rpt-${Date.now()}-${_reportCounter}`
}

export const useStore = create<AppState>((set, get) => ({
  records: loadFromStorage<SensorRecord[]>(STORAGE_KEYS.records, []),
  thresholds: loadFromStorage<ThresholdVersion[]>(STORAGE_KEYS.thresholds, []),
  currentThresholdVersion: loadFromStorage<number>(STORAGE_KEYS.currentVersion, 0),
  reports: loadFromStorage<DiagnosisReport[]>(STORAGE_KEYS.reports, []),
  roomDimensions: loadFromStorage<RoomDimensions>(STORAGE_KEYS.roomDims, { length: 15, width: 10, height: 6 }),

  getCurrentThreshold: () => {
    const { thresholds, currentThresholdVersion } = get()
    if (thresholds.length === 0) {
      const def = getDefaultThreshold()
      set({ thresholds: [def], currentThresholdVersion: 1 })
      saveToStorage(STORAGE_KEYS.thresholds, [def])
      saveToStorage(STORAGE_KEYS.currentVersion, 1)
      return def
    }
    return thresholds.find(t => t.version === currentThresholdVersion) || thresholds[thresholds.length - 1]
  },

  loadSampleData: () => {
    const { importLog, setRoomDimensions } = get()
    importLog(
      `timestamp,frequency,soundPressure,unit
2026-05-20T10:00:00,31.5,0.18,Pa
2026-05-20T10:00:01,50,0.35,Pa
2026-05-20T10:00:02,80,0.12,Pa
2026-05-20T10:00:03,125,0.22,Pa
2026-05-20T10:00:04,200,0.15,Pa
2026-05-20T10:00:05,63,,Pa
2026-05-20T10:00:05,63,0.55,Pa
2026-05-20T10:00:15,40,0.72,Pa
2026-05-20T10:00:16,31.5,2.5,Pa
2026-05-20T10:00:17,50,88,dB
2026-05-20T10:00:18,80,0.58,Pa`
    )
    setRoomDimensions({ length: 15, width: 10, height: 6 })
  },

  importLog: (text: string) => {
    const records = parseSensorLog(text, 'import')
    set({ records })
    saveToStorage(STORAGE_KEYS.records, records)
  },

  supplementLog: (text: string) => {
    const supplementRecords = parseSensorLog(text, 'supplement')
    const { records } = get()
    const merged = [...records, ...supplementRecords]
    set({ records: merged })
    saveToStorage(STORAGE_KEYS.records, merged)
  },

  addThreshold: (reason: string, modifiedBy: string, bands: ThresholdVersion['bands']) => {
    const { thresholds } = get()
    const maxVersion = thresholds.reduce((max, t) => Math.max(max, t.version), 0)
    const newVersion: ThresholdVersion = {
      version: maxVersion + 1,
      createdAt: new Date().toISOString(),
      modifiedBy,
      reason,
      bands,
    }
    const updated = [...thresholds, newVersion]
    set({ thresholds: updated, currentThresholdVersion: newVersion.version })
    saveToStorage(STORAGE_KEYS.thresholds, updated)
    saveToStorage(STORAGE_KEYS.currentVersion, newVersion.version)
  },

  setRoomDimensions: (dims: RoomDimensions) => {
    set({ roomDimensions: dims })
    saveToStorage(STORAGE_KEYS.roomDims, dims)
  },

  runDiagnosis: () => {
    const { records, roomDimensions } = get()
    const threshold = get().getCurrentThreshold()
    const results = records.map(r => judgeRecord(r, threshold))
    const gaps = findGapIntervals(records)
    const modes = calculateStandingWaveModes(roomDimensions)

    const summary = {
      safe: results.filter(r => r.level === 'safe').length,
      warn: results.filter(r => r.level === 'warn').length,
      danger: results.filter(r => r.level === 'danger').length,
    }

    const report: DiagnosisReport = {
      id: genReportId(),
      createdAt: new Date().toISOString(),
      thresholdVersion: threshold.version,
      roomDimensions,
      results,
      gapIntervals: gaps,
      modes,
      summary,
    }

    const { reports } = get()
    const updated = [report, ...reports]
    set({ reports: updated })
    saveToStorage(STORAGE_KEYS.reports, updated)
  },

  deleteReport: (id: string) => {
    const { reports } = get()
    const updated = reports.filter(r => r.id !== id)
    set({ reports: updated })
    saveToStorage(STORAGE_KEYS.reports, updated)
  },

  clearRecords: () => {
    set({ records: [] })
    saveToStorage(STORAGE_KEYS.records, [])
  },
}))

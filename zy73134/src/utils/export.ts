import { StationRecord, ExportPayload, StationDiff, FieldChange } from '@/types/station'

export const generateTimestamp = (): string => {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

const COMPARABLE_FIELDS: (keyof StationRecord)[] = [
  'station_name',
  'lng',
  'lat',
  'energy_output',
  'sampling_time',
  'expected_time',
  'time_conflict',
  'experiment_result',
  'result_value',
  'threshold_min',
  'threshold_max',
  'result_abnormal',
  'anomaly_reason',
  'remote_sensing_source',
  'screenshot_id',
  'source_line',
  'cloud_impact',
  'cloud_area_desc',
  'remark',
]

export function getLatestByStation(records: StationRecord[]): StationRecord[] {
  const map = new Map<string, StationRecord>()

  for (const r of records) {
    const existing = map.get(r.station_code)
    if (!existing) {
      map.set(r.station_code, r)
      continue
    }

    const existingPriority = existing.status !== '原始' ? 1 : 0
    const newPriority = r.status !== '原始' ? 1 : 0

    if (newPriority > existingPriority) {
      map.set(r.station_code, r)
    } else if (newPriority === existingPriority) {
      if (new Date(r.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
        map.set(r.station_code, r)
      }
    }
  }

  return Array.from(map.values())
}

export function compareRecords(oldR: StationRecord, newR: StationRecord): string[] {
  const changed: string[] = []
  for (const field of COMPARABLE_FIELDS) {
    const oldVal = oldR[field]
    const newVal = newR[field]
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changed.push(field)
    }
  }
  return changed
}

export function buildExportPayload(records: StationRecord[]): ExportPayload {
  const latestRecords = getLatestByStation(records)
  const originalRecords = records.filter((r) => r.batch_id === 'BATCH-ORIG')
  const originalMap = new Map(originalRecords.map((r) => [r.station_code, r]))

  const diff: StationDiff[] = []
  for (const newR of latestRecords) {
    const oldR = originalMap.get(newR.station_code)
    if (!oldR) continue
    const changedFields = compareRecords(oldR, newR)
    if (changedFields.length === 0) continue

    const changes: FieldChange[] = changedFields.map((field) => ({
      field,
      old: oldR[field as keyof StationRecord],
      new: newR[field as keyof StationRecord],
    }))

    diff.push({
      station_code: newR.station_code,
      changes,
    })
  }

  return {
    exportedAt: new Date().toISOString(),
    records: latestRecords,
    originalRecords,
    diff,
  }
}

export function downloadJSON(payload: any, filename: string): void {
  const jsonStr = JSON.stringify(payload, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

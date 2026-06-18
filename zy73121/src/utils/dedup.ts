import type { AnomalyRecord, ShipRecord } from './types'

export function makeAnomalyKey(record: { buoyId: string; sensorTimestamp: string }): string {
  return `${record.buoyId}::${record.sensorTimestamp}`
}

export function makeShipKey(record: { buoyId: string; recordTimestamp: string }): string {
  return `${record.buoyId}::${record.recordTimestamp}`
}

export function dedupAnomalies(
  existing: AnomalyRecord[],
  incoming: AnomalyRecord[]
): { toAdd: AnomalyRecord[]; skipped: AnomalyRecord[] } {
  const existingKeys = new Set(existing.map(makeAnomalyKey))
  const toAdd: AnomalyRecord[] = []
  const skipped: AnomalyRecord[] = []
  for (const rec of incoming) {
    if (existingKeys.has(makeAnomalyKey(rec))) {
      skipped.push(rec)
    } else {
      toAdd.push(rec)
    }
  }
  return { toAdd, skipped }
}

export function dedupShipRecords(
  existing: ShipRecord[],
  incoming: ShipRecord[]
): { toAdd: ShipRecord[]; skipped: ShipRecord[] } {
  const existingKeys = new Set(existing.map(makeShipKey))
  const toAdd: ShipRecord[] = []
  const skipped: ShipRecord[] = []
  for (const rec of incoming) {
    if (existingKeys.has(makeShipKey(rec))) {
      skipped.push(rec)
    } else {
      toAdd.push(rec)
    }
  }
  return { toAdd, skipped }
}

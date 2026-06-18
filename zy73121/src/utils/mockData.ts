import type { AnomalyRecord, ShipRecord, Remark } from './types'

function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function randomFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

const BUOY_IDS = ['BY-001', 'BY-002', 'BY-003', 'BY-004', 'BY-005']
const ANOMALY_TYPES: AnomalyRecord['anomalyType'][] = [
  'TEMP_ANOMALY',
  'SALINITY_ANOMALY',
  'DO_ANOMALY',
  'PH_ANOMALY',
  'MULTI_ANOMALY',
]
const STATUSES: AnomalyRecord['status'][] = ['UNCONFIRMED', 'CONFIRMED', 'SUSPENDED', 'RESOLVED']

function randomDate(daysAgo: number): string {
  const now = new Date()
  const past = new Date(now.getTime() - Math.random() * daysAgo * 86400000)
  return past.toISOString()
}

export function generateMockAnomalies(count = 25): AnomalyRecord[] {
  const records: AnomalyRecord[] = []
  for (let i = 0; i < count; i++) {
    const buoyId = BUOY_IDS[Math.floor(Math.random() * BUOY_IDS.length)]
    const hasCoordReversal = Math.random() < 0.12
    const normalLat = randomFloat(18, 40)
    const normalLng = randomFloat(108, 125)
    const sensorLat = hasCoordReversal ? randomFloat(116, 135) : normalLat
    const sensorLng = hasCoordReversal ? normalLat : normalLng

    const createdAt = randomDate(14)
    const sensorTimestamp = new Date(new Date(createdAt).getTime() - Math.random() * 3600000).toISOString()

    records.push({
      id: uuid(),
      buoyId,
      sensorTimestamp,
      sensorLat,
      sensorLng,
      waterTemp: randomFloat(8, 32),
      salinity: randomFloat(20, 38),
      dissolvedOxygen: randomFloat(2, 12),
      phValue: randomFloat(6.5, 9.5, 1),
      anomalyType: ANOMALY_TYPES[Math.floor(Math.random() * ANOMALY_TYPES.length)],
      status: hasCoordReversal ? 'SUSPENDED' : STATUSES[Math.floor(Math.random() * STATUSES.length)],
      createdAt,
      updatedAt: createdAt,
    })
  }
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function generateMockShipRecords(anomalies: AnomalyRecord[]): ShipRecord[] {
  return anomalies.slice(0, 8).map((a) => ({
    id: uuid(),
    buoyId: a.buoyId,
    recordTimestamp: new Date(new Date(a.sensorTimestamp).getTime() + randomFloat(1800, 7200) * 1000).toISOString(),
    recordLat: a.sensorLat + randomFloat(-0.01, 0.01, 4),
    recordLng: a.sensorLng + randomFloat(-0.01, 0.01, 4),
    waterTemp: a.waterTemp + randomFloat(-1.5, 1.5),
    salinity: a.salinity + randomFloat(-2, 2),
    dissolvedOxygen: a.dissolvedOxygen + randomFloat(-1, 1),
    phValue: a.phValue + randomFloat(-0.3, 0.3, 1),
    isBoundarySample: Math.random() < 0.2,
    linkedAnomalyId: a.id,
  }))
}

export function generateMockRemarks(anomalies: AnomalyRecord[]): Remark[] {
  const remarks: Remark[] = []
  const authors = ['阿乔', '值班员A', '值班员B', '接手同事']
  for (const a of anomalies.slice(0, 10)) {
    if (Math.random() < 0.5) {
      remarks.push({
        id: uuid(),
        recordId: a.id,
        author: authors[Math.floor(Math.random() * authors.length)],
        content: a.status === 'SUSPENDED'
          ? '系统检测：经纬度疑似反写，需人工确认'
          : '已核实传感器数据，异常原因待查',
        createdAt: new Date(new Date(a.createdAt).getTime() + randomFloat(600, 3600) * 1000).toISOString(),
      })
    }
  }
  return remarks
}

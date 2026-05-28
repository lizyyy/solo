export interface RackConfig {
  id: string
  row: number
  col: number
  powerKw: number
  temperature: number
  label: string
  isColdAisle: boolean
}

export interface CRACUnit {
  id: string
  position: [number, number, number]
  airflowCfm: number
  direction: [number, number, number]
  temperature: number
  label: string
}

export interface AirflowSample {
  position: [number, number, number]
  velocity: number
  direction: [number, number, number]
  temperature: number
}

export type AnomalyType = 'reversed_airflow' | 'missing_power' | 'hotspot_occluded'
export type Severity = 'critical' | 'warning' | 'info'

export interface AnomalyItem {
  id: string
  type: AnomalyType
  severity: Severity
  rackId?: string
  cracId?: string
  position: [number, number, number]
  description: string
  explanation: string
}

export interface VersionRecord {
  version: number
  timestamp: number
  name: string
  notes: string
  receipt: string
  snapshot: {
    globalPowerKw: number
    globalAirflowCfm: number
    aisleGap: number
    floorPerforation: number
  }
}

export interface ParamSet {
  id: string
  name: string
  version: number
  notes: string
  receipt: string
  timestamp: number
  versionHistory: VersionRecord[]
  racks: RackConfig[]
  cracUnits: CRACUnit[]
  aisleGap: number
  floorPerforation: number
  globalPowerKw: number
  globalAirflowCfm: number
}

export interface CompareScore {
  coolingEfficiency: number
  hotspotCount: number
  airflowUtilization: number
  overallScore: number
  details: string
}

export interface ReportData {
  id: string
  name: string
  timestamp: number
  paramSet: ParamSet
  anomalies: AnomalyItem[]
  score: CompareScore
  screenshotUrl?: string
}

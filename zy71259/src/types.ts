export interface Subsidiary {
  id: string
  code: string
  name: string
  region: string
  functionalCurrency: string
  consolidationLevel: number
}

export interface Currency {
  code: string
  name: string
}

export interface Exposure {
  id: string
  subsidiaryId: string
  currencyCode: string
  amount: number
  direction: 'LONG' | 'SHORT'
  dueDate: string
  contractNo: string
  originalRaw: string
  manualNote: string
  source: string
  hedged: boolean
  hedgeContractNo: string
}

export interface HedgeContract {
  id: string
  contractNo: string
  subsidiaryId: string
  currencyCode: string
  notionalAmount: number
  direction: 'LONG' | 'SHORT'
  dueDate: string
  hedgeType: string
  counterparty: string
  originalRaw: string
  manualNote: string
}

export interface ExchangeRate {
  id: string
  pair: string
  spotRate: number
  forwardRate: number
  rateDate: string
}

export interface Anomaly {
  id: string
  type: 'TRANSLATION_ERROR' | 'DUPLICATE_HEDGE' | 'CONSOLIDATION_OMISSION'
  relatedEntityId: string
  description: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  resolution: 'UNRESOLVED' | 'CONFIRMED' | 'FIXED'
  userNote: string
}

export interface Snapshot {
  id: string
  createdAt: string
  createdBy: string
  summary: string
  cameraState: { position: [number, number, number]; target: [number, number, number] }
  filterState: { currencies: string[]; subsidiaries: string[]; directions: string[] }
  subsidiaries: Subsidiary[]
  currencies: Currency[]
  exposures: Exposure[]
  hedgeContracts: HedgeContract[]
  exchangeRates: ExchangeRate[]
  anomalies: Anomaly[]
}

export interface TreeNodeData {
  id: string
  label: string
  type: 'root' | 'subsidiary' | 'currency'
  position: [number, number, number]
  size: number
  color: string
  direction?: 'LONG' | 'SHORT'
  subsidiaryId?: string
  currencyCode?: string
  netExposure?: number
  hedged?: boolean
  children: TreeNodeData[]
}

export interface ExposureSummary {
  totalLong: number
  totalShort: number
  netExposure: number
  naturalHedgeRatio: number
  hedgeCoverageRatio: number
  naturalHedgeSavings: number
}

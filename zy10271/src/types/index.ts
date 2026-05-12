export interface EyeParams {
  sphere: number
  cylinder: number
  axis: number
  pd?: number
}

export interface LensSpec {
  brand: string
  refractiveIndex: string
  coating: string
  type: 'single-vision' | 'progressive' | 'bifocal'
  diameter?: number
}

export type OrderStatus = 
  | 'pending'
  | 'measuring'
  | 'cutting'
  | 'polishing'
  | 'edging'
  | 'quality-check'
  | 'rework'
  | 'ready'
  | 'picked-up'

export interface QualityCheckResult {
  passed: boolean
  inspector: string
  checkedAt: string
  issues?: string[]
  remarks?: string
}

export interface HistoryEntry {
  id: string
  status: OrderStatus
  timestamp: string
  operator: string
  remarks?: string
}

export interface Order {
  id: string
  orderNo: string
  customerName: string
  phone: string
  createdAt: string
  
  leftEye: EyeParams
  rightEye: EyeParams
  
  lens: LensSpec
  frame?: string
  
  status: OrderStatus
  reworkCount: number
  
  qualityCheck?: QualityCheckResult
  history: HistoryEntry[]
  
  pickedUpAt?: string
}

export interface FilterOptions {
  status?: OrderStatus[]
  search?: string
  hasRework?: boolean
}

export interface Batch {
  id: string
  name: string
  date: string
  status: 'draft' | 'processed' | 'reviewed' | 'exported'
  createdAt: string
}

export interface Trade {
  id: string
  batchId: string
  direction: '正回购' | '逆回购'
  counterparty: string
  amount: number
  term: number
  startDate: string
  endDate: string
  source: string
  version: number
}

export interface Collateral {
  id: string
  batchId: string
  tradeId: string
  bondCode: string
  bondName: string
  faceValue: number
  quantity: number
  maturityDate: string
  replacementBondCode?: string
  replacementStatus: '无替换' | '待替换' | '已替换'
  source: string
  version: number
}

export interface DiscountRate {
  id: string
  batchId: string
  bondCode: string
  rate: number
  effectiveDate: string
  expiryDate: string
  source: string
  version: number
}

export interface ProcessResult {
  id: string
  batchId: string
  collateralId: string
  tradeId: string
  bondCode: string
  discountRate: number
  discountAmount: number
  conclusion: '通过' | '异常'
  warnings: Warning[]
}

export interface Warning {
  type: '折算率过期' | '到期券未替换' | '同券重复占用'
  message: string
  affectedTradeIds: string[]
  affectedCollateralIds: string[]
}

export interface ReviewRecord {
  id: string
  batchId: string
  resultId: string
  status: '待复核' | '已复核'
  reviewer: string
  reviewedAt?: string
  remark?: string
}

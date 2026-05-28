export type RepairGrade = "轻微" | "中度" | "重度" | "报废"
export type RiskLevel = "低" | "中" | "高"
export type ErrorType = "旧伤误判" | "价格超限" | "免责条款漏看"
export type ClueType = "部位卡" | "维修价目" | "保单条款" | "客户情绪"
export type MoodType = "配合" | "急躁" | "隐瞒"
export type GamePhase = "opening" | "clues" | "judge" | "settle" | "replay" | "report"

export interface InsuranceCase {
  id: string
  caseNumber: string
  accidentDate: string
  carModel: string
  insuranceType: string
  photoUrl: string
  description: string
}

export interface Photo {
  id: string
  caseId: string
  url: string
  angle: string
  takenAt: string
  isOriginal: boolean
}

export interface PartCard {
  id: string
  caseId: string
  partName: string
  damageDescription: string
  hasOldDamage: boolean
  oldDamageDetail: string
}

export interface RepairPrice {
  id: string
  caseId: string
  partName: string
  minorPrice: number
  moderatePrice: number
  severePrice: number
  totalLossPrice: number
  priceConfused: boolean
  confusedDetail: string
}

export interface PolicyRule {
  id: string
  caseId: string
  clauseType: string
  clauseContent: string
  isExemption: boolean
  coverageLimit: number
  specialTerms: string
  relatedParts: string[]
}

export interface CustomerMood {
  id: string
  caseId: string
  moodType: MoodType
  behaviorDescription: string
  credibilityScore: number
  hiddenInfo: string
}

export interface PartGrade {
  partName: string
  grade: RepairGrade
}

export interface StandardAnswer {
  id: string
  caseId: string
  damagedParts: string[]
  partGrades: PartGrade[]
  riskLevel: RiskLevel
  correctPayout: number
  keyClues: string[]
  exemptionClauses: string[]
}

export interface GameSession {
  id: string
  caseId: string
  playerName: string
  startedAt: number
  finishedAt: number | null
  timeSpent: number
  phase: GamePhase
}

export interface ClueSelection {
  id: string
  sessionId: string
  clueType: ClueType
  clueId: string
  selectedAt: number
  orderIndex: number
}

export interface Judgment {
  id: string
  sessionId: string
  partName: string
  repairGrade: RepairGrade
  estimatedPayout: number
}

export interface Settlement {
  id: string
  sessionId: string
  totalPayout: number
  correctPayout: number
  payoutDifference: number
  hasOldDamageError: boolean
  hasPriceLimitError: boolean
  hasExemptionError: boolean
  riskLevel: RiskLevel
}

export interface ErrorImpact {
  id: string
  settlementId: string
  errorType: ErrorType
  affectedParts: string[]
  affectedAmounts: string[]
  affectedClauses: string[]
  reason: string
  severity: "高" | "中" | "低"
}

export interface DamageReport {
  id: string
  sessionId: string
  judgments: Judgment[]
  settlement: Settlement | null
  errorImpacts: ErrorImpact[]
  createdAt: number
  status: "草稿" | "已提交" | "已修正"
}

export interface AmendmentRecord {
  id: string
  reportId: string
  caseId: string
  fieldName: string
  oldValue: string
  newValue: string
  reason: string
  amendedAt: number
  amendedBy: string
}

export interface ClueItem {
  id: string
  type: ClueType
  title: string
  description: string
  data: PartCard | RepairPrice | PolicyRule | CustomerMood
}

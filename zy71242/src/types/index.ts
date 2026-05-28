export type DocumentType = 'lot_card' | 'provenance' | 'condition' | 'school' | 'buyer_preference' | 'valuation_ref'

export type ClueType = 'provenance_gap' | 'condition_deduction' | 'school_mislabel' | 'buyer_misjudge' | 'price_anchor'

export type TrapType = ClueType

export type Severity = 'low' | 'medium' | 'high'

export type AnalysisDimension = 'provenance' | 'condition' | 'school' | 'buyer'

export interface Section {
  id: string
  heading: string
  text: string
  isKeyClue: boolean
  clueType?: ClueType
}

export interface TrapReference {
  trapId: string
  disguise: string
}

export interface DocumentContent {
  summary: string
  details: Section[]
  trap?: TrapReference
}

export interface DocPosition {
  x: number
  y: number
  rotation: number
}

export interface LotDocument {
  id: string
  type: DocumentType
  title: string
  icon: string
  content: DocumentContent
  position: DocPosition
}

export interface Trap {
  id: string
  type: TrapType
  description: string
  documentId: string
  sectionId: string
  severity: Severity
  points: number
}

export interface AnalysisItem {
  dimension: AnalysisDimension
  correctAnalysis: string
  commonMistake: string
  impactOnPrice: number
}

export interface LotItem {
  id: string
  name: string
  subtitle: string
  difficulty: 1 | 2 | 3
  image: string
  correctValuation: { low: number; high: number }
  referencePrice: number
  finalPrice: number
  documents: LotDocument[]
  traps: Trap[]
  analysis: AnalysisItem[]
}

export interface LotProgress {
  lotId: string
  readDocuments: string[]
  collectedClues: string[]
  valuation: { low: number; high: number } | null
  confidence: number
  auctionResult: AuctionResult | null
  completedAt: number | null
  score: number
}

export interface AuctionResult {
  playerBid: number
  finalPrice: number
  won: boolean
  profitLoss: number
  valuationDeviation: number
  trapResults: TrapResult[]
}

export interface TrapResult {
  trapId: string
  identified: boolean
  pointsEarned: number
  pointsPossible: number
}

export interface PlayerProfile {
  profileId: string
  profileName: string
  currentLotId: string | null
  lotProgress: Record<string, LotProgress>
  totalScore: number
  createdAt: number
  updatedAt: number
}

export interface ExportReport {
  profileName: string
  lotName: string
  lotSubtitle: string
  difficulty: number
  documents: { title: string; type: DocumentType; read: boolean }[]
  clues: { sectionId: string; type: string; description: string; collected: boolean }[]
  valuation: { low: number; high: number } | null
  confidence: number
  auctionResult: AuctionResult | null
  analysis: AnalysisItem[]
  generatedAt: string
}

export const CLUE_TYPE_LABELS: Record<ClueType, string> = {
  provenance_gap: '来源缺口',
  condition_deduction: '品相扣分',
  school_mislabel: '流派误标',
  buyer_misjudge: '买家误判',
  price_anchor: '估价锚定',
}

export const CLUE_TYPE_COLORS: Record<ClueType, string> = {
  provenance_gap: '#8B2500',
  condition_deduction: '#B8860B',
  school_mislabel: '#4A6741',
  buyer_misjudge: '#5B4A8A',
  price_anchor: '#8B4513',
}

export const DIMENSION_LABELS: Record<AnalysisDimension, string> = {
  provenance: '来源',
  condition: '品相',
  school: '流派',
  buyer: '买家偏好',
}

export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  lot_card: '拍品卡',
  provenance: '来源证明',
  condition: '品相报告',
  school: '流派鉴定',
  buyer_preference: '买家偏好',
  valuation_ref: '估价参考',
}

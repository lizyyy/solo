export type Unit = 'mm' | 'in' | 'pt'

export interface Dimension {
  value: number
  unit: Unit
}

export interface Paper {
  name: string
  width: Dimension
  height: Dimension
}

export interface Workpiece {
  id: string
  name: string
  width: Dimension
  height: Dimension
  bleed?: Dimension
  safeMargin?: Dimension
  rotation: number
  copies: number
  x: number
  y: number
}

export interface JobConfig {
  id: string
  name: string
  paper: Paper
  bleed: Dimension
  safeMargin: Dimension
  workpieces: Workpiece[]
}

export interface Rule {
  id: string
  name: string
  type: 'bleed' | 'safeMargin' | 'rotation' | 'waste' | 'overlap'
  min?: number
  max?: number
  required?: boolean
  message?: string
}

export interface RulesConfig {
  rules: Rule[]
}

export interface ImpositionPlan {
  jobId: string
  paperSize: { width: number; height: number; unit: Unit }
  workpieces: Array<{
    id: string
    name: string
    x: number
    y: number
    rotation: number
    copies: number
    width: number
    height: number
    bleed: number
    safeMargin: number
  }>
  totalWaste: number
  efficiency: number
}

export interface PreflightIssue {
  type: 'error' | 'warning'
  code: string
  message: string
  workpieceId?: string
  details?: string
}

export interface PreflightResult {
  passed: boolean
  issues: PreflightIssue[]
  warnings: PreflightIssue[]
  errors: PreflightIssue[]
}

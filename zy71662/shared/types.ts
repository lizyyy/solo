export interface Scheme {
  id: string
  name: string
  description: string
  safetyFactor: number
  status: 'draft' | 'verified' | 'flagged'
  createdAt: string
  updatedAt: string
}

export interface RiggingPoint {
  id: string
  schemeId: string
  label: string
  x: number
  y: number
  ratedLoad: number
  ratedLoadUnit: 'kg' | 'lb'
  angle: number
  angleDirection: 'left' | 'right'
  notes: string
  createdAt: string
}

export interface Fixture {
  id: string
  name: string
  weight: number
  weightUnit: 'kg' | 'lb'
  quantity: number
}

export interface Assignment {
  id: string
  schemeId: string
  pointId: string
  fixtureId: string
  quantity: number
  notes: string
}

export interface ForceDecomposition {
  pointId: string
  pointLabel: string
  totalWeightKg: number
  verticalForceN: number
  horizontalForceN: number
  angleDeg: number
  angleDirection: 'left' | 'right'
}

export interface LoadVerification {
  pointId: string
  pointLabel: string
  actualLoadKg: number
  ratedLoadKg: number
  loadRatio: number
  safetyFactor: number
  status: 'safe' | 'warning' | 'overload'
}

export interface RiskItem {
  id: string
  schemeId: string
  pointId: string | null
  category: 'unit_error' | 'overload' | 'angle_reversed' | 'safety_insufficient'
  severity: 'critical' | 'warning' | 'info'
  message: string
  status: 'pending' | 'resolved' | 'dismissed'
  createdAt: string
}

export interface SchemeVersion {
  id: string
  schemeId: string
  versionNumber: number
  snapshot: string
  createdAt: string
}

export interface ChangelogEntry {
  id: string
  versionId: string
  field: string
  oldValue: string
  newValue: string
  changedAt: string
}

export interface SchemeDetail {
  scheme: Scheme
  points: RiggingPoint[]
  assignments: Assignment[]
  risks: RiskItem[]
  decompositions: ForceDecomposition[]
  verifications: LoadVerification[]
}

export interface SchemeSummary {
  id: string
  name: string
  status: Scheme['status']
  safetyFactor: number
  pointCount: number
  totalLoadKg: number
  riskCount: number
  versionCount: number
  createdAt: string
  updatedAt: string
}

export type CreateSchemeInput = Pick<Scheme, 'name' | 'description' | 'safetyFactor'>
export type UpdateSchemeInput = Partial<Pick<Scheme, 'name' | 'description' | 'safetyFactor' | 'status'>>
export type CreatePointInput = Omit<RiggingPoint, 'id' | 'schemeId' | 'createdAt'>
export type UpdatePointInput = Partial<Omit<RiggingPoint, 'id' | 'schemeId' | 'createdAt'>>
export type CreateFixtureInput = Omit<Fixture, 'id'>
export type UpdateFixtureInput = Partial<Omit<Fixture, 'id'>>
export type CreateAssignmentInput = Omit<Assignment, 'id' | 'schemeId'>
export type UpdateAssignmentInput = Partial<Omit<Assignment, 'id' | 'schemeId'>>

export const LB_TO_KG = 0.453592
export const G = 9.80665

export function toKg(weight: number, unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? weight * LB_TO_KG : weight
}

export function roundTo(value: number, decimals: number = 1): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

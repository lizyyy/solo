export type NodeType = 'field' | 'etl' | 'report' | 'api'
export type RiskSeverity = 'high' | 'medium' | 'low'
export type RiskType =
  | 'unregistered_field'
  | 'lineage_break'
  | 'unregistered_downstream'
  | 'alias_conflict'
  | 'status_contradiction'
export type EdgeStatus = 'active' | 'broken' | 'unregistered'
export type RiskItemStatus = 'pending' | 'confirmed' | 'ignored'

export interface Field {
  id: string
  name: string
  table: string
  type: string
  status: string
  isHidden: boolean
  description: string
}

export interface FieldAlias {
  id: string
  fieldId: string
  aliasName: string
  source: string
  isConflict: boolean
}

export interface ETLTask {
  id: string
  name: string
  status: string
  schedule: string
  inputFields: string[]
  outputFields: string[]
}

export interface Report {
  id: string
  name: string
  type: string
  owner: string
  dependentFields: string[]
}

export interface APIMapping {
  id: string
  endpoint: string
  method: string
  responseFields: string[]
}

export interface ChangeOrder {
  id: string
  title: string
  fieldIds: string[]
  changeType: string
  status: string
  createdAt: string
}

export interface RiskItem {
  id: string
  riskType: RiskType
  severity: RiskSeverity
  fieldId: string
  description: string
  impactRange: string
  status: RiskItemStatus
  resolvedBy: string
  resolvedAt: string
}

export interface LineageNode {
  id: string
  type: NodeType
  label: string
  aliases: string[]
  isHidden: boolean
  status: string
  metadata: Record<string, unknown>
}

export interface LineageEdge {
  id: string
  source: string
  target: string
  edgeType: string
  status: EdgeStatus
}

export interface ImpactResult {
  nodeId: string
  nodeType: NodeType
  label: string
  severity: RiskSeverity
  path: string[]
  reason: string
}

export interface InspectionReport {
  id: string
  title: string
  generatedAt: string
  totalBreakpoints: number
  totalRisks: number
  highRiskCount: number
  mediumRiskCount: number
  lowRiskCount: number
  topRisks: RiskItem[]
  changeOrders: ChangeOrder[]
  summary: string
}

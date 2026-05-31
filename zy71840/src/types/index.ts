export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface ModelData {
  id: string
  name: string
  type: 'exhibit' | 'structure' | 'path'
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number }
  geometry?: {
    type: 'box' | 'cylinder' | 'sphere'
    dimensions: { width: number; height: number; depth: number; radius?: number }
  }
  color?: string
}

export interface Version {
  id: string
  projectId: string
  name: string
  versionNumber: number
  createdAt: string
  models: ModelData[]
  inspectionPath: InspectionPoint[]
}

export interface InspectionPoint {
  x: number
  y: number
  z: number
  order: number
}

export type IssueType = 'AXIS_FLIPPED' | 'DUPLICATE' | 'PATH_BLOCKED' | 'POSITION_SHIFT'
export type IssueStatus = 'PENDING' | 'CONFIRMED' | 'RESOLVED' | 'DISMISSED'

export interface Issue {
  id: string
  versionId: string
  modelId: string
  relatedModelId?: string
  type: IssueType
  status: IssueStatus
  reason: string
  nextStep: string
  createdAt: string
  resolvedAt?: string
  resolvedBy?: string
}

export interface OperationLog {
  id: string
  versionId: string
  type: 'ISSUE_STATUS_CHANGE' | 'MODEL_MODIFIED' | 'VERSION_CREATED' | 'VERSION_EXPORTED'
  description: string
  oldValue?: string
  newValue?: string
  operator: string
  timestamp: string
}

export type PageType = 'home' | 'import' | 'inspection' | 'history' | 'export'

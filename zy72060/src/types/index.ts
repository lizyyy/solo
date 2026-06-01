export type PointStatus = 'normal' | 'anomaly' | 'conflict' | 'pending'
export type SourceType = 'point_table' | 'photo' | 'manual'
export type ConflictSide = 'photo' | 'data'

export interface CameraState {
  position: [number, number, number]
  target: [number, number, number]
}

export interface Plan {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  creator: string
  cameraState: CameraState
  viewPreset: string
}

export interface InspectionPoint {
  id: string
  planId: string
  label: string
  component: string
  inspectItem: string
  measuredValue: string
  standardValue: string
  judgment: string
  x: number
  y: number
  z: number
  status: PointStatus
  sourceType: SourceType
  sourceRef: string
  originalRow: number
}

export interface TraceRecord {
  id: string
  pointId: string
  sourceRow: string
  sourceType: SourceType
  sourceContent: string
  note: string
  processedAt: string
  processedBy: string
}

export interface ConflictEvidence {
  id: string
  traceId: string
  pointId: string
  side: ConflictSide
  description: string
  evidence: string
  suggestion: string
}

export interface InspectionPhoto {
  id: string
  fileName: string
  dataUrl: string
  capturedAt: string
  pointId: string
  description: string
}

export interface ScreenshotRecord {
  id: string
  planId: string
  dataUrl: string
  filterContext: string
  createdAt: string
}

export type ViewPreset = 'front' | 'side' | 'top' | 'free'

export const VIEW_PRESETS: Record<ViewPreset, CameraState> = {
  front: { position: [0, 5, 20], target: [0, 5, 0] },
  side: { position: [20, 5, 0], target: [0, 5, 0] },
  top: { position: [0, 25, 0.01], target: [0, 5, 0] },
  free: { position: [15, 10, 15], target: [0, 5, 0] },
}

export interface CalibrationRecord {
  id: string
  beaconId: string
  originDescription: string
  status: 'calibrated' | 'pending_review' | 'pending_photo' | 'anomaly'
  coordinateMixDetected: boolean
  photoCount: number
  createdAt: string
  updatedAt: string
}

export interface CoordinateEntry {
  id: string
  pointName: string
  coordinateType: 'latlng' | 'metric' | 'mixed'
  lat: number | null
  lng: number | null
  x: number | null
  y: number | null
  z: number | null
  manualCorrection: {
    correctedBy: string
    correctedAt: string
    reason: string
  } | null
}

export interface RecordDetail extends CalibrationRecord {
  coordinates: CoordinateEntry[]
  photoIds: string[]
  photoSupplementedAt: string | null
  photoSupplementedBy: string | null
}

export interface OperationLog {
  id: string
  action: string
  operator: string
  operatorRole: string
  description: string
  reason: string | null
  timestamp: string
}

export interface FieldTeamNote {
  whyLeftBehind: string
  missingMaterials: string[]
  nextStep: {
    contactTeam: string
    contactPerson: string
    action: string
  }
  generatedAt: string
  version: number
}

export interface RentalRecord {
  id: string
  rentalId: string
  studentId: string
  studentName: string
  violinId: string
  violinName: string
  rentDate: string
  dueDate: string
  returnDate?: string
  status: 'active' | 'returned' | 'overdue'
  notes?: string
}

export interface HumidityRecord {
  id: string
  violinId: string
  violinName: string
  recordTime: string
  humidity: number
  temperature?: number
  location?: string
  notes?: string
}

export interface BowInspection {
  id: string
  violinId: string
  violinName: string
  inspectionDate: string
  bowHairCondition: 'excellent' | 'good' | 'fair' | 'poor'
  bowHairIssues: string[]
  rosinCondition: 'excellent' | 'good' | 'fair' | 'poor'
  rosinIssues: string[]
  inspector: string
  overallStatus: 'pass' | 'needs_maintenance' | 'fail'
  notes?: string
}

export interface MaintenanceNote {
  id: string
  violinId: string
  violinName: string
  createDate: string
  issueType: 'bow_hair' | 'rosin' | 'bridge' | 'strings' | 'case' | 'other'
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  technician?: string
  completedDate?: string
  cost?: number
  notes?: string
}

export interface ViolinRisk {
  id: string
  violinId: string
  violinName: string
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'none'
  riskTypes: RiskType[]
  details: string[]
  rentalInfo?: RentalInfo
  humidityInfo?: HumidityInfo
  bowInspectionInfo?: BowInspectionInfo
  duplicateRentals?: DuplicateRentalInfo[]
  reviewNotes?: string
  reviewedBy?: string
  reviewedAt?: string
  isBlocked: boolean
  blockReason?: string
  blockedBy?: string
  blockedAt?: string
}

export interface RiskType {
  type: 'overdue' | 'humidity_exceeded' | 'bow_damage_unrepaired' | 'duplicate_rental' | 'pending_maintenance'
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
}

export interface RentalInfo {
  rentalId: string
  studentName: string
  rentDate: string
  dueDate: string
  returnDate?: string
  daysOverdue?: number
}

export interface HumidityInfo {
  latestRecordTime: string
  latestHumidity: number
  minHumidity?: number
  maxHumidity?: number
  isOutOfRange: boolean
}

export interface BowInspectionInfo {
  inspectionDate: string
  bowHairCondition: string
  rosinCondition: string
  overallStatus: string
  issues: string[]
}

export interface DuplicateRentalInfo {
  rentalId: string
  studentName: string
  rentDate: string
  dueDate: string
  conflictRentalId: string
  conflictStudentName: string
}

export interface ReviewNote {
  violinId: string
  notes: string
  reviewedBy: string
  reviewedAt: string
  decision: 'ok' | 'block' | 'maintenance'
}

export interface MaintenanceItem {
  violinId: string
  violinName: string
  issueType: string
  description: string
  riskLevel: string
  riskTypes: RiskType[]
  status: 'pending' | 'in_progress' | 'completed'
  createdDate: string
}

export interface AuditRecord {
  id: string
  action: string
  violinId?: string
  violinName?: string
  details: string
  performedBy: string
  timestamp: string
}

export interface AppData {
  rentalRecords: RentalRecord[]
  humidityRecords: HumidityRecord[]
  bowInspections: BowInspection[]
  maintenanceNotes: MaintenanceNote[]
  reviewNotes: Record<string, ReviewNote>
  blockedViolins: BlockedViolin[]
  auditLogs: AuditRecord[]
  lastUpdated: string
  dataDate: string
}

export interface BlockedViolin {
  violinId: string
  violinName: string
  reason: string
  blockedBy: string
  blockedAt: string
  notes?: string
}

export interface ImportResult<T> {
  success: boolean
  data?: T[]
  errors: string[]
  count: number
}

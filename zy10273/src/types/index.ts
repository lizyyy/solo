export enum AppointmentStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  INSPECTED = 'inspected',
  REJECTED = 'rejected',
  SETTLED = 'settled'
}

export enum PriceChangeStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export enum ApplianceType {
  TV = 'tv',
  REFRIGERATOR = 'refrigerator',
  WASHING_MACHINE = 'washing_machine',
  AIR_CONDITIONER = 'air_conditioner',
  WATER_HEATER = 'water_heater',
  OTHER = 'other'
}

export interface Photo {
  id: string
  url: string
  type: string
  uploadedAt: string
  uploadedBy: string
}

export interface InspectionItem {
  id: string
  name: string
  category: string
  result: 'pass' | 'fail' | 'na' | null
  notes: string
  checked: boolean
}

export interface PriceChange {
  id: string
  appointmentId: string
  originalPrice: number
  newPrice: number
  reason: string
  status: PriceChangeStatus
  requestedBy: string
  requestedAt: string
  approvedBy?: string
  approvedAt?: string
  approvalNotes?: string
}

export interface InspectionLog {
  id: string
  appointmentId: string
  action: string
  description: string
  operator: string
  timestamp: string
}

export interface Settlement {
  id: string
  appointmentId: string
  finalPrice: number
  settledAt: string
  settledBy: string
  paymentMethod: string
  notes: string
}

export interface Appointment {
  id: string
  appointmentNo: string
  customerName: string
  customerPhone: string
  customerAddress: string
  applianceType: ApplianceType
  applianceBrand: string
  applianceModel: string
  applianceAge: number
  estimatedPrice: number
  actualPrice?: number
  status: AppointmentStatus
  technician: string
  scheduledDate: string
  arrivedAt?: string
  completedAt?: string
  photos: Photo[]
  inspectionItems: InspectionItem[]
  priceChanges: PriceChange[]
  inspectionLogs: InspectionLog[]
  settlement?: Settlement
  rejectReason?: string
  rejectedAt?: string
  rejectedBy?: string
  createdAt: string
  updatedAt: string
}

export interface Statistics {
  totalAppointments: number
  pendingAppointments: number
  inProgressAppointments: number
  inspectedAppointments: number
  rejectedAppointments: number
  settledAppointments: number
  totalRevenue: number
  pendingPriceChanges: number
  abnormalCount: number
}

export interface AbnormalRecord {
  id: string
  type: 'unsettled_inspection' | 'unapproved_price_change' | 'rejected_with_payment' | 'duplicate_appointment'
  appointmentId: string
  appointmentNo: string
  description: string
  detectedAt: string
  resolved: boolean
}

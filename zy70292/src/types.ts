export type AppointmentStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'completed' 
  | 'no_show' 
  | 'rescheduled' 
  | 'cancelled'

export type PrivacyLevel = 'standard' | 'sensitive' | 'anonymous'

export interface Counselor {
  id: string
  name: string
  specialization: string
  isActive: boolean
}

export interface Schedule {
  id: string
  counselorId: string
  date: string
  startTime: string
  endTime: string
  isBooked: boolean
}

export interface Appointment {
  id: string
  anonymousCode: string
  privacyLevel: PrivacyLevel
  counselorId: string
  scheduleId: string
  status: AppointmentStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export interface HistoryRecord {
  id: string
  appointmentId: string
  action: string
  before: Partial<Appointment> | null
  after: Partial<Appointment> | null
  timestamp: string
}

export type ViewType = 'appointments' | 'counselors' | 'schedule' | 'history' | 'stats'

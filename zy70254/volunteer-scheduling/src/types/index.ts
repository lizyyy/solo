export type Subject = '语文' | '数学' | '英语' | '物理' | '化学' | '生物' | '历史' | '地理' | '政治' | '编程' | '音乐' | '美术'

export type ScheduleStatus = '待确认' | '已确认' | '进行中' | '已完成' | '已取消' | '需改派'

export interface Volunteer {
  id: string
  name: string
  phone: string
  email?: string
  subjects: Subject[]
  availableCampuses: string[]
  volunteerHours: number
  totalAssignedHours: number
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface Campus {
  id: string
  name: string
  address: string
  capacity: number
  maxVolunteersPerClass: number
  operatingDays: string[]
  contactPerson: string
  contactPhone: string
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface Course {
  id: string
  name: string
  subject: Subject
  campusId: string
  dayOfWeek: string
  startTime: string
  endTime: string
  requiredVolunteers: number
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface Schedule {
  id: string
  courseId: string
  volunteerId: string
  date: string
  startTime: string
  endTime: string
  status: ScheduleStatus
  assignedHours: number
  isAbsent?: boolean
  absenceReason?: string
  reassignedFrom?: string
  reassignedTo?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface ImportRecord {
  id: string
  type: 'volunteer' | 'campus' | 'course' | 'schedule'
  status: 'pending' | 'success' | 'failed'
  errors: string[]
  warnings: string[]
  data: Record<string, unknown>[]
  createdAt: string
}

export interface ValidationError {
  field: string
  message: string
  type: 'error' | 'warning'
}

export interface Statistics {
  totalVolunteers: number
  totalScheduledVolunteers: number
  totalCourses: number
  totalCampuses: number
  totalHours: number
  absentCount: number
  reassignedCount: number
  bySubject: Record<string, number>
  byCampus: Record<string, number>
  byStatus: Record<string, number>
}

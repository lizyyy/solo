import type { 
  Appointment, 
  AppointmentStatus, 
  PrivacyLevel, 
  HistoryRecord,
  Counselor,
  Schedule
} from './types'

const CODES = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const generateId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export const generateAnonymousCode = () => {
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += CODES[Math.floor(Math.random() * CODES.length)]
  }
  return code
}

export const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

export const statusLabels: Record<AppointmentStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  completed: '已完成',
  no_show: '爽约',
  rescheduled: '已改约',
  cancelled: '已取消'
}

export const statusColors: Record<AppointmentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  no_show: 'bg-red-100 text-red-800',
  rescheduled: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-gray-100 text-gray-800'
}

export const privacyLabels: Record<PrivacyLevel, string> = {
  standard: '普通',
  sensitive: '敏感',
  anonymous: '匿名'
}

export const privacyColors: Record<PrivacyLevel, string> = {
  standard: 'bg-slate-100 text-slate-700',
  sensitive: 'bg-orange-100 text-orange-800',
  anonymous: 'bg-indigo-100 text-indigo-800'
}

export const maskContent = (content: string, level: PrivacyLevel) => {
  if (level === 'anonymous') return '******'
  if (level === 'sensitive' && content.length > 2) {
    return content.slice(0, 2) + '***'
  }
  return content
}

const STORAGE_KEYS = {
  appointments: 'counseling_appointments',
  counselors: 'counseling_counselors',
  schedules: 'counseling_schedules',
  history: 'counseling_history'
}

const getSeedData = () => {
  const now = Date.now()
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfter = new Date(today)
  dayAfter.setDate(dayAfter.getDate() + 2)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const counselors: Counselor[] = [
    { id: 'c_001', name: '张医生', specialization: '焦虑抑郁', isActive: true },
    { id: 'c_002', name: '李医生', specialization: '青少年心理', isActive: true },
    { id: 'c_003', name: '王医生', specialization: '婚姻家庭', isActive: false }
  ]

  const schedules: Schedule[] = [
    { id: 's_001', counselorId: 'c_001', date: formatDate(today.toISOString()), startTime: '09:00', endTime: '10:00', isBooked: true },
    { id: 's_002', counselorId: 'c_001', date: formatDate(today.toISOString()), startTime: '10:30', endTime: '11:30', isBooked: false },
    { id: 's_003', counselorId: 'c_001', date: formatDate(tomorrow.toISOString()), startTime: '14:00', endTime: '15:00', isBooked: false },
    { id: 's_004', counselorId: 'c_002', date: formatDate(today.toISOString()), startTime: '09:00', endTime: '10:00', isBooked: false },
    { id: 's_005', counselorId: 'c_002', date: formatDate(dayAfter.toISOString()), startTime: '15:30', endTime: '16:30', isBooked: true },
    { id: 's_006', counselorId: 'c_002', date: formatDate(tomorrow.toISOString()), startTime: '10:00', endTime: '11:00', isBooked: false }
  ]

  const appointments: Appointment[] = [
    {
      id: 'a_001',
      anonymousCode: 'AX3T9K2M',
      privacyLevel: 'anonymous',
      counselorId: 'c_001',
      scheduleId: 's_001',
      status: 'confirmed',
      notes: '首次咨询，近期失眠严重',
      createdAt: new Date(now - 86400000 * 2).toISOString(),
      updatedAt: new Date(now - 86400000 * 1.5).toISOString()
    },
    {
      id: 'a_002',
      anonymousCode: 'B7Y4P6LQ',
      privacyLevel: 'sensitive',
      counselorId: 'c_002',
      scheduleId: 's_005',
      status: 'pending',
      notes: '青少年情绪问题',
      createdAt: new Date(now - 3600000 * 5).toISOString(),
      updatedAt: new Date(now - 3600000 * 5).toISOString()
    }
  ]

  const history: HistoryRecord[] = [
    {
      id: 'h_001',
      appointmentId: 'a_001',
      action: '创建预约',
      before: null,
      after: { status: 'pending' },
      timestamp: new Date(now - 86400000 * 2).toISOString()
    },
    {
      id: 'h_002',
      appointmentId: 'a_001',
      action: '确认预约',
      before: { status: 'pending' },
      after: { status: 'confirmed' },
      timestamp: new Date(now - 86400000 * 1.5).toISOString()
    }
  ]

  return { counselors, schedules, appointments, history }
}

export const storage = {
  loadAppointments: (): Appointment[] => {
    const raw = localStorage.getItem(STORAGE_KEYS.appointments)
    if (raw) return JSON.parse(raw)
    const seed = getSeedData()
    localStorage.setItem(STORAGE_KEYS.appointments, JSON.stringify(seed.appointments))
    localStorage.setItem(STORAGE_KEYS.counselors, JSON.stringify(seed.counselors))
    localStorage.setItem(STORAGE_KEYS.schedules, JSON.stringify(seed.schedules))
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(seed.history))
    return seed.appointments
  },
  saveAppointments: (data: Appointment[]) => {
    localStorage.setItem(STORAGE_KEYS.appointments, JSON.stringify(data))
  },
  loadCounselors: (): Counselor[] => {
    const raw = localStorage.getItem(STORAGE_KEYS.counselors)
    if (raw) return JSON.parse(raw)
    const seed = getSeedData()
    localStorage.setItem(STORAGE_KEYS.counselors, JSON.stringify(seed.counselors))
    return seed.counselors
  },
  saveCounselors: (data: Counselor[]) => {
    localStorage.setItem(STORAGE_KEYS.counselors, JSON.stringify(data))
  },
  loadSchedules: (): Schedule[] => {
    const raw = localStorage.getItem(STORAGE_KEYS.schedules)
    if (raw) return JSON.parse(raw)
    const seed = getSeedData()
    localStorage.setItem(STORAGE_KEYS.schedules, JSON.stringify(seed.schedules))
    return seed.schedules
  },
  saveSchedules: (data: Schedule[]) => {
    localStorage.setItem(STORAGE_KEYS.schedules, JSON.stringify(data))
  },
  loadHistory: (): HistoryRecord[] => {
    const raw = localStorage.getItem(STORAGE_KEYS.history)
    if (raw) return JSON.parse(raw)
    return []
  },
  saveHistory: (data: HistoryRecord[]) => {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(data))
  },
  addHistoryRecord: (record: Omit<HistoryRecord, 'id' | 'timestamp'>) => {
    const history = storage.loadHistory()
    const newRecord: HistoryRecord = {
      ...record,
      id: generateId(),
      timestamp: new Date().toISOString()
    }
    storage.saveHistory([newRecord, ...history])
  },
  resetAll: () => {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
  }
}

export const exportToCSV = (
  appointments: Appointment[],
  counselors: Counselor[],
  schedules: Schedule[]
) => {
  const headers = ['匿名编号', '隐私级别', '咨询师', '日期', '时间段', '状态', '创建时间', '更新时间']
  const rows = appointments.map(a => {
    const counselor = counselors.find(c => c.id === a.counselorId)
    const schedule = schedules.find(s => s.id === a.scheduleId)
    return [
      a.anonymousCode,
      privacyLabels[a.privacyLevel],
      counselor?.name || '',
      schedule?.date || '',
      schedule ? `${schedule.startTime}-${schedule.endTime}` : '',
      statusLabels[a.status],
      formatDateTime(a.createdAt),
      formatDateTime(a.updatedAt)
    ]
  })
  const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `心理咨询预约记录_${formatDate(new Date().toISOString())}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

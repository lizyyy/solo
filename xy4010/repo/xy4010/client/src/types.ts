export enum TicketStatus {
  PENDING_ASSIGNMENT = 'PENDING_ASSIGNMENT',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_INSPECTION = 'PENDING_INSPECTION',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
}

export const statusLabelMap: Record<TicketStatus, string> = {
  [TicketStatus.PENDING_ASSIGNMENT]: '待派单',
  [TicketStatus.IN_PROGRESS]: '处理中',
  [TicketStatus.PENDING_INSPECTION]: '待验收',
  [TicketStatus.COMPLETED]: '已完成',
  [TicketStatus.OVERDUE]: '已逾期',
}

export const statusColorMap: Record<TicketStatus, string> = {
  [TicketStatus.PENDING_ASSIGNMENT]: 'bg-yellow-100 text-yellow-800',
  [TicketStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-800',
  [TicketStatus.PENDING_INSPECTION]: 'bg-purple-100 text-purple-800',
  [TicketStatus.COMPLETED]: 'bg-green-100 text-green-800',
  [TicketStatus.OVERDUE]: 'bg-red-100 text-red-800',
}

export interface Technician {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface MaterialItem {
  id: string
  name: string
  quantity: number
  ticketId: string
  createdAt: string
}

export interface Ticket {
  id: string
  ticketNumber: string
  callerName: string
  callerPhone: string
  location: string
  description: string
  priority: number
  status: TicketStatus
  assignedToId: string | null
  result: string | null
  expectedDueDate: string | null
  actualEndDate: string | null
  createdAt: string
  updatedAt: string
  materials: MaterialItem[]
}

export interface Statistics {
  totalTickets: number
  byStatus: Record<TicketStatus, number>
  overdueCount: number
  materialsUsage: { name: string; totalQuantity: number }[]
  technicianStats: {
    id: string
    name: string
    ticketCount: number
    completedCount: number
  }[]
}

export interface CreateTicketInput {
  callerName: string
  callerPhone: string
  location: string
  description: string
  priority: number
  expectedDueDate?: string
}

export interface UpdateTicketInput {
  callerName?: string
  callerPhone?: string
  location?: string
  description?: string
  priority?: number
  expectedDueDate?: string | null
  assignedToId?: string | null
  result?: string
}

export interface MaterialInput {
  name: string
  quantity: number
}

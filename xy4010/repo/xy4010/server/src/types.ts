import { TicketStatus, Ticket, MaterialItem } from '@prisma/client'

export type { TicketStatus, Ticket, MaterialItem }

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
  expectedDueDate?: string
  assignedToId?: string
  result?: string
}

export interface MaterialInput {
  name: string
  quantity: number
}

export type TicketWithMaterials = Ticket & {
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

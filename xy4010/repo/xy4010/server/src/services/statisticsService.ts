import prisma from '../lib/prisma.js'
import { TicketStatus } from '@prisma/client'
import type { Statistics } from '../types.js'

export interface StatsFilter {
  startDate?: string
  endDate?: string
}

export async function getStatistics(filter?: StatsFilter): Promise<Statistics> {
  const dateWhere: any = {}
  if (filter?.startDate) {
    dateWhere.gte = new Date(filter.startDate)
  }
  if (filter?.endDate) {
    const end = new Date(filter.endDate)
    end.setHours(23, 59, 59, 999)
    dateWhere.lte = end
  }
  
  const ticketWhere = Object.keys(dateWhere).length > 0 ? { createdAt: dateWhere } : {}
  
  const totalTickets = await prisma.ticket.count({ where: ticketWhere })
  
  const statusCounts = await prisma.ticket.groupBy({
    by: ['status'],
    _count: true,
    where: ticketWhere,
  })
  
  const byStatus: Record<TicketStatus, number> = {
    [TicketStatus.PENDING_ASSIGNMENT]: 0,
    [TicketStatus.IN_PROGRESS]: 0,
    [TicketStatus.PENDING_INSPECTION]: 0,
    [TicketStatus.COMPLETED]: 0,
    [TicketStatus.OVERDUE]: 0,
  }
  
  for (const sc of statusCounts) {
    byStatus[sc.status] = sc._count
  }
  
  const overdueCount = byStatus[TicketStatus.OVERDUE]
  
  const materialsData = await prisma.materialItem.findMany({
    where: {
      ticket: ticketWhere,
    },
    select: {
      name: true,
      quantity: true,
    },
  })
  
  const materialsMap = new Map<string, number>()
  for (const m of materialsData) {
    const current = materialsMap.get(m.name) || 0
    materialsMap.set(m.name, current + m.quantity)
  }
  
  const materialsUsage = Array.from(materialsMap.entries())
    .map(([name, totalQuantity]) => ({ name, totalQuantity }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
  
  const technicians = await prisma.technician.findMany({
    include: {
      tickets: {
        where: ticketWhere,
        select: { status: true },
      },
    },
  })
  
  const technicianStats = technicians.map(tech => ({
    id: tech.id,
    name: tech.name,
    ticketCount: tech.tickets.length,
    completedCount: tech.tickets.filter(t => t.status === TicketStatus.COMPLETED).length,
  }))
  
  return {
    totalTickets,
    byStatus,
    overdueCount,
    materialsUsage,
    technicianStats,
  }
}

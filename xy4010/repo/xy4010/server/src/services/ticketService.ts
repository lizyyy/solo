import prisma from '../lib/prisma.js'
import { TicketStatus } from '@prisma/client'
import type {
  CreateTicketInput,
  UpdateTicketInput,
  MaterialInput,
  TicketWithMaterials,
} from '../types.js'

const statusTransitions: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.PENDING_ASSIGNMENT]: [TicketStatus.IN_PROGRESS],
  [TicketStatus.IN_PROGRESS]: [TicketStatus.PENDING_INSPECTION, TicketStatus.OVERDUE],
  [TicketStatus.PENDING_INSPECTION]: [TicketStatus.COMPLETED, TicketStatus.IN_PROGRESS],
  [TicketStatus.COMPLETED]: [],
  [TicketStatus.OVERDUE]: [TicketStatus.IN_PROGRESS, TicketStatus.COMPLETED],
}

function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  if (from === to) return true
  return statusTransitions[from]?.includes(to) || false
}

function isCompletedOrClosed(status: TicketStatus): boolean {
  return status === TicketStatus.COMPLETED
}

async function generateTicketNumber(): Promise<string> {
  const now = new Date()
  const year = now.getFullYear().toString()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  
  const count = await prisma.ticket.count({
    where: {
      createdAt: {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
    },
  })
  
  const sequence = (count + 1).toString().padStart(4, '0')
  return `WD${year}${month}${sequence}`
}

export async function createTicket(input: CreateTicketInput): Promise<TicketWithMaterials> {
  const { callerName, callerPhone, location, description, priority, expectedDueDate } = input
  
  if (!callerName?.trim()) throw new Error('报修人姓名为必填项')
  if (!callerPhone?.trim()) throw new Error('联系电话为必填项')
  if (!location?.trim()) throw new Error('地点为必填项')
  if (!description?.trim()) throw new Error('故障描述为必填项')
  
  const ticketNumber = await generateTicketNumber()
  
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber,
      callerName,
      callerPhone,
      location,
      description,
      priority,
      status: TicketStatus.PENDING_ASSIGNMENT,
      expectedDueDate: expectedDueDate ? new Date(expectedDueDate) : null,
    },
    include: { materials: true },
  })
  
  return ticket
}

export async function updateTicket(
  id: string,
  input: UpdateTicketInput
): Promise<TicketWithMaterials> {
  const existing = await prisma.ticket.findUnique({
    where: { id },
    include: { materials: true },
  })
  
  if (!existing) throw new Error('工单不存在')
  
  if (isCompletedOrClosed(existing.status)) {
    if (input.assignedToId !== undefined) {
      throw new Error('工单已完成，不能再派单')
    }
    if (input.expectedDueDate !== undefined) {
      throw new Error('工单已完成，不能再修改截止时间')
    }
  }
  
  const updateData: any = {}
  
  if (input.callerName !== undefined) updateData.callerName = input.callerName
  if (input.callerPhone !== undefined) updateData.callerPhone = input.callerPhone
  if (input.location !== undefined) updateData.location = input.location
  if (input.description !== undefined) updateData.description = input.description
  if (input.priority !== undefined) updateData.priority = input.priority
  if (input.result !== undefined) updateData.result = input.result
  if (input.expectedDueDate !== undefined) {
    updateData.expectedDueDate = input.expectedDueDate ? new Date(input.expectedDueDate) : null
  }
  
  if (input.assignedToId !== undefined && input.assignedToId !== existing.assignedToId) {
    if (!input.assignedToId) {
      updateData.assignedToId = null
    } else {
      const tech = await prisma.technician.findUnique({ where: { id: input.assignedToId } })
      if (!tech) throw new Error('维修师傅不存在')
      updateData.assignedToId = input.assignedToId
    }
  }
  
  const ticket = await prisma.ticket.update({
    where: { id },
    data: updateData,
    include: { materials: true },
  })
  
  return ticket
}

export async function transitionStatus(
  id: string,
  newStatus: TicketStatus
): Promise<TicketWithMaterials> {
  const existing = await prisma.ticket.findUnique({
    where: { id },
    include: { materials: true },
  })
  
  if (!existing) throw new Error('工单不存在')
  
  if (existing.status === newStatus) return existing
  
  if (!canTransition(existing.status, newStatus)) {
    const statusMap: Record<TicketStatus, string> = {
      [TicketStatus.PENDING_ASSIGNMENT]: '待派单',
      [TicketStatus.IN_PROGRESS]: '处理中',
      [TicketStatus.PENDING_INSPECTION]: '待验收',
      [TicketStatus.COMPLETED]: '已完成',
      [TicketStatus.OVERDUE]: '已逾期',
    }
    throw new Error(`无法从"${statusMap[existing.status]}"跳转到"${statusMap[newStatus]}"`)
  }
  
  const updateData: any = { status: newStatus }
  
  if (newStatus === TicketStatus.COMPLETED) {
    updateData.actualEndDate = new Date()
  }
  
  const ticket = await prisma.ticket.update({
    where: { id },
    data: updateData,
    include: { materials: true },
  })
  
  return ticket
}

export async function updateMaterials(
  id: string,
  materials: MaterialInput[]
): Promise<TicketWithMaterials> {
  const existing = await prisma.ticket.findUnique({
    where: { id },
    include: { materials: true },
  })
  
  if (!existing) throw new Error('工单不存在')
  
  if (isCompletedOrClosed(existing.status)) {
    throw new Error('工单已完成，不能再修改材料')
  }
  
  for (const m of materials) {
    if (!m.name?.trim()) throw new Error('材料名称不能为空')
    if (!m.quantity || m.quantity <= 0) throw new Error('材料数量必须大于0')
  }
  
  await prisma.$transaction([
    prisma.materialItem.deleteMany({ where: { ticketId: id } }),
    ...materials.map(m =>
      prisma.materialItem.create({
        data: {
          name: m.name.trim(),
          quantity: m.quantity,
          ticketId: id,
        },
      })
    ),
  ])
  
  const ticket = await prisma.ticket.findUniqueOrThrow({
    where: { id },
    include: { materials: true },
  })
  
  return ticket
}

export async function getTicketById(id: string): Promise<TicketWithMaterials | null> {
  return prisma.ticket.findUnique({
    where: { id },
    include: { materials: true },
  })
}

export interface TicketFilter {
  status?: TicketStatus
  assignedToId?: string
  startDate?: string
  endDate?: string
}

export async function listTickets(filter?: TicketFilter): Promise<TicketWithMaterials[]> {
  const where: any = {}
  
  if (filter?.status) {
    where.status = filter.status
  }
  
  if (filter?.assignedToId) {
    where.assignedToId = filter.assignedToId
  }
  
  if (filter?.startDate || filter?.endDate) {
    where.createdAt = {}
    if (filter.startDate) {
      where.createdAt.gte = new Date(filter.startDate)
    }
    if (filter.endDate) {
      const end = new Date(filter.endDate)
      end.setHours(23, 59, 59, 999)
      where.createdAt.lte = end
    }
  }
  
  return prisma.ticket.findMany({
    where,
    include: { materials: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function deleteTicket(id: string): Promise<void> {
  const ticket = await prisma.ticket.findUnique({ where: { id } })
  if (!ticket) throw new Error('工单不存在')
  
  await prisma.materialItem.deleteMany({ where: { ticketId: id } })
  await prisma.ticket.delete({ where: { id } })
}

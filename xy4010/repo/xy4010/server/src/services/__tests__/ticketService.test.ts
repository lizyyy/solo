import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TicketStatus } from '@prisma/client'
import prisma from '../../lib/prisma.js'
import * as ticketService from '../ticketService.js'

vi.mock('../../lib/prisma.js', () => ({
  default: {
    ticket: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    materialItem: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    technician: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((ops: any[]) => Promise.all(ops)),
  },
}))

describe('ticketService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createTicket', () => {
    it('should throw error when callerName is missing', async () => {
      await expect(
        ticketService.createTicket({
          callerName: '',
          callerPhone: '13800138000',
          location: 'A栋101',
          description: '水管漏水',
          priority: 1,
        })
      ).rejects.toThrow('报修人姓名为必填项')
    })

    it('should throw error when callerPhone is missing', async () => {
      await expect(
        ticketService.createTicket({
          callerName: '张三',
          callerPhone: '',
          location: 'A栋101',
          description: '水管漏水',
          priority: 1,
        })
      ).rejects.toThrow('联系电话为必填项')
    })

    it('should throw error when location is missing', async () => {
      await expect(
        ticketService.createTicket({
          callerName: '张三',
          callerPhone: '13800138000',
          location: '',
          description: '水管漏水',
          priority: 1,
        })
      ).rejects.toThrow('地点为必填项')
    })

    it('should throw error when description is missing', async () => {
      await expect(
        ticketService.createTicket({
          callerName: '张三',
          callerPhone: '13800138000',
          location: 'A栋101',
          description: '',
          priority: 1,
        })
      ).rejects.toThrow('故障描述为必填项')
    })

    it('should create ticket with valid input', async () => {
      const mockTicket = {
        id: '123',
        ticketNumber: 'WD2026050001',
        status: TicketStatus.PENDING_ASSIGNMENT,
        materials: [],
      }
      
      vi.mocked(prisma.ticket.count).mockResolvedValue(0)
      vi.mocked(prisma.ticket.create).mockResolvedValue(mockTicket as any)

      const result = await ticketService.createTicket({
        callerName: '张三',
        callerPhone: '13800138000',
        location: 'A栋101',
        description: '水管漏水',
        priority: 1,
      })

      expect(result).toEqual(mockTicket)
      expect(prisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            callerName: '张三',
            status: TicketStatus.PENDING_ASSIGNMENT,
          }),
        })
      )
    })
  })

  describe('transitionStatus', () => {
    it('should allow transition from PENDING_ASSIGNMENT to IN_PROGRESS', async () => {
      const mockTicket = {
        id: '123',
        status: TicketStatus.PENDING_ASSIGNMENT,
      }
      
      vi.mocked(prisma.ticket.findUnique).mockResolvedValue(mockTicket as any)
      vi.mocked(prisma.ticket.update).mockResolvedValue({
        ...mockTicket,
        status: TicketStatus.IN_PROGRESS,
      } as any)

      const result = await ticketService.transitionStatus('123', TicketStatus.IN_PROGRESS)
      expect(result.status).toBe(TicketStatus.IN_PROGRESS)
    })

    it('should reject transition from PENDING_ASSIGNMENT to COMPLETED', async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValue({
        id: '123',
        status: TicketStatus.PENDING_ASSIGNMENT,
      } as any)

      await expect(
        ticketService.transitionStatus('123', TicketStatus.COMPLETED)
      ).rejects.toThrow('无法从"待派单"跳转到"已完成"')
    })

    it('should reject transition from COMPLETED to any status', async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValue({
        id: '123',
        status: TicketStatus.COMPLETED,
      } as any)

      await expect(
        ticketService.transitionStatus('123', TicketStatus.IN_PROGRESS)
      ).rejects.toThrow()
    })
  })

  describe('updateMaterials', () => {
    it('should throw error when ticket is completed', async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValue({
        id: '123',
        status: TicketStatus.COMPLETED,
      } as any)

      await expect(
        ticketService.updateMaterials('123', [{ name: '水管', quantity: 2 }])
      ).rejects.toThrow('工单已完成，不能再修改材料')
    })

    it('should throw error when material name is empty', async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValue({
        id: '123',
        status: TicketStatus.IN_PROGRESS,
      } as any)

      await expect(
        ticketService.updateMaterials('123', [{ name: '', quantity: 2 }])
      ).rejects.toThrow('材料名称不能为空')
    })

    it('should throw error when quantity is zero', async () => {
      vi.mocked(prisma.ticket.findUnique).mockResolvedValue({
        id: '123',
        status: TicketStatus.IN_PROGRESS,
      } as any)

      await expect(
        ticketService.updateMaterials('123', [{ name: '水管', quantity: 0 }])
      ).rejects.toThrow('材料数量必须大于0')
    })
  })
})

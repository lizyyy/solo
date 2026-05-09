import { taskService } from '../src/services/task'
import { TaskStatus } from '@prisma/client'

describe('TaskService', () => {
  describe('canTransition', () => {
    it('should allow PENDING -> IN_PROGRESS', () => {
      expect(taskService.canTransition(TaskStatus.PENDING, TaskStatus.IN_PROGRESS)).toBe(true)
    })

    it('should allow PENDING -> CANCELLED', () => {
      expect(taskService.canTransition(TaskStatus.PENDING, TaskStatus.CANCELLED)).toBe(true)
    })

    it('should NOT allow PENDING -> APPROVED directly', () => {
      expect(taskService.canTransition(TaskStatus.PENDING, TaskStatus.APPROVED)).toBe(false)
    })

    it('should allow IN_PROGRESS -> PENDING_APPROVAL', () => {
      expect(taskService.canTransition(TaskStatus.IN_PROGRESS, TaskStatus.PENDING_APPROVAL)).toBe(true)
    })

    it('should allow IN_PROGRESS -> CANCELLED', () => {
      expect(taskService.canTransition(TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED)).toBe(true)
    })

    it('should NOT allow IN_PROGRESS -> APPROVED directly', () => {
      expect(taskService.canTransition(TaskStatus.IN_PROGRESS, TaskStatus.APPROVED)).toBe(false)
    })

    it('should allow PENDING_APPROVAL -> APPROVED', () => {
      expect(taskService.canTransition(TaskStatus.PENDING_APPROVAL, TaskStatus.APPROVED)).toBe(true)
    })

    it('should allow PENDING_APPROVAL -> REJECTED', () => {
      expect(taskService.canTransition(TaskStatus.PENDING_APPROVAL, TaskStatus.REJECTED)).toBe(true)
    })

    it('should allow PENDING_APPROVAL -> IN_PROGRESS (rework)', () => {
      expect(taskService.canTransition(TaskStatus.PENDING_APPROVAL, TaskStatus.IN_PROGRESS)).toBe(true)
    })

    it('should allow REJECTED -> IN_PROGRESS', () => {
      expect(taskService.canTransition(TaskStatus.REJECTED, TaskStatus.IN_PROGRESS)).toBe(true)
    })

    it('should allow REJECTED -> CANCELLED', () => {
      expect(taskService.canTransition(TaskStatus.REJECTED, TaskStatus.CANCELLED)).toBe(true)
    })

    it('should NOT allow APPROVED to any status', () => {
      const allStatuses = Object.values(TaskStatus)
      for (const s of allStatuses) {
        expect(taskService.canTransition(TaskStatus.APPROVED, s)).toBe(false)
      }
    })

    it('should NOT allow CANCELLED to any status', () => {
      const allStatuses = Object.values(TaskStatus)
      for (const s of allStatuses) {
        expect(taskService.canTransition(TaskStatus.CANCELLED, s)).toBe(false)
      }
    })
  })
})

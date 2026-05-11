import { taskService } from '../src/services/task'

describe('TaskService', () => {
  describe('canTransition', () => {
    it('should allow PENDING -> IN_PROGRESS', () => {
      expect(taskService.canTransition('PENDING', 'IN_PROGRESS')).toBe(true)
    })

    it('should allow PENDING -> CANCELLED', () => {
      expect(taskService.canTransition('PENDING', 'CANCELLED')).toBe(true)
    })

    it('should NOT allow PENDING -> APPROVED directly', () => {
      expect(taskService.canTransition('PENDING', 'APPROVED')).toBe(false)
    })

    it('should allow IN_PROGRESS -> PENDING_APPROVAL', () => {
      expect(taskService.canTransition('IN_PROGRESS', 'PENDING_APPROVAL')).toBe(true)
    })

    it('should allow IN_PROGRESS -> CANCELLED', () => {
      expect(taskService.canTransition('IN_PROGRESS', 'CANCELLED')).toBe(true)
    })

    it('should NOT allow IN_PROGRESS -> APPROVED directly', () => {
      expect(taskService.canTransition('IN_PROGRESS', 'APPROVED')).toBe(false)
    })

    it('should allow PENDING_APPROVAL -> APPROVED', () => {
      expect(taskService.canTransition('PENDING_APPROVAL', 'APPROVED')).toBe(true)
    })

    it('should allow PENDING_APPROVAL -> REJECTED', () => {
      expect(taskService.canTransition('PENDING_APPROVAL', 'REJECTED')).toBe(true)
    })

    it('should allow PENDING_APPROVAL -> IN_PROGRESS (rework)', () => {
      expect(taskService.canTransition('PENDING_APPROVAL', 'IN_PROGRESS')).toBe(true)
    })

    it('should allow REJECTED -> IN_PROGRESS', () => {
      expect(taskService.canTransition('REJECTED', 'IN_PROGRESS')).toBe(true)
    })

    it('should allow REJECTED -> CANCELLED', () => {
      expect(taskService.canTransition('REJECTED', 'CANCELLED')).toBe(true)
    })

    it('should NOT allow APPROVED to any status', () => {
      const allStatuses = ['PENDING', 'IN_PROGRESS', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED']
      for (const s of allStatuses) {
        expect(taskService.canTransition('APPROVED', s)).toBe(false)
      }
    })

    it('should NOT allow CANCELLED to any status', () => {
      const allStatuses = ['PENDING', 'IN_PROGRESS', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED']
      for (const s of allStatuses) {
        expect(taskService.canTransition('CANCELLED', s)).toBe(false)
      }
    })
  })
})

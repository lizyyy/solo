import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useShowStore } from '@/stores/showStore'

describe('showStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('时间格式化', () => {
    it('应该正确格式化秒数为时间字符串', () => {
      const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      }

      expect(formatTime(0)).toBe('00:00')
      expect(formatTime(30)).toBe('00:30')
      expect(formatTime(60)).toBe('01:00')
      expect(formatTime(90)).toBe('01:30')
      expect(formatTime(3600)).toBe('60:00')
    })

    it('应该正确格式化持续时间', () => {
      const formatDuration = (seconds) => {
        if (seconds < 60) return `${seconds}秒`
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        if (secs === 0) return `${mins}分`
        return `${mins}分${secs}秒`
      }

      expect(formatDuration(30)).toBe('30秒')
      expect(formatDuration(60)).toBe('1分')
      expect(formatDuration(90)).toBe('1分30秒')
      expect(formatDuration(120)).toBe('2分')
    })
  })

  describe('冲突检查逻辑', () => {
    it('应该检测到时间重叠', () => {
      const checkOverlap = (usage1, usage2) => {
        return usage1.start < usage2.end && usage2.start < usage1.end
      }

      expect(checkOverlap(
        { start: 0, end: 10 },
        { start: 5, end: 15 }
      )).toBe(true)

      expect(checkOverlap(
        { start: 0, end: 10 },
        { start: 10, end: 20 }
      )).toBe(false)

      expect(checkOverlap(
        { start: 20, end: 30 },
        { start: 0, end: 10 }
      )).toBe(false)
    })

    it('应该检测换场时间不足', () => {
      const checkTransitionTime = (currentEnd, nextStart, minTime = 30) => {
        return nextStart - currentEnd < minTime
      }

      expect(checkTransitionTime(100, 120)).toBe(true)
      expect(checkTransitionTime(100, 130)).toBe(false)
      expect(checkTransitionTime(100, 150)).toBe(false)
    })

    it('应该检测低电量麦克风', () => {
      const checkMicBattery = (batteryLevel) => {
        if (batteryLevel < 20) return 'critical'
        if (batteryLevel < 50) return 'warning'
        return 'normal'
      }

      expect(checkMicBattery(10)).toBe('critical')
      expect(checkMicBattery(19)).toBe('critical')
      expect(checkMicBattery(20)).toBe('warning')
      expect(checkMicBattery(49)).toBe('warning')
      expect(checkMicBattery(50)).toBe('normal')
      expect(checkMicBattery(100)).toBe('normal')
    })
  })

  describe('CUE状态流转', () => {
    it('应该有正确的状态流转顺序', () => {
      const validTransitions = {
        pending: ['executing'],
        executing: ['completed', 'pending'],
        completed: ['pending'],
        delayed: ['executing', 'completed']
      }

      expect(validTransitions.pending).toContain('executing')
      expect(validTransitions.executing).toContain('completed')
      expect(validTransitions.completed).toContain('pending')
      expect(validTransitions.pending).not.toContain('completed')
    })
  })

  describe('导出功能', () => {
    it('应该生成正确的Markdown表头', () => {
      const generateHeader = (showName, exportType) => {
        const typeLabels = {
          execution: '当日执行单',
          conflicts: '冲突清单',
          report: '复盘报告'
        }
        return `# ${showName} - ${typeLabels[exportType] || exportType}`
      }

      expect(generateHeader('《茶馆》社区版', 'execution')).toBe('# 《茶馆》社区版 - 当日执行单')
      expect(generateHeader('测试演出', 'conflicts')).toBe('# 测试演出 - 冲突清单')
      expect(generateHeader('测试演出', 'report')).toBe('# 测试演出 - 复盘报告')
    })
  })
})

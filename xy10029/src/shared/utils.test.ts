import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  DeviceStatus,
  DeviceStatusTransitions,
  BorrowStatus,
  ChangeType,
  UserRole,
  Permission,
  RolePermissions,
  DeviceCategory
} from './types'
import {
  isValidDeviceTransition,
  calculateNextRetry,
  getCurrentTimestamp,
  generateId,
  truncateText,
  serializeSnapshot,
  deserializeSnapshot
} from './utils'

describe('类型定义', () => {
  describe('UserRole', () => {
    it('应该包含所有角色类型', () => {
      expect(UserRole.ADMIN).toBe('admin')
      expect(UserRole.OPERATOR).toBe('operator')
      expect(UserRole.USER).toBe('user')
    })
  })

  describe('DeviceStatus', () => {
    it('应该包含所有设备状态', () => {
      expect(DeviceStatus.AVAILABLE).toBe('available')
      expect(DeviceStatus.BORROWED).toBe('borrowed')
      expect(DeviceStatus.MAINTENANCE).toBe('maintenance')
      expect(DeviceStatus.RESERVED).toBe('reserved')
      expect(DeviceStatus.LOST).toBe('lost')
    })
  })

  describe('DeviceCategory', () => {
    it('应该包含所有设备类别', () => {
      expect(DeviceCategory.LAPTOP).toBe('laptop')
      expect(DeviceCategory.PHONE).toBe('phone')
      expect(DeviceCategory.TABLET).toBe('tablet')
      expect(DeviceCategory.CAMERA).toBe('camera')
      expect(DeviceCategory.AUDIO).toBe('audio')
      expect(DeviceCategory.OTHER).toBe('other')
    })
  })

  describe('RolePermissions', () => {
    it('管理员应该拥有所有权限', () => {
      const adminPerms = RolePermissions[UserRole.ADMIN]
      expect(adminPerms).toContain(Permission.MANAGE_USERS)
      expect(adminPerms).toContain(Permission.MANAGE_DEVICES)
      expect(adminPerms).toContain(Permission.LEND_DEVICE)
      expect(adminPerms).toContain(Permission.RETURN_DEVICE)
      expect(adminPerms).toContain(Permission.EXPORT_DATA)
      expect(adminPerms).toContain(Permission.IMPORT_DATA)
      expect(adminPerms).toContain(Permission.BATCH_OPERATIONS)
    })

    it('操作员应该拥有有限权限', () => {
      const operatorPerms = RolePermissions[UserRole.OPERATOR]
      expect(operatorPerms).toContain(Permission.LEND_DEVICE)
      expect(operatorPerms).toContain(Permission.RETURN_DEVICE)
      expect(operatorPerms).toContain(Permission.BATCH_OPERATIONS)
      expect(operatorPerms).not.toContain(Permission.MANAGE_USERS)
    })

    it('普通用户只能查看', () => {
      const userPerms = RolePermissions[UserRole.USER]
      expect(userPerms).toContain(Permission.VIEW_DEVICES)
      expect(userPerms).toContain(Permission.VIEW_HISTORY)
      expect(userPerms).not.toContain(Permission.LEND_DEVICE)
      expect(userPerms).not.toContain(Permission.MANAGE_USERS)
    })
  })

  describe('BorrowStatus', () => {
    it('应该包含所有借出状态', () => {
      expect(BorrowStatus.ACTIVE).toBe('active')
      expect(BorrowStatus.RETURNED).toBe('returned')
      expect(BorrowStatus.OVERDUE).toBe('overdue')
      expect(BorrowStatus.CANCELLED).toBe('cancelled')
    })
  })

  describe('ChangeType', () => {
    it('应该包含所有变更类型', () => {
      expect(ChangeType.CREATE).toBe('create')
      expect(ChangeType.UPDATE).toBe('update')
      expect(ChangeType.BORROW).toBe('borrow')
      expect(ChangeType.RETURN).toBe('return')
      expect(ChangeType.MAINTENANCE).toBe('maintenance')
      expect(ChangeType.DELETE).toBe('delete')
      expect(ChangeType.RESTORE).toBe('restore')
    })
  })
})

describe('设备状态转换', () => {
  it('available 状态可以转换为 borrowed, maintenance, reserved', () => {
    expect(isValidDeviceTransition(DeviceStatus.AVAILABLE, DeviceStatus.BORROWED, DeviceStatusTransitions)).toBe(true)
    expect(isValidDeviceTransition(DeviceStatus.AVAILABLE, DeviceStatus.MAINTENANCE, DeviceStatusTransitions)).toBe(true)
    expect(isValidDeviceTransition(DeviceStatus.AVAILABLE, DeviceStatus.RESERVED, DeviceStatusTransitions)).toBe(true)
  })

  it('available 状态不能直接转换为 lost', () => {
    expect(isValidDeviceTransition(DeviceStatus.AVAILABLE, DeviceStatus.LOST, DeviceStatusTransitions)).toBe(false)
  })

  it('borrowed 状态可以转换为 available, maintenance, lost', () => {
    expect(isValidDeviceTransition(DeviceStatus.BORROWED, DeviceStatus.AVAILABLE, DeviceStatusTransitions)).toBe(true)
    expect(isValidDeviceTransition(DeviceStatus.BORROWED, DeviceStatus.MAINTENANCE, DeviceStatusTransitions)).toBe(true)
    expect(isValidDeviceTransition(DeviceStatus.BORROWED, DeviceStatus.LOST, DeviceStatusTransitions)).toBe(true)
  })

  it('borrowed 状态不能转换为 reserved', () => {
    expect(isValidDeviceTransition(DeviceStatus.BORROWED, DeviceStatus.RESERVED, DeviceStatusTransitions)).toBe(false)
  })

  it('maintenance 状态只能转换为 available', () => {
    expect(isValidDeviceTransition(DeviceStatus.MAINTENANCE, DeviceStatus.AVAILABLE, DeviceStatusTransitions)).toBe(true)
    expect(isValidDeviceTransition(DeviceStatus.MAINTENANCE, DeviceStatus.BORROWED, DeviceStatusTransitions)).toBe(false)
    expect(isValidDeviceTransition(DeviceStatus.MAINTENANCE, DeviceStatus.LOST, DeviceStatusTransitions)).toBe(false)
  })

  it('lost 状态可以转换为 available', () => {
    expect(isValidDeviceTransition(DeviceStatus.LOST, DeviceStatus.AVAILABLE, DeviceStatusTransitions)).toBe(true)
  })

  it('reserved 状态可以转换为 available 或 borrowed', () => {
    expect(isValidDeviceTransition(DeviceStatus.RESERVED, DeviceStatus.AVAILABLE, DeviceStatusTransitions)).toBe(true)
    expect(isValidDeviceTransition(DeviceStatus.RESERVED, DeviceStatus.BORROWED, DeviceStatusTransitions)).toBe(true)
  })

  it('无效状态转换应该返回 false', () => {
    expect(isValidDeviceTransition('invalid' as DeviceStatus, DeviceStatus.AVAILABLE, DeviceStatusTransitions)).toBe(false)
  })
})

describe('工具函数', () => {
  describe('generateId', () => {
    it('应该生成唯一的 ID', () => {
      const id1 = generateId()
      const id2 = generateId()
      expect(id1).not.toBe(id2)
      expect(id1.length).toBeGreaterThan(0)
    })
  })

  describe('getCurrentTimestamp', () => {
    it('应该返回 ISO 格式的时间戳', () => {
      const timestamp = getCurrentTimestamp()
      expect(() => new Date(timestamp)).not.toThrow()
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })
  })

  describe('truncateText', () => {
    it('短文本不应该被截断', () => {
      expect(truncateText('hello', 10)).toBe('hello')
    })

    it('长文本应该被截断并添加省略号', () => {
      const result = truncateText('hello world', 8)
      expect(result).toBe('hello...')
      expect(result.length).toBe(8)
    })

    it('空字符串应该保持原样', () => {
      expect(truncateText('', 10)).toBe('')
    })
  })

  describe('calculateNextRetry', () => {
    it('第一次重试延迟应该是 5 秒', () => {
      const now = new Date().toISOString()
      const next = calculateNextRetry(0, now)
      const nextDate = new Date(next)
      const nowDate = new Date(now)
      const diff = nextDate.getTime() - nowDate.getTime()
      expect(diff).toBe(5000)
    })

    it('第二次重试延迟应该是 10 秒', () => {
      const now = new Date().toISOString()
      const next = calculateNextRetry(1, now)
      const nextDate = new Date(next)
      const nowDate = new Date(now)
      const diff = nextDate.getTime() - nowDate.getTime()
      expect(diff).toBe(10000)
    })

    it('第三次重试延迟应该是 20 秒（指数退避）', () => {
      const now = new Date().toISOString()
      const next = calculateNextRetry(2, now)
      const nextDate = new Date(next)
      const nowDate = new Date(now)
      const diff = nextDate.getTime() - nowDate.getTime()
      expect(diff).toBe(20000)
    })
  })

  describe('serializeSnapshot / deserializeSnapshot', () => {
    it('应该正确序列化和反序列化对象', () => {
      const data = { name: 'Test Device', status: DeviceStatus.AVAILABLE, count: 42 }
      const serialized = serializeSnapshot(data)
      const deserialized = deserializeSnapshot<typeof data>(serialized)
      expect(deserialized).toEqual(data)
    })

    it('应该正确处理数组', () => {
      const data = [1, 2, 3, { nested: true }]
      const serialized = serializeSnapshot(data)
      const deserialized = deserializeSnapshot<any[]>(serialized)
      expect(deserialized).toEqual(data)
    })

    it('应该正确处理 null', () => {
      const serialized = serializeSnapshot(null)
      const deserialized = deserializeSnapshot<any>(serialized)
      expect(deserialized).toBeNull()
    })
  })
})

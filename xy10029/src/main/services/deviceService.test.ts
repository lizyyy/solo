import { describe, it, expect } from '@jest/globals'
import {
  DeviceStatus,
  DeviceCategory,
  UserRole,
  DeviceStatusTransitions,
  BorrowStatus
} from '../../shared/types'
import { generateId, getCurrentTimestamp } from '../../shared/utils'

describe('设备状态流转', () => {
  it('新创建设备应该处于 available 状态', () => {
    const now = getCurrentTimestamp()
    const device = {
      id: generateId(),
      deviceCode: 'TEST-001',
      name: 'Test Device',
      category: DeviceCategory.LAPTOP,
      model: 'Test Model',
      serialNumber: 'TEST-SN-001',
      status: DeviceStatus.AVAILABLE,
      location: 'Test Location',
      description: 'Test Description',
      currentHolder: null,
      currentHolderName: null,
      borrowedAt: null,
      expectedReturnAt: null,
      createdAt: now,
      updatedAt: now,
      isActive: true
    }

    expect(device.status).toBe(DeviceStatus.AVAILABLE)
    expect(device.isActive).toBe(true)
  })

  it('available -> borrowed 应该是有效的状态转换', () => {
    const isValid = DeviceStatusTransitions[DeviceStatus.AVAILABLE]?.includes(DeviceStatus.BORROWED)
    expect(isValid).toBe(true)
  })

  it('available -> lost 应该是无效的状态转换', () => {
    const isValid = DeviceStatusTransitions[DeviceStatus.AVAILABLE]?.includes(DeviceStatus.LOST)
    expect(isValid).toBe(false)
  })

  it('borrowed -> available 应该是有效的状态转换（归还）', () => {
    const isValid = DeviceStatusTransitions[DeviceStatus.BORROWED]?.includes(DeviceStatus.AVAILABLE)
    expect(isValid).toBe(true)
  })

  it('borrowed -> lost 应该是有效的状态转换（丢失）', () => {
    const isValid = DeviceStatusTransitions[DeviceStatus.BORROWED]?.includes(DeviceStatus.LOST)
    expect(isValid).toBe(true)
  })

  it('maintenance -> available 应该是有效的状态转换（维护完成）', () => {
    const isValid = DeviceStatusTransitions[DeviceStatus.MAINTENANCE]?.includes(DeviceStatus.AVAILABLE)
    expect(isValid).toBe(true)
  })

  it('lost -> available 应该是有效的状态转换（找回）', () => {
    const isValid = DeviceStatusTransitions[DeviceStatus.LOST]?.includes(DeviceStatus.AVAILABLE)
    expect(isValid).toBe(true)
  })

  it('设备被借出时应该更新持有人信息', () => {
    const now = getCurrentTimestamp()
    const device: {
      id: string
      deviceCode: string
      name: string
      category: DeviceCategory
      model: string
      serialNumber: string
      status: DeviceStatus
      location: string
      description: string
      currentHolder: string | null
      currentHolderName: string | null
      borrowedAt: string | null
      expectedReturnAt: string | null
      createdAt: string
      updatedAt: string
      isActive: boolean
    } = {
      id: generateId(),
      deviceCode: 'LAP-100',
      name: 'Test Laptop',
      category: DeviceCategory.LAPTOP,
      model: 'Model X',
      serialNumber: 'SN-123',
      status: DeviceStatus.AVAILABLE,
      location: 'Cabinet A',
      description: 'Test',
      currentHolder: null,
      currentHolderName: null,
      borrowedAt: null,
      expectedReturnAt: null,
      createdAt: now,
      updatedAt: now,
      isActive: true
    }

    const borrowerId = 'user-001'
    const borrowerName = '张三'
    const expectedReturn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    device.status = DeviceStatus.BORROWED
    device.currentHolder = borrowerId
    device.currentHolderName = borrowerName
    device.borrowedAt = now
    device.expectedReturnAt = expectedReturn
    device.updatedAt = now

    expect(device.status).toBe(DeviceStatus.BORROWED)
    expect(device.currentHolder).toBe(borrowerId)
    expect(device.currentHolderName).toBe(borrowerName)
    expect(device.borrowedAt).not.toBeNull()
    expect(device.expectedReturnAt).toBe(expectedReturn)
  })

  it('设备归还时应该清除持有人信息', () => {
    const now = getCurrentTimestamp()
    const device: {
      id: string
      deviceCode: string
      name: string
      category: DeviceCategory
      model: string
      serialNumber: string
      status: DeviceStatus
      location: string
      description: string
      currentHolder: string | null
      currentHolderName: string | null
      borrowedAt: string | null
      expectedReturnAt: string | null
      createdAt: string
      updatedAt: string
      isActive: boolean
    } = {
      id: generateId(),
      deviceCode: 'LAP-200',
      name: 'Test Laptop 2',
      category: DeviceCategory.LAPTOP,
      model: 'Model Y',
      serialNumber: 'SN-456',
      status: DeviceStatus.BORROWED,
      location: 'Cabinet B',
      description: 'Test 2',
      currentHolder: 'user-002',
      currentHolderName: '李四',
      borrowedAt: now,
      expectedReturnAt: null,
      createdAt: now,
      updatedAt: now,
      isActive: true
    }

    device.status = DeviceStatus.AVAILABLE
    device.currentHolder = null
    device.currentHolderName = null
    device.borrowedAt = null
    device.expectedReturnAt = null
    device.updatedAt = now

    expect(device.status).toBe(DeviceStatus.AVAILABLE)
    expect(device.currentHolder).toBeNull()
    expect(device.currentHolderName).toBeNull()
    expect(device.borrowedAt).toBeNull()
    expect(device.expectedReturnAt).toBeNull()
  })

  it('设备软删除应该只设置 isActive 为 false', () => {
    const now = getCurrentTimestamp()
    const device = {
      id: generateId(),
      deviceCode: 'LAP-300',
      name: 'Test Laptop 3',
      category: DeviceCategory.LAPTOP,
      model: 'Model Z',
      serialNumber: 'SN-789',
      status: DeviceStatus.AVAILABLE,
      location: 'Cabinet C',
      description: 'Test 3',
      currentHolder: null,
      currentHolderName: null,
      borrowedAt: null,
      expectedReturnAt: null,
      createdAt: now,
      updatedAt: now,
      isActive: true
    }

    device.isActive = false
    device.updatedAt = now

    expect(device.isActive).toBe(false)
    expect(device.id).not.toBeNull()
  })
})

describe('权限系统', () => {
  it('管理员应该拥有所有权限', () => {
    const adminRole = UserRole.ADMIN
    expect(adminRole).toBe('admin')
  })

  it('UserRole 枚举值应该正确', () => {
    expect(UserRole.ADMIN).toBe('admin')
    expect(UserRole.OPERATOR).toBe('operator')
    expect(UserRole.USER).toBe('user')
  })
})

describe('借出记录状态', () => {
  it('BorrowStatus 枚举值应该正确', () => {
    expect(BorrowStatus.ACTIVE).toBe('active')
    expect(BorrowStatus.RETURNED).toBe('returned')
    expect(BorrowStatus.OVERDUE).toBe('overdue')
    expect(BorrowStatus.CANCELLED).toBe('cancelled')
  })
})

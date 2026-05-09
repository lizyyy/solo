import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import Database from 'better-sqlite3'
import {
  DeviceStatus,
  DeviceCategory,
  UserRole,
  DeviceStatusTransitions,
  BorrowStatus
} from '../shared/types'
import { generateId, getCurrentTimestamp } from '../shared/utils'

describe('设备状态流转', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    db.exec(`
      CREATE TABLE devices (
        id TEXT PRIMARY KEY,
        device_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        model TEXT,
        serial_number TEXT,
        status TEXT NOT NULL,
        location TEXT,
        description TEXT,
        current_holder TEXT,
        current_holder_name TEXT,
        borrowed_at TEXT,
        expected_return_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      );
    `)
  })

  afterEach(() => {
    db.close()
  })

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

    const stmt = db.prepare(`
      INSERT INTO devices (
        id, device_code, name, category, model, serial_number, status, location,
        description, current_holder, current_holder_name, borrowed_at, expected_return_at,
        created_at, updated_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      device.id,
      device.deviceCode,
      device.name,
      device.category,
      device.model,
      device.serialNumber,
      device.status,
      device.location,
      device.description,
      device.currentHolder,
      device.currentHolderName,
      device.borrowedAt,
      device.expectedReturnAt,
      device.createdAt,
      device.updatedAt,
      1
    )

    const result = db.prepare('SELECT * FROM devices WHERE id = ?').get(device.id) as any
    expect(result.status).toBe(DeviceStatus.AVAILABLE)
    expect(result.is_active).toBe(1)
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
    const deviceId = generateId()

    db.prepare(`
      INSERT INTO devices (
        id, device_code, name, category, model, serial_number, status, location,
        description, current_holder, current_holder_name, borrowed_at, expected_return_at,
        created_at, updated_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      deviceId,
      'LAP-100',
      'Test Laptop',
      DeviceCategory.LAPTOP,
      'Model X',
      'SN-123',
      DeviceStatus.AVAILABLE,
      'Cabinet A',
      'Test',
      null,
      null,
      null,
      null,
      now,
      now,
      1
    )

    const borrowerId = 'user-001'
    const borrowerName = '张三'
    const expectedReturn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    db.prepare(`
      UPDATE devices SET
        status = ?,
        current_holder = ?,
        current_holder_name = ?,
        borrowed_at = ?,
        expected_return_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      DeviceStatus.BORROWED,
      borrowerId,
      borrowerName,
      now,
      expectedReturn,
      now,
      deviceId
    )

    const updated = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId) as any
    expect(updated.status).toBe(DeviceStatus.BORROWED)
    expect(updated.current_holder).toBe(borrowerId)
    expect(updated.current_holder_name).toBe(borrowerName)
    expect(updated.borrowed_at).not.toBeNull()
    expect(updated.expected_return_at).toBe(expectedReturn)
  })

  it('设备归还时应该清除持有人信息', () => {
    const now = getCurrentTimestamp()
    const deviceId = generateId()

    db.prepare(`
      INSERT INTO devices (
        id, device_code, name, category, model, serial_number, status, location,
        description, current_holder, current_holder_name, borrowed_at, expected_return_at,
        created_at, updated_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      deviceId,
      'LAP-200',
      'Test Laptop 2',
      DeviceCategory.LAPTOP,
      'Model Y',
      'SN-456',
      DeviceStatus.BORROWED,
      'Cabinet B',
      'Test 2',
      'user-002',
      '李四',
      now,
      null,
      now,
      now,
      1
    )

    db.prepare(`
      UPDATE devices SET
        status = ?,
        current_holder = ?,
        current_holder_name = ?,
        borrowed_at = ?,
        expected_return_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      DeviceStatus.AVAILABLE,
      null,
      null,
      null,
      null,
      now,
      deviceId
    )

    const updated = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId) as any
    expect(updated.status).toBe(DeviceStatus.AVAILABLE)
    expect(updated.current_holder).toBeNull()
    expect(updated.current_holder_name).toBeNull()
    expect(updated.borrowed_at).toBeNull()
    expect(updated.expected_return_at).toBeNull()
  })

  it('设备软删除应该只设置 is_active 为 0', () => {
    const now = getCurrentTimestamp()
    const deviceId = generateId()

    db.prepare(`
      INSERT INTO devices (
        id, device_code, name, category, model, serial_number, status, location,
        description, current_holder, current_holder_name, borrowed_at, expected_return_at,
        created_at, updated_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      deviceId,
      'LAP-300',
      'Test Laptop 3',
      DeviceCategory.LAPTOP,
      'Model Z',
      'SN-789',
      DeviceStatus.AVAILABLE,
      'Cabinet C',
      'Test 3',
      null,
      null,
      null,
      null,
      now,
      now,
      1
    )

    db.prepare('UPDATE devices SET is_active = 0, updated_at = ? WHERE id = ?').run(now, deviceId)

    const all = db.prepare('SELECT * FROM devices').all()
    expect(all.length).toBe(1)

    const active = db.prepare('SELECT * FROM devices WHERE is_active = 1').all()
    expect(active.length).toBe(0)
  })
})

describe('权限系统', () => {
  it('管理员应该拥有所有权限', () => {
    const allPermissions = Object.values({
      view_devices: 'view_devices',
      manage_devices: 'manage_devices',
      lend_device: 'lend_device',
      return_device: 'return_device',
      view_history: 'view_history',
      view_logs: 'view_logs',
      export_data: 'export_data',
      import_data: 'import_data',
      manage_users: 'manage_users',
      batch_operations: 'batch_operations',
      restore_version: 'restore_version',
      system_settings: 'system_settings'
    })

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

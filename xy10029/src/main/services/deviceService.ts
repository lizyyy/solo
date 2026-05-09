import { getDatabase, beginTransaction, commitTransaction, rollbackTransaction } from '../database'
import {
  Device,
  DeviceStatus,
  DeviceStatusTransitions,
  BorrowRecord,
  BorrowStatus,
  DeviceHistory,
  ChangeType,
  PaginationParams,
  PaginatedResult,
  User
} from '@shared/types'
import { generateId, getCurrentTimestamp, isValidDeviceTransition, createDeviceHistory } from '@shared/utils'

export function createDevice(
  deviceCode: string,
  name: string,
  category: string,
  operator: User,
  options: Partial<Omit<Device, 'id' | 'deviceCode' | 'name' | 'category' | 'createdAt' | 'updatedAt' | 'isActive'>> = {}
): Device {
  const db = getDatabase()
  const now = getCurrentTimestamp()

  const device: Device = {
    id: generateId(),
    deviceCode,
    name,
    category,
    model: options.model || '',
    serialNumber: options.serialNumber || '',
    status: DeviceStatus.AVAILABLE,
    location: options.location || '',
    description: options.description || '',
    currentHolder: null,
    currentHolderName: null,
    borrowedAt: null,
    expectedReturnAt: null,
    createdAt: now,
    updatedAt: now,
    isActive: true
  }

  beginTransaction()
  try {
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

    const history = createDeviceHistory(
      device,
      ChangeType.CREATE,
      operator.id,
      operator.displayName,
      `创建设备 ${deviceCode}`,
      1
    )
    saveDeviceHistory(history)

    commitTransaction()
    return device
  } catch (error) {
    rollbackTransaction()
    throw error
  }
}

export function getDeviceById(id: string): Device | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM devices WHERE id = ? AND is_active = 1')
  const row = stmt.get(id) as any
  return row ? mapDevice(row) : null
}

export function getDeviceByCode(deviceCode: string): Device | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM devices WHERE device_code = ? AND is_active = 1')
  const row = stmt.get(deviceCode) as any
  return row ? mapDevice(row) : null
}

export function listDevices(params: PaginationParams & { status?: DeviceStatus; category?: string; search?: string }): PaginatedResult<Device> {
  const db = getDatabase()
  const { page, pageSize, sortBy = 'created_at', sortOrder = 'desc', status, category, search } = params

  const whereClauses: string[] = ['is_active = 1']
  const whereParams: any[] = []

  if (status) {
    whereClauses.push('status = ?')
    whereParams.push(status)
  }
  if (category) {
    whereClauses.push('category = ?')
    whereParams.push(category)
  }
  if (search) {
    whereClauses.push('(device_code LIKE ? OR name LIKE ? OR serial_number LIKE ?)')
    const searchPattern = `%${search}%`
    whereParams.push(searchPattern, searchPattern, searchPattern)
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM devices ${whereSql}`)
  const total = (countStmt.get(...whereParams) as any).count

  const offset = (page - 1) * pageSize
  const stmt = db.prepare(`
    SELECT * FROM devices
    ${whereSql}
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT ? OFFSET ?
  `)
  const rows = stmt.all(...whereParams, pageSize, offset) as any[]

  return {
    items: rows.map(mapDevice),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

export function updateDevice(
  id: string,
  updates: Partial<Omit<Device, 'id' | 'createdAt' | 'updatedAt'>>,
  operator: User
): Device | null {
  const db = getDatabase()
  const device = getDeviceById(id)
  if (!device) return null

  const now = getCurrentTimestamp()
  const updateFields: string[] = []
  const updateValues: any[] = []

  const fieldMappings: Record<string, keyof Device> = {
    name: 'name',
    category: 'category',
    model: 'model',
    serial_number: 'serialNumber',
    location: 'location',
    description: 'description'
  }

  for (const [dbField, deviceField] of Object.entries(fieldMappings)) {
    if (updates[deviceField] !== undefined) {
      updateFields.push(`${dbField} = ?`)
      updateValues.push(updates[deviceField])
      (device as any)[deviceField] = updates[deviceField]
    }
  }

  if (updateFields.length === 0) return device

  updateFields.push('updated_at = ?')
  updateValues.push(now, id)
  device.updatedAt = now

  beginTransaction()
  try {
    const stmt = db.prepare(`UPDATE devices SET ${updateFields.join(', ')} WHERE id = ?`)
    stmt.run(...updateValues)

    const currentVersion = getLatestHistoryVersion(id)
    const history = createDeviceHistory(
      device,
      ChangeType.UPDATE,
      operator.id,
      operator.displayName,
      `更新设备 ${device.deviceCode} 信息`,
      currentVersion + 1
    )
    saveDeviceHistory(history)

    commitTransaction()
    return device
  } catch (error) {
    rollbackTransaction()
    throw error
  }
}

export function lendDevice(
  deviceId: string,
  borrowerId: string,
  borrowerName: string,
  operator: User,
  expectedReturnAt?: string,
  purpose?: string
): { device: Device; record: BorrowRecord } | null {
  const db = getDatabase()
  const device = getDeviceById(deviceId)
  if (!device) return null

  if (device.status !== DeviceStatus.AVAILABLE) {
    throw new Error(`设备当前状态为 ${device.status}，无法借出`)
  }

  const now = getCurrentTimestamp()

  beginTransaction()
  try {
    const updatedDevice: Device = {
      ...device,
      status: DeviceStatus.BORROWED,
      currentHolder: borrowerId,
      currentHolderName: borrowerName,
      borrowedAt: now,
      expectedReturnAt: expectedReturnAt || null,
      updatedAt: now
    }

    const updateStmt = db.prepare(`
      UPDATE devices SET
        status = ?, current_holder = ?, current_holder_name = ?,
        borrowed_at = ?, expected_return_at = ?, updated_at = ?
      WHERE id = ?
    `)
    updateStmt.run(
      updatedDevice.status,
      updatedDevice.currentHolder,
      updatedDevice.currentHolderName,
      updatedDevice.borrowedAt,
      updatedDevice.expectedReturnAt,
      updatedDevice.updatedAt,
      updatedDevice.id
    )

    const record: BorrowRecord = {
      id: generateId(),
      deviceId: device.id,
      deviceCode: device.deviceCode,
      borrowerId,
      borrowerName,
      operatorId: operator.id,
      operatorName: operator.displayName,
      borrowedAt: now,
      expectedReturnAt: expectedReturnAt || null,
      returnedAt: null,
      status: BorrowStatus.ACTIVE,
      purpose: purpose || '',
      notes: '',
      createdAt: now,
      updatedAt: now
    }

    const recordStmt = db.prepare(`
      INSERT INTO borrow_records (
        id, device_id, device_code, borrower_id, borrower_name, operator_id,
        operator_name, borrowed_at, expected_return_at, returned_at, status,
        purpose, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    recordStmt.run(
      record.id,
      record.deviceId,
      record.deviceCode,
      record.borrowerId,
      record.borrowerName,
      record.operatorId,
      record.operatorName,
      record.borrowedAt,
      record.expectedReturnAt,
      record.returnedAt,
      record.status,
      record.purpose,
      record.notes,
      record.createdAt,
      record.updatedAt
    )

    const currentVersion = getLatestHistoryVersion(device.id)
    const history = createDeviceHistory(
      updatedDevice,
      ChangeType.BORROW,
      operator.id,
      operator.displayName,
      `借出设备给 ${borrowerName}`,
      currentVersion + 1
    )
    saveDeviceHistory(history)

    commitTransaction()
    return { device: updatedDevice, record }
  } catch (error) {
    rollbackTransaction()
    throw error
  }
}

export function returnDevice(deviceId: string, operator: User, notes?: string): { device: Device; record: BorrowRecord } | null {
  const db = getDatabase()
  const device = getDeviceById(deviceId)
  if (!device) return null

  if (device.status !== DeviceStatus.BORROWED) {
    throw new Error(`设备当前状态为 ${device.status}，无法归还`)
  }

  const now = getCurrentTimestamp()

  const activeRecordStmt = db.prepare(`
    SELECT * FROM borrow_records
    WHERE device_id = ? AND status = ?
    ORDER BY borrowed_at DESC
    LIMIT 1
  `)
  const activeRecord = activeRecordStmt.get(device.id, BorrowStatus.ACTIVE) as any
  if (!activeRecord) {
    throw new Error('未找到活跃的借出记录')
  }

  beginTransaction()
  try {
    const updatedDevice: Device = {
      ...device,
      status: DeviceStatus.AVAILABLE,
      currentHolder: null,
      currentHolderName: null,
      borrowedAt: null,
      expectedReturnAt: null,
      updatedAt: now
    }

    const updateDeviceStmt = db.prepare(`
      UPDATE devices SET
        status = ?, current_holder = ?, current_holder_name = ?,
        borrowed_at = ?, expected_return_at = ?, updated_at = ?
      WHERE id = ?
    `)
    updateDeviceStmt.run(
      updatedDevice.status,
      updatedDevice.currentHolder,
      updatedDevice.currentHolderName,
      updatedDevice.borrowedAt,
      updatedDevice.expectedReturnAt,
      updatedDevice.updatedAt,
      updatedDevice.id
    )

    const updatedRecord: BorrowRecord = {
      ...mapBorrowRecord(activeRecord),
      returnedAt: now,
      status: BorrowStatus.RETURNED,
      notes: notes || '',
      updatedAt: now
    }

    const updateRecordStmt = db.prepare(`
      UPDATE borrow_records SET
        returned_at = ?, status = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `)
    updateRecordStmt.run(
      updatedRecord.returnedAt,
      updatedRecord.status,
      updatedRecord.notes,
      updatedRecord.updatedAt,
      updatedRecord.id
    )

    const currentVersion = getLatestHistoryVersion(device.id)
    const history = createDeviceHistory(
      updatedDevice,
      ChangeType.RETURN,
      operator.id,
      operator.displayName,
      `归还设备，原持有人: ${device.currentHolderName}`,
      currentVersion + 1
    )
    saveDeviceHistory(history)

    commitTransaction()
    return { device: updatedDevice, record: updatedRecord }
  } catch (error) {
    rollbackTransaction()
    throw error
  }
}

export function changeDeviceStatus(
  deviceId: string,
  newStatus: DeviceStatus,
  operator: User,
  notes?: string
): Device | null {
  const db = getDatabase()
  const device = getDeviceById(deviceId)
  if (!device) return null

  if (!isValidDeviceTransition(device.status, newStatus, DeviceStatusTransitions)) {
    throw new Error(`设备状态无法从 ${device.status} 转换为 ${newStatus}`)
  }

  const now = getCurrentTimestamp()

  beginTransaction()
  try {
    const updatedDevice: Device = {
      ...device,
      status: newStatus,
      updatedAt: now
    }

    const stmt = db.prepare('UPDATE devices SET status = ?, updated_at = ? WHERE id = ?')
    stmt.run(newStatus, now, device.id)

    const currentVersion = getLatestHistoryVersion(device.id)
    const changeType = newStatus === DeviceStatus.MAINTENANCE ? ChangeType.MAINTENANCE : ChangeType.UPDATE
    const history = createDeviceHistory(
      updatedDevice,
      changeType,
      operator.id,
      operator.displayName,
      notes || `设备状态从 ${device.status} 变更为 ${newStatus}`,
      currentVersion + 1
    )
    saveDeviceHistory(history)

    commitTransaction()
    return updatedDevice
  } catch (error) {
    rollbackTransaction()
    throw error
  }
}

export function deleteDevice(deviceId: string, operator: User): boolean {
  const db = getDatabase()
  const device = getDeviceById(deviceId)
  if (!device) return false

  if (device.status === DeviceStatus.BORROWED) {
    throw new Error('设备已借出，无法删除')
  }

  const now = getCurrentTimestamp()

  beginTransaction()
  try {
    const stmt = db.prepare('UPDATE devices SET is_active = 0, updated_at = ? WHERE id = ?')
    stmt.run(now, deviceId)

    const currentVersion = getLatestHistoryVersion(deviceId)
    const history = createDeviceHistory(
      device,
      ChangeType.DELETE,
      operator.id,
      operator.displayName,
      `删除设备 ${device.deviceCode}`,
      currentVersion + 1
    )
    saveDeviceHistory(history)

    commitTransaction()
    return true
  } catch (error) {
    rollbackTransaction()
    throw error
  }
}

export function getDeviceHistory(deviceId: string): DeviceHistory[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM device_history
    WHERE device_id = ?
    ORDER BY version DESC
  `)
  const rows = stmt.all(deviceId) as any[]
  return rows.map(mapDeviceHistory)
}

export function restoreDeviceFromHistory(
  historyId: string,
  operator: User
): Device | null {
  const db = getDatabase()
  const historyStmt = db.prepare('SELECT * FROM device_history WHERE id = ?')
  const historyRow = historyStmt.get(historyId) as any
  if (!historyRow) return null

  const history = mapDeviceHistory(historyRow)
  const snapshotDevice = JSON.parse(history.snapshot) as Device

  const existingDevice = getDeviceById(history.deviceId)
  if (!existingDevice) return null

  const now = getCurrentTimestamp()

  beginTransaction()
  try {
    const restoredDevice: Device = {
      ...snapshotDevice,
      updatedAt: now,
      isActive: true
    }

    const stmt = db.prepare(`
      UPDATE devices SET
        name = ?, category = ?, model = ?, serial_number = ?, status = ?,
        location = ?, description = ?, current_holder = ?, current_holder_name = ?,
        borrowed_at = ?, expected_return_at = ?, updated_at = ?
      WHERE id = ?
    `)
    stmt.run(
      restoredDevice.name,
      restoredDevice.category,
      restoredDevice.model,
      restoredDevice.serialNumber,
      restoredDevice.status,
      restoredDevice.location,
      restoredDevice.description,
      restoredDevice.currentHolder,
      restoredDevice.currentHolderName,
      restoredDevice.borrowedAt,
      restoredDevice.expectedReturnAt,
      restoredDevice.updatedAt,
      restoredDevice.id
    )

    const currentVersion = getLatestHistoryVersion(history.deviceId)
    const newHistory = createDeviceHistory(
      restoredDevice,
      ChangeType.RESTORE,
      operator.id,
      operator.displayName,
      `从版本 ${history.version} 恢复设备`,
      currentVersion + 1
    )
    saveDeviceHistory(newHistory)

    commitTransaction()
    return restoredDevice
  } catch (error) {
    rollbackTransaction()
    throw error
  }
}

export function getBorrowRecords(params: PaginationParams & { status?: BorrowStatus; deviceId?: string; borrowerId?: string }): PaginatedResult<BorrowRecord> {
  const db = getDatabase()
  const { page, pageSize, sortBy = 'borrowed_at', sortOrder = 'desc', status, deviceId, borrowerId } = params

  const whereClauses: string[] = []
  const whereParams: any[] = []

  if (status) {
    whereClauses.push('status = ?')
    whereParams.push(status)
  }
  if (deviceId) {
    whereClauses.push('device_id = ?')
    whereParams.push(deviceId)
  }
  if (borrowerId) {
    whereClauses.push('borrower_id = ?')
    whereParams.push(borrowerId)
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM borrow_records ${whereSql}`)
  const total = (countStmt.get(...whereParams) as any).count

  const offset = (page - 1) * pageSize
  const stmt = db.prepare(`
    SELECT * FROM borrow_records
    ${whereSql}
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT ? OFFSET ?
  `)
  const rows = stmt.all(...whereParams, pageSize, offset) as any[]

  return {
    items: rows.map(mapBorrowRecord),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

function getLatestHistoryVersion(deviceId: string): number {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT MAX(version) as max_version FROM device_history WHERE device_id = ?
  `)
  const result = stmt.get(deviceId) as any
  return result?.max_version || 0
}

function saveDeviceHistory(history: DeviceHistory): void {
  const db = getDatabase()
  const stmt = db.prepare(`
    INSERT INTO device_history (
      id, device_id, version, snapshot, changed_at, changed_by,
      changed_by_name, change_type, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    history.id,
    history.deviceId,
    history.version,
    history.snapshot,
    history.changedAt,
    history.changedBy,
    history.changedByName,
    history.changeType,
    history.description
  )
}

function mapDevice(row: any): Device {
  return {
    id: row.id,
    deviceCode: row.device_code,
    name: row.name,
    category: row.category,
    model: row.model,
    serialNumber: row.serial_number,
    status: row.status as DeviceStatus,
    location: row.location,
    description: row.description,
    currentHolder: row.current_holder,
    currentHolderName: row.current_holder_name,
    borrowedAt: row.borrowed_at,
    expectedReturnAt: row.expected_return_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isActive: row.is_active === 1
  }
}

function mapBorrowRecord(row: any): BorrowRecord {
  return {
    id: row.id,
    deviceId: row.device_id,
    deviceCode: row.device_code,
    borrowerId: row.borrower_id,
    borrowerName: row.borrower_name,
    operatorId: row.operator_id,
    operatorName: row.operator_name,
    borrowedAt: row.borrowed_at,
    expectedReturnAt: row.expected_return_at,
    returnedAt: row.returned_at,
    status: row.status as BorrowStatus,
    purpose: row.purpose,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapDeviceHistory(row: any): DeviceHistory {
  return {
    id: row.id,
    deviceId: row.device_id,
    version: row.version,
    snapshot: row.snapshot,
    changedAt: row.changed_at,
    changedBy: row.changed_by,
    changedByName: row.changed_by_name,
    changeType: row.change_type as ChangeType,
    description: row.description
  }
}

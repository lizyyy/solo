import { run, get, all, beginTransaction, commitTransaction, rollbackTransaction } from '../database/index'
import {
  Device,
  DeviceStatus,
  DeviceStatusTransitions,
  DeviceCategory,
  BorrowRecord,
  BorrowStatus,
  DeviceHistory,
  ChangeType,
  PaginationParams,
  PaginatedResult,
  User
} from '@shared/types'
import { generateId, getCurrentTimestamp, isValidDeviceTransition, createDeviceHistory } from '@shared/utils'

export async function createDevice(
  deviceCode: string,
  name: string,
  category: DeviceCategory,
  operator: User,
  options: Partial<Omit<Device, 'id' | 'deviceCode' | 'name' | 'category' | 'createdAt' | 'updatedAt' | 'isActive'>> = {}
): Promise<Device> {
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

  await beginTransaction()
  try {
    await run(`
      INSERT INTO devices (
        id, device_code, name, category, model, serial_number, status, location,
        description, current_holder, current_holder_name, borrowed_at, expected_return_at,
        created_at, updated_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
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
    ])

    const history = createDeviceHistory(
      device,
      ChangeType.CREATE,
      operator.id,
      operator.displayName,
      `创建设备 ${deviceCode}`,
      1
    )
    await saveDeviceHistory(history)

    await commitTransaction()
    return device
  } catch (error) {
    await rollbackTransaction()
    throw error
  }
}

export async function getDeviceById(id: string): Promise<Device | null> {
  const row = await get<any>('SELECT * FROM devices WHERE id = ? AND is_active = 1', [id])
  return row ? mapDevice(row) : null
}

export async function getDeviceByCode(deviceCode: string): Promise<Device | null> {
  const row = await get<any>('SELECT * FROM devices WHERE device_code = ? AND is_active = 1', [deviceCode])
  return row ? mapDevice(row) : null
}

export async function listDevices(
  params: PaginationParams & { status?: DeviceStatus; category?: string; search?: string }
): Promise<PaginatedResult<Device>> {
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

  const countRow = await get<any>(`SELECT COUNT(*) as count FROM devices ${whereSql}`, whereParams)
  const total = countRow?.count || 0

  const offset = (page - 1) * pageSize
  const rows = await all<any>(
    `SELECT * FROM devices ${whereSql} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
    [...whereParams, pageSize, offset]
  )

  return {
    items: rows.map(mapDevice),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

export async function updateDevice(
  id: string,
  updates: Partial<Omit<Device, 'id' | 'createdAt' | 'updatedAt'>>,
  operator: User
): Promise<Device | null> {
  const device = await getDeviceById(id)
  if (!device) return null

  const now = getCurrentTimestamp()
  const updateFields: string[] = []
  const updateValues: any[] = []

  const fieldMappings: Array<{ dbField: string; deviceField: keyof typeof updates }> = [
    { dbField: 'name', deviceField: 'name' },
    { dbField: 'category', deviceField: 'category' },
    { dbField: 'model', deviceField: 'model' },
    { dbField: 'serial_number', deviceField: 'serialNumber' },
    { dbField: 'location', deviceField: 'location' },
    { dbField: 'description', deviceField: 'description' }
  ]

  for (const { dbField, deviceField } of fieldMappings) {
    const value = updates[deviceField]
    if (value !== undefined) {
      updateFields.push(`${dbField} = ?`)
      updateValues.push(value)
      ;(device as any)[deviceField] = value
    }
  }

  if (updateFields.length === 0) return device

  updateFields.push('updated_at = ?')
  updateValues.push(now, id)
  device.updatedAt = now

  await beginTransaction()
  try {
    await run(`UPDATE devices SET ${updateFields.join(', ')} WHERE id = ?`, updateValues)

    const currentVersion = await getLatestHistoryVersion(id)
    const history = createDeviceHistory(
      device,
      ChangeType.UPDATE,
      operator.id,
      operator.displayName,
      `更新设备 ${device.deviceCode} 信息`,
      currentVersion + 1
    )
    await saveDeviceHistory(history)

    await commitTransaction()
    return device
  } catch (error) {
    await rollbackTransaction()
    throw error
  }
}

export async function lendDevice(
  deviceId: string,
  borrowerId: string,
  borrowerName: string,
  operator: User,
  expectedReturnAt?: string,
  purpose?: string
): Promise<{ device: Device; record: BorrowRecord } | null> {
  const device = await getDeviceById(deviceId)
  if (!device) return null

  if (device.status !== DeviceStatus.AVAILABLE) {
    throw new Error(`设备当前状态为 ${device.status}，无法借出`)
  }

  const now = getCurrentTimestamp()

  await beginTransaction()
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

    await run(`
      UPDATE devices SET
        status = ?, current_holder = ?, current_holder_name = ?,
        borrowed_at = ?, expected_return_at = ?, updated_at = ?
      WHERE id = ?
    `, [
      updatedDevice.status,
      updatedDevice.currentHolder,
      updatedDevice.currentHolderName,
      updatedDevice.borrowedAt,
      updatedDevice.expectedReturnAt,
      updatedDevice.updatedAt,
      updatedDevice.id
    ])

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

    await run(`
      INSERT INTO borrow_records (
        id, device_id, device_code, borrower_id, borrower_name, operator_id,
        operator_name, borrowed_at, expected_return_at, returned_at, status,
        purpose, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
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
    ])

    const currentVersion = await getLatestHistoryVersion(device.id)
    const history = createDeviceHistory(
      updatedDevice,
      ChangeType.BORROW,
      operator.id,
      operator.displayName,
      `借出设备给 ${borrowerName}`,
      currentVersion + 1
    )
    await saveDeviceHistory(history)

    await commitTransaction()
    return { device: updatedDevice, record }
  } catch (error) {
    await rollbackTransaction()
    throw error
  }
}

export async function returnDevice(
  deviceId: string,
  operator: User,
  notes?: string
): Promise<{ device: Device; record: BorrowRecord } | null> {
  const device = await getDeviceById(deviceId)
  if (!device) return null

  if (device.status !== DeviceStatus.BORROWED) {
    throw new Error(`设备当前状态为 ${device.status}，无法归还`)
  }

  const now = getCurrentTimestamp()

  const activeRecord = await get<any>(`
    SELECT * FROM borrow_records
    WHERE device_id = ? AND status = ?
    ORDER BY borrowed_at DESC
    LIMIT 1
  `, [device.id, BorrowStatus.ACTIVE])

  if (!activeRecord) {
    throw new Error('未找到活跃的借出记录')
  }

  await beginTransaction()
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

    await run(`
      UPDATE devices SET
        status = ?, current_holder = ?, current_holder_name = ?,
        borrowed_at = ?, expected_return_at = ?, updated_at = ?
      WHERE id = ?
    `, [
      updatedDevice.status,
      updatedDevice.currentHolder,
      updatedDevice.currentHolderName,
      updatedDevice.borrowedAt,
      updatedDevice.expectedReturnAt,
      updatedDevice.updatedAt,
      updatedDevice.id
    ])

    const updatedRecord: BorrowRecord = {
      ...mapBorrowRecord(activeRecord),
      returnedAt: now,
      status: BorrowStatus.RETURNED,
      notes: notes || '',
      updatedAt: now
    }

    await run(`
      UPDATE borrow_records SET
        returned_at = ?, status = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `, [
      updatedRecord.returnedAt,
      updatedRecord.status,
      updatedRecord.notes,
      updatedRecord.updatedAt,
      updatedRecord.id
    ])

    const currentVersion = await getLatestHistoryVersion(device.id)
    const history = createDeviceHistory(
      updatedDevice,
      ChangeType.RETURN,
      operator.id,
      operator.displayName,
      `归还设备，原持有人: ${device.currentHolderName}`,
      currentVersion + 1
    )
    await saveDeviceHistory(history)

    await commitTransaction()
    return { device: updatedDevice, record: updatedRecord }
  } catch (error) {
    await rollbackTransaction()
    throw error
  }
}

export async function changeDeviceStatus(
  deviceId: string,
  newStatus: DeviceStatus,
  operator: User,
  notes?: string
): Promise<Device | null> {
  const device = await getDeviceById(deviceId)
  if (!device) return null

  if (!isValidDeviceTransition(device.status, newStatus, DeviceStatusTransitions)) {
    throw new Error(`设备状态无法从 ${device.status} 转换为 ${newStatus}`)
  }

  const now = getCurrentTimestamp()

  await beginTransaction()
  try {
    const updatedDevice: Device = {
      ...device,
      status: newStatus,
      updatedAt: now
    }

    await run('UPDATE devices SET status = ?, updated_at = ? WHERE id = ?', [
      newStatus,
      now,
      device.id
    ])

    const currentVersion = await getLatestHistoryVersion(device.id)
    const changeType = newStatus === DeviceStatus.MAINTENANCE ? ChangeType.MAINTENANCE : ChangeType.UPDATE
    const history = createDeviceHistory(
      updatedDevice,
      changeType,
      operator.id,
      operator.displayName,
      notes || `设备状态从 ${device.status} 变更为 ${newStatus}`,
      currentVersion + 1
    )
    await saveDeviceHistory(history)

    await commitTransaction()
    return updatedDevice
  } catch (error) {
    await rollbackTransaction()
    throw error
  }
}

export async function deleteDevice(deviceId: string, operator: User): Promise<boolean> {
  const device = await getDeviceById(deviceId)
  if (!device) return false

  if (device.status === DeviceStatus.BORROWED) {
    throw new Error('设备已借出，无法删除')
  }

  const now = getCurrentTimestamp()

  await beginTransaction()
  try {
    await run('UPDATE devices SET is_active = 0, updated_at = ? WHERE id = ?', [
      now,
      deviceId
    ])

    const currentVersion = await getLatestHistoryVersion(deviceId)
    const history = createDeviceHistory(
      device,
      ChangeType.DELETE,
      operator.id,
      operator.displayName,
      `删除设备 ${device.deviceCode}`,
      currentVersion + 1
    )
    await saveDeviceHistory(history)

    await commitTransaction()
    return true
  } catch (error) {
    await rollbackTransaction()
    throw error
  }
}

export async function getDeviceHistory(deviceId: string): Promise<DeviceHistory[]> {
  const rows = await all<any>(`
    SELECT * FROM device_history
    WHERE device_id = ?
    ORDER BY version DESC
  `, [deviceId])
  return rows.map(mapDeviceHistory)
}

export async function restoreDeviceFromHistory(
  historyId: string,
  operator: User
): Promise<Device | null> {
  const historyRow = await get<any>('SELECT * FROM device_history WHERE id = ?', [historyId])
  if (!historyRow) return null

  const history = mapDeviceHistory(historyRow)
  const snapshotDevice = JSON.parse(history.snapshot) as Device

  const existingDevice = await getDeviceById(history.deviceId)
  if (!existingDevice) return null

  const now = getCurrentTimestamp()

  await beginTransaction()
  try {
    const restoredDevice: Device = {
      ...snapshotDevice,
      updatedAt: now,
      isActive: true
    }

    await run(`
      UPDATE devices SET
        name = ?, category = ?, model = ?, serial_number = ?, status = ?,
        location = ?, description = ?, current_holder = ?, current_holder_name = ?,
        borrowed_at = ?, expected_return_at = ?, updated_at = ?
      WHERE id = ?
    `, [
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
    ])

    const currentVersion = await getLatestHistoryVersion(history.deviceId)
    const newHistory = createDeviceHistory(
      restoredDevice,
      ChangeType.RESTORE,
      operator.id,
      operator.displayName,
      `从版本 ${history.version} 恢复设备`,
      currentVersion + 1
    )
    await saveDeviceHistory(newHistory)

    await commitTransaction()
    return restoredDevice
  } catch (error) {
    await rollbackTransaction()
    throw error
  }
}

export async function getBorrowRecords(
  params: PaginationParams & { status?: BorrowStatus; deviceId?: string; borrowerId?: string }
): Promise<PaginatedResult<BorrowRecord>> {
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

  const countRow = await get<any>(`SELECT COUNT(*) as count FROM borrow_records ${whereSql}`, whereParams)
  const total = countRow?.count || 0

  const offset = (page - 1) * pageSize
  const rows = await all<any>(
    `SELECT * FROM borrow_records ${whereSql} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
    [...whereParams, pageSize, offset]
  )

  return {
    items: rows.map(mapBorrowRecord),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  }
}

async function getLatestHistoryVersion(deviceId: string): Promise<number> {
  const result = await get<any>(`
    SELECT MAX(version) as max_version FROM device_history WHERE device_id = ?
  `, [deviceId])
  return result?.max_version || 0
}

async function saveDeviceHistory(history: DeviceHistory): Promise<void> {
  await run(`
    INSERT INTO device_history (
      id, device_id, version, snapshot, changed_at, changed_by,
      changed_by_name, change_type, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    history.id,
    history.deviceId,
    history.version,
    history.snapshot,
    history.changedAt,
    history.changedBy,
    history.changedByName,
    history.changeType,
    history.description
  ])
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

import { v4 as uuidv4 } from 'uuid'
import { db } from '../database'
import { ConflictError, NotFoundError, ValidationError } from '../middleware/error'
import type { Device, DeviceStatus, PaginatedResponse } from '../../shared/types'
import { createAuditLog } from './audit'

interface DbDevice {
  id: string
  name: string
  code: string
  type: string
  model?: string
  serial_number?: string
  status: string
  current_borrower_id?: string
  current_borrower_name?: string
  description?: string
  created_at: string
  updated_at: string
}

interface CreateDeviceParams {
  name: string
  code: string
  type: string
  model?: string
  serialNumber?: string
  description?: string
  operatorId: string
  operatorName: string
  requestId: string
  ip?: string
  userAgent?: string
}

export async function createDevice(params: CreateDeviceParams): Promise<Device> {
  if (!params.name?.trim()) {
    throw new ValidationError('设备名称不能为空', { field: 'name' }, params.requestId)
  }
  if (!params.code?.trim()) {
    throw new ValidationError('设备编号不能为空', { field: 'code' }, params.requestId)
  }
  if (!params.type?.trim()) {
    throw new ValidationError('设备类型不能为空', { field: 'type' }, params.requestId)
  }

  const existing = await db.get(
    'SELECT id FROM devices WHERE code = ?',
    [params.code]
  )
  if (existing) {
    throw new ConflictError('设备编号已存在', { code: params.code }, params.requestId)
  }

  const now = new Date().toISOString()
  const deviceId = uuidv4()

  const device: DbDevice = {
    id: deviceId,
    name: params.name,
    code: params.code,
    type: params.type,
    model: params.model,
    serial_number: params.serialNumber,
    status: 'available',
    description: params.description,
    created_at: now,
    updated_at: now
  }

  await db.run(
    `INSERT INTO devices (
      id, name, code, type, model, serial_number, status, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      device.id, device.name, device.code, device.type, device.model, device.serial_number,
      device.status, device.description, device.created_at, device.updated_at
    ]
  )

  const mappedDevice = mapDbDevice(device)
  await createAuditLog({
    action: 'create',
    entityType: 'device',
    entityId: device.id,
    entityName: device.name,
    operatorId: params.operatorId,
    operatorName: params.operatorName,
    after: mappedDevice,
    requestId: params.requestId,
    ip: params.ip,
    userAgent: params.userAgent
  })

  return mappedDevice
}

interface UpdateDeviceParams {
  id: string
  name?: string
  code?: string
  type?: string
  model?: string
  serialNumber?: string
  description?: string
  status?: DeviceStatus
  operatorId: string
  operatorName: string
  requestId: string
  ip?: string
  userAgent?: string
}

export async function updateDevice(params: UpdateDeviceParams): Promise<Device> {
  const existing = await db.get<DbDevice>(
    'SELECT * FROM devices WHERE id = ?',
    [params.id]
  )

  if (!existing) {
    throw new NotFoundError('设备不存在', { deviceId: params.id }, params.requestId)
  }

  if (params.code && params.code !== existing.code) {
    const conflict = await db.get(
      'SELECT id FROM devices WHERE code = ? AND id != ?',
      [params.code, params.id]
    )
    if (conflict) {
      throw new ConflictError('设备编号已被其他设备使用', { code: params.code }, params.requestId)
    }
  }

  const now = new Date().toISOString()
  const originalDevice = mapDbDevice(existing)

  const updates: string[] = []
  const updateParams: any[] = []

  if (params.name !== undefined) {
    updates.push('name = ?')
    updateParams.push(params.name)
  }
  if (params.code !== undefined) {
    updates.push('code = ?')
    updateParams.push(params.code)
  }
  if (params.type !== undefined) {
    updates.push('type = ?')
    updateParams.push(params.type)
  }
  if (params.model !== undefined) {
    updates.push('model = ?')
    updateParams.push(params.model)
  }
  if (params.serialNumber !== undefined) {
    updates.push('serial_number = ?')
    updateParams.push(params.serialNumber)
  }
  if (params.description !== undefined) {
    updates.push('description = ?')
    updateParams.push(params.description)
  }
  if (params.status !== undefined) {
    if (existing.status === 'borrowed' && params.status !== 'borrowed') {
      throw new ConflictError(
        '设备当前已借出，无法修改状态',
        { currentStatus: existing.status, requestedStatus: params.status },
        params.requestId
      )
    }
    updates.push('status = ?')
    updateParams.push(params.status)
  }

  if (updates.length === 0) {
    return originalDevice
  }

  updates.push('updated_at = ?')
  updateParams.push(now, params.id)

  await db.run(
    `UPDATE devices SET ${updates.join(', ')} WHERE id = ?`,
    updateParams
  )

  const updated = await db.get<DbDevice>(
    'SELECT * FROM devices WHERE id = ?',
    [params.id]
  )

  const updatedDevice = updated ? mapDbDevice(updated) : originalDevice

  await createAuditLog({
    action: params.status && params.status !== existing.status ? 'status_change' : 'update',
    entityType: 'device',
    entityId: params.id,
    entityName: existing.name,
    operatorId: params.operatorId,
    operatorName: params.operatorName,
    before: originalDevice,
    after: updatedDevice,
    requestId: params.requestId,
    ip: params.ip,
    userAgent: params.userAgent
  })

  return updatedDevice
}

export async function deleteDevice(
  id: string,
  operatorId: string,
  operatorName: string,
  requestId: string,
  ip?: string,
  userAgent?: string
): Promise<void> {
  const existing = await db.get<DbDevice>(
    'SELECT * FROM devices WHERE id = ?',
    [id]
  )

  if (!existing) {
    throw new NotFoundError('设备不存在', { deviceId: id }, requestId)
  }

  if (existing.status === 'borrowed') {
    throw new ConflictError(
      '设备当前已借出，无法删除',
      { deviceId: id, status: existing.status },
      requestId
    )
  }

  await createAuditLog({
    action: 'delete',
    entityType: 'device',
    entityId: id,
    entityName: existing.name,
    operatorId,
    operatorName,
    before: mapDbDevice(existing),
    requestId,
    ip,
    userAgent
  })

  await db.run('DELETE FROM devices WHERE id = ?', [id])
}

export async function getDeviceById(id: string): Promise<Device | undefined> {
  const row = await db.get<DbDevice>(
    'SELECT * FROM devices WHERE id = ?',
    [id]
  )
  return row ? mapDbDevice(row) : undefined
}

export async function getDevices(params: {
  page: number
  pageSize: number
  status?: DeviceStatus
  type?: string
  search?: string
}): Promise<PaginatedResponse<Device>> {
  const conditions: string[] = []
  const queryParams: any[] = []

  if (params.status) {
    conditions.push('status = ?')
    queryParams.push(params.status)
  }
  if (params.type) {
    conditions.push('type = ?')
    queryParams.push(params.type)
  }
  if (params.search) {
    conditions.push('(name LIKE ? OR code LIKE ? OR serial_number LIKE ?)')
    const searchTerm = `%${params.search}%`
    queryParams.push(searchTerm, searchTerm, searchTerm)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countResult = await db.get<{ total: number }>(
    `SELECT COUNT(*) as total FROM devices ${whereClause}`,
    queryParams
  )

  const total = countResult?.total || 0
  const offset = (params.page - 1) * params.pageSize

  const rows = await db.all<DbDevice>(
    `SELECT * FROM devices ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...queryParams, params.pageSize, offset]
  )

  return {
    items: rows.map(mapDbDevice),
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize)
  }
}

function mapDbDevice(row: DbDevice): Device {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    type: row.type,
    model: row.model,
    serialNumber: row.serial_number,
    status: row.status as DeviceStatus,
    currentBorrowerId: row.current_borrower_id,
    currentBorrowerName: row.current_borrower_name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

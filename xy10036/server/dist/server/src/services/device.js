"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDevice = createDevice;
exports.updateDevice = updateDevice;
exports.deleteDevice = deleteDevice;
exports.getDeviceById = getDeviceById;
exports.getDevices = getDevices;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const error_1 = require("../middleware/error");
const audit_1 = require("./audit");
async function createDevice(params) {
    if (!params.name?.trim()) {
        throw new error_1.ValidationError('设备名称不能为空', { field: 'name' }, params.requestId);
    }
    if (!params.code?.trim()) {
        throw new error_1.ValidationError('设备编号不能为空', { field: 'code' }, params.requestId);
    }
    if (!params.type?.trim()) {
        throw new error_1.ValidationError('设备类型不能为空', { field: 'type' }, params.requestId);
    }
    const existing = await database_1.db.get('SELECT id FROM devices WHERE code = ?', [params.code]);
    if (existing) {
        throw new error_1.ConflictError('设备编号已存在', { code: params.code }, params.requestId);
    }
    const now = new Date().toISOString();
    const deviceId = (0, uuid_1.v4)();
    const device = {
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
    };
    await database_1.db.run(`INSERT INTO devices (
      id, name, code, type, model, serial_number, status, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        device.id, device.name, device.code, device.type, device.model, device.serial_number,
        device.status, device.description, device.created_at, device.updated_at
    ]);
    const mappedDevice = mapDbDevice(device);
    await (0, audit_1.createAuditLog)({
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
    });
    return mappedDevice;
}
async function updateDevice(params) {
    const existing = await database_1.db.get('SELECT * FROM devices WHERE id = ?', [params.id]);
    if (!existing) {
        throw new error_1.NotFoundError('设备不存在', { deviceId: params.id }, params.requestId);
    }
    if (params.code && params.code !== existing.code) {
        const conflict = await database_1.db.get('SELECT id FROM devices WHERE code = ? AND id != ?', [params.code, params.id]);
        if (conflict) {
            throw new error_1.ConflictError('设备编号已被其他设备使用', { code: params.code }, params.requestId);
        }
    }
    const now = new Date().toISOString();
    const originalDevice = mapDbDevice(existing);
    const updates = [];
    const updateParams = [];
    if (params.name !== undefined) {
        updates.push('name = ?');
        updateParams.push(params.name);
    }
    if (params.code !== undefined) {
        updates.push('code = ?');
        updateParams.push(params.code);
    }
    if (params.type !== undefined) {
        updates.push('type = ?');
        updateParams.push(params.type);
    }
    if (params.model !== undefined) {
        updates.push('model = ?');
        updateParams.push(params.model);
    }
    if (params.serialNumber !== undefined) {
        updates.push('serial_number = ?');
        updateParams.push(params.serialNumber);
    }
    if (params.description !== undefined) {
        updates.push('description = ?');
        updateParams.push(params.description);
    }
    if (params.status !== undefined) {
        if (existing.status === 'borrowed' && params.status !== 'borrowed') {
            throw new error_1.ConflictError('设备当前已借出，无法修改状态', { currentStatus: existing.status, requestedStatus: params.status }, params.requestId);
        }
        updates.push('status = ?');
        updateParams.push(params.status);
    }
    if (updates.length === 0) {
        return originalDevice;
    }
    updates.push('updated_at = ?');
    updateParams.push(now, params.id);
    await database_1.db.run(`UPDATE devices SET ${updates.join(', ')} WHERE id = ?`, updateParams);
    const updated = await database_1.db.get('SELECT * FROM devices WHERE id = ?', [params.id]);
    const updatedDevice = updated ? mapDbDevice(updated) : originalDevice;
    await (0, audit_1.createAuditLog)({
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
    });
    return updatedDevice;
}
async function deleteDevice(id, operatorId, operatorName, requestId, ip, userAgent) {
    const existing = await database_1.db.get('SELECT * FROM devices WHERE id = ?', [id]);
    if (!existing) {
        throw new error_1.NotFoundError('设备不存在', { deviceId: id }, requestId);
    }
    if (existing.status === 'borrowed') {
        throw new error_1.ConflictError('设备当前已借出，无法删除', { deviceId: id, status: existing.status }, requestId);
    }
    await (0, audit_1.createAuditLog)({
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
    });
    await database_1.db.run('DELETE FROM devices WHERE id = ?', [id]);
}
async function getDeviceById(id) {
    const row = await database_1.db.get('SELECT * FROM devices WHERE id = ?', [id]);
    return row ? mapDbDevice(row) : undefined;
}
async function getDevices(params) {
    const conditions = [];
    const queryParams = [];
    if (params.status) {
        conditions.push('status = ?');
        queryParams.push(params.status);
    }
    if (params.type) {
        conditions.push('type = ?');
        queryParams.push(params.type);
    }
    if (params.search) {
        conditions.push('(name LIKE ? OR code LIKE ? OR serial_number LIKE ?)');
        const searchTerm = `%${params.search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await database_1.db.get(`SELECT COUNT(*) as total FROM devices ${whereClause}`, queryParams);
    const total = countResult?.total || 0;
    const offset = (params.page - 1) * params.pageSize;
    const rows = await database_1.db.all(`SELECT * FROM devices ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...queryParams, params.pageSize, offset]);
    return {
        items: rows.map(mapDbDevice),
        total,
        page: params.page,
        pageSize: params.pageSize,
        totalPages: Math.ceil(total / params.pageSize)
    };
}
function mapDbDevice(row) {
    return {
        id: row.id,
        name: row.name,
        code: row.code,
        type: row.type,
        model: row.model,
        serialNumber: row.serial_number,
        status: row.status,
        currentBorrowerId: row.current_borrower_id,
        currentBorrowerName: row.current_borrower_name,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}
//# sourceMappingURL=device.js.map
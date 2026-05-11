"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.borrowDevice = borrowDevice;
exports.returnDevice = returnDevice;
exports.getBorrowRecords = getBorrowRecords;
exports.getBorrowRecordById = getBorrowRecordById;
exports.getBorrowRecordsForReport = getBorrowRecordsForReport;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const error_1 = require("../middleware/error");
const audit_1 = require("./audit");
const deviceLocks = new Map();
async function withDeviceLock(deviceId, operation) {
    let previousLock = deviceLocks.get(deviceId);
    const newLock = (async () => {
        if (previousLock) {
            try {
                await previousLock;
            }
            catch {
            }
        }
        return await operation();
    })();
    deviceLocks.set(deviceId, newLock);
    try {
        return await newLock;
    }
    finally {
        if (deviceLocks.get(deviceId) === newLock) {
            deviceLocks.delete(deviceId);
        }
    }
}
async function executeInTransaction(executor) {
    await database_1.db.run('BEGIN TRANSACTION');
    try {
        const result = await executor();
        await database_1.db.run('COMMIT');
        return result;
    }
    catch (error) {
        try {
            await database_1.db.run('ROLLBACK');
        }
        catch {
        }
        throw error;
    }
}
async function borrowDevice(params) {
    if (!params.deviceId) {
        throw new error_1.ValidationError('设备ID不能为空', { field: 'deviceId' }, params.requestId);
    }
    if (!params.purpose?.trim()) {
        throw new error_1.ValidationError('借用用途不能为空', { field: 'purpose' }, params.requestId);
    }
    if (!params.expectedReturnTime) {
        throw new error_1.ValidationError('预计归还时间不能为空', { field: 'expectedReturnTime' }, params.requestId);
    }
    const preCheckDevice = await database_1.db.get('SELECT * FROM devices WHERE id = ?', [params.deviceId]);
    if (!preCheckDevice) {
        throw new error_1.NotFoundError('设备不存在', { deviceId: params.deviceId }, params.requestId);
    }
    if (preCheckDevice.status !== 'available') {
        throw new error_1.ConflictError('设备当前不可用', { deviceId: params.deviceId, currentStatus: preCheckDevice.status }, params.requestId);
    }
    const result = await withDeviceLock(params.deviceId, async () => {
        return await executeInTransaction(async () => {
            const device = await database_1.db.get('SELECT * FROM devices WHERE id = ?', [params.deviceId]);
            if (!device) {
                throw new error_1.NotFoundError('设备不存在', { deviceId: params.deviceId }, params.requestId);
            }
            if (device.status !== 'available') {
                throw new error_1.ConflictError('设备状态已被其他操作修改，请刷新后重试', { deviceId: params.deviceId }, params.requestId);
            }
            const now = new Date().toISOString();
            const borrowRecordId = (0, uuid_1.v4)();
            const borrowRecord = {
                id: borrowRecordId,
                device_id: device.id,
                device_name: device.name,
                device_code: device.code,
                user_id: params.userId,
                user_name: params.userName,
                purpose: params.purpose,
                borrow_time: now,
                expected_return_time: params.expectedReturnTime,
                status: 'borrowed',
                version: 1,
                created_at: now,
                updated_at: now
            };
            const deviceResult = await database_1.db.run(`UPDATE devices 
         SET status = 'borrowed', 
             current_borrower_id = ?, 
             current_borrower_name = ?, 
             updated_at = ? 
         WHERE id = ? AND status = 'available'`, [params.userId, params.userName, now, device.id]);
            if (deviceResult.changes === 0) {
                throw new error_1.ConflictError('设备状态已被其他操作修改，请刷新后重试', { deviceId: device.id }, params.requestId);
            }
            await database_1.db.run(`INSERT INTO borrow_records (
          id, device_id, device_name, device_code, user_id, user_name,
          purpose, borrow_time, expected_return_time, status, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                borrowRecord.id, borrowRecord.device_id, borrowRecord.device_name, borrowRecord.device_code,
                borrowRecord.user_id, borrowRecord.user_name, borrowRecord.purpose, borrowRecord.borrow_time,
                borrowRecord.expected_return_time, borrowRecord.status, borrowRecord.version,
                borrowRecord.created_at, borrowRecord.updated_at
            ]);
            return {
                borrowRecord,
                originalDevice: device,
                updatedAt: now
            };
        });
    });
    const originalDevice = mapDbDevice(result.originalDevice);
    const updatedDevice = {
        ...originalDevice,
        status: 'borrowed',
        currentBorrowerId: params.userId,
        currentBorrowerName: params.userName,
        updatedAt: result.updatedAt
    };
    await (0, audit_1.createAuditLog)({
        action: 'borrow',
        entityType: 'device',
        entityId: result.originalDevice.id,
        entityName: result.originalDevice.name,
        operatorId: params.userId,
        operatorName: params.userName,
        before: originalDevice,
        after: updatedDevice,
        requestId: params.requestId,
        ip: params.ip,
        userAgent: params.userAgent
    });
    const mappedRecord = mapDbBorrowRecord(result.borrowRecord);
    await (0, audit_1.createAuditLog)({
        action: 'create',
        entityType: 'borrow_record',
        entityId: result.borrowRecord.id,
        entityName: `${result.originalDevice.name} - ${params.userName}`,
        operatorId: params.userId,
        operatorName: params.userName,
        after: mappedRecord,
        requestId: params.requestId,
        ip: params.ip,
        userAgent: params.userAgent
    });
    return mappedRecord;
}
async function returnDevice(params) {
    const preCheckRecord = await database_1.db.get('SELECT * FROM borrow_records WHERE id = ?', [params.borrowRecordId]);
    if (!preCheckRecord) {
        throw new error_1.NotFoundError('借用记录不存在', { borrowRecordId: params.borrowRecordId }, params.requestId);
    }
    if (preCheckRecord.status !== 'borrowed') {
        throw new error_1.ConflictError('该借用记录状态不允许归还', { borrowRecordId: params.borrowRecordId, currentStatus: preCheckRecord.status }, params.requestId);
    }
    if (params.version !== undefined && params.version !== preCheckRecord.version) {
        throw new error_1.OptimisticLockError('数据已被其他操作修改，请刷新后重试', {
            borrowRecordId: params.borrowRecordId,
            expectedVersion: params.version,
            actualVersion: preCheckRecord.version
        }, params.requestId);
    }
    const originalRecord = mapDbBorrowRecord(preCheckRecord);
    const result = await withDeviceLock(preCheckRecord.device_id, async () => {
        return await executeInTransaction(async () => {
            const borrowRecord = await database_1.db.get('SELECT * FROM borrow_records WHERE id = ?', [params.borrowRecordId]);
            if (!borrowRecord) {
                throw new error_1.NotFoundError('借用记录不存在', { borrowRecordId: params.borrowRecordId }, params.requestId);
            }
            if (borrowRecord.status !== 'borrowed') {
                throw new error_1.ConflictError('借用记录状态已被其他操作修改，请刷新后重试', { borrowRecordId: params.borrowRecordId }, params.requestId);
            }
            const now = new Date().toISOString();
            const deviceResult = await database_1.db.run(`UPDATE devices 
         SET status = 'available', 
             current_borrower_id = NULL, 
             current_borrower_name = NULL, 
             updated_at = ? 
         WHERE id = ? AND status = 'borrowed'`, [now, borrowRecord.device_id]);
            if (deviceResult.changes === 0) {
                throw new error_1.ConflictError('设备状态已被其他操作修改，请刷新后重试', { deviceId: borrowRecord.device_id }, params.requestId);
            }
            const recordResult = await database_1.db.run(`UPDATE borrow_records 
         SET status = 'returned', 
             actual_return_time = ?, 
             notes = COALESCE(?, notes),
             version = version + 1,
             updated_at = ? 
         WHERE id = ? AND status = 'borrowed'`, [now, params.notes, now, params.borrowRecordId]);
            if (recordResult.changes === 0) {
                throw new error_1.ConflictError('借用记录状态已被其他操作修改，请刷新后重试', { borrowRecordId: params.borrowRecordId }, params.requestId);
            }
            const updatedRecord = await database_1.db.get('SELECT * FROM borrow_records WHERE id = ?', [params.borrowRecordId]);
            return updatedRecord;
        });
    });
    const device = await database_1.db.get('SELECT * FROM devices WHERE id = ?', [preCheckRecord.device_id]);
    if (device) {
        await (0, audit_1.createAuditLog)({
            action: 'return',
            entityType: 'device',
            entityId: device.id,
            entityName: device.name,
            operatorId: params.userId,
            operatorName: params.userName,
            before: {
                ...mapDbDevice(device),
                status: 'borrowed'
            },
            after: mapDbDevice(device),
            requestId: params.requestId,
            ip: params.ip,
            userAgent: params.userAgent
        });
    }
    if (result) {
        await (0, audit_1.createAuditLog)({
            action: 'update',
            entityType: 'borrow_record',
            entityId: result.id,
            entityName: `${result.device_name} - ${result.user_name}`,
            operatorId: params.userId,
            operatorName: params.userName,
            before: originalRecord,
            after: mapDbBorrowRecord(result),
            requestId: params.requestId,
            ip: params.ip,
            userAgent: params.userAgent
        });
        return mapDbBorrowRecord(result);
    }
    throw new error_1.NotFoundError('归还后记录不存在', { borrowRecordId: params.borrowRecordId }, params.requestId);
}
async function getBorrowRecords(params) {
    const conditions = [];
    const queryParams = [];
    if (params.status) {
        conditions.push('status = ?');
        queryParams.push(params.status);
    }
    if (params.deviceId) {
        conditions.push('device_id = ?');
        queryParams.push(params.deviceId);
    }
    if (params.userId) {
        conditions.push('user_id = ?');
        queryParams.push(params.userId);
    }
    if (params.startTime) {
        conditions.push('borrow_time >= ?');
        queryParams.push(params.startTime);
    }
    if (params.endTime) {
        conditions.push('borrow_time <= ?');
        queryParams.push(params.endTime);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await database_1.db.get(`SELECT COUNT(*) as total FROM borrow_records ${whereClause}`, queryParams);
    const total = countResult?.total || 0;
    const offset = (params.page - 1) * params.pageSize;
    const rows = await database_1.db.all(`SELECT * FROM borrow_records ${whereClause} ORDER BY borrow_time DESC LIMIT ? OFFSET ?`, [...queryParams, params.pageSize, offset]);
    return {
        items: rows.map(mapDbBorrowRecord),
        total,
        page: params.page,
        pageSize: params.pageSize,
        totalPages: Math.ceil(total / params.pageSize)
    };
}
async function getBorrowRecordById(id) {
    const row = await database_1.db.get('SELECT * FROM borrow_records WHERE id = ?', [id]);
    return row ? mapDbBorrowRecord(row) : undefined;
}
async function getBorrowRecordsForReport(filters) {
    const conditions = [];
    const params = [];
    if (filters.startDate) {
        conditions.push('borrow_time >= ?');
        params.push(filters.startDate);
    }
    if (filters.endDate) {
        conditions.push('borrow_time <= ?');
        params.push(filters.endDate);
    }
    if (filters.deviceId) {
        conditions.push('device_id = ?');
        params.push(filters.deviceId);
    }
    if (filters.userId) {
        conditions.push('user_id = ?');
        params.push(filters.userId);
    }
    if (filters.status) {
        conditions.push('status = ?');
        params.push(filters.status);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await database_1.db.all(`SELECT * FROM borrow_records ${whereClause} ORDER BY borrow_time DESC`, params);
    return rows.map(mapDbBorrowRecord);
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
function mapDbBorrowRecord(row) {
    return {
        id: row.id,
        deviceId: row.device_id,
        deviceName: row.device_name,
        deviceCode: row.device_code,
        userId: row.user_id,
        userName: row.user_name,
        purpose: row.purpose,
        borrowTime: row.borrow_time,
        expectedReturnTime: row.expected_return_time,
        actualReturnTime: row.actual_return_time,
        status: row.status,
        notes: row.notes,
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}
//# sourceMappingURL=borrow.js.map
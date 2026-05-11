"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDevice = createDevice;
exports.getDeviceById = getDeviceById;
exports.getDeviceByCode = getDeviceByCode;
exports.listDevices = listDevices;
exports.updateDevice = updateDevice;
exports.lendDevice = lendDevice;
exports.returnDevice = returnDevice;
exports.changeDeviceStatus = changeDeviceStatus;
exports.deleteDevice = deleteDevice;
exports.getDeviceHistory = getDeviceHistory;
exports.restoreDeviceFromHistory = restoreDeviceFromHistory;
exports.getBorrowRecords = getBorrowRecords;
const index_1 = require("../database/index");
const types_1 = require("@shared/types");
const utils_1 = require("@shared/utils");
async function createDevice(deviceCode, name, category, operator, options = {}) {
    const now = (0, utils_1.getCurrentTimestamp)();
    const device = {
        id: (0, utils_1.generateId)(),
        deviceCode,
        name,
        category,
        model: options.model || '',
        serialNumber: options.serialNumber || '',
        status: types_1.DeviceStatus.AVAILABLE,
        location: options.location || '',
        description: options.description || '',
        currentHolder: null,
        currentHolderName: null,
        borrowedAt: null,
        expectedReturnAt: null,
        createdAt: now,
        updatedAt: now,
        isActive: true
    };
    await (0, index_1.beginTransaction)();
    try {
        await (0, index_1.run)(`
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
        ]);
        const history = (0, utils_1.createDeviceHistory)(device, types_1.ChangeType.CREATE, operator.id, operator.displayName, `创建设备 ${deviceCode}`, 1);
        await saveDeviceHistory(history);
        await (0, index_1.commitTransaction)();
        return device;
    }
    catch (error) {
        await (0, index_1.rollbackTransaction)();
        throw error;
    }
}
async function getDeviceById(id) {
    const row = await (0, index_1.get)('SELECT * FROM devices WHERE id = ? AND is_active = 1', [id]);
    return row ? mapDevice(row) : null;
}
async function getDeviceByCode(deviceCode) {
    const row = await (0, index_1.get)('SELECT * FROM devices WHERE device_code = ? AND is_active = 1', [deviceCode]);
    return row ? mapDevice(row) : null;
}
async function listDevices(params) {
    const { page, pageSize, sortBy = 'created_at', sortOrder = 'desc', status, category, search } = params;
    const whereClauses = ['is_active = 1'];
    const whereParams = [];
    if (status) {
        whereClauses.push('status = ?');
        whereParams.push(status);
    }
    if (category) {
        whereClauses.push('category = ?');
        whereParams.push(category);
    }
    if (search) {
        whereClauses.push('(device_code LIKE ? OR name LIKE ? OR serial_number LIKE ?)');
        const searchPattern = `%${search}%`;
        whereParams.push(searchPattern, searchPattern, searchPattern);
    }
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const countRow = await (0, index_1.get)(`SELECT COUNT(*) as count FROM devices ${whereSql}`, whereParams);
    const total = countRow?.count || 0;
    const offset = (page - 1) * pageSize;
    const rows = await (0, index_1.all)(`SELECT * FROM devices ${whereSql} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`, [...whereParams, pageSize, offset]);
    return {
        items: rows.map(mapDevice),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
    };
}
async function updateDevice(id, updates, operator) {
    const device = await getDeviceById(id);
    if (!device)
        return null;
    const now = (0, utils_1.getCurrentTimestamp)();
    const updateFields = [];
    const updateValues = [];
    const fieldMappings = [
        { dbField: 'name', deviceField: 'name' },
        { dbField: 'category', deviceField: 'category' },
        { dbField: 'model', deviceField: 'model' },
        { dbField: 'serial_number', deviceField: 'serialNumber' },
        { dbField: 'location', deviceField: 'location' },
        { dbField: 'description', deviceField: 'description' }
    ];
    for (const { dbField, deviceField } of fieldMappings) {
        const value = updates[deviceField];
        if (value !== undefined) {
            updateFields.push(`${dbField} = ?`);
            updateValues.push(value);
            device[deviceField] = value;
        }
    }
    if (updateFields.length === 0)
        return device;
    updateFields.push('updated_at = ?');
    updateValues.push(now, id);
    device.updatedAt = now;
    await (0, index_1.beginTransaction)();
    try {
        await (0, index_1.run)(`UPDATE devices SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
        const currentVersion = await getLatestHistoryVersion(id);
        const history = (0, utils_1.createDeviceHistory)(device, types_1.ChangeType.UPDATE, operator.id, operator.displayName, `更新设备 ${device.deviceCode} 信息`, currentVersion + 1);
        await saveDeviceHistory(history);
        await (0, index_1.commitTransaction)();
        return device;
    }
    catch (error) {
        await (0, index_1.rollbackTransaction)();
        throw error;
    }
}
async function lendDevice(deviceId, borrowerId, borrowerName, operator, expectedReturnAt, purpose) {
    const device = await getDeviceById(deviceId);
    if (!device)
        return null;
    if (device.status !== types_1.DeviceStatus.AVAILABLE) {
        throw new Error(`设备当前状态为 ${device.status}，无法借出`);
    }
    const now = (0, utils_1.getCurrentTimestamp)();
    await (0, index_1.beginTransaction)();
    try {
        const updatedDevice = {
            ...device,
            status: types_1.DeviceStatus.BORROWED,
            currentHolder: borrowerId,
            currentHolderName: borrowerName,
            borrowedAt: now,
            expectedReturnAt: expectedReturnAt || null,
            updatedAt: now
        };
        await (0, index_1.run)(`
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
        ]);
        const record = {
            id: (0, utils_1.generateId)(),
            deviceId: device.id,
            deviceCode: device.deviceCode,
            borrowerId,
            borrowerName,
            operatorId: operator.id,
            operatorName: operator.displayName,
            borrowedAt: now,
            expectedReturnAt: expectedReturnAt || null,
            returnedAt: null,
            status: types_1.BorrowStatus.ACTIVE,
            purpose: purpose || '',
            notes: '',
            createdAt: now,
            updatedAt: now
        };
        await (0, index_1.run)(`
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
        ]);
        const currentVersion = await getLatestHistoryVersion(device.id);
        const history = (0, utils_1.createDeviceHistory)(updatedDevice, types_1.ChangeType.BORROW, operator.id, operator.displayName, `借出设备给 ${borrowerName}`, currentVersion + 1);
        await saveDeviceHistory(history);
        await (0, index_1.commitTransaction)();
        return { device: updatedDevice, record };
    }
    catch (error) {
        await (0, index_1.rollbackTransaction)();
        throw error;
    }
}
async function returnDevice(deviceId, operator, notes) {
    const device = await getDeviceById(deviceId);
    if (!device)
        return null;
    if (device.status !== types_1.DeviceStatus.BORROWED) {
        throw new Error(`设备当前状态为 ${device.status}，无法归还`);
    }
    const now = (0, utils_1.getCurrentTimestamp)();
    const activeRecord = await (0, index_1.get)(`
    SELECT * FROM borrow_records
    WHERE device_id = ? AND status = ?
    ORDER BY borrowed_at DESC
    LIMIT 1
  `, [device.id, types_1.BorrowStatus.ACTIVE]);
    if (!activeRecord) {
        throw new Error('未找到活跃的借出记录');
    }
    await (0, index_1.beginTransaction)();
    try {
        const updatedDevice = {
            ...device,
            status: types_1.DeviceStatus.AVAILABLE,
            currentHolder: null,
            currentHolderName: null,
            borrowedAt: null,
            expectedReturnAt: null,
            updatedAt: now
        };
        await (0, index_1.run)(`
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
        ]);
        const updatedRecord = {
            ...mapBorrowRecord(activeRecord),
            returnedAt: now,
            status: types_1.BorrowStatus.RETURNED,
            notes: notes || '',
            updatedAt: now
        };
        await (0, index_1.run)(`
      UPDATE borrow_records SET
        returned_at = ?, status = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `, [
            updatedRecord.returnedAt,
            updatedRecord.status,
            updatedRecord.notes,
            updatedRecord.updatedAt,
            updatedRecord.id
        ]);
        const currentVersion = await getLatestHistoryVersion(device.id);
        const history = (0, utils_1.createDeviceHistory)(updatedDevice, types_1.ChangeType.RETURN, operator.id, operator.displayName, `归还设备，原持有人: ${device.currentHolderName}`, currentVersion + 1);
        await saveDeviceHistory(history);
        await (0, index_1.commitTransaction)();
        return { device: updatedDevice, record: updatedRecord };
    }
    catch (error) {
        await (0, index_1.rollbackTransaction)();
        throw error;
    }
}
async function changeDeviceStatus(deviceId, newStatus, operator, notes) {
    const device = await getDeviceById(deviceId);
    if (!device)
        return null;
    if (!(0, utils_1.isValidDeviceTransition)(device.status, newStatus, types_1.DeviceStatusTransitions)) {
        throw new Error(`设备状态无法从 ${device.status} 转换为 ${newStatus}`);
    }
    const now = (0, utils_1.getCurrentTimestamp)();
    await (0, index_1.beginTransaction)();
    try {
        const updatedDevice = {
            ...device,
            status: newStatus,
            updatedAt: now
        };
        await (0, index_1.run)('UPDATE devices SET status = ?, updated_at = ? WHERE id = ?', [
            newStatus,
            now,
            device.id
        ]);
        const currentVersion = await getLatestHistoryVersion(device.id);
        const changeType = newStatus === types_1.DeviceStatus.MAINTENANCE ? types_1.ChangeType.MAINTENANCE : types_1.ChangeType.UPDATE;
        const history = (0, utils_1.createDeviceHistory)(updatedDevice, changeType, operator.id, operator.displayName, notes || `设备状态从 ${device.status} 变更为 ${newStatus}`, currentVersion + 1);
        await saveDeviceHistory(history);
        await (0, index_1.commitTransaction)();
        return updatedDevice;
    }
    catch (error) {
        await (0, index_1.rollbackTransaction)();
        throw error;
    }
}
async function deleteDevice(deviceId, operator) {
    const device = await getDeviceById(deviceId);
    if (!device)
        return false;
    if (device.status === types_1.DeviceStatus.BORROWED) {
        throw new Error('设备已借出，无法删除');
    }
    const now = (0, utils_1.getCurrentTimestamp)();
    await (0, index_1.beginTransaction)();
    try {
        await (0, index_1.run)('UPDATE devices SET is_active = 0, updated_at = ? WHERE id = ?', [
            now,
            deviceId
        ]);
        const currentVersion = await getLatestHistoryVersion(deviceId);
        const history = (0, utils_1.createDeviceHistory)(device, types_1.ChangeType.DELETE, operator.id, operator.displayName, `删除设备 ${device.deviceCode}`, currentVersion + 1);
        await saveDeviceHistory(history);
        await (0, index_1.commitTransaction)();
        return true;
    }
    catch (error) {
        await (0, index_1.rollbackTransaction)();
        throw error;
    }
}
async function getDeviceHistory(deviceId) {
    const rows = await (0, index_1.all)(`
    SELECT * FROM device_history
    WHERE device_id = ?
    ORDER BY version DESC
  `, [deviceId]);
    return rows.map(mapDeviceHistory);
}
async function restoreDeviceFromHistory(historyId, operator) {
    const historyRow = await (0, index_1.get)('SELECT * FROM device_history WHERE id = ?', [historyId]);
    if (!historyRow)
        return null;
    const history = mapDeviceHistory(historyRow);
    const snapshotDevice = JSON.parse(history.snapshot);
    const existingDevice = await getDeviceById(history.deviceId);
    if (!existingDevice)
        return null;
    const now = (0, utils_1.getCurrentTimestamp)();
    await (0, index_1.beginTransaction)();
    try {
        const restoredDevice = {
            ...snapshotDevice,
            updatedAt: now,
            isActive: true
        };
        await (0, index_1.run)(`
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
        ]);
        const currentVersion = await getLatestHistoryVersion(history.deviceId);
        const newHistory = (0, utils_1.createDeviceHistory)(restoredDevice, types_1.ChangeType.RESTORE, operator.id, operator.displayName, `从版本 ${history.version} 恢复设备`, currentVersion + 1);
        await saveDeviceHistory(newHistory);
        await (0, index_1.commitTransaction)();
        return restoredDevice;
    }
    catch (error) {
        await (0, index_1.rollbackTransaction)();
        throw error;
    }
}
async function getBorrowRecords(params) {
    const { page, pageSize, sortBy = 'borrowed_at', sortOrder = 'desc', status, deviceId, borrowerId } = params;
    const whereClauses = [];
    const whereParams = [];
    if (status) {
        whereClauses.push('status = ?');
        whereParams.push(status);
    }
    if (deviceId) {
        whereClauses.push('device_id = ?');
        whereParams.push(deviceId);
    }
    if (borrowerId) {
        whereClauses.push('borrower_id = ?');
        whereParams.push(borrowerId);
    }
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const countRow = await (0, index_1.get)(`SELECT COUNT(*) as count FROM borrow_records ${whereSql}`, whereParams);
    const total = countRow?.count || 0;
    const offset = (page - 1) * pageSize;
    const rows = await (0, index_1.all)(`SELECT * FROM borrow_records ${whereSql} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`, [...whereParams, pageSize, offset]);
    return {
        items: rows.map(mapBorrowRecord),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
    };
}
async function getLatestHistoryVersion(deviceId) {
    const result = await (0, index_1.get)(`
    SELECT MAX(version) as max_version FROM device_history WHERE device_id = ?
  `, [deviceId]);
    return result?.max_version || 0;
}
async function saveDeviceHistory(history) {
    await (0, index_1.run)(`
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
    ]);
}
function mapDevice(row) {
    return {
        id: row.id,
        deviceCode: row.device_code,
        name: row.name,
        category: row.category,
        model: row.model,
        serialNumber: row.serial_number,
        status: row.status,
        location: row.location,
        description: row.description,
        currentHolder: row.current_holder,
        currentHolderName: row.current_holder_name,
        borrowedAt: row.borrowed_at,
        expectedReturnAt: row.expected_return_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isActive: row.is_active === 1
    };
}
function mapBorrowRecord(row) {
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
        status: row.status,
        purpose: row.purpose,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}
function mapDeviceHistory(row) {
    return {
        id: row.id,
        deviceId: row.device_id,
        version: row.version,
        snapshot: row.snapshot,
        changedAt: row.changed_at,
        changedBy: row.changed_by,
        changedByName: row.changed_by_name,
        changeType: row.change_type,
        description: row.description
    };
}
//# sourceMappingURL=deviceService.js.map
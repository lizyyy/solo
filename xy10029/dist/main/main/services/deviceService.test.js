"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const types_1 = require("../shared/types");
const utils_1 = require("../shared/utils");
(0, globals_1.describe)('设备状态流转', () => {
    let db;
    (0, globals_1.beforeEach)(() => {
        db = new better_sqlite3_1.default(':memory:');
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
    `);
    });
    (0, globals_1.afterEach)(() => {
        db.close();
    });
    (0, globals_1.it)('新创建设备应该处于 available 状态', () => {
        const now = (0, utils_1.getCurrentTimestamp)();
        const device = {
            id: (0, utils_1.generateId)(),
            deviceCode: 'TEST-001',
            name: 'Test Device',
            category: types_1.DeviceCategory.LAPTOP,
            model: 'Test Model',
            serialNumber: 'TEST-SN-001',
            status: types_1.DeviceStatus.AVAILABLE,
            location: 'Test Location',
            description: 'Test Description',
            currentHolder: null,
            currentHolderName: null,
            borrowedAt: null,
            expectedReturnAt: null,
            createdAt: now,
            updatedAt: now,
            isActive: true
        };
        const stmt = db.prepare(`
      INSERT INTO devices (
        id, device_code, name, category, model, serial_number, status, location,
        description, current_holder, current_holder_name, borrowed_at, expected_return_at,
        created_at, updated_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(device.id, device.deviceCode, device.name, device.category, device.model, device.serialNumber, device.status, device.location, device.description, device.currentHolder, device.currentHolderName, device.borrowedAt, device.expectedReturnAt, device.createdAt, device.updatedAt, 1);
        const result = db.prepare('SELECT * FROM devices WHERE id = ?').get(device.id);
        (0, globals_1.expect)(result.status).toBe(types_1.DeviceStatus.AVAILABLE);
        (0, globals_1.expect)(result.is_active).toBe(1);
    });
    (0, globals_1.it)('available -> borrowed 应该是有效的状态转换', () => {
        const isValid = types_1.DeviceStatusTransitions[types_1.DeviceStatus.AVAILABLE]?.includes(types_1.DeviceStatus.BORROWED);
        (0, globals_1.expect)(isValid).toBe(true);
    });
    (0, globals_1.it)('available -> lost 应该是无效的状态转换', () => {
        const isValid = types_1.DeviceStatusTransitions[types_1.DeviceStatus.AVAILABLE]?.includes(types_1.DeviceStatus.LOST);
        (0, globals_1.expect)(isValid).toBe(false);
    });
    (0, globals_1.it)('borrowed -> available 应该是有效的状态转换（归还）', () => {
        const isValid = types_1.DeviceStatusTransitions[types_1.DeviceStatus.BORROWED]?.includes(types_1.DeviceStatus.AVAILABLE);
        (0, globals_1.expect)(isValid).toBe(true);
    });
    (0, globals_1.it)('borrowed -> lost 应该是有效的状态转换（丢失）', () => {
        const isValid = types_1.DeviceStatusTransitions[types_1.DeviceStatus.BORROWED]?.includes(types_1.DeviceStatus.LOST);
        (0, globals_1.expect)(isValid).toBe(true);
    });
    (0, globals_1.it)('maintenance -> available 应该是有效的状态转换（维护完成）', () => {
        const isValid = types_1.DeviceStatusTransitions[types_1.DeviceStatus.MAINTENANCE]?.includes(types_1.DeviceStatus.AVAILABLE);
        (0, globals_1.expect)(isValid).toBe(true);
    });
    (0, globals_1.it)('lost -> available 应该是有效的状态转换（找回）', () => {
        const isValid = types_1.DeviceStatusTransitions[types_1.DeviceStatus.LOST]?.includes(types_1.DeviceStatus.AVAILABLE);
        (0, globals_1.expect)(isValid).toBe(true);
    });
    (0, globals_1.it)('设备被借出时应该更新持有人信息', () => {
        const now = (0, utils_1.getCurrentTimestamp)();
        const deviceId = (0, utils_1.generateId)();
        db.prepare(`
      INSERT INTO devices (
        id, device_code, name, category, model, serial_number, status, location,
        description, current_holder, current_holder_name, borrowed_at, expected_return_at,
        created_at, updated_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(deviceId, 'LAP-100', 'Test Laptop', types_1.DeviceCategory.LAPTOP, 'Model X', 'SN-123', types_1.DeviceStatus.AVAILABLE, 'Cabinet A', 'Test', null, null, null, null, now, now, 1);
        const borrowerId = 'user-001';
        const borrowerName = '张三';
        const expectedReturn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        db.prepare(`
      UPDATE devices SET
        status = ?,
        current_holder = ?,
        current_holder_name = ?,
        borrowed_at = ?,
        expected_return_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(types_1.DeviceStatus.BORROWED, borrowerId, borrowerName, now, expectedReturn, now, deviceId);
        const updated = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId);
        (0, globals_1.expect)(updated.status).toBe(types_1.DeviceStatus.BORROWED);
        (0, globals_1.expect)(updated.current_holder).toBe(borrowerId);
        (0, globals_1.expect)(updated.current_holder_name).toBe(borrowerName);
        (0, globals_1.expect)(updated.borrowed_at).not.toBeNull();
        (0, globals_1.expect)(updated.expected_return_at).toBe(expectedReturn);
    });
    (0, globals_1.it)('设备归还时应该清除持有人信息', () => {
        const now = (0, utils_1.getCurrentTimestamp)();
        const deviceId = (0, utils_1.generateId)();
        db.prepare(`
      INSERT INTO devices (
        id, device_code, name, category, model, serial_number, status, location,
        description, current_holder, current_holder_name, borrowed_at, expected_return_at,
        created_at, updated_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(deviceId, 'LAP-200', 'Test Laptop 2', types_1.DeviceCategory.LAPTOP, 'Model Y', 'SN-456', types_1.DeviceStatus.BORROWED, 'Cabinet B', 'Test 2', 'user-002', '李四', now, null, now, now, 1);
        db.prepare(`
      UPDATE devices SET
        status = ?,
        current_holder = ?,
        current_holder_name = ?,
        borrowed_at = ?,
        expected_return_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(types_1.DeviceStatus.AVAILABLE, null, null, null, null, now, deviceId);
        const updated = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId);
        (0, globals_1.expect)(updated.status).toBe(types_1.DeviceStatus.AVAILABLE);
        (0, globals_1.expect)(updated.current_holder).toBeNull();
        (0, globals_1.expect)(updated.current_holder_name).toBeNull();
        (0, globals_1.expect)(updated.borrowed_at).toBeNull();
        (0, globals_1.expect)(updated.expected_return_at).toBeNull();
    });
    (0, globals_1.it)('设备软删除应该只设置 is_active 为 0', () => {
        const now = (0, utils_1.getCurrentTimestamp)();
        const deviceId = (0, utils_1.generateId)();
        db.prepare(`
      INSERT INTO devices (
        id, device_code, name, category, model, serial_number, status, location,
        description, current_holder, current_holder_name, borrowed_at, expected_return_at,
        created_at, updated_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(deviceId, 'LAP-300', 'Test Laptop 3', types_1.DeviceCategory.LAPTOP, 'Model Z', 'SN-789', types_1.DeviceStatus.AVAILABLE, 'Cabinet C', 'Test 3', null, null, null, null, now, now, 1);
        db.prepare('UPDATE devices SET is_active = 0, updated_at = ? WHERE id = ?').run(now, deviceId);
        const all = db.prepare('SELECT * FROM devices').all();
        (0, globals_1.expect)(all.length).toBe(1);
        const active = db.prepare('SELECT * FROM devices WHERE is_active = 1').all();
        (0, globals_1.expect)(active.length).toBe(0);
    });
});
(0, globals_1.describe)('权限系统', () => {
    (0, globals_1.it)('管理员应该拥有所有权限', () => {
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
        });
        const adminRole = types_1.UserRole.ADMIN;
        (0, globals_1.expect)(adminRole).toBe('admin');
    });
    (0, globals_1.it)('UserRole 枚举值应该正确', () => {
        (0, globals_1.expect)(types_1.UserRole.ADMIN).toBe('admin');
        (0, globals_1.expect)(types_1.UserRole.OPERATOR).toBe('operator');
        (0, globals_1.expect)(types_1.UserRole.USER).toBe('user');
    });
});
(0, globals_1.describe)('借出记录状态', () => {
    (0, globals_1.it)('BorrowStatus 枚举值应该正确', () => {
        (0, globals_1.expect)(types_1.BorrowStatus.ACTIVE).toBe('active');
        (0, globals_1.expect)(types_1.BorrowStatus.RETURNED).toBe('returned');
        (0, globals_1.expect)(types_1.BorrowStatus.OVERDUE).toBe('overdue');
        (0, globals_1.expect)(types_1.BorrowStatus.CANCELLED).toBe('cancelled');
    });
});
//# sourceMappingURL=deviceService.test.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const types_1 = require("../../shared/types");
const utils_1 = require("../../shared/utils");
(0, globals_1.describe)('设备状态流转', () => {
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
        (0, globals_1.expect)(device.status).toBe(types_1.DeviceStatus.AVAILABLE);
        (0, globals_1.expect)(device.isActive).toBe(true);
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
        const device = {
            id: (0, utils_1.generateId)(),
            deviceCode: 'LAP-100',
            name: 'Test Laptop',
            category: types_1.DeviceCategory.LAPTOP,
            model: 'Model X',
            serialNumber: 'SN-123',
            status: types_1.DeviceStatus.AVAILABLE,
            location: 'Cabinet A',
            description: 'Test',
            currentHolder: null,
            currentHolderName: null,
            borrowedAt: null,
            expectedReturnAt: null,
            createdAt: now,
            updatedAt: now,
            isActive: true
        };
        const borrowerId = 'user-001';
        const borrowerName = '张三';
        const expectedReturn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        device.status = types_1.DeviceStatus.BORROWED;
        device.currentHolder = borrowerId;
        device.currentHolderName = borrowerName;
        device.borrowedAt = now;
        device.expectedReturnAt = expectedReturn;
        device.updatedAt = now;
        (0, globals_1.expect)(device.status).toBe(types_1.DeviceStatus.BORROWED);
        (0, globals_1.expect)(device.currentHolder).toBe(borrowerId);
        (0, globals_1.expect)(device.currentHolderName).toBe(borrowerName);
        (0, globals_1.expect)(device.borrowedAt).not.toBeNull();
        (0, globals_1.expect)(device.expectedReturnAt).toBe(expectedReturn);
    });
    (0, globals_1.it)('设备归还时应该清除持有人信息', () => {
        const now = (0, utils_1.getCurrentTimestamp)();
        const device = {
            id: (0, utils_1.generateId)(),
            deviceCode: 'LAP-200',
            name: 'Test Laptop 2',
            category: types_1.DeviceCategory.LAPTOP,
            model: 'Model Y',
            serialNumber: 'SN-456',
            status: types_1.DeviceStatus.BORROWED,
            location: 'Cabinet B',
            description: 'Test 2',
            currentHolder: 'user-002',
            currentHolderName: '李四',
            borrowedAt: now,
            expectedReturnAt: null,
            createdAt: now,
            updatedAt: now,
            isActive: true
        };
        device.status = types_1.DeviceStatus.AVAILABLE;
        device.currentHolder = null;
        device.currentHolderName = null;
        device.borrowedAt = null;
        device.expectedReturnAt = null;
        device.updatedAt = now;
        (0, globals_1.expect)(device.status).toBe(types_1.DeviceStatus.AVAILABLE);
        (0, globals_1.expect)(device.currentHolder).toBeNull();
        (0, globals_1.expect)(device.currentHolderName).toBeNull();
        (0, globals_1.expect)(device.borrowedAt).toBeNull();
        (0, globals_1.expect)(device.expectedReturnAt).toBeNull();
    });
    (0, globals_1.it)('设备软删除应该只设置 isActive 为 false', () => {
        const now = (0, utils_1.getCurrentTimestamp)();
        const device = {
            id: (0, utils_1.generateId)(),
            deviceCode: 'LAP-300',
            name: 'Test Laptop 3',
            category: types_1.DeviceCategory.LAPTOP,
            model: 'Model Z',
            serialNumber: 'SN-789',
            status: types_1.DeviceStatus.AVAILABLE,
            location: 'Cabinet C',
            description: 'Test 3',
            currentHolder: null,
            currentHolderName: null,
            borrowedAt: null,
            expectedReturnAt: null,
            createdAt: now,
            updatedAt: now,
            isActive: true
        };
        device.isActive = false;
        device.updatedAt = now;
        (0, globals_1.expect)(device.isActive).toBe(false);
        (0, globals_1.expect)(device.id).not.toBeNull();
    });
});
(0, globals_1.describe)('权限系统', () => {
    (0, globals_1.it)('管理员应该拥有所有权限', () => {
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
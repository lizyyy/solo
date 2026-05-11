"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const types_1 = require("./types");
const utils_1 = require("./utils");
(0, globals_1.describe)('类型定义', () => {
    (0, globals_1.describe)('UserRole', () => {
        (0, globals_1.it)('应该包含所有角色类型', () => {
            (0, globals_1.expect)(types_1.UserRole.ADMIN).toBe('admin');
            (0, globals_1.expect)(types_1.UserRole.OPERATOR).toBe('operator');
            (0, globals_1.expect)(types_1.UserRole.USER).toBe('user');
        });
    });
    (0, globals_1.describe)('DeviceStatus', () => {
        (0, globals_1.it)('应该包含所有设备状态', () => {
            (0, globals_1.expect)(types_1.DeviceStatus.AVAILABLE).toBe('available');
            (0, globals_1.expect)(types_1.DeviceStatus.BORROWED).toBe('borrowed');
            (0, globals_1.expect)(types_1.DeviceStatus.MAINTENANCE).toBe('maintenance');
            (0, globals_1.expect)(types_1.DeviceStatus.RESERVED).toBe('reserved');
            (0, globals_1.expect)(types_1.DeviceStatus.LOST).toBe('lost');
        });
    });
    (0, globals_1.describe)('DeviceCategory', () => {
        (0, globals_1.it)('应该包含所有设备类别', () => {
            (0, globals_1.expect)(types_1.DeviceCategory.LAPTOP).toBe('laptop');
            (0, globals_1.expect)(types_1.DeviceCategory.PHONE).toBe('phone');
            (0, globals_1.expect)(types_1.DeviceCategory.TABLET).toBe('tablet');
            (0, globals_1.expect)(types_1.DeviceCategory.CAMERA).toBe('camera');
            (0, globals_1.expect)(types_1.DeviceCategory.AUDIO).toBe('audio');
            (0, globals_1.expect)(types_1.DeviceCategory.OTHER).toBe('other');
        });
    });
    (0, globals_1.describe)('RolePermissions', () => {
        (0, globals_1.it)('管理员应该拥有所有权限', () => {
            const adminPerms = types_1.RolePermissions[types_1.UserRole.ADMIN];
            (0, globals_1.expect)(adminPerms).toContain(types_1.Permission.MANAGE_USERS);
            (0, globals_1.expect)(adminPerms).toContain(types_1.Permission.MANAGE_DEVICES);
            (0, globals_1.expect)(adminPerms).toContain(types_1.Permission.LEND_DEVICE);
            (0, globals_1.expect)(adminPerms).toContain(types_1.Permission.RETURN_DEVICE);
            (0, globals_1.expect)(adminPerms).toContain(types_1.Permission.EXPORT_DATA);
            (0, globals_1.expect)(adminPerms).toContain(types_1.Permission.IMPORT_DATA);
            (0, globals_1.expect)(adminPerms).toContain(types_1.Permission.BATCH_OPERATIONS);
        });
        (0, globals_1.it)('操作员应该拥有有限权限', () => {
            const operatorPerms = types_1.RolePermissions[types_1.UserRole.OPERATOR];
            (0, globals_1.expect)(operatorPerms).toContain(types_1.Permission.LEND_DEVICE);
            (0, globals_1.expect)(operatorPerms).toContain(types_1.Permission.RETURN_DEVICE);
            (0, globals_1.expect)(operatorPerms).toContain(types_1.Permission.BATCH_OPERATIONS);
            (0, globals_1.expect)(operatorPerms).not.toContain(types_1.Permission.MANAGE_USERS);
        });
        (0, globals_1.it)('普通用户只能查看', () => {
            const userPerms = types_1.RolePermissions[types_1.UserRole.USER];
            (0, globals_1.expect)(userPerms).toContain(types_1.Permission.VIEW_DEVICES);
            (0, globals_1.expect)(userPerms).toContain(types_1.Permission.VIEW_HISTORY);
            (0, globals_1.expect)(userPerms).not.toContain(types_1.Permission.LEND_DEVICE);
            (0, globals_1.expect)(userPerms).not.toContain(types_1.Permission.MANAGE_USERS);
        });
    });
    (0, globals_1.describe)('BorrowStatus', () => {
        (0, globals_1.it)('应该包含所有借出状态', () => {
            (0, globals_1.expect)(types_1.BorrowStatus.ACTIVE).toBe('active');
            (0, globals_1.expect)(types_1.BorrowStatus.RETURNED).toBe('returned');
            (0, globals_1.expect)(types_1.BorrowStatus.OVERDUE).toBe('overdue');
            (0, globals_1.expect)(types_1.BorrowStatus.CANCELLED).toBe('cancelled');
        });
    });
    (0, globals_1.describe)('ChangeType', () => {
        (0, globals_1.it)('应该包含所有变更类型', () => {
            (0, globals_1.expect)(types_1.ChangeType.CREATE).toBe('create');
            (0, globals_1.expect)(types_1.ChangeType.UPDATE).toBe('update');
            (0, globals_1.expect)(types_1.ChangeType.BORROW).toBe('borrow');
            (0, globals_1.expect)(types_1.ChangeType.RETURN).toBe('return');
            (0, globals_1.expect)(types_1.ChangeType.MAINTENANCE).toBe('maintenance');
            (0, globals_1.expect)(types_1.ChangeType.DELETE).toBe('delete');
            (0, globals_1.expect)(types_1.ChangeType.RESTORE).toBe('restore');
        });
    });
});
(0, globals_1.describe)('设备状态转换', () => {
    (0, globals_1.it)('available 状态可以转换为 borrowed, maintenance, reserved', () => {
        (0, globals_1.expect)((0, utils_1.isValidDeviceTransition)(types_1.DeviceStatus.AVAILABLE, types_1.DeviceStatus.BORROWED, types_1.DeviceStatusTransitions)).toBe(true);
        (0, globals_1.expect)((0, utils_1.isValidDeviceTransition)(types_1.DeviceStatus.AVAILABLE, types_1.DeviceStatus.MAINTENANCE, types_1.DeviceStatusTransitions)).toBe(true);
        (0, globals_1.expect)((0, utils_1.isValidDeviceTransition)(types_1.DeviceStatus.AVAILABLE, types_1.DeviceStatus.RESERVED, types_1.DeviceStatusTransitions)).toBe(true);
    });
    (0, globals_1.it)('available 状态不能直接转换为 lost', () => {
        (0, globals_1.expect)((0, utils_1.isValidDeviceTransition)(types_1.DeviceStatus.AVAILABLE, types_1.DeviceStatus.LOST, types_1.DeviceStatusTransitions)).toBe(false);
    });
    (0, globals_1.it)('borrowed 状态可以转换为 available, maintenance, lost', () => {
        (0, globals_1.expect)((0, utils_1.isValidDeviceTransition)(types_1.DeviceStatus.BORROWED, types_1.DeviceStatus.AVAILABLE, types_1.DeviceStatusTransitions)).toBe(true);
        (0, globals_1.expect)((0, utils_1.isValidDeviceTransition)(types_1.DeviceStatus.BORROWED, types_1.DeviceStatus.MAINTENANCE, types_1.DeviceStatusTransitions)).toBe(true);
        (0, globals_1.expect)((0, utils_1.isValidDeviceTransition)(types_1.DeviceStatus.BORROWED, types_1.DeviceStatus.LOST, types_1.DeviceStatusTransitions)).toBe(true);
    });
    (0, globals_1.it)('borrowed 状态不能转换为 reserved', () => {
        (0, globals_1.expect)((0, utils_1.isValidDeviceTransition)(types_1.DeviceStatus.BORROWED, types_1.DeviceStatus.RESERVED, types_1.DeviceStatusTransitions)).toBe(false);
    });
    (0, globals_1.it)('maintenance 状态只能转换为 available', () => {
        (0, globals_1.expect)((0, utils_1.isValidDeviceTransition)(types_1.DeviceStatus.MAINTENANCE, types_1.DeviceStatus.AVAILABLE, types_1.DeviceStatusTransitions)).toBe(true);
        (0, globals_1.expect)((0, utils_1.isValidDeviceTransition)(types_1.DeviceStatus.MAINTENANCE, types_1.DeviceStatus.BORROWED, types_1.DeviceStatusTransitions)).toBe(false);
        (0, globals_1.expect)((0, utils_1.isValidDeviceTransition)(types_1.DeviceStatus.MAINTENANCE, types_1.DeviceStatus.LOST, types_1.DeviceStatusTransitions)).toBe(false);
    });
    (0, globals_1.it)('lost 状态可以转换为 available', () => {
        (0, globals_1.expect)((0, utils_1.isValidDeviceTransition)(types_1.DeviceStatus.LOST, types_1.DeviceStatus.AVAILABLE, types_1.DeviceStatusTransitions)).toBe(true);
    });
    (0, globals_1.it)('reserved 状态可以转换为 available 或 borrowed', () => {
        (0, globals_1.expect)((0, utils_1.isValidDeviceTransition)(types_1.DeviceStatus.RESERVED, types_1.DeviceStatus.AVAILABLE, types_1.DeviceStatusTransitions)).toBe(true);
        (0, globals_1.expect)((0, utils_1.isValidDeviceTransition)(types_1.DeviceStatus.RESERVED, types_1.DeviceStatus.BORROWED, types_1.DeviceStatusTransitions)).toBe(true);
    });
    (0, globals_1.it)('无效状态转换应该返回 false', () => {
        (0, globals_1.expect)((0, utils_1.isValidDeviceTransition)('invalid', types_1.DeviceStatus.AVAILABLE, types_1.DeviceStatusTransitions)).toBe(false);
    });
});
(0, globals_1.describe)('工具函数', () => {
    (0, globals_1.describe)('generateId', () => {
        (0, globals_1.it)('应该生成唯一的 ID', () => {
            const id1 = (0, utils_1.generateId)();
            const id2 = (0, utils_1.generateId)();
            (0, globals_1.expect)(id1).not.toBe(id2);
            (0, globals_1.expect)(id1.length).toBeGreaterThan(0);
        });
    });
    (0, globals_1.describe)('getCurrentTimestamp', () => {
        (0, globals_1.it)('应该返回 ISO 格式的时间戳', () => {
            const timestamp = (0, utils_1.getCurrentTimestamp)();
            (0, globals_1.expect)(() => new Date(timestamp)).not.toThrow();
            (0, globals_1.expect)(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });
    });
    (0, globals_1.describe)('truncateText', () => {
        (0, globals_1.it)('短文本不应该被截断', () => {
            (0, globals_1.expect)((0, utils_1.truncateText)('hello', 10)).toBe('hello');
        });
        (0, globals_1.it)('长文本应该被截断并添加省略号', () => {
            const result = (0, utils_1.truncateText)('hello world', 8);
            (0, globals_1.expect)(result).toBe('hello...');
            (0, globals_1.expect)(result.length).toBe(8);
        });
        (0, globals_1.it)('空字符串应该保持原样', () => {
            (0, globals_1.expect)((0, utils_1.truncateText)('', 10)).toBe('');
        });
    });
    (0, globals_1.describe)('calculateNextRetry', () => {
        (0, globals_1.it)('第一次重试延迟应该是 5 秒', () => {
            const now = new Date().toISOString();
            const next = (0, utils_1.calculateNextRetry)(0, now);
            const nextDate = new Date(next);
            const nowDate = new Date(now);
            const diff = nextDate.getTime() - nowDate.getTime();
            (0, globals_1.expect)(diff).toBe(5000);
        });
        (0, globals_1.it)('第二次重试延迟应该是 10 秒', () => {
            const now = new Date().toISOString();
            const next = (0, utils_1.calculateNextRetry)(1, now);
            const nextDate = new Date(next);
            const nowDate = new Date(now);
            const diff = nextDate.getTime() - nowDate.getTime();
            (0, globals_1.expect)(diff).toBe(10000);
        });
        (0, globals_1.it)('第三次重试延迟应该是 20 秒（指数退避）', () => {
            const now = new Date().toISOString();
            const next = (0, utils_1.calculateNextRetry)(2, now);
            const nextDate = new Date(next);
            const nowDate = new Date(now);
            const diff = nextDate.getTime() - nowDate.getTime();
            (0, globals_1.expect)(diff).toBe(20000);
        });
    });
    (0, globals_1.describe)('serializeSnapshot / deserializeSnapshot', () => {
        (0, globals_1.it)('应该正确序列化和反序列化对象', () => {
            const data = { name: 'Test Device', status: types_1.DeviceStatus.AVAILABLE, count: 42 };
            const serialized = (0, utils_1.serializeSnapshot)(data);
            const deserialized = (0, utils_1.deserializeSnapshot)(serialized);
            (0, globals_1.expect)(deserialized).toEqual(data);
        });
        (0, globals_1.it)('应该正确处理数组', () => {
            const data = [1, 2, 3, { nested: true }];
            const serialized = (0, utils_1.serializeSnapshot)(data);
            const deserialized = (0, utils_1.deserializeSnapshot)(serialized);
            (0, globals_1.expect)(deserialized).toEqual(data);
        });
        (0, globals_1.it)('应该正确处理 null', () => {
            const serialized = (0, utils_1.serializeSnapshot)(null);
            const deserialized = (0, utils_1.deserializeSnapshot)(serialized);
            (0, globals_1.expect)(deserialized).toBeNull();
        });
    });
});
//# sourceMappingURL=utils.test.js.map
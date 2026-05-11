"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const types_1 = require("../../shared/types");
(0, globals_1.describe)('权限系统', () => {
    (0, globals_1.describe)('RolePermissions 映射', () => {
        (0, globals_1.it)('admin 角色应该拥有最多权限', () => {
            const adminPerms = types_1.RolePermissions[types_1.UserRole.ADMIN];
            const operatorPerms = types_1.RolePermissions[types_1.UserRole.OPERATOR];
            const userPerms = types_1.RolePermissions[types_1.UserRole.USER];
            (0, globals_1.expect)(adminPerms.length).toBeGreaterThan(operatorPerms.length);
            (0, globals_1.expect)(adminPerms.length).toBeGreaterThan(userPerms.length);
        });
        (0, globals_1.it)('operator 权限应该是 admin 权限的子集', () => {
            const adminPerms = types_1.RolePermissions[types_1.UserRole.ADMIN];
            const operatorPerms = types_1.RolePermissions[types_1.UserRole.OPERATOR];
            for (const perm of operatorPerms) {
                (0, globals_1.expect)(adminPerms).toContain(perm);
            }
        });
        (0, globals_1.it)('user 权限应该是 operator 权限的子集', () => {
            const operatorPerms = types_1.RolePermissions[types_1.UserRole.OPERATOR];
            const userPerms = types_1.RolePermissions[types_1.UserRole.USER];
            for (const perm of userPerms) {
                (0, globals_1.expect)(operatorPerms).toContain(perm);
            }
        });
    });
    (0, globals_1.describe)('Permission 枚举', () => {
        (0, globals_1.it)('应该包含所有必要的权限', () => {
            (0, globals_1.expect)(types_1.Permission.VIEW_DEVICES).toBe('view_devices');
            (0, globals_1.expect)(types_1.Permission.MANAGE_DEVICES).toBe('manage_devices');
            (0, globals_1.expect)(types_1.Permission.LEND_DEVICE).toBe('lend_device');
            (0, globals_1.expect)(types_1.Permission.RETURN_DEVICE).toBe('return_device');
            (0, globals_1.expect)(types_1.Permission.VIEW_HISTORY).toBe('view_history');
            (0, globals_1.expect)(types_1.Permission.VIEW_LOGS).toBe('view_logs');
            (0, globals_1.expect)(types_1.Permission.EXPORT_DATA).toBe('export_data');
            (0, globals_1.expect)(types_1.Permission.IMPORT_DATA).toBe('import_data');
            (0, globals_1.expect)(types_1.Permission.MANAGE_USERS).toBe('manage_users');
            (0, globals_1.expect)(types_1.Permission.BATCH_OPERATIONS).toBe('batch_operations');
            (0, globals_1.expect)(types_1.Permission.RESTORE_VERSION).toBe('restore_version');
            (0, globals_1.expect)(types_1.Permission.SYSTEM_SETTINGS).toBe('system_settings');
        });
    });
    (0, globals_1.describe)('权限检查场景', () => {
        function hasPermission(role, permission) {
            const permissions = types_1.RolePermissions[role];
            return permissions.includes(permission);
        }
        (0, globals_1.it)('管理员可以管理用户', () => {
            (0, globals_1.expect)(hasPermission(types_1.UserRole.ADMIN, types_1.Permission.MANAGE_USERS)).toBe(true);
        });
        (0, globals_1.it)('操作员不能管理用户', () => {
            (0, globals_1.expect)(hasPermission(types_1.UserRole.OPERATOR, types_1.Permission.MANAGE_USERS)).toBe(false);
        });
        (0, globals_1.it)('普通用户不能管理用户', () => {
            (0, globals_1.expect)(hasPermission(types_1.UserRole.USER, types_1.Permission.MANAGE_USERS)).toBe(false);
        });
        (0, globals_1.it)('管理员和操作员都可以借出设备', () => {
            (0, globals_1.expect)(hasPermission(types_1.UserRole.ADMIN, types_1.Permission.LEND_DEVICE)).toBe(true);
            (0, globals_1.expect)(hasPermission(types_1.UserRole.OPERATOR, types_1.Permission.LEND_DEVICE)).toBe(true);
        });
        (0, globals_1.it)('普通用户不能借出设备', () => {
            (0, globals_1.expect)(hasPermission(types_1.UserRole.USER, types_1.Permission.LEND_DEVICE)).toBe(false);
        });
        (0, globals_1.it)('所有角色都可以查看设备', () => {
            (0, globals_1.expect)(hasPermission(types_1.UserRole.ADMIN, types_1.Permission.VIEW_DEVICES)).toBe(true);
            (0, globals_1.expect)(hasPermission(types_1.UserRole.OPERATOR, types_1.Permission.VIEW_DEVICES)).toBe(true);
            (0, globals_1.expect)(hasPermission(types_1.UserRole.USER, types_1.Permission.VIEW_DEVICES)).toBe(true);
        });
        (0, globals_1.it)('只有管理员可以恢复版本', () => {
            (0, globals_1.expect)(hasPermission(types_1.UserRole.ADMIN, types_1.Permission.RESTORE_VERSION)).toBe(true);
            (0, globals_1.expect)(hasPermission(types_1.UserRole.OPERATOR, types_1.Permission.RESTORE_VERSION)).toBe(false);
            (0, globals_1.expect)(hasPermission(types_1.UserRole.USER, types_1.Permission.RESTORE_VERSION)).toBe(false);
        });
        (0, globals_1.it)('管理员和操作员都可以执行批量操作', () => {
            (0, globals_1.expect)(hasPermission(types_1.UserRole.ADMIN, types_1.Permission.BATCH_OPERATIONS)).toBe(true);
            (0, globals_1.expect)(hasPermission(types_1.UserRole.OPERATOR, types_1.Permission.BATCH_OPERATIONS)).toBe(true);
            (0, globals_1.expect)(hasPermission(types_1.UserRole.USER, types_1.Permission.BATCH_OPERATIONS)).toBe(false);
        });
        (0, globals_1.it)('只有管理员可以查看系统设置', () => {
            (0, globals_1.expect)(hasPermission(types_1.UserRole.ADMIN, types_1.Permission.SYSTEM_SETTINGS)).toBe(true);
            (0, globals_1.expect)(hasPermission(types_1.UserRole.OPERATOR, types_1.Permission.SYSTEM_SETTINGS)).toBe(false);
            (0, globals_1.expect)(hasPermission(types_1.UserRole.USER, types_1.Permission.SYSTEM_SETTINGS)).toBe(false);
        });
        (0, globals_1.it)('操作员可以导出数据', () => {
            (0, globals_1.expect)(hasPermission(types_1.UserRole.OPERATOR, types_1.Permission.EXPORT_DATA)).toBe(true);
        });
        (0, globals_1.it)('普通用户不能导出数据', () => {
            (0, globals_1.expect)(hasPermission(types_1.UserRole.USER, types_1.Permission.EXPORT_DATA)).toBe(false);
        });
    });
});
//# sourceMappingURL=userService.test.js.map
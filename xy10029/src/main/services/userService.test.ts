import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import {
  UserRole,
  Permission,
  RolePermissions
} from '../../shared/types'

describe('权限系统', () => {
  describe('RolePermissions 映射', () => {
    it('admin 角色应该拥有最多权限', () => {
      const adminPerms = RolePermissions[UserRole.ADMIN]
      const operatorPerms = RolePermissions[UserRole.OPERATOR]
      const userPerms = RolePermissions[UserRole.USER]

      expect(adminPerms.length).toBeGreaterThan(operatorPerms.length)
      expect(adminPerms.length).toBeGreaterThan(userPerms.length)
    })

    it('operator 权限应该是 admin 权限的子集', () => {
      const adminPerms = RolePermissions[UserRole.ADMIN]
      const operatorPerms = RolePermissions[UserRole.OPERATOR]

      for (const perm of operatorPerms) {
        expect(adminPerms).toContain(perm)
      }
    })

    it('user 权限应该是 operator 权限的子集', () => {
      const operatorPerms = RolePermissions[UserRole.OPERATOR]
      const userPerms = RolePermissions[UserRole.USER]

      for (const perm of userPerms) {
        expect(operatorPerms).toContain(perm)
      }
    })
  })

  describe('Permission 枚举', () => {
    it('应该包含所有必要的权限', () => {
      expect(Permission.VIEW_DEVICES).toBe('view_devices')
      expect(Permission.MANAGE_DEVICES).toBe('manage_devices')
      expect(Permission.LEND_DEVICE).toBe('lend_device')
      expect(Permission.RETURN_DEVICE).toBe('return_device')
      expect(Permission.VIEW_HISTORY).toBe('view_history')
      expect(Permission.VIEW_LOGS).toBe('view_logs')
      expect(Permission.EXPORT_DATA).toBe('export_data')
      expect(Permission.IMPORT_DATA).toBe('import_data')
      expect(Permission.MANAGE_USERS).toBe('manage_users')
      expect(Permission.BATCH_OPERATIONS).toBe('batch_operations')
      expect(Permission.RESTORE_VERSION).toBe('restore_version')
      expect(Permission.SYSTEM_SETTINGS).toBe('system_settings')
    })
  })

  describe('权限检查场景', () => {
    function hasPermission(role: UserRole, permission: Permission): boolean {
      const permissions = RolePermissions[role]
      return permissions.includes(permission)
    }

    it('管理员可以管理用户', () => {
      expect(hasPermission(UserRole.ADMIN, Permission.MANAGE_USERS)).toBe(true)
    })

    it('操作员不能管理用户', () => {
      expect(hasPermission(UserRole.OPERATOR, Permission.MANAGE_USERS)).toBe(false)
    })

    it('普通用户不能管理用户', () => {
      expect(hasPermission(UserRole.USER, Permission.MANAGE_USERS)).toBe(false)
    })

    it('管理员和操作员都可以借出设备', () => {
      expect(hasPermission(UserRole.ADMIN, Permission.LEND_DEVICE)).toBe(true)
      expect(hasPermission(UserRole.OPERATOR, Permission.LEND_DEVICE)).toBe(true)
    })

    it('普通用户不能借出设备', () => {
      expect(hasPermission(UserRole.USER, Permission.LEND_DEVICE)).toBe(false)
    })

    it('所有角色都可以查看设备', () => {
      expect(hasPermission(UserRole.ADMIN, Permission.VIEW_DEVICES)).toBe(true)
      expect(hasPermission(UserRole.OPERATOR, Permission.VIEW_DEVICES)).toBe(true)
      expect(hasPermission(UserRole.USER, Permission.VIEW_DEVICES)).toBe(true)
    })

    it('只有管理员可以恢复版本', () => {
      expect(hasPermission(UserRole.ADMIN, Permission.RESTORE_VERSION)).toBe(true)
      expect(hasPermission(UserRole.OPERATOR, Permission.RESTORE_VERSION)).toBe(false)
      expect(hasPermission(UserRole.USER, Permission.RESTORE_VERSION)).toBe(false)
    })

    it('管理员和操作员都可以执行批量操作', () => {
      expect(hasPermission(UserRole.ADMIN, Permission.BATCH_OPERATIONS)).toBe(true)
      expect(hasPermission(UserRole.OPERATOR, Permission.BATCH_OPERATIONS)).toBe(true)
      expect(hasPermission(UserRole.USER, Permission.BATCH_OPERATIONS)).toBe(false)
    })

    it('只有管理员可以查看系统设置', () => {
      expect(hasPermission(UserRole.ADMIN, Permission.SYSTEM_SETTINGS)).toBe(true)
      expect(hasPermission(UserRole.OPERATOR, Permission.SYSTEM_SETTINGS)).toBe(false)
      expect(hasPermission(UserRole.USER, Permission.SYSTEM_SETTINGS)).toBe(false)
    })

    it('操作员可以导出数据', () => {
      expect(hasPermission(UserRole.OPERATOR, Permission.EXPORT_DATA)).toBe(true)
    })

    it('普通用户不能导出数据', () => {
      expect(hasPermission(UserRole.USER, Permission.EXPORT_DATA)).toBe(false)
    })
  })
})

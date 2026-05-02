const config = require('../config');

class PermissionError extends Error {
  constructor(message, code = 'PERMISSION_DENIED') {
    super(message);
    this.name = 'PermissionError';
    this.code = code;
    this.status = 403;
  }
}

class PermissionValidator {
  static hasPermission(userRole, permission) {
    const allowedRoles = config.permissions[permission];
    if (!allowedRoles) {
      return false;
    }
    return allowedRoles.includes(userRole);
  }

  static checkPermission(userRole, permission) {
    if (!this.hasPermission(userRole, permission)) {
      throw new PermissionError(
        `角色 ${userRole} 没有权限执行 ${permission} 操作`
      );
    }
    return true;
  }

  static isAdmin(userRole) {
    return userRole === config.roles.admin;
  }

  static isSafetyOfficer(userRole) {
    return userRole === config.roles.safety_officer || this.isAdmin(userRole);
  }

  static checkIsAdmin(userRole) {
    if (!this.isAdmin(userRole)) {
      throw new PermissionError('需要管理员权限');
    }
    return true;
  }

  static checkIsSafetyOfficer(userRole) {
    if (!this.isSafetyOfficer(userRole)) {
      throw new PermissionError('需要安全员或管理员权限');
    }
    return true;
  }

  static validateRole(role) {
    const validRoles = Object.values(config.roles);
    if (!validRoles.includes(role)) {
      throw new PermissionError(
        `无效的角色: ${role}。有效角色: ${validRoles.join(', ')}`
      );
    }
    return true;
  }

  static canCreateChemical(userRole) {
    return this.hasPermission(userRole, 'create_chemical');
  }

  static canUpdateChemical(userRole) {
    return this.hasPermission(userRole, 'update_chemical');
  }

  static canDeleteChemical(userRole) {
    return this.hasPermission(userRole, 'delete_chemical');
  }

  static canCreateBatch(userRole) {
    return this.hasPermission(userRole, 'create_batch');
  }

  static canUpdateBatch(userRole) {
    return this.hasPermission(userRole, 'update_batch');
  }

  static canCreateRequest(userRole) {
    return this.hasPermission(userRole, 'create_request');
  }

  static canApproveRequest(userRole) {
    return this.hasPermission(userRole, 'approve_request');
  }

  static canRejectRequest(userRole) {
    return this.hasPermission(userRole, 'reject_request');
  }

  static canExecuteRequest(userRole) {
    return this.hasPermission(userRole, 'execute_request');
  }

  static canReturnChemical(userRole) {
    return this.hasPermission(userRole, 'return_chemical');
  }

  static canDisposeChemical(userRole) {
    return this.hasPermission(userRole, 'dispose_chemical');
  }

  static canViewAuditLog(userRole) {
    return this.hasPermission(userRole, 'view_audit_log');
  }

  static canExportReport(userRole) {
    return this.hasPermission(userRole, 'export_report');
  }

  static canImportBatch(userRole) {
    return this.hasPermission(userRole, 'import_batch');
  }
}

module.exports = { PermissionValidator, PermissionError };

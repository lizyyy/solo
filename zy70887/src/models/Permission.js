const db = require('../database');

class Permission {
  static async checkPermission(userId, permissionType) {
    const permission = await db.get(
      `SELECT * FROM permissions 
       WHERE user_id = ? AND permission_type = ? AND is_active = 1 
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [userId, permissionType]
    );
    return !!permission;
  }

  static async grantPermission(userId, permissionType, grantedBy, expiresAt = null) {
    try {
      await db.run(
        `INSERT INTO permissions (user_id, permission_type, granted_by, expires_at, is_active) 
         VALUES (?, ?, ?, ?, 1)`,
        [userId, permissionType, grantedBy, expiresAt]
      );
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        await db.run(
          `UPDATE permissions SET granted_by = ?, expires_at = ?, is_active = 1, granted_at = CURRENT_TIMESTAMP 
           WHERE user_id = ? AND permission_type = ?`,
          [grantedBy, expiresAt, userId, permissionType]
        );
      } else {
        throw err;
      }
    }
    return await this.getUserPermissions(userId);
  }

  static async revokePermission(userId, permissionType) {
    await db.run(
      'UPDATE permissions SET is_active = 0 WHERE user_id = ? AND permission_type = ?',
      [userId, permissionType]
    );
    return await this.getUserPermissions(userId);
  }

  static async getUserPermissions(userId) {
    return await db.all(
      `SELECT p.*, u.username as granted_by_name 
       FROM permissions p 
       LEFT JOIN users u ON p.granted_by = u.id 
       WHERE p.user_id = ?`,
      [userId]
    );
  }

  static async canSendToCourier(userId, stampType) {
    const hasCourierPermission = await this.checkPermission(userId, 'courier_send');
    
    if (!hasCourierPermission) {
      return { allowed: false, reason: '没有快递寄送权限' };
    }
    
    if (stampType === 'authorized') {
      const hasStampAuthorized = await this.checkPermission(userId, 'stamp_authorized');
      if (!hasStampAuthorized) {
        return { allowed: false, reason: '没有授权盖章权限，无法进入快递环节' };
      }
    }
    
    return { allowed: true };
  }

  static async canPerformStampAction(userId, stampType) {
    const permissionMap = {
      'authorized': 'stamp_authorized',
      'attachment': 'stamp_attachment',
      'resubmit': 'resubmit'
    };
    
    const requiredPermission = permissionMap[stampType];
    if (!requiredPermission) {
      return { allowed: false, reason: '未知的盖章类型' };
    }
    
    const hasPermission = await this.checkPermission(userId, requiredPermission);
    return {
      allowed: hasPermission,
      reason: hasPermission ? null : `没有${stampType === 'authorized' ? '授权盖章' : stampType === 'attachment' ? '补盖附件' : '撤回重提'}权限`
    };
  }
}

module.exports = Permission;

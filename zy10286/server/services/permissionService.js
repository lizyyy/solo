const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class PermissionService {
  constructor(db) {
    this.db = db;
  }

  runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async recordEvent(eventType, entityType, entityId, description, prevState = null, newState = null, operator = 'system') {
    await this.runAsync(
      `INSERT INTO business_events (id, event_type, entity_type, entity_id, description, previous_state, new_state, operator)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), eventType, entityType, entityId, description, 
       prevState ? JSON.stringify(prevState) : null, 
       newState ? JSON.stringify(newState) : null, operator]
    );
  }

  async recordAnomaly(anomalyType, severity, studentId, sessionId, classId, description) {
    const existing = await this.getAsync(
      `SELECT * FROM permission_anomalies 
       WHERE anomaly_type = ? AND student_id = ? AND session_id = ? AND status = 'open'`,
      [anomalyType, studentId, sessionId]
    );
    
    if (existing) return existing.id;

    const anomalyId = uuidv4();
    await this.runAsync(
      `INSERT INTO permission_anomalies (id, anomaly_type, severity, student_id, session_id, class_id, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [anomalyId, anomalyType, severity, studentId, sessionId, classId, description]
    );
    return anomalyId;
  }

  async grantPermission(enrollmentId, sessionId, source = 'enrollment') {
    const enrollment = await this.getAsync(
      `SELECT * FROM class_enrollments WHERE id = ?`,
      [enrollmentId]
    );
    
    if (!enrollment) throw new Error('Enrollment not found');
    if (enrollment.status !== 'active') throw new Error('Enrollment is not active');

    const session = await this.getAsync(
      `SELECT * FROM live_sessions WHERE id = ?`,
      [sessionId]
    );
    
    if (!session) throw new Error('Session not found');

    const existingPerm = await this.getAsync(
      `SELECT * FROM replay_permissions 
       WHERE student_id = ? AND session_id = ? AND enrollment_id = ?`,
      [enrollment.student_id, sessionId, enrollmentId]
    );

    if (existingPerm) {
      if (existingPerm.status === 'active') {
        return { permission: existingPerm, isNew: false };
      } else {
        await this.runAsync(
          `UPDATE replay_permissions 
           SET status = 'active', revoked_at = NULL, revoke_reason = NULL, granted_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [existingPerm.id]
        );
        await this.recordEvent('permission_reinstated', 'replay_permission', existingPerm.id,
          `恢复回放权限: 学生 ${enrollment.student_id} 场次 ${session.title}`);
        const updatedPerm = await this.getAsync(`SELECT * FROM replay_permissions WHERE id = ?`, [existingPerm.id]);
        return { permission: updatedPerm, isNew: false };
      }
    }

    const permId = uuidv4();
    const expiresAt = session.replay_expiry_date || moment().add(180, 'days').format('YYYY-MM-DD');
    
    await this.runAsync(
      `INSERT INTO replay_permissions 
       (id, student_id, session_id, class_id, enrollment_id, granted_at, expires_at, status, source)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 'active', ?)`,
      [permId, enrollment.student_id, sessionId, enrollment.class_id, enrollmentId, expiresAt, source]
    );

    await this.recordEvent('permission_granted', 'replay_permission', permId,
      `授予回放权限: 学生 ${enrollment.student_id} 场次 ${session.title}`);

    const newPerm = await this.getAsync(`SELECT * FROM replay_permissions WHERE id = ?`, [permId]);
    return { permission: newPerm, isNew: true };
  }

  async revokePermission(permissionId, reason, operator = 'system') {
    const perm = await this.getAsync(
      `SELECT * FROM replay_permissions WHERE id = ?`,
      [permissionId]
    );
    
    if (!perm) throw new Error('Permission not found');
    if (perm.status === 'revoked') return perm;

    await this.runAsync(
      `UPDATE replay_permissions 
       SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP, revoke_reason = ?
       WHERE id = ?`,
      [reason, permissionId]
    );

    await this.recordEvent('permission_revoked', 'replay_permission', permissionId,
      `回收回放权限: ${reason}`, perm, { ...perm, status: 'revoked' }, operator);

    return await this.getAsync(`SELECT * FROM replay_permissions WHERE id = ?`, [permissionId]);
  }

  async processRefund(enrollmentId, operator = 'system') {
    const enrollment = await this.getAsync(
      `SELECT * FROM class_enrollments WHERE id = ?`,
      [enrollmentId]
    );
    
    if (!enrollment) throw new Error('Enrollment not found');
    if (enrollment.status === 'refunded') return { enrollment, permissionsRevoked: 0 };

    await this.runAsync(
      `UPDATE class_enrollments 
       SET status = 'refunded', refund_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [enrollmentId]
    );

    await this.recordEvent('enrollment_refunded', 'class_enrollment', enrollmentId,
      `学员退费: ${enrollment.student_id} 从班级 ${enrollment.class_id}`,
      enrollment, { ...enrollment, status: 'refunded' }, operator);

    const permissions = await this.allAsync(
      `SELECT * FROM replay_permissions 
       WHERE enrollment_id = ? AND status = 'active'`,
      [enrollmentId]
    );

    for (const perm of permissions) {
      await this.revokePermission(perm.id, '学员退费', operator);
    }

    return {
      enrollment: await this.getAsync(`SELECT * FROM class_enrollments WHERE id = ?`, [enrollmentId]),
      permissionsRevoked: permissions.length
    };
  }

  async transferStudent(enrollmentId, targetClassId, operator = 'system') {
    const enrollment = await this.getAsync(
      `SELECT * FROM class_enrollments WHERE id = ?`,
      [enrollmentId]
    );
    
    if (!enrollment) throw new Error('Enrollment not found');
    if (enrollment.class_id === targetClassId) throw new Error('Cannot transfer to same class');

    const targetClass = await this.getAsync(
      `SELECT * FROM classes WHERE id = ?`,
      [targetClassId]
    );
    
    if (!targetClass) throw new Error('Target class not found');

    const newEnrollmentId = uuidv4();
    await this.runAsync(
      `INSERT INTO class_enrollments 
       (id, class_id, student_id, enrollment_date, status, transfer_from_id)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'active', ?)`,
      [newEnrollmentId, targetClassId, enrollment.student_id, enrollmentId]
    );

    await this.runAsync(
      `UPDATE class_enrollments 
       SET transfer_to_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newEnrollmentId, enrollmentId]
    );

    await this.recordEvent('student_transferred', 'class_enrollment', enrollmentId,
      `学员转班: 从班级 ${enrollment.class_id} 转到 ${targetClassId}`,
      enrollment, { ...enrollment, transfer_to_id: newEnrollmentId }, operator);

    const targetSessions = await this.allAsync(
      `SELECT * FROM live_sessions WHERE class_id = ?`,
      [targetClassId]
    );

    for (const session of targetSessions) {
      await this.grantPermission(newEnrollmentId, session.id, 'transfer');
    }

    const oldPermissions = await this.allAsync(
      `SELECT * FROM replay_permissions 
       WHERE enrollment_id = ? AND status = 'active'`,
      [enrollmentId]
    );

    for (const perm of oldPermissions) {
      await this.revokePermission(perm.id, '学员转班', operator);
    }

    return {
      oldEnrollment: enrollment,
      newEnrollment: await this.getAsync(`SELECT * FROM class_enrollments WHERE id = ?`, [newEnrollmentId]),
      oldPermissionsRevoked: oldPermissions.length,
      newPermissionsGranted: targetSessions.length
    };
  }

  async checkAccess(studentId, accountIdentifier, sessionId) {
    const session = await this.getAsync(
      `SELECT * FROM live_sessions WHERE id = ?`,
      [sessionId]
    );
    
    if (!session) {
      await this.logAccess(studentId, accountIdentifier, sessionId, 'denied', 'Session not found', 0);
      return { allowed: false, reason: 'Session not found' };
    }

    const enrollment = await this.getAsync(
      `SELECT * FROM class_enrollments 
       WHERE student_id = ? AND class_id = ? AND status = 'active'`,
      [studentId, session.class_id]
    );

    if (!enrollment) {
      const refundedEnrollment = await this.getAsync(
        `SELECT * FROM class_enrollments 
         WHERE student_id = ? AND class_id = ? AND status = 'refunded'`,
        [studentId, session.class_id]
      );
      
      if (refundedEnrollment) {
        await this.logAccess(studentId, accountIdentifier, sessionId, 'denied', 'Student has refunded', 0);
        await this.recordAnomaly('access_after_refund', 'high', studentId, sessionId, session.class_id,
          '退费学员尝试访问回放');
        return { allowed: false, reason: 'Student has refunded' };
      }
    }

    const permission = await this.getAsync(
      `SELECT * FROM replay_permissions 
       WHERE student_id = ? AND session_id = ? AND status = 'active'`,
      [studentId, sessionId]
    );

    if (!permission) {
      await this.logAccess(studentId, accountIdentifier, sessionId, 'denied', 'No permission', 0);
      return { allowed: false, reason: 'No permission' };
    }

    if (permission.expires_at && moment(permission.expires_at).isBefore(moment(), 'day')) {
      await this.logAccess(studentId, accountIdentifier, sessionId, 'denied', 'Permission expired', 0);
      await this.recordAnomaly('expired_access_attempt', 'medium', studentId, sessionId, session.class_id,
        '过期权限尝试访问');
      return { allowed: false, reason: 'Permission expired' };
    }

    await this.logAccess(studentId, accountIdentifier, sessionId, 'play', null, 1);
    return { allowed: true, permission, session };
  }

  async logAccess(studentId, accountIdentifier, sessionId, accessType, denyReason = null, wasAllowed = 1) {
    await this.runAsync(
      `INSERT INTO access_logs 
       (id, student_id, account_identifier, session_id, access_type, was_allowed, deny_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), studentId, accountIdentifier, sessionId, accessType, wasAllowed, denyReason]
    );
  }

  async detectAnomalies() {
    const anomalies = [];

    const refundedWithAccess = await this.allAsync(`
      SELECT DISTINCT p.student_id, p.session_id, p.class_id, s.name as student_name
      FROM replay_permissions p
      JOIN class_enrollments e ON p.enrollment_id = e.id
      JOIN students s ON p.student_id = s.id
      WHERE e.status = 'refunded' AND p.status = 'active'
    `);

    for (const item of refundedWithAccess) {
      const anomalyId = await this.recordAnomaly('permission_after_refund', 'high', 
        item.student_id, item.session_id, item.class_id,
        `退费学员 ${item.student_name} 仍有活跃回放权限`);
      anomalies.push({ id: anomalyId, type: 'permission_after_refund', ...item });
    }

    const expiredPermissions = await this.allAsync(`
      SELECT DISTINCT p.student_id, p.session_id, p.class_id, s.name as student_name, p.expires_at
      FROM replay_permissions p
      JOIN students s ON p.student_id = s.id
      WHERE p.status = 'active' AND p.expires_at < DATE('now')
    `);

    for (const item of expiredPermissions) {
      const anomalyId = await this.recordAnomaly('expired_permission_active', 'medium',
        item.student_id, item.session_id, item.class_id,
        `学员 ${item.student_name} 的回放权限已过期但仍标记为活跃`);
      anomalies.push({ id: anomalyId, type: 'expired_permission_active', ...item });
    }

    const duplicatePermissions = await this.allAsync(`
      SELECT student_id, session_id, COUNT(*) as count
      FROM replay_permissions
      WHERE status = 'active'
      GROUP BY student_id, session_id
      HAVING count > 1
    `);

    for (const item of duplicatePermissions) {
      const student = await this.getAsync(`SELECT name FROM students WHERE id = ?`, [item.student_id]);
      const anomalyId = await this.recordAnomaly('duplicate_permissions', 'medium',
        item.student_id, item.session_id, null,
        `学员 ${student?.name} 对同一场次有 ${item.count} 个活跃权限`);
      anomalies.push({ id: anomalyId, type: 'duplicate_permissions', ...item });
    }

    const multiAccountStudents = await this.allAsync(`
      SELECT student_id, COUNT(*) as account_count
      FROM student_accounts
      GROUP BY student_id
      HAVING account_count > 1
    `);

    for (const item of multiAccountStudents) {
      const student = await this.getAsync(`SELECT name FROM students WHERE id = ?`, [item.student_id]);
      const anomalyId = await this.recordAnomaly('multiple_accounts', 'low',
        item.student_id, null, null,
        `学员 ${student?.name} 绑定了 ${item.account_count} 个账号，需确认是否本人使用`);
      anomalies.push({ id: anomalyId, type: 'multiple_accounts', ...item });
    }

    return anomalies;
  }

  async resolveAnomaly(anomalyId, resolver, notes = '') {
    await this.runAsync(
      `UPDATE permission_anomalies 
       SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolver = ?, notes = ?
       WHERE id = ?`,
      [resolver, notes, anomalyId]
    );
    
    await this.recordEvent('anomaly_resolved', 'permission_anomaly', anomalyId,
      `异常已解决: ${notes}`, null, null, resolver);
  }
}

module.exports = PermissionService;

const { run, get, all, addHistory, checkExpired, STATUS, uuidv4 } = require('../utils/db');

const formatPermission = (row) => {
  if (!row) return null;
  return {
    ...row,
    permissions: row.permissions ? JSON.parse(row.permissions) : []
  };
};

const applyTempPermission = async (userId, packageId, reason, validFrom, validTo, appliedBy) => {
  const id = uuidv4();
  const now = Date.now();

  await run(
    `INSERT INTO temp_permissions 
     (id, user_id, permission_package_id, reason, status, valid_from, valid_to, applied_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, packageId, reason, STATUS.PENDING_CONFIRM, validFrom, validTo, appliedBy, now, now]
  );

  await addHistory(id, 'apply', null, STATUS.PENDING_CONFIRM, appliedBy, reason);

  return getTempPermissionDetail(id);
};

const confirmTempPermission = async (id, confirmedBy) => {
  const now = Date.now();
  const perm = await get('SELECT * FROM temp_permissions WHERE id = ?', [id]);

  if (!perm) throw new Error('权限申请不存在');
  if (perm.status !== STATUS.PENDING_CONFIRM) throw new Error('当前状态不允许确认');

  await run(
    `UPDATE temp_permissions 
     SET status = ?, confirmed_by = ?, confirmed_at = ?, updated_at = ?
     WHERE id = ?`,
    [STATUS.ACTIVE, confirmedBy, now, now, id]
  );

  await addHistory(id, 'confirm', STATUS.PENDING_CONFIRM, STATUS.ACTIVE, confirmedBy, '二次确认通过');

  return getTempPermissionDetail(id);
};

const revokeTempPermission = async (id, revokedBy, revokedReason) => {
  const now = Date.now();
  const perm = await get('SELECT * FROM temp_permissions WHERE id = ?', [id]);

  if (!perm) throw new Error('权限申请不存在');
  if (perm.status !== STATUS.ACTIVE) throw new Error('只有生效中的权限可以回收');

  await run(
    `UPDATE temp_permissions 
     SET status = ?, revoked_by = ?, revoked_at = ?, revoked_reason = ?, updated_at = ?
     WHERE id = ?`,
    [STATUS.REVOKED, revokedBy, now, revokedReason, now, id]
  );

  await addHistory(id, 'revoke', STATUS.ACTIVE, STATUS.REVOKED, revokedBy, revokedReason);

  return getTempPermissionDetail(id);
};

const getTempPermissionDetail = async (id) => {
  await checkExpired();
  
  const row = await get(
    `SELECT tp.*, u.name as user_name, u.username, u.department,
            pp.name as package_name, pp.code as package_code, pp.permissions
     FROM temp_permissions tp
     LEFT JOIN users u ON tp.user_id = u.id
     LEFT JOIN permission_packages pp ON tp.permission_package_id = pp.id
     WHERE tp.id = ?`,
    [id]
  );

  if (!row) return null;

  return {
    id: row.id,
    user: {
      id: row.user_id,
      username: row.username,
      name: row.user_name,
      department: row.department
    },
    permission_package: {
      id: row.permission_package_id,
      code: row.package_code,
      name: row.package_name,
      permissions: JSON.parse(row.permissions)
    },
    reason: row.reason,
    status: row.status,
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    applied_by: row.applied_by,
    confirmed_by: row.confirmed_by,
    confirmed_at: row.confirmed_at,
    revoked_by: row.revoked_by,
    revoked_at: row.revoked_at,
    revoked_reason: row.revoked_reason,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
};

const listTempPermissions = async (filters = {}) => {
  await checkExpired();

  let sql = `
    SELECT tp.*, u.name as user_name, u.username, u.department,
           pp.name as package_name, pp.code as package_code
    FROM temp_permissions tp
    LEFT JOIN users u ON tp.user_id = u.id
    LEFT JOIN permission_packages pp ON tp.permission_package_id = pp.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.user_id) {
    sql += ' AND tp.user_id = ?';
    params.push(filters.user_id);
  }
  if (filters.status) {
    sql += ' AND tp.status = ?';
    params.push(filters.status);
  }
  if (filters.package_id) {
    sql += ' AND tp.permission_package_id = ?';
    params.push(filters.package_id);
  }

  sql += ' ORDER BY tp.created_at DESC';

  const rows = await all(sql, params);

  return rows.map(row => ({
    id: row.id,
    user: {
      id: row.user_id,
      username: row.username,
      name: row.user_name,
      department: row.department
    },
    permission_package: {
      id: row.permission_package_id,
      code: row.package_code,
      name: row.package_name
    },
    reason: row.reason,
    status: row.status,
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    created_at: row.created_at
  }));
};

const getHistory = async (tempPermissionId) => {
  const rows = await all(
    `SELECT * FROM permission_history 
     WHERE temp_permission_id = ? 
     ORDER BY created_at DESC`,
    [tempPermissionId]
  );
  return rows;
};

const batchImport = async (records, operator) => {
  const results = {
    success: 0,
    failed: 0,
    total: records.length,
    details: []
  };

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    try {
      if (!record.user_id) throw new Error('缺少 user_id');
      if (!record.package_id) throw new Error('缺少 package_id');
      if (!record.reason) throw new Error('缺少 reason');
      if (!record.valid_from) throw new Error('缺少 valid_from');
      if (!record.valid_to) throw new Error('缺少 valid_to');

      const user = await get('SELECT id FROM users WHERE id = ?', [record.user_id]);
      if (!user) throw new Error('用户不存在');

      const pkg = await get('SELECT id FROM permission_packages WHERE id = ?', [record.package_id]);
      if (!pkg) throw new Error('权限包不存在');

      if (record.valid_from >= record.valid_to) throw new Error('生效时间必须早于失效时间');

      if (record.status === STATUS.EXPIRED) {
        throw new Error('权限已到期，刷新令牌后仍可访问，但不建议继续使用');
      }

      const perm = await applyTempPermission(
        record.user_id,
        record.package_id,
        record.reason,
        record.valid_from,
        record.valid_to,
        operator
      );

      results.success++;
      results.details.push({
        row: i + 1,
        success: true,
        id: perm.id,
        message: '创建成功'
      });
    } catch (error) {
      results.failed++;
      results.details.push({
        row: i + 1,
        success: false,
        error: error.message,
        record: record
      });
    }
  }

  return results;
};

const exportToCSV = async () => {
  const list = await listTempPermissions();
  return list.map(item => ({
    id: item.id,
    user_name: item.user.name,
    user_department: item.user.department,
    package_name: item.permission_package.name,
    reason: item.reason,
    status: item.status,
    valid_from: new Date(item.valid_from).toISOString(),
    valid_to: new Date(item.valid_to).toISOString(),
    created_at: new Date(item.created_at).toISOString()
  }));
};

const listUsers = async () => {
  const rows = await all('SELECT * FROM users ORDER BY created_at DESC');
  return rows;
};

const listPackages = async () => {
  const rows = await all('SELECT * FROM permission_packages ORDER BY created_at DESC');
  return rows.map(formatPermission);
};

module.exports = {
  applyTempPermission,
  confirmTempPermission,
  revokeTempPermission,
  getTempPermissionDetail,
  listTempPermissions,
  getHistory,
  batchImport,
  exportToCSV,
  listUsers,
  listPackages,
  STATUS
};

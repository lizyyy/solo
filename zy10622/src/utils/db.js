const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const STATUS = {
  PENDING_CONFIRM: 'pending_confirm',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked'
};

const promisify = (fn, ...args) => {
  return new Promise((resolve, reject) => {
    fn.call(db, ...args, function(err, result) {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

const run = (sql, params = []) => promisify(db.run, sql, params);
const get = (sql, params = []) => promisify(db.get, sql, params);
const all = (sql, params = []) => promisify(db.all, sql, params);

const addHistory = async (tempPermissionId, action, oldStatus, newStatus, operator, remark = null) => {
  const id = uuidv4();
  const now = Date.now();
  await run(
    'INSERT INTO permission_history (id, temp_permission_id, action, old_status, new_status, operator, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, tempPermissionId, action, oldStatus, newStatus, operator, remark, now]
  );
  return id;
};

const checkExpired = async () => {
  const now = Date.now();
  const expired = await all(
    `SELECT id FROM temp_permissions 
     WHERE status = ? AND valid_to < ?`,
    [STATUS.ACTIVE, now]
  );
  
  for (const perm of expired) {
    await run(
      'UPDATE temp_permissions SET status = ?, updated_at = ? WHERE id = ?',
      [STATUS.EXPIRED, now, perm.id]
    );
    await addHistory(perm.id, 'expire', STATUS.ACTIVE, STATUS.EXPIRED, 'system', '权限自动到期');
  }
  
  return expired.length;
};

module.exports = {
  run,
  get,
  all,
  addHistory,
  checkExpired,
  STATUS,
  uuidv4
};

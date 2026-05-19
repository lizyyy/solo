const db = require('../utils/database');
const { generateId, isEmpty } = require('../utils/common');

async function createBlacklistItem(data, batchId = null) {
  const blacklistId = data.blacklist_id || generateId('b');

  const sql = `
    INSERT INTO blacklist (
      blacklist_id, type, id_number, name, reason,
      level, status, effective_date, expiry_date, import_batch_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await db.run(sql, [
    blacklistId,
    data.type,
    data.id_number,
    data.name || null,
    data.reason,
    data.level || 'normal',
    data.status || 'active',
    data.effective_date || null,
    data.expiry_date || null,
    batchId
  ]);

  return await getBlacklistByBlacklistId(blacklistId);
}

async function getBlacklistByBlacklistId(blacklistId) {
  return await db.get(
    `SELECT * FROM blacklist WHERE blacklist_id = ?`,
    [blacklistId]
  );
}

async function getBlacklistById(id) {
  return await db.get(
    `SELECT * FROM blacklist WHERE id = ?`,
    [id]
  );
}

async function getBlacklist(filters = {}, page = 1, pageSize = 20) {
  let sql = `SELECT * FROM blacklist WHERE 1=1`;
  const params = [];
  const countParams = [];

  if (filters.type) {
    sql += ` AND type = ?`;
    params.push(filters.type);
    countParams.push(filters.type);
  }

  if (filters.id_number) {
    sql += ` AND id_number LIKE ?`;
    const likePattern = `%${filters.id_number}%`;
    params.push(likePattern);
    countParams.push(likePattern);
  }

  if (filters.name) {
    sql += ` AND name LIKE ?`;
    const likePattern = `%${filters.name}%`;
    params.push(likePattern);
    countParams.push(likePattern);
  }

  if (filters.status) {
    sql += ` AND status = ?`;
    params.push(filters.status);
    countParams.push(filters.status);
  }

  if (filters.check_date) {
    sql += ` AND (effective_date IS NULL OR effective_date <= ?) 
              AND (expiry_date IS NULL OR expiry_date >= ?)`;
    params.push(filters.check_date, filters.check_date);
    countParams.push(filters.check_date, filters.check_date);
  }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countResult = await db.get(countSql, countParams);

  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(pageSize, (page - 1) * pageSize);

  const list = await db.all(sql, params);

  return {
    list,
    pagination: {
      page,
      pageSize,
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / pageSize)
    }
  };
}

async function updateBlacklist(id, data) {
  const fields = [];
  const values = [];

  const allowedFields = [
    'type', 'id_number', 'name', 'reason',
    'level', 'status', 'effective_date', 'expiry_date'
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(data[field]);
    }
  }

  if (fields.length === 0) {
    return await getBlacklistById(id);
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const sql = `UPDATE blacklist SET ${fields.join(', ')} WHERE id = ?`;
  await db.run(sql, values);

  return await getBlacklistById(id);
}

async function deleteBlacklist(id) {
  const result = await db.run(
    `DELETE FROM blacklist WHERE id = ?`,
    [id]
  );
  return result.changes > 0;
}

async function checkBlacklist(type, idNumber, checkDate = null) {
  let sql = `
    SELECT * FROM blacklist 
    WHERE type = ? AND id_number = ? AND status = 'active'
  `;
  const params = [type, idNumber];

  if (checkDate) {
    sql += ` AND (effective_date IS NULL OR effective_date <= ?) 
              AND (expiry_date IS NULL OR expiry_date >= ?)`;
    params.push(checkDate, checkDate);
  }

  sql += ` ORDER BY created_at DESC LIMIT 1`;

  return await db.get(sql, params);
}

function validateBlacklistData(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate || data.type !== undefined) {
    if (isEmpty(data.type)) {
      errors.push({ field: 'type', message: '黑名单类型不能为空' });
    } else if (!['person', 'vehicle', 'id_card'].includes(data.type)) {
      errors.push({ field: 'type', message: '黑名单类型必须是 person、vehicle 或 id_card' });
    }
  }

  if (!isUpdate || data.id_number !== undefined) {
    if (isEmpty(data.id_number)) {
      errors.push({ field: 'id_number', message: '标识号码不能为空' });
    }
  }

  if (!isUpdate || data.reason !== undefined) {
    if (isEmpty(data.reason)) {
      errors.push({ field: 'reason', message: '拉黑原因不能为空' });
    }
  }

  return errors;
}

module.exports = {
  createBlacklistItem,
  getBlacklistByBlacklistId,
  getBlacklistById,
  getBlacklist,
  updateBlacklist,
  deleteBlacklist,
  checkBlacklist,
  validateBlacklistData
};

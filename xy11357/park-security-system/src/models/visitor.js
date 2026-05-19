const db = require('../utils/database');
const { generateId, isEmpty, isValidPhone, isValidIdCard } = require('../utils/common');

async function createVisitor(data, batchId = null) {
  const visitorId = data.visitor_id || generateId('v');

  const sql = `
    INSERT INTO visitors (
      visitor_id, name, phone, id_card, company, visit_reason,
      visit_date, visit_time_start, visit_time_end, license_plate,
      host_name, host_dept, status, import_batch_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await db.run(sql, [
    visitorId,
    data.name,
    data.phone,
    data.id_card || null,
    data.company || null,
    data.visit_reason || null,
    data.visit_date,
    data.visit_time_start || null,
    data.visit_time_end || null,
    data.license_plate || null,
    data.host_name || null,
    data.host_dept || null,
    data.status || 'pending',
    batchId
  ]);

  return await getVisitorByVisitorId(visitorId);
}

async function getVisitorByVisitorId(visitorId) {
  return await db.get(
    `SELECT * FROM visitors WHERE visitor_id = ?`,
    [visitorId]
  );
}

async function getVisitorById(id) {
  return await db.get(
    `SELECT * FROM visitors WHERE id = ?`,
    [id]
  );
}

async function getVisitors(filters = {}, page = 1, pageSize = 20) {
  let sql = `SELECT * FROM visitors WHERE 1=1`;
  const params = [];
  const countParams = [];

  if (filters.name) {
    sql += ` AND name LIKE ?`;
    const likePattern = `%${filters.name}%`;
    params.push(likePattern);
    countParams.push(likePattern);
  }

  if (filters.phone) {
    sql += ` AND phone LIKE ?`;
    const likePattern = `%${filters.phone}%`;
    params.push(likePattern);
    countParams.push(likePattern);
  }

  if (filters.visit_date) {
    sql += ` AND visit_date = ?`;
    params.push(filters.visit_date);
    countParams.push(filters.visit_date);
  }

  if (filters.status) {
    sql += ` AND status = ?`;
    params.push(filters.status);
    countParams.push(filters.status);
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

async function updateVisitor(id, data) {
  const fields = [];
  const values = [];

  const allowedFields = [
    'name', 'phone', 'id_card', 'company', 'visit_reason',
    'visit_date', 'visit_time_start', 'visit_time_end',
    'license_plate', 'host_name', 'host_dept', 'status'
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(data[field]);
    }
  }

  if (fields.length === 0) {
    return await getVisitorById(id);
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const sql = `UPDATE visitors SET ${fields.join(', ')} WHERE id = ?`;
  await db.run(sql, values);

  return await getVisitorById(id);
}

async function deleteVisitor(id) {
  const result = await db.run(
    `DELETE FROM visitors WHERE id = ?`,
    [id]
  );
  return result.changes > 0;
}

async function getVisitorsByIdCardOrPhone(idCard = null, phone = null) {
  let sql = `SELECT * FROM visitors WHERE 1=1`;
  const params = [];

  if (idCard) {
    sql += ` AND id_card = ?`;
    params.push(idCard);
  }

  if (phone) {
    if (idCard) {
      sql += ` OR phone = ?`;
    } else {
      sql += ` AND phone = ?`;
    }
    params.push(phone);
  }

  sql += ` AND status IN ('pending', 'approved') ORDER BY created_at DESC`;

  return await db.all(sql, params);
}

function validateVisitorData(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate || data.name !== undefined) {
    if (isEmpty(data.name)) {
      errors.push({ field: 'name', message: '访客姓名不能为空' });
    }
  }

  if (!isUpdate || data.phone !== undefined) {
    if (isEmpty(data.phone)) {
      errors.push({ field: 'phone', message: '手机号不能为空' });
    } else if (!isValidPhone(data.phone)) {
      errors.push({ field: 'phone', message: '手机号格式不正确' });
    }
  }

  if (!isUpdate || data.visit_date !== undefined) {
    if (isEmpty(data.visit_date)) {
      errors.push({ field: 'visit_date', message: '访问日期不能为空' });
    }
  }

  if (data.id_card !== undefined && !isEmpty(data.id_card)) {
    if (!isValidIdCard(data.id_card)) {
      errors.push({ field: 'id_card', message: '身份证号格式不正确' });
    }
  }

  return errors;
}

module.exports = {
  createVisitor,
  getVisitorByVisitorId,
  getVisitorById,
  getVisitors,
  updateVisitor,
  deleteVisitor,
  getVisitorsByIdCardOrPhone,
  validateVisitorData
};

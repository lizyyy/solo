const db = require('../utils/database');
const { generateId, isEmpty, isValidLicensePlate } = require('../utils/common');

async function createLicensePlate(data, batchId = null) {
  const plateId = data.plate_id || generateId('p');

  const sql = `
    INSERT INTO license_plates (
      plate_id, plate_number, owner_name, owner_phone,
      valid_start_date, valid_end_date, vehicle_type,
      visit_reason, status, import_batch_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await db.run(sql, [
    plateId,
    data.plate_number,
    data.owner_name || null,
    data.owner_phone || null,
    data.valid_start_date,
    data.valid_end_date,
    data.vehicle_type || null,
    data.visit_reason || null,
    data.status || 'active',
    batchId
  ]);

  return await getLicensePlateByPlateId(plateId);
}

async function getLicensePlateByPlateId(plateId) {
  return await db.get(
    `SELECT * FROM license_plates WHERE plate_id = ?`,
    [plateId]
  );
}

async function getLicensePlateById(id) {
  return await db.get(
    `SELECT * FROM license_plates WHERE id = ?`,
    [id]
  );
}

async function getLicensePlates(filters = {}, page = 1, pageSize = 20) {
  let sql = `SELECT * FROM license_plates WHERE 1=1`;
  const params = [];
  const countParams = [];

  if (filters.plate_number) {
    sql += ` AND plate_number LIKE ?`;
    const likePattern = `%${filters.plate_number}%`;
    params.push(likePattern);
    countParams.push(likePattern);
  }

  if (filters.owner_name) {
    sql += ` AND owner_name LIKE ?`;
    const likePattern = `%${filters.owner_name}%`;
    params.push(likePattern);
    countParams.push(likePattern);
  }

  if (filters.status) {
    sql += ` AND status = ?`;
    params.push(filters.status);
    countParams.push(filters.status);
  }

  if (filters.valid_date) {
    sql += ` AND valid_start_date <= ? AND valid_end_date >= ?`;
    params.push(filters.valid_date, filters.valid_date);
    countParams.push(filters.valid_date, filters.valid_date);
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

async function updateLicensePlate(id, data) {
  const fields = [];
  const values = [];

  const allowedFields = [
    'plate_number', 'owner_name', 'owner_phone',
    'valid_start_date', 'valid_end_date', 'vehicle_type',
    'visit_reason', 'status'
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(data[field]);
    }
  }

  if (fields.length === 0) {
    return await getLicensePlateById(id);
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const sql = `UPDATE license_plates SET ${fields.join(', ')} WHERE id = ?`;
  await db.run(sql, values);

  return await getLicensePlateById(id);
}

async function deleteLicensePlate(id) {
  const result = await db.run(
    `DELETE FROM license_plates WHERE id = ?`,
    [id]
  );
  return result.changes > 0;
}

async function getLicensePlatesByPlateNumber(plateNumber) {
  return await db.all(
    `SELECT * FROM license_plates 
     WHERE plate_number = ? AND status = 'active'
     ORDER BY created_at DESC`,
    [plateNumber]
  );
}

function validateLicensePlateData(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate || data.plate_number !== undefined) {
    if (isEmpty(data.plate_number)) {
      errors.push({ field: 'plate_number', message: '车牌号码不能为空' });
    }
  }

  if (!isUpdate || data.valid_start_date !== undefined) {
    if (isEmpty(data.valid_start_date)) {
      errors.push({ field: 'valid_start_date', message: '有效开始日期不能为空' });
    }
  }

  if (!isUpdate || data.valid_end_date !== undefined) {
    if (isEmpty(data.valid_end_date)) {
      errors.push({ field: 'valid_end_date', message: '有效结束日期不能为空' });
    }
  }

  return errors;
}

module.exports = {
  createLicensePlate,
  getLicensePlateByPlateId,
  getLicensePlateById,
  getLicensePlates,
  updateLicensePlate,
  deleteLicensePlate,
  getLicensePlatesByPlateNumber,
  validateLicensePlateData
};

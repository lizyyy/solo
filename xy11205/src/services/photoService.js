const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDatabase } = require('../models/database');
const { logAction } = require('./auditService');
const {
  validateRole,
  validateOperator,
  VALID_PHOTO_TYPES
} = require('../utils/validator');

function createPhotoRecord(data, operator, role) {
  const db = getDatabase();
  
  const roleValidation = validateRole(role);
  const operatorValidation = validateOperator(operator);
  
  if (!roleValidation.valid || !operatorValidation.valid) {
    throw new Error('角色或操作人校验失败');
  }
  
  if (!VALID_PHOTO_TYPES.includes(data.photo_type)) {
    throw new Error(`无效照片类型。有效类型: ${VALID_PHOTO_TYPES.join(', ')}`);
  }
  
  if (!data.photo_path || data.photo_path.trim().length === 0) {
    throw new Error('照片路径不能为空');
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const id = uuidv4();
  
  const stmt = db.prepare(`
    INSERT INTO photos (
      id, arrival_order_id, photo_path, photo_type,
      upload_time, uploaded_by, created_at, operator, role
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    data.arrival_order_id,
    data.photo_path.trim(),
    data.photo_type,
    data.upload_time || now,
    data.uploaded_by.trim(),
    now,
    operator,
    role
  );
  
  logAction('create', 'photos', id, null, data, operator, role);
  
  return getPhotoRecordById(id);
}

function getPhotoRecordById(id) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM photos WHERE id = ?');
  return stmt.get(id);
}

function getPhotosByOrderId(arrivalOrderId) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM photos WHERE arrival_order_id = ? ORDER BY upload_time');
  return stmt.all(arrivalOrderId);
}

function getAllPhotos(options = {}) {
  const db = getDatabase();
  let query = 'SELECT * FROM photos WHERE 1=1';
  const params = [];
  
  if (options.photo_type) {
    query += ' AND photo_type = ?';
    params.push(options.photo_type);
  }
  
  query += ' ORDER BY upload_time DESC';
  
  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  
  const stmt = db.prepare(query);
  return stmt.all(...params);
}

module.exports = {
  createPhotoRecord,
  getPhotoRecordById,
  getPhotosByOrderId,
  getAllPhotos
};

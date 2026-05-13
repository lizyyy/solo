const db = require('../database/init');
const OperationLogService = require('./OperationLogService');
const Joi = require('joi');

const addressSchema = Joi.object({
  customer_id: Joi.string().required(),
  customer_name: Joi.string().required(),
  phone: Joi.string().pattern(/^1[3-9]\d{9}$/).required(),
  address: Joi.string().min(5).required(),
  area_type: Joi.string().valid('residential', 'commercial', 'office').required(),
  bucket_capacity: Joi.number().integer().min(0).default(0)
});

class CustomerAddressService {
  static async create(data, operator, operatorName) {
    const { error, value } = addressSchema.validate(data);
    if (error) {
      throw new Error(error.details[0].message);
    }

    const existing = db.prepare(`
      SELECT id FROM customer_addresses 
      WHERE customer_id = ? AND phone = ? AND address = ?
    `).get(value.customer_id, value.phone, value.address);

    if (existing) {
      throw new Error('该客户地址已存在');
    }

    const stmt = db.prepare(`
      INSERT INTO customer_addresses 
      (customer_id, customer_name, phone, address, area_type, bucket_capacity, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      value.customer_id,
      value.customer_name,
      value.phone,
      value.address,
      value.area_type,
      value.bucket_capacity,
      operator
    );

    const newRecord = { id: result.lastInsertRowid, ...value };

    await OperationLogService.log(
      'CREATE',
      'customer_addresses',
      result.lastInsertRowid,
      null,
      null,
      newRecord,
      operator,
      operatorName,
      '创建客户地址'
    );

    return newRecord;
  }

  static async update(id, data, operator, operatorName) {
    const existing = db.prepare('SELECT * FROM customer_addresses WHERE id = ?').get(id);
    if (!existing) {
      throw new Error('客户地址不存在');
    }

    const beforeValues = { ...existing };

    const updateFields = [];
    const values = [];

    const allowedFields = ['customer_name', 'phone', 'address', 'area_type', 'bucket_capacity', 'is_active'];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (updateFields.length === 0) {
      return existing;
    }

    values.push(id);

    const stmt = db.prepare(`
      UPDATE customer_addresses 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(...values);

    const afterValues = db.prepare('SELECT * FROM customer_addresses WHERE id = ?').get(id);

    await OperationLogService.log(
      'UPDATE',
      'customer_addresses',
      id,
      null,
      beforeValues,
      afterValues,
      operator,
      operatorName,
      '更新客户地址'
    );

    return afterValues;
  }

  static getById(id) {
    return db.prepare('SELECT * FROM customer_addresses WHERE id = ?').get(id);
  }

  static list(filters = {}, page = 1, pageSize = 20) {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (filters.customer_id) {
      whereClause += ' AND customer_id = ?';
      params.push(filters.customer_id);
    }

    if (filters.keyword) {
      whereClause += ' AND (customer_name LIKE ? OR phone LIKE ? OR address LIKE ?)';
      const keyword = `%${filters.keyword}%`;
      params.push(keyword, keyword, keyword);
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM customer_addresses ${whereClause}`);
    const { total } = countStmt.get(...params);

    const offset = (page - 1) * pageSize;
    const list = db.prepare(`
      SELECT * FROM customer_addresses 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    return { list, total, page, pageSize };
  }
}

module.exports = CustomerAddressService;

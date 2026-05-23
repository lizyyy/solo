const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../config/database');
const processingRecordService = require('./processingRecordService');

class CustomerService {
  async createCustomer(data) {
    const id = uuidv4();
    
    try {
      await runAsync(
        `INSERT INTO customers (id, name, phone, address, requirements)
         VALUES (?, ?, ?, ?, ?)`,
        [id, data.name, data.phone, data.address, data.requirements]
      );

      await processingRecordService.createRecord(
        'create_customer',
        id,
        'customer',
        data,
        { success: true, customerId: id },
        'success',
        null,
        data.operator || 'system'
      );

      return await this.getCustomer(id);
    } catch (error) {
      await processingRecordService.createRecord(
        'create_customer',
        null,
        'customer',
        data,
        null,
        'failed',
        error.message,
        data.operator || 'system'
      );
      throw error;
    }
  }

  async getCustomer(id) {
    const customer = await getAsync('SELECT * FROM customers WHERE id = ?', [id]);
    return customer;
  }

  async getAllCustomers(filters = {}) {
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params = [];

    if (filters.name) {
      sql += ' AND name LIKE ?';
      params.push(`%${filters.name}%`);
    }
    if (filters.phone) {
      sql += ' AND phone = ?';
      params.push(filters.phone);
    }

    sql += ' ORDER BY created_at DESC';

    return await allAsync(sql, params);
  }

  async updateCustomer(id, data) {
    try {
      const fields = [];
      const values = [];

      if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
      if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
      if (data.address !== undefined) { fields.push('address = ?'); values.push(data.address); }
      if (data.requirements !== undefined) { fields.push('requirements = ?'); values.push(data.requirements); }
      
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      await runAsync(
        `UPDATE customers SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      await processingRecordService.createRecord(
        'update_customer',
        id,
        'customer',
        data,
        { success: true },
        'success',
        null,
        data.operator || 'system'
      );

      return await this.getCustomer(id);
    } catch (error) {
      await processingRecordService.createRecord(
        'update_customer',
        id,
        'customer',
        data,
        null,
        'failed',
        error.message,
        data.operator || 'system'
      );
      throw error;
    }
  }
}

module.exports = new CustomerService();

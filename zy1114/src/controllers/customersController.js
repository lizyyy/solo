const db = require('../config/database');
const { NotFoundError, ValidationError } = require('../utils/errors');

function getAllCustomers(req, res, next) {
  try {
    const { keyword } = req.query;
    let sql = 'SELECT * FROM customers';
    const params = [];
    
    if (keyword) {
      sql += ' WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?';
      const searchPattern = `%${keyword}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const customers = db.prepare(sql).all(...params);
    res.json({ success: true, data: customers });
  } catch (err) {
    next(err);
  }
}

function getCustomerById(req, res, next) {
  try {
    const { id } = req.params;
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    
    if (!customer) {
      throw new NotFoundError('客户不存在', 'customer');
    }
    
    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
}

function createCustomer(req, res, next) {
  try {
    const { name, phone, email, notes } = req.body;
    
    if (!name) {
      throw new ValidationError('缺少必填字段：name');
    }
    
    const stmt = db.prepare(`
      INSERT INTO customers (name, phone, email, notes)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      name,
      phone || null,
      email || null,
      notes || null
    );
    
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
}

function updateCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const { name, phone, email, notes } = req.body;
    
    const existingCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!existingCustomer) {
      throw new NotFoundError('客户不存在', 'customer');
    }
    
    const updateFields = [];
    const updateParams = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateParams.push(name);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateParams.push(phone);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateParams.push(email);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateParams.push(notes);
    }
    
    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateParams.push(id);
      
      const stmt = db.prepare(`
        UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?
      `);
      stmt.run(...updateParams);
    }
    
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
}

function deleteCustomer(req, res, next) {
  try {
    const { id } = req.params;
    
    const existingCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!existingCustomer) {
      throw new NotFoundError('客户不存在', 'customer');
    }
    
    const activeBookings = db.prepare(`
      SELECT id FROM bookings 
      WHERE customer_id = ? 
      AND status IN ('pending_confirmation', 'deposit_paid', 'checked_in', 'in_use', 'pending_settlement')
    `).all(id);
    
    if (activeBookings.length > 0) {
      throw new ValidationError('客户存在活跃预约，无法删除', 'customer');
    }
    
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    res.json({ success: true, message: '客户已删除' });
  } catch (err) {
    next(err);
  }
}

function getCustomerBookings(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.query;
    
    const existingCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!existingCustomer) {
      throw new NotFoundError('客户不存在', 'customer');
    }
    
    let sql = `
      SELECT b.*, r.name as room_name
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE b.customer_id = ?
    `;
    const params = [id];
    
    if (status) {
      sql += ' AND b.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY b.start_time DESC';
    
    const bookings = db.prepare(sql).all(...params);
    res.json({ success: true, data: bookings });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerBookings
};

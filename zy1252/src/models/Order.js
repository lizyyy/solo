const { run, get, all } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const OrderStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
};

class Order {
  static async create(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await run(`
      INSERT INTO orders (id, user_id, product_name, amount, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, data.user_id, data.product_name, data.amount, OrderStatus.PENDING, now, now]);
    
    return this.findById(id);
  }

  static async findById(id) {
    return get('SELECT * FROM orders WHERE id = ?', [id]);
  }

  static async findByUserId(userId) {
    return all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  }

  static async updateStatus(id, status) {
    const now = new Date().toISOString();
    await run(`UPDATE orders SET status = ?, updated_at = ? WHERE id = ?`, [status, now, id]);
    return this.findById(id);
  }

  static async list(options = {}) {
    const { limit = 20, offset = 0, status, userId } = options;
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    return all(query, params);
  }

  static async count(options = {}) {
    const { status, userId } = options;
    let query = 'SELECT COUNT(*) as total FROM orders WHERE 1=1';
    const params = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    
    const result = await get(query, params);
    return result.total;
  }
}

module.exports = { Order, OrderStatus };

const { run, get, all } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const TransactionStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  REFUNDED: 'refunded'
};

class PaymentTransaction {
  static async create(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await run(`
      INSERT INTO payment_transactions (
        id, order_id, amount, payment_method, status, 
        gateway_transaction_id, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id, 
      data.order_id, 
      data.amount, 
      data.payment_method || null,
      data.status || TransactionStatus.PENDING,
      data.gateway_transaction_id || null,
      now
    ]);
    
    return this.findById(id);
  }

  static async findById(id) {
    return get('SELECT * FROM payment_transactions WHERE id = ?', [id]);
  }

  static async findByOrderId(orderId) {
    return all('SELECT * FROM payment_transactions WHERE order_id = ? ORDER BY created_at DESC', [orderId]);
  }

  static async findByGatewayTransactionId(gatewayTransactionId) {
    return get('SELECT * FROM payment_transactions WHERE gateway_transaction_id = ?', [gatewayTransactionId]);
  }

  static async updateStatus(id, status, gatewayTransactionId = null) {
    const updateFields = ['status = ?'];
    const params = [status];
    
    if (gatewayTransactionId) {
      updateFields.push('gateway_transaction_id = ?');
      params.push(gatewayTransactionId);
    }
    
    params.push(id);
    
    await run(`UPDATE payment_transactions SET ${updateFields.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }

  static async list(options = {}) {
    const { limit = 20, offset = 0, status, orderId } = options;
    let query = 'SELECT * FROM payment_transactions WHERE 1=1';
    const params = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (orderId) {
      query += ' AND order_id = ?';
      params.push(orderId);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    return all(query, params);
  }

  static async count(options = {}) {
    const { status, orderId } = options;
    let query = 'SELECT COUNT(*) as total FROM payment_transactions WHERE 1=1';
    const params = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (orderId) {
      query += ' AND order_id = ?';
      params.push(orderId);
    }
    
    const result = await get(query, params);
    return result.total;
  }
}

module.exports = { PaymentTransaction, TransactionStatus };

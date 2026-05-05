const { run, get, all } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const CallbackType = {
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  REFUND_SUCCESS: 'refund_success',
  NOTIFY_ORDER: 'notify_order'
};

const CallbackStatus = {
  RECEIVED: 'received',
  PROCESSING: 'processing',
  PROCESSED: 'processed',
  DUPLICATE: 'duplicate',
  FAILED: 'failed'
};

class CallbackEvent {
  static async create(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await run(`
      INSERT INTO callback_events (
        id, order_id, transaction_id, callback_type, 
        callback_data, status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.order_id || null,
      data.transaction_id || null,
      data.callback_type,
      data.callback_data ? JSON.stringify(data.callback_data) : null,
      data.status || CallbackStatus.RECEIVED,
      now
    ]);
    
    return this.findById(id);
  }

  static async findById(id) {
    const result = await get('SELECT * FROM callback_events WHERE id = ?', [id]);
    return this.parseCallbackData(result);
  }

  static async findByOrderId(orderId) {
    const results = await all('SELECT * FROM callback_events WHERE order_id = ? ORDER BY created_at DESC', [orderId]);
    return results.map(r => this.parseCallbackData(r));
  }

  static async findByTransactionId(transactionId) {
    const results = await all('SELECT * FROM callback_events WHERE transaction_id = ? ORDER BY created_at DESC', [transactionId]);
    return results.map(r => this.parseCallbackData(r));
  }

  static async updateStatus(id, status) {
    const processedAt = status === CallbackStatus.PROCESSED || 
                        status === CallbackStatus.DUPLICATE ||
                        status === CallbackStatus.FAILED
      ? new Date().toISOString()
      : null;
    
    if (processedAt) {
      await run(`UPDATE callback_events SET status = ?, processed_at = ? WHERE id = ?`, [status, processedAt, id]);
    } else {
      await run(`UPDATE callback_events SET status = ? WHERE id = ?`, [status, id]);
    }
    
    return this.findById(id);
  }

  static parseCallbackData(event) {
    if (!event) return null;
    return {
      ...event,
      callback_data: event.callback_data ? JSON.parse(event.callback_data) : null
    };
  }

  static async list(options = {}) {
    const { limit = 20, offset = 0, status, callbackType, orderId } = options;
    let query = 'SELECT * FROM callback_events WHERE 1=1';
    const params = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (callbackType) {
      query += ' AND callback_type = ?';
      params.push(callbackType);
    }
    
    if (orderId) {
      query += ' AND order_id = ?';
      params.push(orderId);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const results = await all(query, params);
    return results.map(r => this.parseCallbackData(r));
  }

  static async count(options = {}) {
    const { status, callbackType, orderId } = options;
    let query = 'SELECT COUNT(*) as total FROM callback_events WHERE 1=1';
    const params = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (callbackType) {
      query += ' AND callback_type = ?';
      params.push(callbackType);
    }
    
    if (orderId) {
      query += ' AND order_id = ?';
      params.push(orderId);
    }
    
    const result = await get(query, params);
    return result.total;
  }

  static async getStatistics() {
    return all(`
      SELECT 
        callback_type,
        status,
        COUNT(*) as count
      FROM callback_events 
      GROUP BY callback_type, status
      ORDER BY count DESC
    `);
  }
}

module.exports = { CallbackEvent, CallbackType, CallbackStatus };

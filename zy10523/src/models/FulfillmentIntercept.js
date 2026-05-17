const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('./database');

const InterceptStatus = {
  INTERCEPTED: 'INTERCEPTED',
  BYPASSED: 'BYPASSED',
  FAILED: 'FAILED'
};

class FulfillmentIntercept {
  static async create(data) {
    const now = Date.now();
    const id = uuidv4();
    
    await run(`
      INSERT INTO fulfillment_intercepts (
        id, freeze_id, order_no, intercept_type, intercept_status,
        intercept_details, original_request, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.freezeId,
      data.orderNo,
      data.interceptType,
      data.interceptStatus || InterceptStatus.INTERCEPTED,
      data.interceptDetails || null,
      data.originalRequest ? JSON.stringify(data.originalRequest) : null,
      now
    ]);

    return this.findById(id);
  }

  static async findById(id) {
    return get('SELECT * FROM fulfillment_intercepts WHERE id = ?', [id]);
  }

  static async findByFreezeId(freezeId) {
    return all('SELECT * FROM fulfillment_intercepts WHERE freeze_id = ? ORDER BY created_at DESC', [freezeId]);
  }

  static async findByOrderNo(orderNo) {
    return all('SELECT * FROM fulfillment_intercepts WHERE order_no = ? ORDER BY created_at DESC', [orderNo]);
  }

  static async updateStatus(id, status, details = null) {
    const now = Date.now();
    const current = await this.findById(id);
    const newDetails = (current.intercept_details || '') + 
      (details ? `[${new Date(now).toISOString()}] ${details}\n` : '');
    
    await run(`
      UPDATE fulfillment_intercepts 
      SET intercept_status = ?, intercept_details = ?
      WHERE id = ?
    `, [status, newDetails, id]);

    return this.findById(id);
  }
}

module.exports = { FulfillmentIntercept, InterceptStatus };

const db = require('../database/init');
const OperationLogService = require('./OperationLogService');
const BucketValidationService = require('./BucketValidationService');
const BalanceService = require('./BalanceService');

class DeliveryService {
  static generateDeliveryNo() {
    const date = new Date();
    const dateStr = date.getFullYear().toString() + 
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    
    const lastDelivery = db.prepare(`
      SELECT delivery_no FROM delivery_signoffs 
      WHERE delivery_no LIKE ?
      ORDER BY delivery_no DESC LIMIT 1
    `).get(`D${dateStr}%`);

    let seq = 1;
    if (lastDelivery) {
      seq = parseInt(lastDelivery.delivery_no.slice(-4)) + 1;
    }

    return `D${dateStr}${seq.toString().padStart(4, '0')}`;
  }

  static async createDelivery(data, operator, operatorName) {
    const bucketCodes = data.bucket_codes.split(',').map(c => c.trim());
    
    const validation = await BucketValidationService.validateBucketsForDelivery(bucketCodes, operator, operatorName);
    
    if (!validation.allValid) {
      return {
        success: false,
        scene: 'RULE_BLOCKED',
        message: '桶编号校验不通过',
        details: validation.results
      };
    }

    const existingDelivery = db.prepare(`
      SELECT id FROM delivery_signoffs 
      WHERE customer_address_id = ? AND delivery_date = ? AND status != 'cancelled'
    `).get(data.customer_address_id, data.delivery_date);

    if (existingDelivery) {
      return {
        success: false,
        scene: 'DUPLICATE_SUBMIT',
        message: '该地址今日已有配送记录',
        details: { deliveryId: existingDelivery.id }
      };
    }

    const deliveryNo = this.generateDeliveryNo();
    const stmt = db.prepare(`
      INSERT INTO delivery_signoffs 
      (delivery_no, customer_address_id, bucket_codes, bucket_count, delivery_date,
       delivery_person, receiver_name, receiver_phone, remarks, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      deliveryNo,
      data.customer_address_id,
      data.bucket_codes,
      bucketCodes.length,
      data.delivery_date,
      data.delivery_person,
      data.receiver_name || null,
      data.receiver_phone || null,
      data.remarks || null,
      'confirmed',
      operator
    );

    const updateBucketStmt = db.prepare(`
      UPDATE buckets SET status = 'in_use', updated_at = CURRENT_TIMESTAMP
      WHERE bucket_code = ?
    `);

    for (const code of bucketCodes) {
      updateBucketStmt.run(code);
    }

    BalanceService.getBalance(data.customer_address_id);

    const newRecord = {
      id: result.lastInsertRowid,
      delivery_no: deliveryNo,
      ...data,
      bucket_count: bucketCodes.length,
      status: 'confirmed'
    };

    await OperationLogService.log(
      'CREATE',
      'delivery_signoffs',
      result.lastInsertRowid,
      deliveryNo,
      null,
      newRecord,
      operator,
      operatorName,
      '创建配送签收单'
    );

    return {
      success: true,
      scene: 'NORMAL_COMPLETE',
      message: '配送签收创建成功',
      data: newRecord
    };
  }

  static async getDelivery(deliveryNo) {
    return db.prepare('SELECT * FROM delivery_signoffs WHERE delivery_no = ?').get(deliveryNo);
  }

  static async listDeliveries(filters = {}, page = 1, pageSize = 20) {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (filters.customer_address_id) {
      whereClause += ' AND customer_address_id = ?';
      params.push(filters.customer_address_id);
    }

    if (filters.status) {
      whereClause += ' AND status = ?';
      params.push(filters.status);
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM delivery_signoffs ${whereClause}`);
    const { total } = countStmt.get(...params);

    const offset = (page - 1) * pageSize;
    const list = db.prepare(`
      SELECT ds.*, ca.customer_name, ca.address
      FROM delivery_signoffs ds
      LEFT JOIN customer_addresses ca ON ds.customer_address_id = ca.id
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    return { list, total, page, pageSize };
  }
}

module.exports = DeliveryService;

const db = require('../database/init');
const OperationLogService = require('./OperationLogService');
const BucketValidationService = require('./BucketValidationService');
const BalanceService = require('./BalanceService');

class BucketReturnService {
  static generateReturnNo() {
    const date = new Date();
    const dateStr = date.getFullYear().toString() + 
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    
    const lastReturn = db.prepare(`
      SELECT return_no FROM bucket_returns 
      WHERE return_no LIKE ?
      ORDER BY return_no DESC LIMIT 1
    `).get(`R${dateStr}%`);

    let seq = 1;
    if (lastReturn) {
      seq = parseInt(lastReturn.return_no.slice(-4)) + 1;
    }

    return `R${dateStr}${seq.toString().padStart(4, '0')}`;
  }

  static async createReturn(data, operator, operatorName) {
    const bucketCodes = data.bucket_codes.split(',').map(c => c.trim());
    
    const validation = await BucketValidationService.validateBucketsForReturn(
      bucketCodes, 
      data.delivery_no
    );
    
    if (!validation.allValid) {
      return {
        success: false,
        scene: 'RULE_BLOCKED',
        message: '退桶校验不通过',
        details: validation.results
      };
    }

    const existingReturn = db.prepare(`
      SELECT id FROM bucket_returns 
      WHERE delivery_no = ? AND status NOT IN ('rejected', 'completed')
    `).get(data.delivery_no);

    if (existingReturn) {
      return {
        success: false,
        scene: 'DUPLICATE_SUBMIT',
        message: '该配送单已有退桶申请',
        details: { returnId: existingReturn.id }
      };
    }

    const returnData = {
      ...data,
      bucket_count: bucketCodes.length
    };

    const rulesCheck = BucketValidationService.checkReturnInterceptionRules(returnData);
    
    if (rulesCheck.shouldBlock) {
      const returnNo = this.generateReturnNo();
      const stmt = db.prepare(`
        INSERT INTO bucket_returns 
        (return_no, delivery_no, customer_address_id, bucket_codes, bucket_count,
         return_date, collector_name, status, is_blocked, block_reason, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        returnNo,
        data.delivery_no,
        data.customer_address_id,
        data.bucket_codes,
        bucketCodes.length,
        data.return_date,
        data.collector_name,
        'reviewing',
        1,
        rulesCheck.rules.map(r => r.reason).join('; '),
        operator
      );

      const newRecord = {
        id: result.lastInsertRowid,
        return_no: returnNo,
        ...data,
        bucket_count: bucketCodes.length,
        status: 'reviewing',
        is_blocked: 1,
        block_reason: rulesCheck.rules.map(r => r.reason).join('; '),
        rules: rulesCheck.rules
      };

      await OperationLogService.log(
        'CREATE',
        'bucket_returns',
        result.lastInsertRowid,
        returnNo,
        null,
        newRecord,
        operator,
        operatorName,
        '退桶申请已被规则拦截，需要人工复核'
      );

      return {
        success: true,
        scene: 'MANUAL_REVIEW',
        message: '退桶申请已提交，需要人工复核',
        data: newRecord
      };
    }

    const returnNo = this.generateReturnNo();
    const stmt = db.prepare(`
      INSERT INTO bucket_returns 
      (return_no, delivery_no, customer_address_id, bucket_codes, bucket_count,
       return_date, collector_name, inspection_result, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      returnNo,
      data.delivery_no,
      data.customer_address_id,
      data.bucket_codes,
      bucketCodes.length,
      data.return_date,
      data.collector_name,
      'passed',
      'accepted',
      operator
    );

    const updateBucketStmt = db.prepare(`
      UPDATE buckets SET status = 'available', updated_at = CURRENT_TIMESTAMP
      WHERE bucket_code = ?
    `);

    for (const code of bucketCodes) {
      updateBucketStmt.run(code);
    }

    BalanceService.getBalance(data.customer_address_id);

    const newRecord = {
      id: result.lastInsertRowid,
      return_no: returnNo,
      ...data,
      bucket_count: bucketCodes.length,
      inspection_result: 'passed',
      status: 'accepted'
    };

    await OperationLogService.log(
      'CREATE',
      'bucket_returns',
      result.lastInsertRowid,
      returnNo,
      null,
      newRecord,
      operator,
      operatorName,
      '退桶申请已通过验收'
    );

    return {
      success: true,
      scene: 'NORMAL_COMPLETE',
      message: '退桶验收成功',
      data: newRecord
    };
  }

  static async reviewReturn(returnNo, action, operator, operatorName, remarks = '') {
    const returnRecord = db.prepare('SELECT * FROM bucket_returns WHERE return_no = ?').get(returnNo);
    
    if (!returnRecord) {
      throw new Error('退桶记录不存在');
    }

    if (returnRecord.status !== 'reviewing') {
      throw new Error('该记录不在待审核状态');
    }

    const beforeValues = { ...returnRecord };
    let afterValues;

    if (action === 'approve') {
      db.prepare(`
        UPDATE bucket_returns 
        SET status = 'accepted', inspection_result = 'passed', 
            reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
            inspection_remarks = ?, updated_at = CURRENT_TIMESTAMP
        WHERE return_no = ?
      `).run(operator, remarks, returnNo);

      const bucketCodes = returnRecord.bucket_codes.split(',');
      const updateBucketStmt = db.prepare(`
        UPDATE buckets SET status = 'available', updated_at = CURRENT_TIMESTAMP
        WHERE bucket_code = ?
      `);
      for (const code of bucketCodes) {
        updateBucketStmt.run(code);
      }

      BalanceService.getBalance(returnRecord.customer_address_id);

      afterValues = db.prepare('SELECT * FROM bucket_returns WHERE return_no = ?').get(returnNo);

      await OperationLogService.log(
        'REVIEW',
        'bucket_returns',
        returnRecord.id,
        returnNo,
        beforeValues,
        afterValues,
        operator,
        operatorName,
        '人工复核通过: ' + remarks
      );
    } else if (action === 'reject') {
      db.prepare(`
        UPDATE bucket_returns 
        SET status = 'rejected', reviewed_by = ?, 
            reviewed_at = CURRENT_TIMESTAMP, inspection_remarks = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE return_no = ?
      `).run(operator, remarks, returnNo);

      afterValues = db.prepare('SELECT * FROM bucket_returns WHERE return_no = ?').get(returnNo);

      await OperationLogService.log(
        'REVIEW',
        'bucket_returns',
        returnRecord.id,
        returnNo,
        beforeValues,
        afterValues,
        operator,
        operatorName,
        '人工复核驳回: ' + remarks
      );
    }

    return afterValues;
  }

  static async getReturn(returnNo) {
    return db.prepare('SELECT * FROM bucket_returns WHERE return_no = ?').get(returnNo);
  }

  static async listReturns(filters = {}, page = 1, pageSize = 20) {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (filters.customer_address_id) {
      whereClause += ' AND br.customer_address_id = ?';
      params.push(filters.customer_address_id);
    }

    if (filters.status) {
      whereClause += ' AND br.status = ?';
      params.push(filters.status);
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM bucket_returns br ${whereClause}`);
    const { total } = countStmt.get(...params);

    const offset = (page - 1) * pageSize;
    const list = db.prepare(`
      SELECT br.*, ca.customer_name, ca.address
      FROM bucket_returns br
      LEFT JOIN customer_addresses ca ON br.customer_address_id = ca.id
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    return { list, total, page, pageSize };
  }
}

module.exports = BucketReturnService;

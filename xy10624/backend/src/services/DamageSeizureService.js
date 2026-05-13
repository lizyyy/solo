const db = require('../database/init');
const OperationLogService = require('./OperationLogService');
const BalanceService = require('./BalanceService');

class DamageSeizureService {
  static generateSeizureNo() {
    const date = new Date();
    const dateStr = date.getFullYear().toString() + 
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    
    const lastSeizure = db.prepare(`
      SELECT seizure_no FROM damage_seizures 
      WHERE seizure_no LIKE ?
      ORDER BY seizure_no DESC LIMIT 1
    `).get(`S${dateStr}%`);

    let seq = 1;
    if (lastSeizure) {
      seq = parseInt(lastSeizure.seizure_no.slice(-4)) + 1;
    }

    return `S${dateStr}${seq.toString().padStart(4, '0')}`;
  }

  static async createSeizure(data, operator, operatorName) {
    const seizureNo = this.generateSeizureNo();
    const stmt = db.prepare(`
      INSERT INTO damage_seizures 
      (seizure_no, return_no, bucket_code, damage_type, damage_level,
       seizure_reason, is_compensable, compensation_amount, status, handled_by, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      seizureNo,
      data.return_no,
      data.bucket_code,
      data.damage_type,
      data.damage_level,
      data.seizure_reason || null,
      data.is_compensable !== undefined ? data.is_compensable : 1,
      data.compensation_amount || 50,
      'pending',
      operator,
      operator
    );

    const newRecord = {
      id: result.lastInsertRowid,
      seizure_no: seizureNo,
      ...data,
      status: 'pending'
    };

    await OperationLogService.log(
      'CREATE',
      'damage_seizures',
      result.lastInsertRowid,
      seizureNo,
      null,
      newRecord,
      operator,
      operatorName,
      '创建破损扣押记录'
    );

    return newRecord;
  }

  static async updateSeizure(seizureNo, data, operator, operatorName, changeReason = '') {
    const existing = db.prepare('SELECT * FROM damage_seizures WHERE seizure_no = ?').get(seizureNo);
    
    if (!existing) {
      throw new Error('扣押记录不存在');
    }

    const beforeValues = { ...existing };

    const updateFields = [];
    const values = [];

    const allowedFields = [
      'damage_type', 'damage_level', 'seizure_reason', 
      'is_compensable', 'compensation_amount', 'status'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (updateFields.length === 0) {
      return existing;
    }

    updateFields.push('previous_handler = ?');
    values.push(existing.handled_by);
    updateFields.push('handled_by = ?');
    values.push(operator);
    updateFields.push('change_reason = ?');
    values.push(changeReason);

    values.push(seizureNo);

    db.prepare(`
      UPDATE damage_seizures 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE seizure_no = ?
    `).run(...values);

    const afterValues = db.prepare('SELECT * FROM damage_seizures WHERE seizure_no = ?').get(seizureNo);

    if (data.status === 'confirmed') {
      db.prepare(`
        UPDATE buckets SET status = 'damaged', updated_at = CURRENT_TIMESTAMP
        WHERE bucket_code = ?
      `).run(existing.bucket_code);

      const returnRecord = db.prepare('SELECT * FROM bucket_returns WHERE return_no = ?').get(existing.return_no);
      if (returnRecord) {
        BalanceService.getBalance(returnRecord.customer_address_id);
      }
    }

    await OperationLogService.log(
      'UPDATE',
      'damage_seizures',
      existing.id,
      seizureNo,
      beforeValues,
      afterValues,
      operator,
      operatorName,
      '修改破损扣押记录: ' + changeReason
    );

    return afterValues;
  }

  static async getSeizure(seizureNo) {
    return db.prepare('SELECT * FROM damage_seizures WHERE seizure_no = ?').get(seizureNo);
  }

  static async listSeizures(filters = {}, page = 1, pageSize = 20) {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (filters.return_no) {
      whereClause += ' AND return_no = ?';
      params.push(filters.return_no);
    }

    if (filters.status) {
      whereClause += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.handled_by) {
      whereClause += ' AND handled_by = ?';
      params.push(filters.handled_by);
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM damage_seizures ${whereClause}`);
    const { total } = countStmt.get(...params);

    const offset = (page - 1) * pageSize;
    const list = db.prepare(`
      SELECT ds.*, br.return_date, ca.customer_name
      FROM damage_seizures ds
      LEFT JOIN bucket_returns br ON ds.return_no = br.return_no
      LEFT JOIN customer_addresses ca ON br.customer_address_id = ca.id
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    return { list, total, page, pageSize };
  }
}

module.exports = DamageSeizureService;

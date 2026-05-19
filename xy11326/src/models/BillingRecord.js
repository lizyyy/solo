const { runQuery, getOne, getAll } = require('../database/connection');

class BillingRecord {
  static async create(data) {
    const now = new Date().toISOString();
    
    const result = await runQuery(`
      INSERT INTO billing_records (
        workRecordId, hoursFee, acresFee, fuelFee, serviceFee,
        totalAmount, billingDate, status, remarks, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.workRecordId,
      data.hoursFee || 0,
      data.acresFee || 0,
      data.fuelFee || 0,
      data.serviceFee || 0,
      data.totalAmount,
      data.billingDate || new Date().toISOString().slice(0, 10),
      data.status || 'unpaid',
      data.remarks,
      now,
      now
    ]);
    
    return { id: result.id, ...data, createdAt: now, updatedAt: now };
  }

  static async findById(id) {
    return getOne(`
      SELECT br.*, wr.recordNo, o.name as operatorName, t.plateNumber as tractorPlate
      FROM billing_records br
      LEFT JOIN work_records wr ON br.workRecordId = wr.id
      LEFT JOIN operators o ON wr.operatorId = o.id
      LEFT JOIN tractors t ON wr.tractorId = t.id
      WHERE br.id = ?
    `, [id]);
  }

  static async findByWorkRecordId(workRecordId) {
    return getOne('SELECT * FROM billing_records WHERE workRecordId = ?', [workRecordId]);
  }

  static async findAll(filters = {}) {
    let sql = `
      SELECT br.*, wr.recordNo, o.name as operatorName, t.plateNumber as tractorPlate
      FROM billing_records br
      LEFT JOIN work_records wr ON br.workRecordId = wr.id
      LEFT JOIN operators o ON wr.operatorId = o.id
      LEFT JOIN tractors t ON wr.tractorId = t.id
      WHERE 1=1
    `;
    let params = [];
    
    if (filters.status) {
      sql += ' AND br.status = ?';
      params.push(filters.status);
    }
    if (filters.startDate) {
      sql += ' AND br.billingDate >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND br.billingDate <= ?';
      params.push(filters.endDate);
    }
    
    sql += ' ORDER BY br.billingDate DESC, br.createdAt DESC';
    return getAll(sql, params);
  }

  static async update(id, data) {
    const now = new Date().toISOString();
    
    const updates = [];
    const params = [];
    
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    if (data.remarks !== undefined) { updates.push('remarks = ?'); params.push(data.remarks); }
    
    updates.push('updatedAt = ?');
    params.push(now);
    params.push(id);
    
    await runQuery(`UPDATE billing_records SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }

  static async getSummary(filters = {}) {
    let sql = `
      SELECT 
        COUNT(*) as totalCount,
        SUM(totalAmount) as totalAmount,
        SUM(CASE WHEN status = 'paid' THEN totalAmount ELSE 0 END) as paidAmount,
        SUM(CASE WHEN status = 'unpaid' THEN totalAmount ELSE 0 END) as unpaidAmount
      FROM billing_records
      WHERE 1=1
    `;
    let params = [];
    
    if (filters.startDate) {
      sql += ' AND billingDate >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND billingDate <= ?';
      params.push(filters.endDate);
    }
    
    return getOne(sql, params);
  }
}

module.exports = BillingRecord;

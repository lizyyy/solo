const { runQuery, getOne, getAll } = require('../database/connection');

class WorkRecord {
  static generateRecordNo() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `WR${dateStr}${random}`;
  }

  static async create(data) {
    const now = new Date().toISOString();
    const recordNo = data.recordNo || this.generateRecordNo();
    
    const result = await runQuery(`
      INSERT INTO work_records (
        recordNo, operatorId, tractorId, workDate, workType, fieldName,
        hours, acres, fuelConsumption, remarks, status, importBatchNo,
        validationErrors, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      recordNo,
      data.operatorId,
      data.tractorId,
      data.workDate,
      data.workType,
      data.fieldName,
      data.hours,
      data.acres,
      data.fuelConsumption,
      data.remarks,
      data.status || 'pending',
      data.importBatchNo,
      data.validationErrors ? JSON.stringify(data.validationErrors) : null,
      now,
      now
    ]);
    
    return { id: result.id, recordNo, ...data, createdAt: now, updatedAt: now };
  }

  static async findById(id) {
    const row = await getOne(`
      SELECT wr.*, o.name as operatorName, t.plateNumber as tractorPlate
      FROM work_records wr
      LEFT JOIN operators o ON wr.operatorId = o.id
      LEFT JOIN tractors t ON wr.tractorId = t.id
      WHERE wr.id = ?
    `, [id]);
    
    if (row && row.validationErrors) {
      row.validationErrors = JSON.parse(row.validationErrors);
    }
    return row;
  }

  static async findByRecordNo(recordNo) {
    const row = await getOne(`
      SELECT wr.*, o.name as operatorName, t.plateNumber as tractorPlate
      FROM work_records wr
      LEFT JOIN operators o ON wr.operatorId = o.id
      LEFT JOIN tractors t ON wr.tractorId = t.id
      WHERE wr.recordNo = ?
    `, [recordNo]);
    
    if (row && row.validationErrors) {
      row.validationErrors = JSON.parse(row.validationErrors);
    }
    return row;
  }

  static async findAll(filters = {}) {
    let sql = `
      SELECT wr.*, o.name as operatorName, t.plateNumber as tractorPlate
      FROM work_records wr
      LEFT JOIN operators o ON wr.operatorId = o.id
      LEFT JOIN tractors t ON wr.tractorId = t.id
      WHERE 1=1
    `;
    let params = [];
    
    if (filters.status) {
      sql += ' AND wr.status = ?';
      params.push(filters.status);
    }
    if (filters.importBatchNo) {
      sql += ' AND wr.importBatchNo = ?';
      params.push(filters.importBatchNo);
    }
    if (filters.operatorId) {
      sql += ' AND wr.operatorId = ?';
      params.push(filters.operatorId);
    }
    if (filters.startDate) {
      sql += ' AND wr.workDate >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND wr.workDate <= ?';
      params.push(filters.endDate);
    }
    
    sql += ' ORDER BY wr.workDate DESC, wr.createdAt DESC';
    
    const rows = await getAll(sql, params);
    return rows.map(row => {
      if (row.validationErrors) {
        row.validationErrors = JSON.parse(row.validationErrors);
      }
      return row;
    });
  }

  static async update(id, data) {
    const now = new Date().toISOString();
    
    const updates = [];
    const params = [];
    
    if (data.operatorId !== undefined) { updates.push('operatorId = ?'); params.push(data.operatorId); }
    if (data.tractorId !== undefined) { updates.push('tractorId = ?'); params.push(data.tractorId); }
    if (data.workDate !== undefined) { updates.push('workDate = ?'); params.push(data.workDate); }
    if (data.workType !== undefined) { updates.push('workType = ?'); params.push(data.workType); }
    if (data.fieldName !== undefined) { updates.push('fieldName = ?'); params.push(data.fieldName); }
    if (data.hours !== undefined) { updates.push('hours = ?'); params.push(data.hours); }
    if (data.acres !== undefined) { updates.push('acres = ?'); params.push(data.acres); }
    if (data.fuelConsumption !== undefined) { updates.push('fuelConsumption = ?'); params.push(data.fuelConsumption); }
    if (data.remarks !== undefined) { updates.push('remarks = ?'); params.push(data.remarks); }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    if (data.validationErrors !== undefined) { 
      updates.push('validationErrors = ?'); 
      params.push(data.validationErrors ? JSON.stringify(data.validationErrors) : null); 
    }
    
    updates.push('updatedAt = ?');
    params.push(now);
    params.push(id);
    
    await runQuery(`UPDATE work_records SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }

  static async updateStatus(id, status) {
    const now = new Date().toISOString();
    await runQuery('UPDATE work_records SET status = ?, updatedAt = ? WHERE id = ?', [status, now, id]);
    return this.findById(id);
  }
}

module.exports = WorkRecord;

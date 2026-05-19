const { runQuery, getOne, getAll } = require('../database/connection');

class Tractor {
  static async create(data) {
    const now = new Date().toISOString();
    
    const result = await runQuery(`
      INSERT INTO tractors (plateNumber, model, type, horsepower, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      data.plateNumber,
      data.model,
      data.type,
      data.horsepower,
      data.status || 'active',
      now,
      now
    ]);
    
    return { id: result.id, ...data, createdAt: now, updatedAt: now };
  }

  static async findById(id) {
    return getOne('SELECT * FROM tractors WHERE id = ?', [id]);
  }

  static async findAll(status = null) {
    let sql = 'SELECT * FROM tractors';
    let params = [];
    
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY createdAt DESC';
    return getAll(sql, params);
  }

  static async findByPlateNumber(plateNumber) {
    return getOne('SELECT * FROM tractors WHERE plateNumber = ?', [plateNumber]);
  }

  static async update(id, data) {
    const now = new Date().toISOString();
    
    const updates = [];
    const params = [];
    
    if (data.plateNumber !== undefined) { updates.push('plateNumber = ?'); params.push(data.plateNumber); }
    if (data.model !== undefined) { updates.push('model = ?'); params.push(data.model); }
    if (data.type !== undefined) { updates.push('type = ?'); params.push(data.type); }
    if (data.horsepower !== undefined) { updates.push('horsepower = ?'); params.push(data.horsepower); }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    
    updates.push('updatedAt = ?');
    params.push(now);
    params.push(id);
    
    await runQuery(`UPDATE tractors SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }
}

module.exports = Tractor;

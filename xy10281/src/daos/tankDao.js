const db = require('../config/database');

class TankDao {
  static all() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM tanks', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM tanks WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static getByType(type) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM tanks WHERE type = ?', [type], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static create(data) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO tanks (id, name, type, capacity, water_ph, water_temperature, water_salinity, is_quarantine_ready)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.id,
          data.name,
          data.type,
          data.capacity,
          data.waterPh,
          data.waterTemperature,
          data.waterSalinity,
          data.isQuarantineReady ? 1 : 0
        ],
        function(err) {
          if (err) reject(err);
          else resolve(data);
        }
      );
    });
  }

  static update(id, updates) {
    const setClauses = [];
    const values = [];
    
    if (updates.name) { setClauses.push('name = ?'); values.push(updates.name); }
    if (updates.capacity !== undefined) { setClauses.push('capacity = ?'); values.push(updates.capacity); }
    if (updates.waterPh !== undefined) { setClauses.push('water_ph = ?'); values.push(updates.waterPh); }
    if (updates.waterTemperature !== undefined) { setClauses.push('water_temperature = ?'); values.push(updates.waterTemperature); }
    if (updates.waterSalinity !== undefined) { setClauses.push('water_salinity = ?'); values.push(updates.waterSalinity); }
    if (updates.waterQualityScore !== undefined) { setClauses.push('water_quality_score = ?'); values.push(updates.waterQualityScore); }
    if (updates.isQuarantineReady !== undefined) { setClauses.push('is_quarantine_ready = ?'); values.push(updates.isQuarantineReady ? 1 : 0); }
    
    if (setClauses.length === 0) {
      return Promise.resolve();
    }
    
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE tanks SET ${setClauses.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }

  static updateOccupancy(id, delta) {
    return new Promise((resolve, reject) => {
      db.get('SELECT current_occupancy, capacity FROM tanks WHERE id = ?', [id], (err, tank) => {
        if (err) return reject(err);
        if (!tank) return reject(new Error('Tank not found'));
        
        const newOccupancy = tank.current_occupancy + delta;
        if (newOccupancy < 0) {
          return reject(new Error('Occupancy cannot be negative'));
        }
        if (newOccupancy > tank.capacity) {
          return reject(new Error('Tank capacity exceeded'));
        }
        
        db.run(
          'UPDATE tanks SET current_occupancy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newOccupancy, id],
          function(err) {
            if (err) reject(err);
            else resolve({ oldOccupancy: tank.current_occupancy, newOccupancy, changes: this.changes });
          }
        );
      });
    });
  }

  static findAvailableQuarantineTanks(requiredType, waterParams = {}) {
    const params = [requiredType];
    let query = `
      SELECT * FROM tanks 
      WHERE type = ? AND (current_occupancy < capacity) AND is_quarantine_ready = 1
    `;
    
    if (waterParams.minPh !== undefined && waterParams.minPh !== null) {
      query += ' AND water_ph >= ?';
      params.push(waterParams.minPh);
    }
    if (waterParams.maxPh !== undefined && waterParams.maxPh !== null) {
      query += ' AND water_ph <= ?';
      params.push(waterParams.maxPh);
    }
    if (waterParams.minTemperature !== undefined && waterParams.minTemperature !== null) {
      query += ' AND water_temperature >= ?';
      params.push(waterParams.minTemperature);
    }
    if (waterParams.maxTemperature !== undefined && waterParams.maxTemperature !== null) {
      query += ' AND water_temperature <= ?';
      params.push(waterParams.maxTemperature);
    }
    if (waterParams.minQualityScore !== undefined && waterParams.minQualityScore !== null) {
      query += ' AND water_quality_score >= ?';
      params.push(waterParams.minQualityScore);
    }
    
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = TankDao;

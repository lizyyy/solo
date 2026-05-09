const db = require('../config/database');

class FishGroupDao {
  static all() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM fish_groups', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM fish_groups WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static create(id, species, speciesName, count, tankId = null) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO fish_groups (id, species, species_name, count, tank_id)
         VALUES (?, ?, ?, ?, ?)`,
        [id, species, speciesName, count, tankId],
        function(err) {
          if (err) reject(err);
          else resolve({ id, species, speciesName, count, tankId });
        }
      );
    });
  }

  static update(id, updates) {
    const setClauses = [];
    const values = [];
    
    if (updates.species) { setClauses.push('species = ?'); values.push(updates.species); }
    if (updates.speciesName) { setClauses.push('species_name = ?'); values.push(updates.speciesName); }
    if (updates.count !== undefined) { setClauses.push('count = ?'); values.push(updates.count); }
    if (updates.tankId !== undefined) { setClauses.push('tank_id = ?'); values.push(updates.tankId); }
    if (updates.healthStatus) { setClauses.push('health_status = ?'); values.push(updates.healthStatus); }
    if (updates.quarantineStatus) { setClauses.push('quarantine_status = ?'); values.push(updates.quarantineStatus); }
    
    if (setClauses.length === 0) {
      return Promise.resolve();
    }
    
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE fish_groups SET ${setClauses.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }
}

module.exports = FishGroupDao;

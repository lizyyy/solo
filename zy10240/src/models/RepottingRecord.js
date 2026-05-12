const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class RepottingRecord {
  static async create(data, requestId) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO repotting_records 
         (id, plant_id, location_id, maintenance_task_id, repot_date, old_pot_number, new_pot_number, reason, handled_by, notes, request_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.plant_id,
          data.location_id,
          data.maintenance_task_id,
          data.repot_date,
          data.old_pot_number,
          data.new_pot_number,
          data.reason,
          data.handled_by,
          data.notes,
          requestId
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...data });
        }
      );
    });
  }

  static async getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM repotting_records WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getByPlant(plantId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM repotting_records WHERE plant_id = ? ORDER BY repot_date DESC',
        [plantId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async getByLocation(locationId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM repotting_records WHERE location_id = ? ORDER BY repot_date DESC',
        [locationId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async getAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM repotting_records ORDER BY repot_date DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = RepottingRecord;
